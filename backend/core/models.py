"""
Core models for the Goal Management System.
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Extended user model with user type."""

    class UserType(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        MANAGER = 'manager', 'Manager'
        MEMBER = 'member', 'Member'

    user_type = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.MEMBER,
    )
    team = models.ForeignKey(
        'Team', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='members',
    )
    evaluator = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='direct_reports',
    )

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.get_user_type_display()})"

    @property
    def is_admin_user(self):
        return self.user_type == self.UserType.ADMIN

    @property
    def is_manager(self):
        return self.user_type == self.UserType.MANAGER

    @property
    def is_member(self):
        return self.user_type == self.UserType.MEMBER


class Team(models.Model):
    """Organizational team."""
    name = models.CharField(max_length=200, unique=True)
    description = models.TextField(blank=True)
    lead = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='led_teams',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class Role(models.Model):
    """System roles for access control."""

    class RoleName(models.TextChoices):
        LEADERSHIP = 'leadership', 'Leadership / Admin'
        EVALUATOR = 'evaluator', 'Evaluator / Manager'
        TEAM_MEMBER = 'team_member', 'Team Member'

    name = models.CharField(max_length=50, choices=RoleName.choices, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.get_name_display()


class Entity(models.Model):
    """Goal hierarchy level."""

    class EntityName(models.TextChoices):
        COMPANY = 'company', 'Company'
        TEAM = 'team', 'Team'
        INDIVIDUAL = 'individual', 'Individual'

    name = models.CharField(max_length=50, choices=EntityName.choices, unique=True)

    class Meta:
        verbose_name_plural = 'entities'

    def __str__(self):
        return self.get_name_display()


class Permission(models.Model):
    """Granular permission entries."""
    name = models.CharField(max_length=100)
    codename = models.CharField(max_length=100, unique=True)
    entity = models.ForeignKey(Entity, on_delete=models.CASCADE, related_name='permissions')

    def __str__(self):
        return f"{self.codename} ({self.entity})"


class RolePermission(models.Model):
    """Maps roles to permissions."""
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role} → {self.permission}"


class UserRole(models.Model):
    """Maps users to roles."""
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='user_roles',
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='user_roles')

    class Meta:
        unique_together = ('user', 'role')

    def __str__(self):
        return f"{self.user} → {self.role}"


class Priority(models.Model):
    """Goal priority levels."""

    class PriorityName(models.TextChoices):
        HIGH = 'high', 'High'
        MEDIUM = 'medium', 'Medium'
        LOW = 'low', 'Low'

    name = models.CharField(max_length=20, choices=PriorityName.choices, unique=True)

    class Meta:
        verbose_name_plural = 'priorities'

    def __str__(self):
        return self.get_name_display()


class GoalPeriod(models.Model):
    """Goal timeframe type."""

    class PeriodName(models.TextChoices):
        YEARLY = 'yearly', 'Yearly'
        QUARTERLY = 'quarterly', 'Quarterly'
        MONTHLY = 'monthly', 'Monthly'

    name = models.CharField(max_length=20, choices=PeriodName.choices, unique=True)

    def __str__(self):
        return self.get_name_display()


class Goal(models.Model):
    """Core goal model — the centrepiece of GMS."""

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PENDING = 'pending', 'Pending Approval'
        ACTIVE = 'active', 'Active'
        COMPLETED = 'completed', 'Completed'
        REJECTED = 'rejected', 'Rejected'
        SCORED = 'scored', 'Scored'

    # Basic info
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    labels = models.JSONField(
        default=list, blank=True,
        help_text='Category tags, e.g. ["Growth", "Delivery", "Process"]',
    )

    # Classification
    entity = models.ForeignKey(Entity, on_delete=models.PROTECT, related_name='goals')
    priority = models.ForeignKey(
        Priority, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='goals',
    )
    goal_period = models.ForeignKey(
        GoalPeriod, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='goals',
    )

    # Status & progress
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT,
    )
    target_completion = models.IntegerField(
        default=0,
        help_text='Completion percentage (0-100)',
    )
    weightage = models.IntegerField(
        default=100,
        help_text='Weightage percentage for scoring',
    )

    # Relationships
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='assigned_goals',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='created_goals',
    )
    parent = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='sub_goals',
    )
    team = models.ForeignKey(
        Team, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='goals',
    )
    evaluator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='evaluated_goals',
    )

    # Dates
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Final score (set when evaluation is finalized)
    final_score = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
    )
    final_rating = models.CharField(max_length=30, blank=True)
    is_finalized = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"

    @property
    def is_editable(self):
        """Goals can only be edited in Draft or Rejected state."""
        return self.status in (self.Status.DRAFT, self.Status.REJECTED)

    @property
    def is_at_risk(self):
        """Flag if past 70% of due-date window with < 50% completion."""
        if self.status not in (self.Status.ACTIVE, self.Status.PENDING):
            return False
        total_days = (self.due_date - self.created_at.date()).days
        if total_days <= 0:
            return True
        elapsed_days = (timezone.now().date() - self.created_at.date()).days
        pct_time = (elapsed_days / total_days) * 100
        return pct_time >= 70 and self.target_completion < 50


class GoalComment(models.Model):
    """Comments on a goal (used during approval / tracking)."""
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='comments')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    comment = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Comment by {self.user} on {self.goal}"


class GoalFeedback(models.Model):
    """Mandatory feedback before scoring (member self-reflection OR evaluator feedback)."""

    class FeedbackType(models.TextChoices):
        MEMBER = 'member', 'Member Self-Reflection'
        EVALUATOR = 'evaluator', 'Evaluator Feedback'

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='feedbacks')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    feedback_type = models.CharField(max_length=20, choices=FeedbackType.choices)
    feedback = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('goal', 'feedback_type')

    def __str__(self):
        return f"{self.get_feedback_type_display()} on {self.goal}"


class Task(models.Model):
    """Optional sub-tasks under a goal."""

    class Status(models.TextChoices):
        TODO = 'todo', 'To Do'
        IN_PROGRESS = 'in_progress', 'In Progress'
        DONE = 'done', 'Done'

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=300)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.TODO,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.get_status_display()})"


class EvaluatorDimension(models.Model):
    """Five evaluation dimensions as per PRD."""
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class EvaluationRating(models.Model):
    """Rating levels with numeric scores."""
    name = models.CharField(max_length=50, unique=True)
    score = models.IntegerField()

    class Meta:
        ordering = ['score']

    def __str__(self):
        return f"{self.name} ({self.score})"


class Evaluation(models.Model):
    """Per-dimension evaluation of a completed goal."""
    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='evaluations')
    evaluator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    dimension = models.ForeignKey(EvaluatorDimension, on_delete=models.CASCADE)
    rating = models.ForeignKey(EvaluationRating, on_delete=models.CASCADE)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('goal', 'dimension')

    def __str__(self):
        return f"{self.dimension}: {self.rating} for {self.goal}"
