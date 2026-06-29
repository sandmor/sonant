import io

import modal

from app_instance import app
from shared.secrets import sonant_s3_secret
from shared.voices import resolve_voice, resolve_voice_audio_path

QWEN_MODEL_ID = "Qwen/Qwen3-TTS-12Hz-1.7B-Base"

FLASH_ATTN_URL = (
    "https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/"
    "flash_attn-2.7.4.post1+cu12torch2.6cxx11abiFALSE-cp313-cp313-linux_x86_64.whl"
)

qwen_image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("sox", "libsox-dev", "libgomp1", "ffmpeg")
    .pip_install(
        "torch==2.6.0",
        "torchaudio==2.6.0",
        "numpy<3",
        index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install_from_pyproject("pyproject.toml")
    .pip_install(FLASH_ATTN_URL, "boto3>=1.35.0")
    .run_commands(
        "python -c \"from huggingface_hub import snapshot_download; "
        f"snapshot_download('{QWEN_MODEL_ID}')\""
    )
    .add_local_python_source("app_instance")
    .add_local_python_source("shared")
    .add_local_dir("./voices/shared", remote_path="/assets/voices/shared")
    .add_local_dir("./voices/qwen", remote_path="/assets/voices/qwen")
)


@app.cls(
    image=qwen_image,
    gpu="L4",
    scaledown_window=180,
    timeout=7200,
    enable_memory_snapshot=True,
    secrets=[sonant_s3_secret],
)
class QwenTTS:
    @modal.enter(snap=True)
    def snapshot_imports(self) -> None:
        import torch
        from qwen_tts import Qwen3TTSModel

        self.torch = torch
        self.Qwen3TTSModel = Qwen3TTSModel

    @modal.enter(snap=False)
    def load_model_to_gpu(self) -> None:
        print("Loading Qwen3-TTS 1.7B Base model into VRAM from local disk...")
        self.model = self.Qwen3TTSModel.from_pretrained(
            QWEN_MODEL_ID,
            device_map="cuda:0",
            dtype=self.torch.bfloat16,
        )

    def _generate_raw_wav(self, text: str, voice_id: str, language: str) -> bytes:
        import soundfile as sf

        voice_info, base_dir = resolve_voice("qwen", voice_id)
        ref_text = voice_info.get("ref_text")

        if not isinstance(ref_text, str) or not ref_text.strip():
            raise ValueError(f"voice_missing_ref_text:{voice_id}")

        audio_path = resolve_voice_audio_path(base_dir, voice_info)

        with self.torch.inference_mode():
            audio_data, sample_rate = self.model.generate_voice_clone(
                text=text,
                language=language,
                ref_audio=audio_path,
                ref_text=ref_text,
            )

        audio_array = audio_data[0].astype("float32")
        self.sample_rate = int(sample_rate)
        buffer = io.BytesIO()
        sf.write(buffer, audio_array, sample_rate, format="WAV")
        return buffer.getvalue()

    @modal.method()
    def synthesize(self, text: str, voice_id: str, language: str = "English") -> bytes:
        return self._generate_raw_wav(text, voice_id, language)

    @modal.method()
    def synthesize_cue(
        self,
        cue: dict,
        voice_id: str,
        language: str = "English",
        fit: dict | None = None,
    ) -> bytes:
        from shared.srt_processing import process_cue

        resolved_fit = fit if isinstance(fit, dict) else {"max_speedup": 2.0}
        fitted, _warnings = process_cue(
            lambda text: self._generate_raw_wav(text, voice_id, language),
            cue,
            resolved_fit,
        )
        return fitted

    @modal.method()
    def synthesize_cues_to_staging(
        self,
        cues: list[dict],
        voice_id: str,
        language: str = "English",
        staging_prefix: str = "",
        job_id: str | None = None,
    ) -> dict:
        from shared.progress import srt_progress
        from shared.srt_processing import synthesize_cues_to_staging

        if not isinstance(staging_prefix, str) or not staging_prefix.strip():
            raise ValueError("missing_staging_prefix")

        def release_gpu_memory() -> None:
            if self.torch.cuda.is_available():
                self.torch.cuda.empty_cache()

        return synthesize_cues_to_staging(
            lambda text: self._generate_raw_wav(text, voice_id, language),
            cues,
            staging_prefix.strip(),
            job_id,
            srt_progress,
            getattr(self, "sample_rate", 24_000),
            on_synthesis_complete=release_gpu_memory,
        )
