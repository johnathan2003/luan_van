import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException, status
from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_DOC_TYPES = {"application/pdf", "image/jpeg", "image/png"}


async def save_upload_file(file: UploadFile, subfolder: str = "products") -> str:
    """Save an uploaded file and return the URL path."""
    if file.size and file.size > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    if file.content_type not in ALLOWED_IMAGE_TYPES and file.content_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type",
        )

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    folder = os.path.join(settings.UPLOAD_FOLDER, subfolder)
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, filename)

    async with aiofiles.open(file_path, "wb") as f:
        content = await file.read()
        await f.write(content)

    return f"/uploads/{subfolder}/{filename}"


async def delete_upload_file(url: str) -> bool:
    """Delete an uploaded file by its URL."""
    try:
        relative_path = url.lstrip("/")
        if os.path.exists(relative_path):
            os.remove(relative_path)
            return True
    except Exception:
        pass
    return False
