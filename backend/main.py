import uvicorn
from app.config import settings

if __name__ == "__main__":
    uvicorn.run(
        "app.main:socket_app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
