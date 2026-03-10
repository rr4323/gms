"""
API views for the Goal Management System.
"""
from decimal import Decimal

from django.db import models
from django.db.models import Avg, Count, F, Q, ExpressionWrapper, FloatField, IntegerField
from django.utils import timezone
from rest_framework import generics, status, views, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import (
    User, Team, Entity, Priority, GoalPeriod, Goal,
    GoalComment, GoalFeedback, Task,
    EvaluatorDimension, EvaluationRating, Evaluation,
)
from .permissions import (
    IsAdminUser, IsEvaluatorOrAdmin,
    IsGoalOwnerOrEvaluatorOrAdmin, CanApproveGoal,
)
from .serializers import (
    LoginSerializer, UserSerializer, UserCreateSerializer,
    TeamSerializer, EntitySerializer, PrioritySerializer,
    GoalPeriodSerializer, EvaluatorDimensionSerializer, EvaluationRatingSerializer,
    GoalListSerializer, GoalDetailSerializer, GoalCreateUpdateSerializer,
    GoalProgressSerializer, GoalCommentSerializer, GoalFeedbackSerializer,
    EvaluationSerializer, EvaluationCreateSerializer, TaskSerializer,
)


# ── Auth ──────────────────────────────────────────────
class LoginView(views.APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': UserSerializer(user).data,
        })


class LogoutView(views.APIView):
    """Delete token to log out."""

    def post(self, request):
        if hasattr(request.user, 'auth_token'):
            request.user.auth_token.delete()
        return Response({'detail': 'Logged out.'}, status=status.HTTP_200_OK)


