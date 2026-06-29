from typing import Any, Callable

from shared.audio import compose_timeline, fit_to_slot
from shared.s3_upload import delete_prefix, download_object, upload_wav


def build_staging_prefix(job_id: str) -> str:
    return f"srt-staging/{job_id}/"


def staging_object_key(staging_prefix: str, index: int) -> str:
    return f"{staging_prefix}{index:04d}.wav"


def _validate_cue_text(cue: dict[str, Any]) -> str:
    text = cue.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("missing_cue_text")
    return text


def _validate_cue_timestamps(cue: dict[str, Any]) -> tuple[int, int]:
    start_ms = cue.get("start_ms")
    end_ms = cue.get("end_ms")
    if not isinstance(start_ms, int) or not isinstance(end_ms, int):
        raise ValueError("invalid_cue_timestamps")
    return start_ms, end_ms


def _resolve_max_speedup(fit: dict[str, Any]) -> float:
    max_speedup = fit.get("max_speedup", 2.0)
    if not isinstance(max_speedup, (int, float)):
        return 2.0
    return float(max_speedup)


def fit_cue(
    raw_wav: bytes,
    cue: dict[str, Any],
    fit: dict[str, Any],
) -> tuple[bytes, list[dict[str, Any]]]:
    start_ms, end_ms = _validate_cue_timestamps(cue)
    cue_index = cue.get("index")
    slot_ms = max(0, end_ms - start_ms)
    max_speedup = _resolve_max_speedup(fit)

    fitted, warnings = fit_to_slot(raw_wav, slot_ms, max_speedup)

    enriched_warnings: list[dict[str, Any]] = []
    for warning in warnings:
        enriched_warnings.append(
            {
                "cueIndex": cue_index,
                "code": warning.get("code", "overrun_after_clamp"),
                "message": warning.get("message", "Cue fit warning"),
            }
        )

    return fitted, enriched_warnings


def _update_progress(
    progress_dict: Any | None,
    progress_key: str | None,
    *,
    cues_done: int,
    cues_total: int,
    phase: str,
) -> None:
    if progress_dict is None or progress_key is None:
        return

    progress_dict[progress_key] = {
        "cuesDone": cues_done,
        "cuesTotal": cues_total,
        "phase": phase,
    }


def process_cue(
    synthesize_one: Callable[[str], bytes],
    cue: dict[str, Any],
    fit: dict[str, Any],
) -> tuple[bytes, list[dict[str, Any]]]:
    text = _validate_cue_text(cue)
    raw_wav = synthesize_one(text)
    return fit_cue(raw_wav, cue, fit)


def synthesize_cues_to_staging(
    synthesize_one: Callable[[str], bytes],
    cues: list[dict[str, Any]],
    staging_prefix: str,
    progress_key: str | None,
    progress_dict: Any | None,
    sample_rate: int,
    on_synthesis_complete: Callable[[], None] | None = None,
) -> dict[str, Any]:
    total = len(cues)

    _update_progress(
        progress_dict,
        progress_key,
        cues_done=0,
        cues_total=total,
        phase="synthesizing",
    )

    for index, cue in enumerate(cues):
        text = _validate_cue_text(cue)
        _validate_cue_timestamps(cue)
        raw_wav = synthesize_one(text)
        upload_wav(raw_wav, staging_object_key(staging_prefix, index))

        _update_progress(
            progress_dict,
            progress_key,
            cues_done=index + 1,
            cues_total=total,
            phase="synthesizing",
        )

    if on_synthesis_complete is not None:
        on_synthesis_complete()

    return {
        "sample_rate": sample_rate,
        "staging_prefix": staging_prefix,
        "cues_total": total,
    }


def postprocess_srt_from_staging(
    manifest: dict[str, Any],
    cues: list[dict[str, Any]],
    fit: dict[str, Any],
    output_filename: str,
    progress_key: str | None,
    progress_dict: Any | None,
) -> dict[str, Any]:
    staging_prefix = manifest.get("staging_prefix")
    sample_rate = manifest.get("sample_rate", 24_000)
    if not isinstance(staging_prefix, str) or not staging_prefix:
        raise ValueError("missing_staging_prefix")
    if not isinstance(sample_rate, int):
        sample_rate = 24_000

    total = len(cues)
    all_warnings: list[dict[str, Any]] = []

    _update_progress(
        progress_dict,
        progress_key,
        cues_done=total,
        cues_total=total,
        phase="postprocessing",
    )

    segments: list[tuple[int, bytes]] = []
    for index, cue in enumerate(cues):
        start_ms, _end_ms = _validate_cue_timestamps(cue)
        raw_wav = download_object(staging_object_key(staging_prefix, index))
        fitted, warnings = fit_cue(raw_wav, cue, fit)
        segments.append((start_ms, fitted))
        all_warnings.extend(warnings)

    total_duration_ms = 0
    for cue in cues:
        end_ms = cue.get("end_ms")
        if isinstance(end_ms, int):
            total_duration_ms = max(total_duration_ms, end_ms)

    final_wav = compose_timeline(segments, total_duration_ms, sample_rate)
    storage = upload_wav(final_wav, output_filename)
    delete_prefix(staging_prefix)

    return {
        "filename": storage["filename"],
        "byte_length": storage["byte_length"],
        "mime_type": storage["mime_type"],
        "warnings": all_warnings,
        "total_duration_ms": total_duration_ms,
    }
