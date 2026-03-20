"""
Keycloak JWT Authentication for DRF.
Validates access tokens issued by Keycloak and maps claims to GMS User.
"""
import jwt
import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from .models import User


class KeycloakJWTAuthentication(BaseAuthentication):
    """Validate Keycloak JWT access tokens on every request."""

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')

        if not auth_header.startswith('Bearer '):
            return None  # Let other auth backends try

        token = auth_header[7:]
        try:
            payload = self._decode_token(token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f'Invalid token: {e}')

        user = self._get_or_create_user(payload)
        self._sync_roles(user, payload)
        return (user, payload)

    def _get_jwks(self):
        """Fetch and cache Keycloak's public keys."""
        cache_key = 'keycloak_jwks'
        jwks = cache.get(cache_key)
        if not jwks:
            resp = requests.get(settings.OIDC_OP_JWKS_ENDPOINT, timeout=10)
            resp.raise_for_status()
            jwks = resp.json()
            cache.set(cache_key, jwks, timeout=3600)  # cache 1 hour
        return jwks

    def _decode_token(self, token):
        """Decode and validate the JWT using Keycloak's public key."""
        jwks = self._get_jwks()
        # Get the key ID from the token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')

        # Find the matching public key
        public_key = None
        for key_data in jwks.get('keys', []):
            if key_data.get('kid') == kid:
                public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
                break

        if not public_key:
            raise jwt.InvalidTokenError('No matching key found')

        return jwt.decode(
            token,
            public_key,
            algorithms=[settings.OIDC_RP_SIGN_ALGO],
            audience=settings.OIDC_RP_CLIENT_ID,
            options={'verify_exp': True},
        )

    def _get_or_create_user(self, payload):
        """Find or create a Django user from Keycloak JWT claims."""
        keycloak_id = payload.get('sub')
        username = payload.get('preferred_username', keycloak_id)
        email = payload.get('email', '')

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                'email': email,
                'first_name': payload.get('given_name', ''),
                'last_name': payload.get('family_name', ''),
            }
        )
        if not created:
            # Sync profile data from Keycloak
            changed = False
            for attr, claim in [('email', 'email'), ('first_name', 'given_name'), ('last_name', 'family_name')]:
                val = payload.get(claim, '')
                if val and getattr(user, attr) != val:
                    setattr(user, attr, val)
                    changed = True
            if changed:
                user.save(update_fields=['email', 'first_name', 'last_name'])

        return user

    def _sync_roles(self, user, payload):
        """Map Keycloak realm roles to GMS user_type."""
        kc_roles = payload.get('realm_access', {}).get('roles', [])

        if 'gms-admin' in kc_roles:
            new_type = User.UserType.ADMIN
        elif 'gms-manager' in kc_roles:
            new_type = User.UserType.MANAGER
        else:
            new_type = User.UserType.MEMBER

        if user.user_type != new_type:
            user.user_type = new_type
            user.save(update_fields=['user_type'])
