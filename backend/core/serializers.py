"""
DRF Serializers for the Goal Management System.
"""
from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import (
    User, Team, Role, Entity, Permission, UserRole,
    Priority, GoalPeriod, Goal, GoalComment, GoalFeedback,
    Task, EvaluatorDimension, EvaluationRating, Evaluation,
)


# ── Auth ──────────────────────────────────────────────
class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(**data)
        if user and user.is_active:
            return user
        raise serializers.ValidationError('Invalid credentials.')


class UserSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    evaluator_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'user_type', 'team', 'team_name', 'evaluator', 'evaluator_name',
            'is_active',
        ]
        read_only_fields = ['id']

    def get_evaluator_name(self, obj):
        if obj.evaluator:
            return obj.evaluator.get_full_name() or obj.evaluator.username
        return None


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'password', 'first_name', 'last_name',
            'user_type', 'team', 'evaluator',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ── Lookup tables ─────────────────────────────────────
class TeamSerializer(serializers.ModelSerializer):
    lead_name = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Team
        fields = ['id', 'name', 'description', 'lead', 'lead_name', 'member_count', 'created_at']

    def get_lead_name(self, obj):
        if obj.lead:
            return obj.lead.get_full_name() or obj.lead.username
        return None

    def get_member_count(self, obj):
        return obj.members.count()


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'


class EntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Entity
        fields = '__all__'


class PrioritySerializer(serializers.ModelSerializer):
    class Meta:
        model = Priority
        fields = '__all__'


class GoalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalPeriod
        fields = '__all__'


class EvaluatorDimensionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluatorDimension
        fields = '__all__'


class EvaluationRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationRating
        fields = '__all__'


# ── Tasks (sub-items) ────────────────────────────────
class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = ['id', 'goal', 'name', 'status', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


# ── Comments ──────────────────────────────────────────
class GoalCommentSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = GoalComment
        fields = ['id', 'goal', 'user', 'user_name', 'comment', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


# ── Feedback ──────────────────────────────────────────
class GoalFeedbackSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = GoalFeedback
        fields = ['id', 'goal', 'user', 'user_name', 'feedback_type', 'feedback', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username


# ── Evaluation ────────────────────────────────────────
class EvaluationSerializer(serializers.ModelSerializer):
    dimension_name = serializers.CharField(source='dimension.name', read_only=True)
    rating_name = serializers.CharField(source='rating.name', read_only=True)
    rating_score = serializers.IntegerField(source='rating.score', read_only=True)

    class Meta:
        model = Evaluation
        fields = [
            'id', 'goal', 'evaluator', 'dimension', 'dimension_name',
            'rating', 'rating_name', 'rating_score', 'comment', 'created_at',
        ]
        read_only_fields = ['id', 'evaluator', 'created_at']


class EvaluationCreateSerializer(serializers.Serializer):
    """Accepts bulk evaluation: list of {dimension, rating, comment}."""
    evaluations = serializers.ListField(
        child=serializers.DictField(), min_length=1,
    )
    final_rating = serializers.CharField()

    def validate_evaluations(self, value):
        required_keys = {'dimension', 'rating'}
        for item in value:
            if not required_keys.issubset(item.keys()):
                raise serializers.ValidationError(
                    'Each evaluation must have "dimension" and "rating" keys.'
                )
        return value


# ── Goal ──────────────────────────────────────────────
class GoalListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views."""
    assigned_to_name = serializers.SerializerMethodField()
    evaluator_name = serializers.SerializerMethodField()
    entity_name = serializers.CharField(source='entity.get_name_display', read_only=True)
    priority_name = serializers.CharField(source='priority.get_name_display', read_only=True, default=None)
    is_at_risk = serializers.BooleanField(read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Goal
        fields = [
            'id', 'name', 'status', 'entity', 'entity_name',
            'priority', 'priority_name', 'target_completion', 'weightage',
            'assigned_to', 'assigned_to_name',
            'evaluator', 'evaluator_name', 'due_date',
            'is_at_risk', 'is_finalized', 'final_rating',
            'task_count', 'labels', 'created_at', 'updated_at',
        ]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_evaluator_name(self, obj):
        return (obj.evaluator.get_full_name() or obj.evaluator.username) if obj.evaluator else None

    def get_task_count(self, obj):
        return obj.tasks.count()


class GoalDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested relationships."""
    assigned_to_name = serializers.SerializerMethodField()
    evaluator_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    entity_name = serializers.CharField(source='entity.get_name_display', read_only=True)
    priority_name = serializers.CharField(source='priority.get_name_display', read_only=True, default=None)
    goal_period_name = serializers.CharField(source='goal_period.get_name_display', read_only=True, default=None)
    team_name = serializers.CharField(source='team.name', read_only=True, default=None)
    is_at_risk = serializers.BooleanField(read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    comments = GoalCommentSerializer(many=True, read_only=True)
    feedbacks = GoalFeedbackSerializer(many=True, read_only=True)
    evaluations = EvaluationSerializer(many=True, read_only=True)

    class Meta:
        model = Goal
        fields = [
            'id', 'name', 'description', 'labels',
            'entity', 'entity_name', 'priority', 'priority_name',
            'goal_period', 'goal_period_name', 'team', 'team_name',
            'assigned_to', 'assigned_to_name',
            'evaluator', 'evaluator_name',
            'created_by', 'created_by_name',
            'parent', 'due_date',
            'final_score', 'final_rating', 'is_finalized',
            'is_at_risk', 'is_editable',
            'tasks', 'comments', 'feedbacks', 'evaluations',
            'created_at', 'updated_at',
        ]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() or obj.assigned_to.username

    def get_evaluator_name(self, obj):
        return (obj.evaluator.get_full_name() or obj.evaluator.username) if obj.evaluator else None

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() or obj.created_by.username


class GoalCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            'id', 'name', 'description', 'labels',
            'entity', 'priority', 'goal_period', 'team',
            'weightage', 'assigned_to', 'evaluator', 'parent', 'due_date',
        ]
        read_only_fields = ['id']

    def validate(self, data):
        # On update, enforce editable only in Draft / Rejected
        if self.instance and not self.instance.is_editable:
            raise serializers.ValidationError(
                'Goal can only be edited in Draft or Rejected state.'
            )
        return data


class GoalProgressSerializer(serializers.Serializer):
    target_completion = serializers.IntegerField(min_value=0, max_value=100)
