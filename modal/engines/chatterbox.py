import io

import modal

from app_instance import app
from shared.secrets import sonant_s3_secret
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
    .pip_install("chatterbox-tts>=0.1.4", "soundfile>=0.13.1", "boto3>=1.35.0")
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
    timeout=7200,
    enable_memory_snapshot=True,
    secrets=[sonant_s3_secret],
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
        from shared.chatterbox_guard import capture_t3_transformer_config

        print("Loading Chatterbox Multilingual V3 model into VRAM...")
        self.model = self.ChatterboxMultilingualTTS.from_pretrained(
            device="cuda",
        )
        (
            self._t3_baseline_output_attentions,
            self._t3_baseline_attn_impl,
        ) = capture_t3_transformer_config(self.model.t3)

    def _reset_t3_generation_state(self) -> None:
        from shared.chatterbox_guard import (
            clear_t3_generation_hooks,
            restore_t3_transformer_config,
        )

        clear_t3_generation_hooks(self.model.t3)
        restore_t3_transformer_config(
            self.model.t3,
            output_attentions=self._t3_baseline_output_attentions,
            attn_implementation=self._t3_baseline_attn_impl,
        )

    def _run_chatterbox_generate(
        self,
        text: str,
        language: str,
        audio_path: str,
    ):
        self._reset_t3_generation_state()
        try:
            with self.torch.inference_mode():
                return self.model.generate(
                    text,
                    language_id=language,
                    audio_prompt_path=audio_path,
                )
        finally:
            self._reset_t3_generation_state()

    def _generate_raw_wav(self, text: str, voice_id: str, language: str) -> bytes:
        import torchaudio as ta

        from shared.chatterbox_guard import (
            CHATTERBOX_MIN_TEXT_CHARS,
            prepare_chatterbox_text,
            trim_padded_generation,
        )

        voice_info, base_dir = resolve_voice("chatterbox", voice_id)
        audio_path = resolve_voice_audio_path(base_dir, voice_info)

        synthesis_text, was_padded = prepare_chatterbox_text(text)

        try:
            wav = self._run_chatterbox_generate(synthesis_text, language, audio_path)
        except IndexError:
            synthesis_text, was_padded = prepare_chatterbox_text(
                text,
                min_chars=CHATTERBOX_MIN_TEXT_CHARS + 10,
            )
            wav = self._run_chatterbox_generate(synthesis_text, language, audio_path)

        self.sample_rate = int(self.model.sr)
        buffer = io.BytesIO()
        ta.save(buffer, wav, self.model.sr, format="wav")
        raw_wav = buffer.getvalue()

        if was_padded:
            raw_wav = trim_padded_generation(raw_wav, text, synthesis_text)

        return raw_wav

    @modal.method()
    def synthesize(self, text: str, voice_id: str, language: str = "en") -> bytes:
        return self._generate_raw_wav(text, voice_id, language)

    @modal.method()
    def synthesize_cue(
        self,
        cue: dict,
        voice_id: str,
        language: str = "en",
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
        language: str = "en",
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
            getattr(self, "sample_rate", self.model.sr),
            on_synthesis_complete=release_gpu_memory,
        )
