import os
import uuid
import aiofiles
from typing import Optional
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
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


async def save_upload_file(
    file: UploadFile,
    subfolder: str = "products",
    db: Optional[Session] = None,
    uploaded_by: Optional[int] = None,
) -> str:
    """
    Upload file và trả về public URL.
    - Production (SUPABASE_URL set): upload lên Supabase Storage
    - Development: lưu local filesystem

    Nếu truyền `db`, mọi upload (bất kể subfolder) sẽ được đăng ký vào bảng
    media_assets — đây là sổ đăng ký TẬP TRUNG duy nhất cho toàn bộ ảnh
    trong hệ thống, để super có thể thấy được mọi ảnh đã upload ở đâu.
    """
    ext = _validate_file(file)
    content = await file.read()
    code = uuid.uuid4().hex
    filename = f"{code}.{ext}"

    # --- Supabase Storage (production) ---
    # Bỏ qua nếu URL là placeholder (chứa dấu ngoặc vuông) hoặc không hợp lệ
    _supabase_ready = (
        bool(settings.SUPABASE_URL)
        and bool(settings.SUPABASE_SERVICE_KEY)
        and '[' not in settings.SUPABASE_URL
        and settings.SUPABASE_URL.startswith('http')
    )
    if _supabase_ready:
        storage_path = f"{subfolder}/{filename}"
        supabase = _get_supabase_client()
        supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).upload(
            path=storage_path,
            file=content,
            file_options={"content-type": file.content_type},
        )
        public_url = supabase.storage.from_(settings.SUPABASE_STORAGE_BUCKET).get_public_url(storage_path)
    else:
        # --- Local filesystem (development) ---
        folder = os.path.join(settings.UPLOAD_FOLDER, subfolder)
        os.makedirs(folder, exist_ok=True)
        file_path = os.path.join(folder, filename)
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        public_url = f"/uploads/{subfolder}/{filename}"

    _register_media_asset(
        db, code=code, url=public_url, subfolder=subfolder,
        original_filename=file.filename, content_type=file.content_type,
        size_bytes=len(content), uploaded_by=uploaded_by,
    )
    return public_url


def _register_media_asset(
    db: Optional[Session], *, code: str, url: str, subfolder: str,
    original_filename: Optional[str], content_type: Optional[str],
    size_bytes: int, uploaded_by: Optional[int],
) -> None:
    """Ghi 1 dòng vào media_assets — best-effort, không làm hỏng luồng upload
    chính nếu vì lý do gì đó (bảng chưa migrate, lỗi DB...) mà ghi thất bại."""
    if db is None:
        return
    try:
        from app.models.media import MediaAsset
        db.add(MediaAsset(
            code=code, url=url, subfolder=subfolder,
            original_filename=original_filename, content_type=content_type,
            size_bytes=size_bytes, uploaded_by=uploaded_by,
        ))
        db.commit()
    except Exception:
        db.rollback()


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
