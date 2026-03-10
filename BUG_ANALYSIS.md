# Threat
FIXED
- on creating goal one has to assign the manager and then that manager has permission to approval not any other manager.
- when user complete goal then it is send to manager for evaluation and then manager can evaluate and submit its evaluation.
- first manager apporove or score each goal
- Editing Rules: Goals can only be edited while in Draft or Rejected state; Active goals are locked
- pdf/csv export is not working
- goal approvla list nahi hone chahiye
- dashboard -correction ,isolation

New BUGS
- When we are clicking on Add Team, the previous data is not clearing
- When clicking on Team, it is not opening (unable to view or edit)
- When selecting Team Lead not able to see the team members
- When creating new user, password is already written there (in password field)
- mail validation is not working
- When clicking on evaluator the options are not coming, showing only None and blank field
- When adding new goal, Assigned to field show options in ()
- In manager Goals, update progress bar should start from 0, it is by default shows 50 %
- Progress is updating but failed to update in progress bar and also not showing percentage number.
- email should be unique
- Evaluator can be multiple
- While login the detials isn't showing, it is showing blank white field instead of user detials
- scoring level need to show after self reflection 
- In Details number isn't showing.
- When we create new user it automatically show on login username list.
- Member and Manager doesn't assign goal to Admin (Don't show Admin in assigned to field).


## Additional Issue Index

| ID      | Severity   | Category    | File                              | Description                                         |
|---------|------------|-------------|-----------------------------------|-----------------------------------------------------|
| SEC-01  | 🔴 Critical | Security    | `docker-compose.yml:8-10,24-25`  | Hardcoded DB password and secret key in VCS         |
| SEC-02  | 🔴 Critical | Security    | `backend/gms/settings.py:10-11`  | Insecure defaults for SECRET_KEY and DEBUG          |
| SEC-03  | 🔴 Critical | Security    | `docker-compose.prod.yml:16`     | ALLOWED_HOSTS wildcard `*` in production            |
| SEC-04  | 🔴 Critical | Security    | `frontend/src/context/AuthContext.jsx:29` | Auth token in localStorage (XSS risk)     |
| SEC-05  | 🟠 High    | Security    | `backend/core/views.py:37`       | No rate limiting on login endpoint                  |
| SEC-06  | 🟠 High    | Security    | `backend/core/export_views.py:40,47` | Exception details exposed to HTTP client        |
| SEC-07  | 🟠 High    | Security    | `backend/core/export_views.py:24` | Unhandled ValueError on non-numeric user_id        |
| SEC-08  | 🟡 Medium  | Security    | `frontend/nginx.conf`            | No HTTP security headers (CSP, HSTS, X-Frame, etc.) |
| SEC-09  | 🟡 Medium  | Security    | `backend/gms/settings.py`        | No HTTPS enforcement or HSTS settings               |
| SEC-10  | 🟡 Medium  | Security    | `backend/core/views.py:262`      | TaskViewSet exposes all tasks to all users          |
| SEC-11  | 🟢 Low     | Security    | `backend/core/views.py:58`       | Minimum password length is 6 (should be 8)          |
| CQ-01   | 🟠 High    | Code Quality| `backend/core/models.py:57-110`  | Dead code: 4 unused RBAC models + 1 serializer      |
| CQ-02   | 🟡 Medium  | Code Quality| `backend/core/views.py:6-9`      | Unused imports (Now, Cast, Extract, etc.)           |
| CQ-03   | 🟡 Medium  | Code Quality| `backend/core/views.py:119-131`  | Duplicate is_editable guard in view and serializer  |
| CQ-04   | 🟡 Medium  | Code Quality| `backend/gms/__pycache__/`       | Compiled .pyc files committed to git                |
| CQ-05   | 🟡 Medium  | Code Quality| `backend/core/views.py:89`       | GoalViewSet has too many responsibilities           |
| CQ-06   | 🟢 Low     | Code Quality| Repository root                  | No root-level .gitignore                            |
| CQ-07   | 🟢 Low     | Code Quality| `backend/core/export_views.py`   | Inconsistent error response format (plain vs JSON)  |
| PERF-01 | 🟠 High    | Performance | `backend/core/views.py:289-294`  | Python-side loop for at-risk goals (N+1 / full scan)|
| PERF-02 | 🟠 High    | Performance | `backend/core/views.py:335-364`  | Nested loops in TeamReportView (O(T×M) queries)     |
| PERF-03 | 🟡 Medium  | Performance | `backend/core/serializers.py:140`| `.count()` defeats prefetch cache in task_count     |
| PERF-04 | 🟡 Medium  | Performance | `backend/core/serializers.py:61` | TeamSerializer member_count fires N COUNT queries   |
| PERF-05 | 🟡 Medium  | Performance | `backend/core/models.py`         | Missing DB indexes on Goal.status, is_finalized     |
| PERF-06 | 🟢 Low     | Performance | `backend/core/serializers.py:160`| GoalDetailSerializer always loads all nested data   |
| DEP-01  | 🟡 Medium  | Dependencies| `backend/requirements.txt`       | Unpinned dependency versions                        |
| DEP-02  | 🟡 Medium  | Dependencies| `backend/requirements.txt:5`     | psycopg2-binary not suitable for production         |
| DEP-03  | 🟢 Low     | Dependencies| Repository root                  | No CI pipeline or dependency vulnerability scanning |