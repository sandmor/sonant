import modal

from app_instance import app
from engines.chatterbox import ChatterboxTTS
from engines.qwen import QwenTTS
from shared.progress import srt_progress
from shared.secrets import sonant_s3_secret
from shared.srt_processing import (
    build_staging_prefix,
    postprocess_srt_from_staging,
)

ENGINE_MAP = {
    "qwen": QwenTTS,
    "chatterbox": ChatterboxTTS,
}

cpu_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("ffmpeg")
    .pip_install("boto3>=1.35.0", "soundfile>=0.13.1", "numpy<3")
    .add_local_python_source("app_instance")
    .add_local_python_source("shared")
    .add_local_python_source("engines")
)


@app.function(
    image=cpu_image,
    cpu=2,
    memory=2048,
    timeout=7200,
    secrets=[sonant_s3_secret],
)
def run_srt_job(
    engine: str,
    cues: list[dict],
    voice_id: str,
    language: str,
    fit: dict,
    job_id: str | None,
    output_filename: str,
) -> dict:
    if engine not in ENGINE_MAP:
        raise ValueError(f"unsupported_engine:{engine}")

    if not isinstance(output_filename, str) or not output_filename.strip():
        raise ValueError("missing_output_filename")

    progress_key = job_id if isinstance(job_id, str) and job_id.strip() else None
    staging_prefix = build_staging_prefix(progress_key or "unknown")

    engine_cls = ENGINE_MAP[engine]
    manifest = engine_cls().synthesize_cues_to_staging.remote(
        cues=cues,
        voice_id=voice_id,
        language=language,
        staging_prefix=staging_prefix,
        job_id=progress_key,
    )

    resolved_fit = fit if isinstance(fit, dict) else {"max_speedup": 2.0}

    return postprocess_srt_from_staging(
        manifest,
        cues,
        resolved_fit,
        output_filename.strip(),
        progress_key,
        srt_progress,
    )
