"""
Admin configuration for GMS models.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import (
    User, Team, Role, Entity, Permission, RolePermission, UserRole,
    Priority, GoalPeriod, Goal, GoalComment, GoalFeedback,
    Task, EvaluatorDimension, EvaluationRating, Evaluation,
)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'user_type', 'team')
    list_filter = ('user_type', 'team', 'is_active')
    fieldsets = BaseUserAdmin.fieldsets + (
        ('GMS', {'fields': ('user_type', 'team', 'evaluator')}),
    )


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'lead', 'created_at')
    search_fields = ('name',)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'description')


@admin.register(Entity)
class EntityAdmin(admin.ModelAdmin):
    list_display = ('name',)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ('name', 'codename', 'entity')


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ('role', 'permission')


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ('user', 'role')


@admin.register(Priority)
class PriorityAdmin(admin.ModelAdmin):
    list_display = ('name',)


@admin.register(GoalPeriod)
class GoalPeriodAdmin(admin.ModelAdmin):
    list_display = ('name',)


class TaskInline(admin.TabularInline):
    model = Task
    extra = 0


class GoalCommentInline(admin.TabularInline):
    model = GoalComment
    extra = 0
    readonly_fields = ('user', 'created_at')


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ('name', 'status', 'entity', 'assigned_to', 'target_completion', 'due_date', 'is_finalized')
    list_filter = ('status', 'entity', 'priority', 'is_finalized')
    search_fields = ('name', 'description')
    inlines = [TaskInline, GoalCommentInline]


@admin.register(GoalComment)
class GoalCommentAdmin(admin.ModelAdmin):
    list_display = ('goal', 'user', 'created_at')


@admin.register(GoalFeedback)
class GoalFeedbackAdmin(admin.ModelAdmin):
    list_display = ('goal', 'user', 'feedback_type', 'created_at')


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('name', 'goal', 'status')
    list_filter = ('status',)


@admin.register(EvaluatorDimension)
class EvaluatorDimensionAdmin(admin.ModelAdmin):
    list_display = ('name',)


@admin.register(EvaluationRating)
class EvaluationRatingAdmin(admin.ModelAdmin):
    list_display = ('name', 'score')


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ('goal', 'evaluator', 'dimension', 'rating')
