import modal

from app_instance import app
from engines import chatterbox, qwen  # noqa: F401
from gateway import create_app

gateway_image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install("fastapi[standard]>=0.136.1", "modal>=1.4.2")
    .add_local_python_source("app_instance")
    .add_local_python_source("gateway")
    .add_local_python_source("engines")
    .add_local_python_source("shared")
)


@app.function(image=gateway_image, cpu=2)
@modal.asgi_app()
def gateway():
    return create_app()
