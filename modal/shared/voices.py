import json
import os
from typing import Any

SHARED_VOICES_DIR = "/assets/voices/shared"


def _load_registry_file(registry_path: str) -> dict[str, Any]:
    if not os.path.exists(registry_path):
        return {}

    with open(registry_path, "r", encoding="utf-8") as file:
        data = json.load(file)

    if not isinstance(data, dict):
        return {}

    return data


def load_engine_registry(engine: str) -> dict[str, Any]:
    registry_path = f"/assets/voices/{engine}/registry.json"
    return _load_registry_file(registry_path)


def load_shared_registry() -> dict[str, Any]:
    registry_path = os.path.join(SHARED_VOICES_DIR, "registry.json")
    return _load_registry_file(registry_path)


def load_merged_voice_registry(engine: str) -> dict[str, Any]:
    shared_registry = load_shared_registry()
    engine_registry = load_engine_registry(engine)
    return {**shared_registry, **engine_registry}


def resolve_voice_audio_path(base_dir: str, voice_info: dict[str, Any]) -> str:
    return os.path.join(base_dir, voice_info["file"])


def resolve_voice(engine: str, voice_id: str) -> tuple[dict[str, Any], str]:
    engine_registry = load_engine_registry(engine)
    if voice_id in engine_registry:
        return engine_registry[voice_id], f"/assets/voices/{engine}"

    shared_registry = load_shared_registry()
    if voice_id in shared_registry:
        return shared_registry[voice_id], SHARED_VOICES_DIR

    raise ValueError(f"voice_not_found:{voice_id}")
