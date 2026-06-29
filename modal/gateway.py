from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
import modal

from engines.chatterbox import ChatterboxTTS
from engines.qwen import QwenTTS
from shared.progress import srt_progress

SRT_JOB_FUNCTION = modal.Function.from_name("sonant-tts", "run_srt_job")

SUPPORTED_ENGINES = {"qwen", "chatterbox"}
DEFAULT_LANGUAGE = {
    "qwen": "English",
    "chatterbox": "en",
}


def _resolve_language(engine: str, language: Any) -> str:
    return (
        language
        if isinstance(language, str) and language.strip()
        else DEFAULT_LANGUAGE[engine]
    )


def _get_engine_cls(engine: str):
    if engine == "qwen":
        return QwenTTS
    return ChatterboxTTS


def _validate_voice_and_cues(payload: dict[str, Any]) -> tuple[str, str, list[dict], dict] | JSONResponse:
    engine = payload.get("engine")
    voice_id = payload.get("voice_id")
    cues = payload.get("cues")
    fit = payload.get("fit")

    if engine not in SUPPORTED_ENGINES:
        return JSONResponse(
            content={"error": "unsupported_engine", "engine": engine},
            status_code=400,
        )

    if not isinstance(voice_id, str) or not voice_id.strip():
        return JSONResponse(content={"error": "missing_voice_id"}, status_code=400)

    if not isinstance(cues, list) or len(cues) == 0:
        return JSONResponse(content={"error": "missing_cues"}, status_code=400)

    resolved_fit = fit if isinstance(fit, dict) else {"max_speedup": 2.0, "mode": "compress_and_pad"}

    return engine, voice_id, cues, resolved_fit


