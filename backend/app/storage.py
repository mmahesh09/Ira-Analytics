"""Visual Website Doctor screenshots: Neon Object Storage (S3-compatible) when configured, local disk otherwise.

Neon injects AWS-standard variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_ENDPOINT_URL_S3, AWS_REGION),
so boto3 reads credentials, endpoint and region from the environment; Neon requires path-style addressing.
Container disks are wiped on restart, so a bucket keeps report screenshots working on hosted deploys.
"""

import asyncio
import os
from functools import lru_cache
from pathlib import Path

from .config import settings

SHOTS_DIR = Path(__file__).resolve().parent.parent / "data" / "shots"
_PREFIX = "shots/"


def bucket_configured() -> bool:
    return bool(settings.shots_bucket and os.getenv("AWS_ACCESS_KEY_ID") and os.getenv("AWS_SECRET_ACCESS_KEY") and os.getenv("AWS_ENDPOINT_URL_S3"))


@lru_cache(maxsize=1)
def _client():
    import boto3
    from botocore.config import Config

    return boto3.client("s3", config=Config(s3={"addressing_style": "path"}, retries={"max_attempts": 3}))


def _put(name: str, data: bytes) -> None:
    _client().put_object(
        Bucket=settings.shots_bucket, Key=_PREFIX + name, Body=data, ContentType="image/jpeg",
        CacheControl="public, max-age=604800, immutable",
    )


def _get(name: str) -> bytes | None:
    client = _client()
    try:
        return client.get_object(Bucket=settings.shots_bucket, Key=_PREFIX + name)["Body"].read()
    except client.exceptions.NoSuchKey:
        return None


async def save_shot(name: str, data: bytes) -> None:
    if bucket_configured():
        await asyncio.to_thread(_put, name, data)
        return
    SHOTS_DIR.mkdir(parents=True, exist_ok=True)
    (SHOTS_DIR / name).write_bytes(data)


async def load_shot(name: str) -> bytes | None:
    if bucket_configured():
        return await asyncio.to_thread(_get, name)
    path = SHOTS_DIR / name
    return path.read_bytes() if path.is_file() else None
