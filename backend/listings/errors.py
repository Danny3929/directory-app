"""One error shape for the whole API:

    {"error": {"code": "invalid", "message": "...", "fields": {"email": ["..."]}}}

Unexpected crashes become a plain 500 of the same shape. The real error goes to
the server log only, never to the visitor.
"""
import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

CODES = {400: "invalid", 401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed", 429: "throttled"}


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:  # not an API error: a bug on our side
        logger.exception("Unhandled error in %s", context.get("view"))
        return Response(
            {"error": {"code": "server_error", "message": "Something went wrong. Please try again."}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    code = CODES.get(response.status_code, "error")
    data = response.data
    if response.status_code == 400 and isinstance(data, dict):
        error = {"code": code, "message": "Please check the highlighted fields.", "fields": data}
    else:
        message = data.get("detail") if isinstance(data, dict) else None
        error = {"code": code, "message": str(message or "Request failed.")}
    response.data = {"error": error}
    return response
