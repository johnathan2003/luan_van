# core/middleware __init__.py


import time
import logging

logger = logging.getLogger("requests")


class RequestLoggingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.time()
        response = self.get_response(request)
        duration = round((time.time() - start) * 1000)

        user = request.user.email if request.user.is_authenticated else "anonymous"
        logger.info(f"{request.method} {request.path} → {response.status_code} [{duration}ms] ({user})")

        return response