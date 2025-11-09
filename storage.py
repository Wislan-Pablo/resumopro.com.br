import os
import mimetypes
from typing import List, Optional, Tuple

from google.cloud import storage
from fastapi import UploadFile, HTTPException
from starlette.responses import StreamingResponse, Response


def _get_bucket() -> storage.Bucket:
    bucket_name = os.getenv("UPLOADS_BUCKET") or os.getenv("GCS_BUCKET") or "resumopro-storage-bucket"
    try:
        client = storage.Client()
        return client.bucket(bucket_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha ao inicializar cliente do Cloud Storage: {e}")


def _guess_content_type(path: str) -> str:
    ctype, _ = mimetypes.guess_type(path)
    return ctype or "application/octet-stream"


async def upload_uploadfile(prefix: str, file: UploadFile, dest_name: Optional[str] = None) -> str:
    bucket = _get_bucket()
    name = dest_name or (file.filename or f"upload_{id(file)}")
    safe_name = name.replace("\\", "_").replace("/", "_")
    blob_path = f"{prefix.rstrip('/')}/{safe_name}"
    blob = bucket.blob(blob_path)
    try:
        # UploadFile.file pode ser um SpooledTemporaryFile; usar upload_from_file
        file.file.seek(0)
        blob.upload_from_file(file.file, content_type=_guess_content_type(safe_name))
        return blob_path
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar arquivo para Cloud Storage: {e}")


def upload_local_file(prefix: str, local_path: str, dest_name: Optional[str] = None) -> str:
    bucket = _get_bucket()
    name = dest_name or os.path.basename(local_path)
    safe_name = name.replace("\\", "_").replace("/", "_")
    blob_path = f"{prefix.rstrip('/')}/{safe_name}"
    blob = bucket.blob(blob_path)
    try:
        blob.upload_from_filename(local_path, content_type=_guess_content_type(safe_name))
        return blob_path
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar arquivo local para Cloud Storage: {e}")


def copy_blob(src_path: str, dest_path: str) -> None:
    bucket = _get_bucket()
    try:
        src_blob = bucket.blob(src_path)
        bucket.copy_blob(src_blob, bucket, new_name=dest_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao copiar blob no Cloud Storage: {e}")


def list_prefix(prefix: str) -> List[Tuple[str, int]]:
    bucket = _get_bucket()
    try:
        blobs = bucket.list_blobs(prefix=prefix.rstrip('/') + '/')
        out: List[Tuple[str, int]] = []
        for b in blobs:
            # Ignorar "diretórios" virtuais
            name = b.name
            if name.endswith('/'):
                continue
            out.append((name, int(b.size or 0)))
        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar prefixo no Cloud Storage: {e}")


def delete_blob(path: str) -> None:
    bucket = _get_bucket()
    try:
        blob = bucket.blob(path)
        blob.delete()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir blob no Cloud Storage: {e}")


def delete_prefix(prefix: str) -> int:
    bucket = _get_bucket()
    try:
        count = 0
        for name, _ in list_prefix(prefix):
            bucket.blob(name).delete()
            count += 1
        return count
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir prefixo no Cloud Storage: {e}")


def stream_blob(path: str) -> Response:
    bucket = _get_bucket()
    try:
        blob = bucket.blob(path)
        # Baixar como stream de bytes
        ctype = _guess_content_type(path)
        # Para arquivos pequenos, download_as_bytes é suficiente
        data = blob.download_as_bytes()
        return Response(content=data, media_type=ctype)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Arquivo não encontrado no Cloud Storage: {e}")