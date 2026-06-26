import io

import modal

from app_instance import app
from shared.voices import resolve_voice, resolve_voice_audio_path


chatterbox_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("sox", "libsox-dev", "libgomp1", "ffmpeg")
    .pip_install(
        "torch==2.6.0",
        "torchaudio==2.6.0",
        "numpy<3",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install("chatterbox-tts>=0.1.4", "soundfile>=0.13.1")
    .run_commands(
        "python -c \"from chatterbox.mtl_tts import ChatterboxMultilingualTTS; "
        "ChatterboxMultilingualTTS.from_pretrained(device='cpu')\""
    )
    .add_local_python_source("app_instance")
    .add_local_python_source("shared")
    .add_local_dir("./voices/shared", remote_path="/assets/voices/shared")
    .add_local_dir("./voices/chatterbox", remote_path="/assets/voices/chatterbox")
)


@app.cls(
    image=chatterbox_image,
    gpu="T4",
    scaledown_window=180,
    enable_memory_snapshot=True,
)
class ChatterboxTTS:
    @modal.enter(snap=True)
    def snapshot_imports(self) -> None:
        import torch
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS

        self.torch = torch
        self.ChatterboxMultilingualTTS = ChatterboxMultilingualTTS

    @modal.enter(snap=False)
    def load_model_to_gpu(self) -> None:
        print("Loading Chatterbox Multilingual V3 model into VRAM...")
        self.model = self.ChatterboxMultilingualTTS.from_pretrained(
            device="cuda",
        )

    @modal.method()
    def synthesize(self, text: str, voice_id: str, language: str = "en") -> bytes:
        import torchaudio as ta

        voice_info, base_dir = resolve_voice("chatterbox", voice_id)
        audio_path = resolve_voice_audio_path(base_dir, voice_info)

        wav = self.model.generate(
            text,
            language_id=language,
            audio_prompt_path=audio_path,
        )

        buffer = io.BytesIO()
        ta.save(buffer, wav, self.model.sr, format="wav")
        return buffer.getvalue()