class PasswordChangeView(views.APIView):
    """Change password for current user."""

    def post(self, request):
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new_password) < 8:
            return Response({'error': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(new_password)
        request.user.save()
        # Re-create token
        Token.objects.filter(user=request.user).delete()
        token = Token.objects.create(user=request.user)
        return Response({'detail': 'Password changed.', 'token': token.key})


class MeView(views.APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related('team', 'evaluator').all()
    filterset_fields = ['user_type', 'team', 'is_active']
    search_fields = ['username', 'first_name', 'last_name', 'email']

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [IsAuthenticated()]


# ── Teams ─────────────────────────────────────────────
class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.select_related('lead').all()
    serializer_class = TeamSerializer
    search_fields = ['name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAdminUser()]
        return [IsAuthenticated()]


# ── Lookup endpoints ──────────────────────────────────
class EntityListView(generics.ListAPIView):
    queryset = Entity.objects.all()
    serializer_class = EntitySerializer


class PriorityListView(generics.ListAPIView):
    queryset = Priority.objects.all()
    serializer_class = PrioritySerializer


class GoalPeriodListView(generics.ListAPIView):
    queryset = GoalPeriod.objects.all()
    serializer_class = GoalPeriodSerializer


class DimensionListView(generics.ListAPIView):
    queryset = EvaluatorDimension.objects.all()
    serializer_class = EvaluatorDimensionSerializer


class RatingListView(generics.ListAPIView):
    queryset = EvaluationRating.objects.all()
    serializer_class = EvaluationRatingSerializer


# ── Goals ─────────────────────────────────────────────
class GoalViewSet(viewsets.ModelViewSet):
    filterset_fields = ['status', 'entity', 'priority', 'assigned_to', 'team']
    search_fields = ['name', 'description', 'labels']
    ordering_fields = ['created_at', 'due_date', 'target_completion', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Goal.objects.select_related(
            'entity', 'priority', 'goal_period', 'assigned_to', 'created_by', 'team',
            'evaluator',
        ).prefetch_related('tasks', 'comments', 'feedbacks', 'evaluations')

        if user.user_type == 'admin':
            return qs

        # Show goals assigned to user, created by user, or where user is the assigned evaluator
        filters = Q(assigned_to=user) | Q(created_by=user) | Q(evaluator=user)

        return qs.filter(filters).distinct()

    def get_serializer_class(self):
        if self.action == 'list':
            return GoalListSerializer
        elif self.action in ('create', 'update', 'partial_update'):
            return GoalCreateUpdateSerializer
        return GoalDetailSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        goal = self.get_object()
        if not goal.is_editable and request.user.user_type != 'admin':
            return Response(
                {'error': 'Goal can only be edited in Draft or Rejected state.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        goal = self.get_object()
        if not goal.is_editable and request.user.user_type != 'admin':
            return Response(
                {'error': 'Goal can only be edited in Draft or Rejected state.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)

    # ── Status transition actions ─────────────────────
    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit goal for approval → status: pending."""
        goal = self.get_object()
        if goal.status not in (Goal.Status.DRAFT, Goal.Status.REJECTED):
            return Response(
                {'error': 'Only draft or rejected goals can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        goal.status = Goal.Status.PENDING
        goal.save(update_fields=['status', 'updated_at'])
        return Response(GoalDetailSerializer(goal).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanApproveGoal])
    def approve(self, request, pk=None):
        """Approve goal → status: active."""
        goal = self.get_object()
        if goal.status != Goal.Status.PENDING:
            return Response(
                {'error': 'Only pending goals can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        goal.status = Goal.Status.ACTIVE
        goal.save(update_fields=['status', 'updated_at'])
        # Optionally add a comment
        comment_text = request.data.get('comment', '')
        if comment_text:
            GoalComment.objects.create(goal=goal, user=request.user, comment=comment_text)
        return Response(GoalDetailSerializer(goal).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, CanApproveGoal])
    def reject(self, request, pk=None):
        """Reject goal → status: rejected. Comment is mandatory."""
        goal = self.get_object()
        if goal.status != Goal.Status.PENDING:
            return Response(
                {'error': 'Only pending goals can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        comment_text = request.data.get('comment', '')
        if not comment_text:
            return Response(
                {'error': 'A comment is mandatory when rejecting a goal.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        goal.status = Goal.Status.REJECTED
        goal.save(update_fields=['status', 'updated_at'])
        GoalComment.objects.create(goal=goal, user=request.user, comment=comment_text)
        return Response(GoalDetailSerializer(goal).data)

    @action(detail=True, methods=['patch'])
    def progress(self, request, pk=None):
        """Update completion percentage.
        PRD §4: Members own goals, Evaluators their team, Admins all.
        """
        goal = self.get_object()
        user = request.user
        if goal.status != Goal.Status.ACTIVE:
            return Response(
                {'error': 'Can only update progress on active goals.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Check role-based access for progress updates
        can_update = (
            user.user_type == 'admin'
            or goal.assigned_to == user
            or (user.user_type == 'manager' and (
                goal.assigned_to.evaluator == user
                or (goal.team and goal.team.lead == user)
            ))
        )
        if not can_update:
            return Response(
                {'error': 'You do not have permission to update this goal\'s progress.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = GoalProgressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        goal.target_completion = serializer.validated_data['target_completion']
        goal.save(update_fields=['target_completion', 'updated_at'])
        return Response(GoalDetailSerializer(goal).data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark goal as completed.
        PRD §2 Step 5: Both member and evaluator can mark complete.
        """
        goal = self.get_object()
        user = request.user
        if goal.status != Goal.Status.ACTIVE:
            return Response(
                {'error': 'Only active goals can be completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Allow owner, evaluator, or admin to mark complete
        can_complete = (
            user.user_type == 'admin'
            or goal.assigned_to == user
            or (user.user_type == 'manager' and (
                goal.assigned_to.evaluator == user
                or (goal.team and goal.team.lead == user)
            ))
        )
        if not can_complete:
            return Response(
                {'error': 'You do not have permission to complete this goal.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        goal.status = Goal.Status.COMPLETED
        goal.target_completion = 100
        goal.save(update_fields=['status', 'target_completion', 'updated_at'])
        return Response(GoalDetailSerializer(goal).data)

    # ── Comments ──────────────────────────────────────
    @action(detail=True, methods=['get', 'post'])
    def comments(self, request, pk=None):
        goal = self.get_object()
        if request.method == 'GET':
            comments = goal.comments.select_related('user').all()
            return Response(GoalCommentSerializer(comments, many=True).data)
        serializer = GoalCommentSerializer(data={**request.data, 'goal': goal.id})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── Feedback ──────────────────────────────────────
    @action(detail=True, methods=['get', 'post'])
    def feedback(self, request, pk=None):
        goal = self.get_object()
        if request.method == 'GET':
            feedbacks = goal.feedbacks.select_related('user').all()
            return Response(GoalFeedbackSerializer(feedbacks, many=True).data)

        if goal.status not in (Goal.Status.COMPLETED, Goal.Status.SCORED):
            return Response(
                {'error': 'Feedback can only be submitted for completed or scored goals.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        feedback_type = request.data.get('feedback_type')
        # Validate: members submit member feedback, evaluators submit evaluator feedback
        if feedback_type == 'member' and request.user != goal.assigned_to:
            return Response(
                {'error': 'Only the goal owner can submit member feedback.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if feedback_type == 'evaluator':
            if request.user.user_type != 'admin' and goal.evaluator != request.user:
                return Response(
                    {'error': 'Only the assigned evaluator can submit evaluator feedback.'},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = GoalFeedbackSerializer(data={**request.data, 'goal': goal.id})
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    # ── Evaluation ────────────────────────────────────
    @action(detail=True, methods=['get', 'post'], url_path='evaluate')
    def evaluate(self, request, pk=None):
        goal = self.get_object()
        if request.method == 'GET':
            evals = goal.evaluations.select_related('dimension', 'rating').all()
            return Response(EvaluationSerializer(evals, many=True).data)

        if goal.status not in (Goal.Status.COMPLETED, Goal.Status.SCORED):
            return Response(
                {'error': 'Evaluation can only be done on completed goals.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Only the assigned evaluator or admin can submit evaluations
        if request.user.user_type != 'admin' and goal.evaluator != request.user:
            return Response(
                {'error': 'Only the assigned evaluator can score this goal.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check both feedbacks exist
        member_fb = goal.feedbacks.filter(feedback_type='member').exists()
        evaluator_fb = goal.feedbacks.filter(feedback_type='evaluator').exists()
        if not (member_fb and evaluator_fb):
            return Response(
                {'error': 'Both member and evaluator feedback must be submitted before scoring.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EvaluationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        evaluations_data = serializer.validated_data['evaluations']
        final_rating = serializer.validated_data['final_rating']

        created = []
        for item in evaluations_data:
            eval_obj, _ = Evaluation.objects.update_or_create(
                goal=goal,
                dimension_id=item['dimension'],
                defaults={
                    'evaluator': request.user,
                    'rating_id': item['rating'],
                    'comment': item.get('comment', ''),
                },
            )
            created.append(eval_obj)

        # Calculate average score
        avg_score = goal.evaluations.aggregate(avg=Avg('rating__score'))['avg'] or 0

        # Finalize goal
        goal.final_score = Decimal(str(round(avg_score, 2)))
        goal.final_rating = final_rating
        goal.status = Goal.Status.SCORED
        goal.is_finalized = True
        goal.save(update_fields=['final_score', 'final_rating', 'status', 'is_finalized', 'updated_at'])

        return Response(GoalDetailSerializer(goal).data, status=status.HTTP_201_CREATED)


# ── Tasks (sub-items) ────────────────────────────────
class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    filterset_fields = ['goal', 'status']

    def get_queryset(self):
        user = self.request.user
        if user.user_type == 'admin':
            return Task.objects.select_related('goal').all()
        # Only show tasks for goals the user can see
        return Task.objects.select_related('goal').filter(
            Q(goal__assigned_to=user) | Q(goal__created_by=user) | Q(goal__evaluator=user)
        ).distinct()


# ── Dashboard ─────────────────────────────────────────
class DashboardView(views.APIView):
    """Aggregated dashboard stats, filtered by user role."""

    def get(self, request):
        user = request.user
        goals = Goal.objects.all()

        # Filter by role — proper isolation
        if user.user_type == 'member':
            goals = goals.filter(assigned_to=user)
        elif user.user_type == 'manager':
            # Manager sees only their own goals + goals where they are the assigned evaluator
            goals = goals.filter(Q(assigned_to=user) | Q(evaluator=user))
        # admin sees all

        total = goals.count()
        status_counts = dict(goals.values_list('status').annotate(c=Count('id')).values_list('status', 'c'))
        entity_counts = dict(
            goals.values_list('entity__name').annotate(c=Count('id')).values_list('entity__name', 'c')
        )

        # At-risk goals — use DB-side calculation to avoid N+1
        # Determine at-risk goals using Python logic (database agnostic)
        at_risk = []
        for goal in goals.filter(status__in=['active', 'pending']):
            if goal.is_at_risk:
                at_risk.append(goal.id)

        # Performance: avg final_score of scored goals
        scored = goals.filter(is_finalized=True)
        avg_score = scored.aggregate(avg=Avg('final_score'))['avg']

        # Team-wise completion
        team_stats = list(
            goals.filter(team__isnull=False)
            .values('team__name')
            .annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(status__in=['completed', 'scored'])),
                avg_score=Avg('final_score', filter=Q(is_finalized=True)),
            )
        )

        # Per-member stats (for managers / admins)
        member_stats = []
        if user.user_type in ('manager', 'admin'):
            member_stats = list(
                goals.values('assigned_to__id', 'assigned_to__first_name', 'assigned_to__last_name', 'assigned_to__username')
                .annotate(
                    total=Count('id'),
                    completed=Count('id', filter=Q(status__in=['completed', 'scored'])),
                    avg_score=Avg('final_score', filter=Q(is_finalized=True)),
                )
            )

        return Response({
            'total_goals': total,
            'status_counts': {
                'draft': status_counts.get('draft', 0),
                'pending': status_counts.get('pending', 0),
                'active': status_counts.get('active', 0),
                'completed': status_counts.get('completed', 0),
                'rejected': status_counts.get('rejected', 0),
                'scored': status_counts.get('scored', 0),
            },
            'entity_counts': {
                'company': entity_counts.get('company', 0),
                'team': entity_counts.get('team', 0),
                'individual': entity_counts.get('individual', 0),
            },
            'at_risk_count': len(at_risk),
            'at_risk_goal_ids': at_risk,
            'average_score': float(avg_score) if avg_score else None,
            'team_stats': team_stats,
            'member_stats': member_stats,
        })


# ── Reports ───────────────────────────────────────────
class IndividualReportView(views.APIView):
    """Individual performance report for a user."""

    def get(self, request, user_id):
        requester = request.user
        try:
            target_user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Access control
        if requester.user_type == 'member' and requester.id != target_user.id:
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        if requester.user_type == 'manager':
            if requester.id != target_user.id and target_user.evaluator != requester:
                return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

        goals = Goal.objects.filter(assigned_to=target_user).select_related(
            'entity', 'priority', 'goal_period',
        ).prefetch_related('feedbacks', 'evaluations')

        # Apply optional date filters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            goals = goals.filter(created_at__date__gte=start_date)
        if end_date:
            goals = goals.filter(created_at__date__lte=end_date)

        goal_data = GoalListSerializer(goals, many=True).data
        scored = goals.filter(is_finalized=True)
        avg_score = scored.aggregate(avg=Avg('final_score'))['avg']

        return Response({
            'user': UserSerializer(target_user).data,
            'goals': goal_data,
            'summary': {
                'total': goals.count(),
                'completed': goals.filter(status__in=['completed', 'scored']).count(),
                'active': goals.filter(status='active').count(),
                'pending': goals.filter(status='pending').count(),
                'average_score': float(avg_score) if avg_score else None,
            },
        })


class TeamReportView(views.APIView):
    """Team-level report — aggregated across members."""
    permission_classes = [IsAuthenticated, IsEvaluatorOrAdmin]

    def get(self, request):
        user = request.user
        teams = Team.objects.all()

        if user.user_type == 'manager':
            teams = teams.filter(Q(lead=user) | Q(members=user)).distinct()

        reports = []
        for team in teams:
            goals = Goal.objects.filter(team=team)
            scored = goals.filter(is_finalized=True)
            avg_score = scored.aggregate(avg=Avg('final_score'))['avg']

            members = team.members.all()
            member_details = []
            for member in members:
                m_goals = goals.filter(assigned_to=member)
                m_scored = m_goals.filter(is_finalized=True)
                m_avg = m_scored.aggregate(avg=Avg('final_score'))['avg']
                member_details.append({
                    'user': UserSerializer(member).data,
                    'total_goals': m_goals.count(),
                    'completed': m_goals.filter(status__in=['completed', 'scored']).count(),
                    'average_score': float(m_avg) if m_avg else None,
                })

            # Sort for top/bottom performers
            member_details.sort(key=lambda x: x['average_score'] or 0, reverse=True)

            reports.append({
                'team': TeamSerializer(team).data,
                'total_goals': goals.count(),
                'completed': goals.filter(status__in=['completed', 'scored']).count(),
                'average_score': float(avg_score) if avg_score else None,
                'members': member_details,
            })

        return Response(reports)


class CompanyReportView(views.APIView):
    """Company-wide report — org-level summary."""
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        goals = Goal.objects.all()
        total = goals.count()
        scored = goals.filter(is_finalized=True)
        avg_score = scored.aggregate(avg=Avg('final_score'))['avg']

        # Score distribution
        score_dist = list(
            scored.values('final_rating')
            .annotate(count=Count('id'))
            .order_by('final_rating')
        )

        # Per-team summary
        team_summary = list(
            goals.filter(team__isnull=False)
            .values('team__id', 'team__name')
            .annotate(
                total=Count('id'),
                completed=Count('id', filter=Q(status__in=['completed', 'scored'])),
                avg_score=Avg('final_score', filter=Q(is_finalized=True)),
            )
            .order_by('team__name')
        )

        return Response({
            'total_goals': total,
            'completed': goals.filter(status__in=['completed', 'scored']).count(),
            'active': goals.filter(status='active').count(),
            'pending': goals.filter(status='pending').count(),
            'average_score': float(avg_score) if avg_score else None,
            'score_distribution': score_dist,
            'team_summary': team_summary,
        })
