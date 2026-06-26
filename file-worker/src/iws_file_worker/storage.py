from __future__ import annotations

import io
from dataclasses import dataclass

import boto3
from botocore.config import Config

from .config import Settings


@dataclass
class ObjectBytes:
    body: bytes
    content_type: str | None


class ObjectStorage:
    def __init__(self, settings: Settings) -> None:
        self.bucket = settings.s3_project_files_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint,
            region_name=settings.s3_region,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"},
            ),
        )

    def get_bytes(self, key: str) -> ObjectBytes:
        res = self.client.get_object(Bucket=self.bucket, Key=key)
        body = res["Body"].read()
        return ObjectBytes(body=body, content_type=res.get("ContentType"))

    def put_bytes(self, key: str, body: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=io.BytesIO(body),
            ContentType=content_type,
        )
