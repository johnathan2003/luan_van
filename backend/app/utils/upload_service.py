import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException, status
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def _get_supabase_client():
    """Lazy-load Supabase client — chỉ dùng khi SUPABASE_URL đã set."""
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def _validate_file(file: UploadFile) -> str:
    """Validate file size và type, trả về extension."""
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File quá lớn. Tối đa: {settings.MAX_FILE_SIZE // 1024 // 1024}MB",
        )
    all_allowed = ALLOWED_IMAGE_TYPES | ALLOWED_DOC_TYPES
    if file.content_type not in all_allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng file không hợp lệ: {file.content_type}",
        )
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    return ext


async def save_upload_file(file: UploadFile, subfolder: str = "products") -> str:
    """
    Upload file và trả về public URL.
    - Production (SUPABASE_URL set): upload lên Supabase Storage
    - Development: lưu local filesystem
    """
    ext = _validate_file(file)
    content = await file.read()
    filename = f"{uuid.uuid4().hex}.{ext}"

    # --- Supabase Storage (production) ---
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
        storage_path = f"{subfolder}/{filename}"
        supabase = _get_supabase_client()
        supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type},
        )
        public_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(storage_path)
        return public_url

    # --- Local filesystem (development) ---
    folder = os.path.join(settings.UPLOAD_FOLDER, subfolder)
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, filename)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    return f"/uploads/{subfolder}/{filename}"


async def delete_upload_file(url: str) -> bool:
    """
    Xóa file theo URL.
    - Supabase Storage: xóa object trên bucket
    - Local: xóa file trên filesystem
    """
    try:
        # Supabase URL dạng: https://xxx.supabase.co/storage/v1/object/public/uploads/subfolder/file.jpg
        if settings.SUPABASE_URL and settings.SUPABASE_URL in url:
            bucket = settings.SUPABASE_STORAGE_BUCKET
            # Lấy path sau "/public/{bucket}/"
            marker = f"/public/{bucket}/"
            if marker in url:
                storage_path = url.split(marker, 1)[1]
                supabase = _get_supabase_client()
                supabase.storage.from_(bucket).remove([storage_path])
                return True
        else:
            # Local
            relative_path = url.lstrip("/")
            if os.path.exists(relative_path):
                os.remove(relative_path)
                return True
    except Exception:
        pass
    return False
