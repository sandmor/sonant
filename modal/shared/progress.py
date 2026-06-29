import modal

from app_instance import app

srt_progress = modal.Dict.from_name("sonant-srt-progress", create_if_missing=True)
