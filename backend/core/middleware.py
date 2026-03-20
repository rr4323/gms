"""
Tenant middleware for multi-tenancy support.
Sets request.organization from the authenticated user.
"""


class TenantMiddleware:
    """
    Attach the current user's organization to the request.
    Must come after AuthenticationMiddleware.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.organization = None
        if hasattr(request, 'user') and request.user.is_authenticated:
            request.organization = getattr(request.user, 'organization', None)
        response = self.get_response(request)
        return response
