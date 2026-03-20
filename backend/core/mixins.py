"""
Tenant-aware mixins for views and querysets.
"""


class TenantQuerySetMixin:
    """
    Filter querysets by the current user's organization.
    Apply to ViewSets that need tenant isolation.
    The model must have an 'organization' field.
    """

    tenant_field = 'organization'

    def get_queryset(self):
        qs = super().get_queryset()
        org = getattr(self.request, 'organization', None)
        if org:
            qs = qs.filter(**{self.tenant_field: org})
        return qs

    def perform_create(self, serializer):
        org = getattr(self.request, 'organization', None)
        if org and self.tenant_field in [f.name for f in serializer.Meta.model._meta.get_fields()]:
            serializer.save(**{self.tenant_field: org})
        else:
            super().perform_create(serializer)
