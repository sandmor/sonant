import subprocess
import tempfile
from typing import Any

from shared.audio import wav_duration_ms

# Chatterbox alignment can fail below ~25 chars on sequential generate() calls.
CHATTERBOX_MIN_TEXT_CHARS = 30


def prepare_chatterbox_text(
    text: str,
    min_chars: int = CHATTERBOX_MIN_TEXT_CHARS,
) -> tuple[str, bool]:
    stripped = text.strip()
    if len(stripped) >= min_chars:
        return stripped, False

    parts = [stripped]
    separator = ". "
    while len(separator.join(parts)) < min_chars:
        parts.append(stripped)

    padded = separator.join(parts)
    if padded[-1] not in ".!?":
        padded += "."
    return padded, True


def capture_t3_transformer_config(t3: Any) -> tuple[bool, str | None]:
    tfmr = getattr(t3, "tfmr", None)
    if tfmr is None or not hasattr(tfmr, "config"):
        return False, None

    config = tfmr.config
    output_attentions = bool(getattr(config, "output_attentions", False))
    attn_implementation = getattr(config, "_attn_implementation", None)
    return output_attentions, attn_implementation


def clear_t3_generation_hooks(t3: Any) -> None:
    tfmr = getattr(t3, "tfmr", None)
    if tfmr is None:
        return

    layers = getattr(tfmr, "layers", None)
    if layers is None:
        return

    for layer in layers:
        self_attn = getattr(layer, "self_attn", None)
        if self_attn is None:
            continue

        forward_hooks = getattr(self_attn, "_forward_hooks", None)
        if forward_hooks is not None:
            forward_hooks.clear()


def restore_t3_transformer_config(
    t3: Any,
    *,
    output_attentions: bool,
    attn_implementation: str | None,
) -> None:
    tfmr = getattr(t3, "tfmr", None)
    if tfmr is None or not hasattr(tfmr, "config"):
        return

    config = tfmr.config
    if hasattr(config, "output_attentions"):
        config.output_attentions = output_attentions
    if attn_implementation is not None and hasattr(config, "_attn_implementation"):
        config._attn_implementation = attn_implementation


def trim_wav_to_ms(wav_bytes: bytes, max_ms: int) -> bytes:
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


def trim_padded_generation(
    wav_bytes: bytes,
    original_text: str,
    padded_text: str,
) -> bytes:
    original_len = len(original_text.strip())
    padded_len = len(padded_text.strip())
    if padded_len <= original_len:
        return wav_bytes

    ratio = original_len / padded_len
    duration_ms = wav_duration_ms(wav_bytes)
    keep_ms = max(1, int(duration_ms * ratio))
    return trim_wav_to_ms(wav_bytes, keep_ms)
