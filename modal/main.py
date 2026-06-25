import modal
import json
import os

app = modal.App("qwen3-tts-api")

def download_model():
    from huggingface_hub import snapshot_download
    print("Downloading Qwen 1.7B weights into the container image...")
    snapshot_download("Qwen/Qwen3-TTS-12Hz-1.7B-Base")

flash_attn_url = (
    "https://github.com/Dao-AILab/flash-attention/releases/download/v2.7.4.post1/"
    "flash_attn-2.7.4.post1+cu12torch2.6cxx11abiFALSE-cp313-cp313-linux_x86_64.whl"
)

image = (
    modal.Image.debian_slim(python_version="3.13")
    .apt_install("sox", "libsox-dev", "libgomp1")
    .pip_install(
        "torch==2.6.0", 
        "torchaudio==2.6.0", 
        "numpy<3",
        index_url="https://download.pytorch.org/whl/cu124"
    )
    .pip_install_from_pyproject("pyproject.toml")
    .pip_install(flash_attn_url)
    .run_function(download_model)
    .add_local_dir("./voices", remote_path="/assets/voices")
)

@app.cls(image=image, gpu="L4", scaledown_window=180, enable_memory_snapshot=True)
class QwenTTS:
    @modal.enter(snap=True)
    def snapshot_imports(self):
        import torch
        from qwen_tts import Qwen3TTSModel
        
        self.torch = torch
        self.Qwen3TTSModel = Qwen3TTSModel
        
        registry_path = "/assets/voices/registry.json"
        with open(registry_path, "r") as f:
            self.voice_registry = json.load(f)

    @modal.enter(snap=False)
    def load_model_to_gpu(self):
        print("Loading Qwen3-TTS 1.7B Base model into VRAM from local disk...")
        self.model = self.Qwen3TTSModel.from_pretrained(
            "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            device_map="cuda:0",
            dtype=self.torch.bfloat16
        )

    @modal.fastapi_endpoint(method="POST")
    def generate(self, payload: dict): 
        import soundfile as sf
        import io
        from fastapi.responses import Response

        text = payload.get("text")
        voice_id = payload.get("voice_id")
        language = payload.get("language", "English") 

        if not text or not voice_id:
             return Response(content="Missing 'text' or 'voice_id' in payload", status_code=400)

        if voice_id not in self.voice_registry:
            return Response(content=f"Voice '{voice_id}' not found", status_code=400)

        voice_info = self.voice_registry[voice_id]
        audio_path = os.path.join("/assets/voices", voice_info["file"])
        ref_text = voice_info["ref_text"]

        audio_data, sample_rate = self.model.generate_voice_clone(
            text=text,
            language=language,
            ref_audio=audio_path,
            ref_text=ref_text
        )

        audio_array = audio_data[0].astype("float32")

        buffer = io.BytesIO()
        sf.write(buffer, audio_array, sample_rate, format="WAV")
        
        return Response(content=buffer.getvalue(), media_type="audio/wav")