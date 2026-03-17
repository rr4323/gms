# GMS — Future Features Design Document

> **Version:** 1.0 · **Date:** 2026-03-17 · **Status:** Draft

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [Feature 1 — Keycloak Authentication & RBAC](#2-feature-1--keycloak-authentication--rbac)
3. [Feature 2 — Multi-Tenancy (Org vs Normal User)](#3-feature-2--multi-tenancy-org-vs-normal-user)
4. [Feature 3 — Timetable, Google Calendar & Teams Integration](#4-feature-3--timetable-google-calendar--teams-integration)
5. [Feature 4 — Goal Journey](#5-feature-4--goal-journey)
6. [Feature 5 — Daily Journal](#6-feature-5--daily-journal)
7. [Integration Map](#7-integration-map)
8. [Phased Rollout](#8-phased-rollout)

---

## 1. Current Architecture

| Layer | Tech | Key Components |
|---|---|---|
| **Backend** | Django 4.x + DRF | `core/models.py` (User, Team, Goal, Task, Evaluation), `core/views.py`, `core/serializers.py` |
| **Frontend** | React 19 + Vite | 8 pages (Dashboard, Goals, GoalDetail, GoalForm, Approvals, Reports, Users, Login) |
| **Auth** | DRF Token auth | `LoginView` → Token, localStorage on frontend, `Token` header via Axios interceptor |
| **RBAC** | `user_type` field | admin / manager / member — checked in `permissions.py` (4 permission classes) |
| **Database** | PostgreSQL 15 | Docker Compose with `pgdata` volume |
| **Infra** | Docker, nginx | `docker-compose.yml` (dev), `docker-compose.prod.yml` (prod with gunicorn) |

**Current Auth Flow:**
```
LoginPage → POST /api/v1/auth/login/ → DRF Token → localStorage('gms_token')
→ Axios interceptor adds "Token xxx" header → DRF TokenAuthentication validates
```

**Current RBAC:**
- `User.user_type`: admin / manager / member
- `permissions.py`: `IsAdminUser`, `IsEvaluatorOrAdmin`, `IsGoalOwnerOrEvaluatorOrAdmin`, `CanApproveGoal`
- DB models exist for `Role`, `Permission`, `RolePermission`, `UserRole` but are **unused** (dead code per BUG_ANALYSIS)

---

## 2. Feature 1 — Keycloak Authentication & RBAC

### 2.1 Why Keycloak?

- **SSO**: Single sign-on across GMS and future services
- **OIDC/OAuth 2.0**: Industry-standard protocol; eliminates password management in GMS
- **Centralized RBAC**: Roles/groups managed in Keycloak admin console
- **Social Login Ready**: Google, GitHub, LDAP connectors out of the box
- **Multi-Tenancy Ready**: Keycloak realms map naturally to organizations

### 2.2 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        KEYCLOAK SERVER                          │
│  Realm: "gms"                                                    │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ Client:     │  │ Roles:           │  │ Groups:           │   │
│  │ gms-frontend│  │ gms-admin        │  │ /org-acme         │   │
│  │ gms-backend │  │ gms-manager      │  │ /org-acme/team-a  │   │
│  │             │  │ gms-member       │  │ /org-beta         │   │
│  └─────────────┘  └──────────────────┘  └───────────────────┘   │
└──────────────────────────────────────┬───────────────────────────┘
                                       │ OIDC / JWT
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
        ┌───────▼───────┐      ┌───────▼───────┐              │
        │   React SPA   │      │ Django + DRF  │              │
        │  keycloak-js   │────▶│ JWT validate  │              │
        │  (PKCE flow)  │      │ mozilla-oidc  │              │
        └───────────────┘      └───────────────┘              │
```

### 2.3 Keycloak Realm Configuration

Create a `gms` realm with:

| Item | Config |
|---|---|
| **Client: `gms-frontend`** | Public client, PKCE, redirect URIs = `http://localhost:5173/*` |
| **Client: `gms-backend`** | Confidential client, service-account enabled |
| **Realm Roles** | `gms-admin`, `gms-manager`, `gms-member` |
| **Role Mapper** | Include realm roles in the `realm_access.roles` JWT claim |
| **Groups** | `/org-<slug>` per organization (for multi-tenancy later) |
| **Token Settings** | Access token lifespan: 5 min, Refresh token: 30 min |

### 2.4 Backend Changes

#### 2.4.1 New Dependencies

```diff
# backend/requirements.txt
+ mozilla-django-oidc>=4.0
+ PyJWT>=2.8
+ cryptography>=42.0
```

#### 2.4.2 Settings

```python
# backend/gms/settings.py — new Keycloak settings

KEYCLOAK_URL = os.environ.get('KEYCLOAK_URL', 'http://keycloak:8080')
KEYCLOAK_REALM = os.environ.get('KEYCLOAK_REALM', 'gms')
KEYCLOAK_CLIENT_ID = os.environ.get('KEYCLOAK_CLIENT_ID', 'gms-backend')
KEYCLOAK_CLIENT_SECRET = os.environ.get('KEYCLOAK_CLIENT_SECRET', '')

# OIDC Discovery
OIDC_OP_AUTHORIZATION_ENDPOINT = f'{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/auth'
OIDC_OP_TOKEN_ENDPOINT = f'{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/token'
OIDC_OP_USER_ENDPOINT = f'{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/userinfo'
OIDC_OP_JWKS_ENDPOINT = f'{KEYCLOAK_URL}/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs'
OIDC_RP_CLIENT_ID = KEYCLOAK_CLIENT_ID
OIDC_RP_CLIENT_SECRET = KEYCLOAK_CLIENT_SECRET
OIDC_RP_SIGN_ALGO = 'RS256'

# Tell DRF to use JWT authentication
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.KeycloakJWTAuthentication',   # NEW — primary
        'rest_framework.authentication.TokenAuthentication', # KEEP — fallback for migration
        'rest_framework.authentication.SessionAuthentication',
    ],
    # ... rest unchanged
}

INSTALLED_APPS += ['mozilla_django_oidc']
```

#### 2.4.3 Custom JWT Authentication Backend

```python
# backend/core/authentication.py  [NEW FILE]
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
```

#### 2.4.4 Updated Views

```python
# backend/core/views.py — Auth section changes

class MeView(views.APIView):
    """Return current user info — works with both Token and JWT auth."""
    def get(self, request):
        return Response(UserSerializer(request.user).data)


# LoginView and LogoutView are KEPT for the migration period but become
# secondary. The primary auth flow goes through Keycloak.
# After full migration, these can be removed.
```

#### 2.4.5 Updated Permissions

```python
# backend/core/permissions.py — role checks remain the same since
# KeycloakJWTAuthentication syncs Keycloak roles → user.user_type
# No changes needed to permission classes!
```

### 2.5 Frontend Changes

#### 2.5.1 New Dependency

```diff
# frontend/package.json
+ "keycloak-js": "^26.0.0"
```

#### 2.5.2 Keycloak Init

```javascript
// frontend/src/keycloak.js  [NEW FILE]
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
    realm: import.meta.env.VITE_KEYCLOAK_REALM || 'gms',
    clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'gms-frontend',
});

export default keycloak;
```

#### 2.5.3 Updated AuthContext

```javascript
// frontend/src/context/AuthContext.jsx  [REWRITTEN]
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import keycloak from '../keycloak';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {
        keycloak.init({
            onLoad: 'login-required',   // redirect to Keycloak login automatically
            pkceMethod: 'S256',
            checkLoginIframe: false,
        }).then(auth => {
            setAuthenticated(auth);
            if (auth) {
                // Fetch user profile from GMS backend (using JWT)
                api.get('/auth/me/').then(res => {
                    setUser(res.data);
                }).catch(console.error);

                // Set up token refresh
                setInterval(() => {
                    keycloak.updateToken(30).catch(() => keycloak.login());
                }, 30000);
            }
        }).catch(err => {
            console.error('Keycloak init failed:', err);
        }).finally(() => setLoading(false));
    }, []);

    const logout = useCallback(() => {
        keycloak.logout({ redirectUri: window.location.origin + '/login' });
        setUser(null);
        setAuthenticated(false);
    }, []);

    return (
        <AuthContext.Provider value={{ user, logout, loading, authenticated, keycloak }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
```

#### 2.5.4 Updated API Client

```javascript
// frontend/src/api/client.js  [UPDATED]
import axios from 'axios';
import keycloak from '../keycloak';

const api = axios.create({
    baseURL: '/api/v1',
    headers: { 'Content-Type': 'application/json' },
});

// Attach Keycloak JWT token (instead of DRF Token)
api.interceptors.request.use(async (config) => {
    if (keycloak.authenticated) {
        // Refresh token if about to expire
        try {
            await keycloak.updateToken(5);
        } catch {
            keycloak.login();
            return config;
        }
        config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
});

// Handle 401 → redirect to Keycloak login
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401) {
            keycloak.login();
        }
        return Promise.reject(err);
    }
);

export default api;
```

#### 2.5.5 Remove LoginPage

With Keycloak, the login UI is handled by Keycloak's login page (customizable via themes). The React `LoginPage.jsx` is **no longer used** for the primary flow.

- Keep it as a fallback landing page that triggers `keycloak.login()`
- Or remove it entirely and rely on `onLoad: 'login-required'`

#### 2.5.6 Updated App.jsx

```diff
# Remove the /login route since Keycloak handles login
- <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
+ {/* Login is handled by Keycloak — unauthenticated users auto-redirect */}
```

### 2.6 Docker Compose Changes

```yaml
# docker-compose.yml — add Keycloak service
  keycloak:
    image: quay.io/keycloak/keycloak:26.0
    command: start-dev --import-realm
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://db:5432/keycloak_db
      KC_DB_USERNAME: gms_user
      KC_DB_PASSWORD: gms_pass_2024
      KC_HOSTNAME_STRICT: "false"
      KC_HTTP_ENABLED: "true"
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"
    depends_on:
      - db
    volumes:
      - ./keycloak/realm-export.json:/opt/keycloak/data/import/realm-export.json

  # Add a separate Keycloak DB (or reuse the same PG with a different DB name)
```

```diff
# backend service — add Keycloak env vars
    environment:
+     KEYCLOAK_URL: http://keycloak:8080
+     KEYCLOAK_REALM: gms
+     KEYCLOAK_CLIENT_ID: gms-backend
+     KEYCLOAK_CLIENT_SECRET: ${KEYCLOAK_CLIENT_SECRET:-backend-secret}

# frontend service — add Keycloak env vars
    environment:
+     VITE_KEYCLOAK_URL: http://localhost:8080
+     VITE_KEYCLOAK_REALM: gms
+     VITE_KEYCLOAK_CLIENT_ID: gms-frontend
```

### 2.7 Keycloak Realm Export

We'll provide a `keycloak/realm-export.json` file that auto-imports on first start:

```json
{
    "realm": "gms",
    "enabled": true,
    "roles": {
        "realm": [
            { "name": "gms-admin", "description": "GMS Administrator" },
            { "name": "gms-manager", "description": "GMS Manager / Evaluator" },
            { "name": "gms-member", "description": "GMS Team Member" }
        ]
    },
    "clients": [
        {
            "clientId": "gms-frontend",
            "publicClient": true,
            "redirectUris": ["http://localhost:5173/*"],
            "webOrigins": ["http://localhost:5173"],
            "protocol": "openid-connect",
            "standardFlowEnabled": true,
            "directAccessGrantsEnabled": false,
            "attributes": {
                "pkce.code.challenge.method": "S256"
            }
        },
        {
            "clientId": "gms-backend",
            "publicClient": false,
            "secret": "backend-secret",
            "serviceAccountsEnabled": true,
            "standardFlowEnabled": false,
            "directAccessGrantsEnabled": true
        }
    ],
    "users": [
        {
            "username": "admin",
            "email": "admin@gms.local",
            "firstName": "Admin",
            "lastName": "User",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "admin123", "temporary": false }],
            "realmRoles": ["gms-admin"]
        },
        {
            "username": "manager",
            "email": "manager@gms.local",
            "firstName": "Manager",
            "lastName": "User",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "manager123", "temporary": false }],
            "realmRoles": ["gms-manager"]
        },
        {
            "username": "member",
            "email": "member@gms.local",
            "firstName": "Member",
            "lastName": "User",
            "enabled": true,
            "credentials": [{ "type": "password", "value": "member123", "temporary": false }],
            "realmRoles": ["gms-member"]
        }
    ]
}
```

### 2.8 Migration Strategy

| Phase | Action | Duration |
|---|---|---|
| **Phase A** | Deploy Keycloak alongside existing Token auth (dual mode) | Week 1 |
| **Phase B** | Frontend switches to `keycloak-js`, backend accepts both Token & JWT | Week 2 |
| **Phase C** | Migrate all users to Keycloak; remove DRF Token auth | Week 3 |
| **Phase D** | Remove `LoginView`, `LogoutView`, `rest_framework.authtoken` from INSTALLED_APPS | Week 4 |

### 2.9 RBAC Mapping

| Keycloak Role | GMS `user_type` | Permissions |
|---|---|---|
| `gms-admin` | `admin` | Full access — manage orgs, users, teams, all goals, all reports |
| `gms-manager` | `manager` | Manage team goals, approve/reject, evaluate, team dashboard/reports |
| `gms-member` | `member` | Own goals, submit for approval, self-reflection, individual dashboard |

Role sync happens automatically in `KeycloakJWTAuthentication._sync_roles()` on every request.

---

## 3. Feature 2 — Multi-Tenancy (Org vs Normal User)

### 3.1 Problem

GMS currently runs as a single flat namespace. To support multiple organizations (companies, departments, clients) on the same deployment, we need tenant isolation.

### 3.2 Data Model

```python
class Organization(models.Model):
    name         = models.CharField(max_length=200, unique=True)
    slug         = models.SlugField(max_length=200, unique=True)
    logo         = models.ImageField(upload_to='org_logos/', blank=True, null=True)
    domain       = models.CharField(max_length=255, blank=True)   # for SSO domain mapping
    plan         = models.CharField(max_length=20,
                     choices=[('free','Free'),('pro','Pro'),('enterprise','Enterprise')],
                     default='free')
    max_users    = models.IntegerField(default=10)
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
```

**Changes to existing models — add FK:**

| Model | New Field |
|---|---|
| `User` | `organization = ForeignKey(Organization, null=True, blank=True)` |
| `User` | `is_org_admin = BooleanField(default=False)` |
| `Team` | `organization = ForeignKey(Organization)` |
| `Goal` | `organization = ForeignKey(Organization, null=True, blank=True)` |

### 3.3 Tenant Isolation

- **Middleware**: `TenantMiddleware` sets `request.organization` from the authenticated user
- **Mixin**: `TenantQuerySetMixin` filters all querysets by `organization`
- **Keycloak groups**: `/org-<slug>` groups map to organizations; group membership is synced on auth

### 3.4 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `api/v1/organizations/` | GET, POST | CRUD orgs (Super Admin) |
| `api/v1/organizations/<id>/invite/` | POST | Invite user via email |
| `api/v1/organizations/<id>/members/` | GET | List org members |

---

## 4. Feature 3 — Timetable, Google Calendar & Teams Integration

### 4.1 Architecture

```
GMS Backend ──OAuth 2.0──▶ Google Calendar API
                          ▶ Microsoft Graph API (Outlook)
                          ▶ Teams Incoming Webhooks
```

### 4.2 Data Models

| Model | Purpose |
|---|---|
| `CalendarIntegration` | OAuth connection (user ↔ provider), stores encrypted tokens |
| `CalendarEvent` | Synced events linked to goals/milestones |
| `TeamsIntegration` | Teams channel webhook for org/team notifications |

### 4.3 Key Flows

- **Google Calendar**: Connect via OAuth → push goal deadlines as events → pull events for timetable view
- **Teams**: Org Admin adds incoming webhook URL → goal status changes post adaptive cards to channel
- **Timetable UI**: New page using `react-big-calendar` showing goals + synced calendar events

### 4.4 API Endpoints

| Endpoint | Description |
|---|---|
| `api/v1/integrations/google/connect/` | Start OAuth flow |
| `api/v1/integrations/google/callback/` | OAuth callback |
| `api/v1/integrations/teams/` | CRUD Teams webhooks |
| `api/v1/timetable/` | Aggregated calendar view |

### 4.5 Dependencies

- `google-api-python-client`, `google-auth-oauthlib` (Google Calendar)
- `celery[redis]`, `django-celery-beat` (async sync)
- `cryptography` (token encryption)

---

## 5. Feature 4 — Goal Journey

### 5.1 Problem

Goal completion is tracked as a single percentage. No milestones, no historical progress, no activity audit trail.

### 5.2 Data Models

| Model | Purpose |
|---|---|
| `Milestone` | Key checkpoints within a goal (title, target_date, status, order) |
| `ProgressSnapshot` | Point-in-time completion % records for historical charting |
| `GoalActivity` | Audit trail — every status change, progress update, comment, feedback |

### 5.3 Changes to Existing Code

- `GoalViewSet.progress()` → also creates `ProgressSnapshot`
- Status transitions (`submit`, `approve`, `reject`, `complete`) → create `GoalActivity`
- GoalDetailPage gets a new **"Journey" tab** with timeline + progress chart

### 5.4 API Endpoints

| Endpoint | Description |
|---|---|
| `api/v1/goals/<id>/milestones/` | CRUD milestones |
| `api/v1/goals/<id>/journey/` | Full journey view |
| `api/v1/goals/<id>/progress-history/` | Historical snapshots |
| `api/v1/goals/<id>/activities/` | Activity log |

---

## 6. Feature 5 — Daily Journal

### 6.1 Problem

No space for daily reflection. Members can't document daily work, blockers, or wins to feed into evaluations.

### 6.2 Data Model

```python
class JournalEntry(models.Model):
    class Mood(models.TextChoices):
        GREAT      = 'great', '😊 Great'
        GOOD       = 'good', '🙂 Good'
        NEUTRAL    = 'neutral', '😐 Neutral'
        STRUGGLING = 'struggling', '😟 Struggling'
        TOUGH      = 'tough', '😣 Tough'

    user            = models.ForeignKey(User, on_delete=models.CASCADE)
    organization    = models.ForeignKey('Organization', null=True, blank=True, on_delete=models.CASCADE)
    date            = models.DateField()   # one entry per day
    mood            = models.CharField(max_length=20, choices=Mood.choices, blank=True)
    accomplishments = models.TextField(blank=True)
    challenges      = models.TextField(blank=True)
    learnings       = models.TextField(blank=True)
    plan_tomorrow   = models.TextField(blank=True)
    free_notes      = models.TextField(blank=True)
    linked_goals    = models.ManyToManyField('Goal', blank=True)
    is_private      = models.BooleanField(default=False)

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']
```

### 6.3 Visibility Rules

| Viewer | Can See |
|---|---|
| Author | All own entries |
| Manager | Direct reports' shared entries |
| Org Admin | All org shared entries |

### 6.4 API Endpoints

| Endpoint | Description |
|---|---|
| `api/v1/journal/` | List/create journal entries |
| `api/v1/journal/<id>/` | CRUD specific entry |
| `api/v1/journal/team/` | Manager view: team entries |
| `api/v1/journal/analytics/` | Mood trends, streaks |

### 6.5 Frontend

- New `/journal` page with calendar heatmap + structured entry form
- Mood selector (emoji chips), four text sections, goal linking, private toggle
- Manager sidebar showing team's daily pulse

---

## 7. Integration Map

```
                    ┌──────────────┐
                    │   KEYCLOAK   │
                    │   (SSO/RBAC) │
                    └──────┬───────┘
                           │ JWT
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
 React SPA          Django + DRF           Google/Teams APIs
    │                      │                      │
    │    ┌─────────────────┼──────────────┐       │
    │    │ Organization    │ Goal         │       │
    │    │   ├─ Users      │  ├─ Milestones       │
    │    │   ├─ Teams      │  ├─ ProgressHistory  │
    │    │   └─ Settings   │  ├─ Activities       │
    │    │                 │  └─ CalendarEvents────┘
    │    │ JournalEntry    │                      │
    │    │   ├─ linked_goals                      │
    │    │   └─ mood analytics                    │
    │    └────────────────────────────────┘       │
    │                                             │
    └─────────────────────────────────────────────┘
```

---

## 8. Phased Rollout

### Phase 1 — Auth & Foundation (Weeks 1–3)
- [ ] Deploy Keycloak + realm config
- [ ] Backend: `KeycloakJWTAuthentication` + dual-mode auth
- [ ] Frontend: `keycloak-js` integration + updated AuthContext
- [ ] Add `Organization` model + tenant middleware
- [ ] Add `Milestone`, `ProgressSnapshot`, `GoalActivity` models
- [ ] Add `JournalEntry` model + CRUD API

### Phase 2 — Features & UI (Weeks 4–6)
- [ ] Journal page (frontend)
- [ ] Goal journey tab on GoalDetailPage
- [ ] Google Calendar OAuth flow + event sync
- [ ] Timetable page (frontend)
- [ ] Org management UI

### Phase 3 — Polish & Integrations (Weeks 7–8)
- [ ] Teams webhook notifications
- [ ] Journal analytics (mood trends, streaks)
- [ ] Progress-over-time charts
- [ ] Remove legacy DRF Token auth
- [ ] Outlook Calendar support (P2)

---

## Files To Create/Modify

### New Files
| File | Purpose |
|---|---|
| `backend/core/authentication.py` | Keycloak JWT authentication backend |
| `frontend/src/keycloak.js` | Keycloak JS adapter init |
| `keycloak/realm-export.json` | Auto-import realm config |
| `backend/core/middleware.py` | Tenant middleware |
| `backend/core/mixins.py` | Tenant queryset mixin |
| `backend/core/services/google_calendar.py` | Google Calendar sync |
| `backend/core/services/teams_notify.py` | Teams webhook notifier |
| `frontend/src/pages/JournalPage.jsx` | Daily journal page |
| `frontend/src/pages/TimetablePage.jsx` | Calendar/timetable view |

### Modified Files
| File | Changes |
|---|---|
| `backend/core/models.py` | Add Organization, Milestone, ProgressSnapshot, GoalActivity, JournalEntry, CalendarIntegration, CalendarEvent, TeamsIntegration |
| `backend/gms/settings.py` | Keycloak OIDC settings |
| `backend/core/views.py` | Journal/Milestone ViewSets, integration views |
| `backend/core/serializers.py` | Serializers for new models |
| `backend/core/urls.py` | New routes |
| `backend/requirements.txt` | New dependencies |
| `frontend/src/context/AuthContext.jsx` | Keycloak-based auth |
| `frontend/src/api/client.js` | Bearer token instead of DRF Token |
| `frontend/src/App.jsx` | New routes, remove login page |
| `frontend/package.json` | Add keycloak-js |
| `docker-compose.yml` | Add Keycloak service |
| `docker-compose.prod.yml` | Add Keycloak service |
