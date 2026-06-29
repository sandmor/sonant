import io
import subprocess
import tempfile
from typing import Any


def _run_ffmpeg(args: list[str]) -> bytes:
    result = subprocess.run(
        args,
        check=True,
        capture_output=True,
    )
    return result.stdout


def wav_duration_ms(wav_bytes: bytes) -> int:
    with tempfile.NamedTemporaryFile(suffix=".wav") as input_file:
        input_file.write(wav_bytes)
        input_file.flush()

        probe = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                input_file.name,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        duration_sec = float(probe.stdout.strip())
        return int(round(duration_sec * 1_000))


def _atempo_filter_chain(factor: float) -> str:
    if factor <= 1.0:
        return "anull"

    filters: list[str] = []
    remaining = factor

    while remaining > 2.0:
        filters.append("atempo=2.0")
        remaining /= 2.0

    if remaining > 1.0:
        filters.append(f"atempo={remaining:.6f}")

    return ",".join(filters) if filters else "anull"


def compress_atempo(wav_bytes: bytes, factor: float) -> bytes:
    if factor <= 1.0:
        return wav_bytes

    filter_chain = _atempo_filter_chain(factor)

    with tempfile.NamedTemporaryFile(suffix=".wav") as input_file:
        input_file.write(wav_bytes)
        input_file.flush()

        with tempfile.NamedTemporaryFile(suffix=".wav") as output_file:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    input_file.name,
                    "-filter:a",
                    filter_chain,
                    output_file.name,
                ],
                check=True,
                capture_output=True,
            )
            output_file.seek(0)
            return output_file.read()


def trim_to(wav_bytes: bytes, max_ms: int) -> bytes:
    if max_ms <= 0:
        return wav_bytes

    current_ms = wav_duration_ms(wav_bytes)
    if current_ms <= max_ms:
        return wav_bytes

    with tempfile.NamedTemporaryFile(suffix=".wav") as input_file:
        input_file.write(wav_bytes)
        input_file.flush()

        with tempfile.NamedTemporaryFile(suffix=".wav") as output_file:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    input_file.name,
                    "-t",
                    f"{max_ms / 1_000:.6f}",
                    output_file.name,
                ],
                check=True,
                capture_output=True,
            )
            output_file.seek(0)
            return output_file.read()


def pad_to(wav_bytes: bytes, target_ms: int) -> bytes:
    current_ms = wav_duration_ms(wav_bytes)
    if current_ms >= target_ms:
        return wav_bytes

    pad_ms = target_ms - current_ms

    with tempfile.NamedTemporaryFile(suffix=".wav") as input_file:
        input_file.write(wav_bytes)
        input_file.flush()

        with tempfile.NamedTemporaryFile(suffix=".wav") as output_file:
            subprocess.run(
                [
                    "ffmpeg",
                    "-y",
                    "-i",
                    input_file.name,
                    "-af",
                    f"apad=pad_dur={pad_ms / 1_000:.6f}",
                    output_file.name,
                ],
                check=True,
                capture_output=True,
            )
            output_file.seek(0)
            return output_file.read()


def fit_to_slot(
    wav_bytes: bytes,
    slot_ms: int,
    max_speedup: float,
) -> tuple[bytes, list[dict[str, Any]]]:
    warnings: list[dict[str, Any]] = []
    if slot_ms <= 0:
        return wav_bytes, warnings

    duration_ms = wav_duration_ms(wav_bytes)

    if duration_ms > slot_ms:
        required_factor = duration_ms / slot_ms
        applied_factor = min(required_factor, max_speedup)
        fitted = compress_atempo(wav_bytes, applied_factor)
        fitted_ms = wav_duration_ms(fitted)

        if required_factor > max_speedup or fitted_ms > slot_ms:
            warnings.append(
                {
                    "code": "overrun_after_clamp",
                    "message": (
                        f"Audio still exceeds slot after clamping to {max_speedup}x "
                        f"({fitted_ms}ms > {slot_ms}ms)"
                    ),
                }
            )
            fitted = trim_to(fitted, slot_ms)
            fitted_ms = wav_duration_ms(fitted)

        if fitted_ms < slot_ms:
            fitted = pad_to(fitted, slot_ms)

        return fitted, warnings

    if duration_ms < slot_ms:
        return pad_to(wav_bytes, slot_ms), warnings

    return wav_bytes, warnings


def compose_timeline(
    segments: list[tuple[int, bytes]],
    total_duration_ms: int,
    sample_rate: int = 24_000,
) -> bytes:
    if not segments:
        buffer = io.BytesIO()
        import soundfile as sf
        import numpy as np

        silence = np.zeros(max(1, int(sample_rate * total_duration_ms / 1_000)), dtype="float32")
        sf.write(buffer, silence, sample_rate, format="WAV")
        return buffer.getvalue()

    with tempfile.TemporaryDirectory() as temp_dir:
        input_args: list[str] = []
        filter_parts: list[str] = []
        output_labels: list[str] = []

        for index, (start_ms, wav_bytes) in enumerate(segments):
            segment_path = f"{temp_dir}/segment_{index}.wav"
            with open(segment_path, "wb") as segment_file:
                segment_file.write(wav_bytes)

            input_args.extend(["-i", segment_path])
            delay_ms = max(0, start_ms)
            label = f"s{index}"
            filter_parts.append(
                f"[{index}:a]adelay={delay_ms}|{delay_ms}[{label}]"
            )
            output_labels.append(f"[{label}]")

        mix_inputs = "".join(output_labels)
        duration_sec = max(total_duration_ms / 1_000, 0.001)
        filter_complex = (
            ";".join(filter_parts)
            + f";{mix_inputs}amix=inputs={len(segments)}:duration=longest:dropout_transition=0:normalize=0,"
            + f"atrim=0:{duration_sec:.6f},apad=whole_dur={duration_sec:.6f}[out]"
        )

        output_path = f"{temp_dir}/output.wav"
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                *input_args,
                "-filter_complex",
                filter_complex,
                "-map",
                "[out]",
                "-ar",
                str(sample_rate),
                output_path,
            ],
            check=True,
            capture_output=True,
        )

        with open(output_path, "rb") as output_file:
            return output_file.read()
