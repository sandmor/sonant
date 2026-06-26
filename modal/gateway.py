from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response

from engines.chatterbox import ChatterboxTTS
from engines.qwen import QwenTTS

SUPPORTED_ENGINES = {"qwen", "chatterbox"}
DEFAULT_LANGUAGE = {
    "qwen": "English",
    "chatterbox": "en",
}


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

        resolved_language = (
            language
            if isinstance(language, str) and language.strip()
            else DEFAULT_LANGUAGE[engine]
        )

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

    return web_app