def create_app() -> FastAPI:
    web_app = FastAPI(title="Sonant TTS Gateway")

    @web_app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @web_app.post("/synthesize")
    def synthesize(payload: dict[str, Any]) -> Response:
        engine = payload.get("engine")
        text = payload.get("text")
        voice_id = payload.get("voice_id")
        language = payload.get("language")

        if engine not in SUPPORTED_ENGINES:
            return JSONResponse(
                content={"error": "unsupported_engine", "engine": engine},
                status_code=400,
            )

        if not isinstance(text, str) or not text.strip():
            return JSONResponse(
                content={"error": "missing_text"},
                status_code=400,
            )

        if not isinstance(voice_id, str) or not voice_id.strip():
            return JSONResponse(
                content={"error": "missing_voice_id"},
                status_code=400,
            )

        resolved_language = _resolve_language(engine, language)

        try:
            if engine == "qwen":
                wav_bytes = QwenTTS().synthesize.remote(
                    text=text,
                    voice_id=voice_id,
                    language=resolved_language,
                )
            else:
                wav_bytes = ChatterboxTTS().synthesize.remote(
                    text=text,
                    voice_id=voice_id,
                    language=resolved_language,
                )
        except Exception as error:
            message = str(error)
            if "voice_not_found" in message:
                return JSONResponse(
                    content={
                        "error": "voice_not_found",
                        "voice_id": voice_id,
                    },
                    status_code=400,
                )
            return JSONResponse(
                content={"error": "synthesis_failed", "detail": str(error)},
                status_code=502,
            )

        if not wav_bytes:
            return JSONResponse(
                content={"error": "empty_audio"},
                status_code=502,
            )

        return Response(content=wav_bytes, media_type="audio/wav")

    @web_app.post("/synthesize-cue")
    def synthesize_cue(payload: dict[str, Any]) -> Response:
        engine = payload.get("engine")
        voice_id = payload.get("voice_id")
        cue = payload.get("cue")
        language = payload.get("language")
        fit = payload.get("fit")

        if engine not in SUPPORTED_ENGINES:
            return JSONResponse(
                content={"error": "unsupported_engine", "engine": engine},
                status_code=400,
            )

        if not isinstance(voice_id, str) or not voice_id.strip():
            return JSONResponse(content={"error": "missing_voice_id"}, status_code=400)

        if not isinstance(cue, dict):
            return JSONResponse(content={"error": "missing_cue"}, status_code=400)

        resolved_language = _resolve_language(engine, language)
        resolved_fit = fit if isinstance(fit, dict) else {"max_speedup": 2.0, "mode": "compress_and_pad"}
        engine_cls = _get_engine_cls(engine)

        try:
            wav_bytes = engine_cls().synthesize_cue.remote(
                cue=cue,
                voice_id=voice_id,
                language=resolved_language,
                fit=resolved_fit,
            )
        except Exception as error:
            message = str(error)
            if "voice_not_found" in message:
                return JSONResponse(
                    content={"error": "voice_not_found", "voice_id": voice_id},
                    status_code=400,
                )
            return JSONResponse(
                content={"error": "synthesis_failed", "detail": str(error)},
                status_code=502,
            )

        return Response(content=wav_bytes, media_type="audio/wav")

    @web_app.post("/synthesize-srt")
    def synthesize_srt(payload: dict[str, Any]) -> JSONResponse:
        validated = _validate_voice_and_cues(payload)
        if isinstance(validated, JSONResponse):
            return validated

        engine, voice_id, cues, resolved_fit = validated
        language = _resolve_language(engine, payload.get("language"))
        job_id = payload.get("job_id")
        output_filename = payload.get("output_filename")
        progress_key = job_id if isinstance(job_id, str) and job_id.strip() else None

        if not isinstance(output_filename, str) or not output_filename.strip():
            return JSONResponse(
                content={"error": "missing_output_filename"},
                status_code=400,
            )

        try:
            call = SRT_JOB_FUNCTION.spawn(
                engine=engine,
                cues=cues,
                voice_id=voice_id,
                language=language,
                fit=resolved_fit,
                job_id=progress_key,
                output_filename=output_filename.strip(),
            )
        except Exception as error:
            return JSONResponse(
                content={"error": "spawn_failed", "detail": str(error)},
                status_code=502,
            )

        return JSONResponse(
            content={
                "call_id": call.object_id,
                "cues_total": len(cues),
            },
            status_code=202,
        )

    @web_app.get("/srt-status")
    def srt_status(call_id: str, job_id: str | None = None) -> Response:
        if not call_id:
            return JSONResponse(content={"error": "missing_call_id"}, status_code=400)

        progress_key = job_id if isinstance(job_id, str) and job_id.strip() else call_id
        progress = srt_progress.get(progress_key, default={"cuesDone": 0, "cuesTotal": 0})

        function_call = modal.functions.FunctionCall.from_id(call_id)

        try:
            result = function_call.get(timeout=0)
        except TimeoutError:
            running_payload: dict[str, Any] = {
                "status": "running",
                "cuesDone": progress.get("cuesDone", 0),
                "cuesTotal": progress.get("cuesTotal", 0),
            }
            phase = progress.get("phase")
            if isinstance(phase, str) and phase:
                running_payload["phase"] = phase

            return JSONResponse(
                content=running_payload,
                status_code=200,
            )
        except Exception as error:
            return JSONResponse(
                content={
                    "status": "failed",
                    "error": str(error),
                    "cuesDone": progress.get("cuesDone", 0),
                    "cuesTotal": progress.get("cuesTotal", 0),
                },
                status_code=200,
            )

        if not isinstance(result, dict) or "filename" not in result:
            return JSONResponse(
                content={"status": "failed", "error": "invalid_worker_result"},
                status_code=200,
            )

        return JSONResponse(
            content={
                "status": "completed",
                "filename": result.get("filename"),
                "byte_length": result.get("byte_length", 0),
                "mime_type": result.get("mime_type", "audio/wav"),
                "warnings": result.get("warnings", []),
                "total_duration_ms": result.get("total_duration_ms", 0),
                "cuesDone": progress.get("cuesDone", 0),
                "cuesTotal": progress.get("cuesTotal", 0),
            },
            status_code=200,
        )

    return web_app
