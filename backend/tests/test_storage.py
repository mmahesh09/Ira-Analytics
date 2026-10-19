"""Visual Doctor screenshots: Neon Object Storage when the AWS_* variables are set, local disk otherwise."""

import asyncio

import app.storage as storage

BUCKET_ENV = ("AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ENDPOINT_URL_S3")
NAME = "0123456789abcdef0123456789abcdef.jpg"


class FakeS3:
    class exceptions:
        class NoSuchKey(Exception):
            pass

    def __init__(self):
        self.objects = {}

    def put_object(self, Bucket, Key, Body, **_):
        self.objects[(Bucket, Key)] = Body

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise self.exceptions.NoSuchKey()
        body = self.objects[(Bucket, Key)]
        return {"Body": type("Body", (), {"read": lambda self: body})()}


def test_disk_fallback_without_bucket_credentials(monkeypatch, tmp_path):
    for var in BUCKET_ENV:
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setattr(storage, "SHOTS_DIR", tmp_path / "shots")
    assert not storage.bucket_configured()

    asyncio.run(storage.save_shot(NAME, b"jpeg-bytes"))
    assert (tmp_path / "shots" / NAME).read_bytes() == b"jpeg-bytes"
    assert asyncio.run(storage.load_shot(NAME)) == b"jpeg-bytes"
    assert asyncio.run(storage.load_shot("f" * 32 + ".jpg")) is None


def test_bucket_used_when_configured(monkeypatch, tmp_path):
    for var in BUCKET_ENV:
        monkeypatch.setenv(var, "x")
    fake = FakeS3()
    monkeypatch.setattr(storage, "_client", lambda: fake)
    monkeypatch.setattr(storage, "SHOTS_DIR", tmp_path / "shots")
    assert storage.bucket_configured()

    asyncio.run(storage.save_shot(NAME, b"jpeg-bytes"))
    assert fake.objects == {(storage.settings.shots_bucket, "shots/" + NAME): b"jpeg-bytes"}
    assert not (tmp_path / "shots").exists()
    assert asyncio.run(storage.load_shot(NAME)) == b"jpeg-bytes"
    assert asyncio.run(storage.load_shot("f" * 32 + ".jpg")) is None
