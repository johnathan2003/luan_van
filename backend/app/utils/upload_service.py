import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException, status
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def _get_supabase_client():
    """Lazy-load Supabase client."""
    from supabase import create_client
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)


def _cloudinary_configured() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def _get_cloudinary():
    """Lazy-load & configure Cloudinary."""
    import cloudinary
    import cloudinary.uploader
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    return cloudinary.uploader


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
    Priority:
      1. Cloudinary (CLOUDINARY_* keys set)
      2. Supabase Storage (SUPABASE_URL set)
      3. Local filesystem (development fallback)
    """
    ext = _validate_file(file)
    content = await file.read()
    filename = f"{uuid.uuid4().hex}.{ext}"

    # --- Cloudinary (production, ưu tiên 1) ---
    if _cloudinary_configured():
        uploader = _get_cloudinary()
        import io
        result = uploader.upload(
            io.BytesIO(content),
            folder=f"buyzo/{subfolder}",
            resource_type="image",
            public_id=uuid.uuid4().hex,
            overwrite=False,
            transformation=[
                {"quality": "auto", "fetch_format": "auto"},
            ],
        )
        return result["secure_url"]

    # --- Supabase Storage (production, ưu tiên 2) ---
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
    - Cloudinary: extract public_id từ URL rồi destroy
    - Supabase Storage: xóa object trên bucket
    - Local: xóa file trên filesystem
    """
    try:
        if _cloudinary_configured() and "res.cloudinary.com" in url:
            import cloudinary
            import cloudinary.uploader
            _get_cloudinary()  # configure
            # URL dạng: https://res.cloudinary.com/<cloud>/image/upload/v.../buyzo/products/<id>
            # public_id = phần sau /upload/v.../ (không có extension)
            parts = url.split("/upload/")
            if len(parts) == 2:
                # bỏ version prefix "v1234567890/"
                path_part = parts[1]
                if path_part.startswith("v") and "/" in path_part:
                    path_part = path_part.split("/", 1)[1]
                public_id = path_part.rsplit(".", 1)[0]  # bỏ extension
                cloudinary.uploader.destroy(public_id)
                return True

        elif settings.SUPABASE_URL and settings.SUPABASE_URL in url:
            bucket = settings.SUPABASE_STORAGE_BUCKET
            marker = f"/public/{bucket}/"
            if marker in url:
                storage_path = url.split(marker, 1)[1]
                supabase = _get_supabase_client()
                supabase.storage.from_(bucket).remove([storage_path])
                return True

        else:
            relative_path = url.lstrip("/")
            if os.path.exists(relative_path):
                os.remove(relative_path)
                return True
    except Exception:
        pass
    return False
