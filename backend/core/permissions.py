"""
Custom DRF permissions for role-based access control.
"""
from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Only admin (leadership) users."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.user_type == 'admin'
        )


class IsEvaluatorOrAdmin(BasePermission):
    """Evaluators (managers) and admins."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.user_type in ('admin', 'manager')
        )


class IsGoalOwnerOrEvaluatorOrAdmin(BasePermission):
    """
    Object-level: the goal's assigned_to, their evaluator, or an admin.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.user_type == 'admin':
            return True
        if hasattr(obj, 'assigned_to'):
            goal = obj
        elif hasattr(obj, 'goal'):
            goal = obj.goal
        else:
            return False
        # Owner
        if goal.assigned_to == user:
            return True
        # Evaluator of the owner
        if goal.assigned_to.evaluator == user:
            return True
        # Team lead
        if goal.team and goal.team.lead == user:
            return True
        return False


class CanApproveGoal(BasePermission):
    """Only evaluators of the goal owner, or admins, can approve/reject."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.user_type == 'admin':
            return True
        if obj.assigned_to.evaluator == user:
            return True
        if obj.team and obj.team.lead == user:
            return True
        return False
