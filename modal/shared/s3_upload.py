import os
from functools import lru_cache
from typing import Any

import boto3
from botocore.client import Config

MIME_WAV = "audio/wav"


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise ValueError(f"missing_s3_env:{name}")
    return value


def _force_path_style() -> bool:
    raw = os.environ.get("S3_FORCE_PATH_STYLE", "true").strip().lower()
    return raw != "false"


@lru_cache(maxsize=1)
def get_s3_client():
    endpoint = _require_env("S3_ENDPOINT")
    region = _require_env("S3_REGION")
    access_key = _require_env("S3_ACCESS_KEY_ID")
    secret_key = _require_env("S3_SECRET_ACCESS_KEY")

    config_kwargs: dict[str, Any] = {}
    if _force_path_style():
        config_kwargs["s3"] = {"addressing_style": "path"}

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=region,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(**config_kwargs) if config_kwargs else None,
    )


def _bucket() -> str:
    return _require_env("S3_BUCKET")


def upload_wav(wav_bytes: bytes, filename: str) -> dict[str, Any]:
    if not filename.strip():
        raise ValueError("missing_output_filename")

    client = get_s3_client()
    bucket = _bucket()

    client.put_object(
        Bucket=bucket,
        Key=filename,
        Body=wav_bytes,
        ContentType=MIME_WAV,
    )

    return {
        "filename": filename,
        "byte_length": len(wav_bytes),
        "mime_type": MIME_WAV,
    }


def download_object(filename: str) -> bytes:
    client = get_s3_client()
    response = client.get_object(Bucket=_bucket(), Key=filename)
    body = response.get("Body")
    if body is None:
        raise ValueError(f"missing_object_body:{filename}")
    return body.read()


def head_object(filename: str) -> dict[str, Any]:
    client = get_s3_client()
    response = client.head_object(Bucket=_bucket(), Key=filename)
    content_length = response.get("ContentLength")
    content_type = response.get("ContentType")

    return {
        "filename": filename,
        "byte_length": int(content_length) if isinstance(content_length, int) else 0,
        "mime_type": content_type if isinstance(content_type, str) else MIME_WAV,
    }


def delete_object(filename: str) -> None:
    client = get_s3_client()
    client.delete_object(Bucket=_bucket(), Key=filename)


def delete_prefix(prefix: str) -> None:
    if not prefix.strip():
        return

    client = get_s3_client()
    bucket = _bucket()
    continuation_token: str | None = None

    while True:
        list_kwargs: dict[str, Any] = {
            "Bucket": bucket,
            "Prefix": prefix,
        }
        if continuation_token:
            list_kwargs["ContinuationToken"] = continuation_token

        response = client.list_objects_v2(**list_kwargs)
        contents = response.get("Contents") or []

        if contents:
            client.delete_objects(
                Bucket=bucket,
                Delete={
                    "Objects": [{"Key": item["Key"]} for item in contents if "Key" in item],
                    "Quiet": True,
                },
            )

        if not response.get("IsTruncated"):
            break

        continuation_token = response.get("NextContinuationToken")
