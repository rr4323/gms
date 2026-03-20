"""
URL routing for the GMS core API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    LoginView, LogoutView, MeView, PasswordChangeView,
    UserViewSet, TeamViewSet, GoalViewSet, TaskViewSet,
    EntityListView, PriorityListView, GoalPeriodListView,
    DimensionListView, RatingListView,
    IndividualReportView, TeamReportView, CompanyReportView,
    OrganizationViewSet, JournalViewSet, MilestoneViewSet,
    CalendarIntegrationViewSet, CalendarEventViewSet, TeamsIntegrationViewSet,
)
from .export_views import ExportReportView

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'teams', TeamViewSet)
router.register(r'goals', GoalViewSet, basename='goal')
router.register(r'tasks', TaskViewSet, basename='task')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'journal', JournalViewSet, basename='journal')
router.register(r'milestones', MilestoneViewSet, basename='milestone')
router.register(r'integrations/calendar', CalendarIntegrationViewSet, basename='calendar-integration')
router.register(r'integrations/events', CalendarEventViewSet, basename='calendar-event')
router.register(r'integrations/teams', TeamsIntegrationViewSet, basename='teams-integration')

urlpatterns = [
    path('', include(router.urls)),
    # Auth
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/password-change/', PasswordChangeView.as_view(), name='password_change'),
    # Lookups
    path('lookups/entities/', EntityListView.as_view(), name='entities'),
    path('lookups/priorities/', PriorityListView.as_view(), name='priorities'),
    path('lookups/periods/', GoalPeriodListView.as_view(), name='periods'),
    path('lookups/dimensions/', DimensionListView.as_view(), name='dimensions'),
    path('lookups/ratings/', RatingListView.as_view(), name='ratings'),
    # Reports
    path('reports/individual/<int:user_id>/', IndividualReportView.as_view(), name='report_individual'),
    path('reports/team/', TeamReportView.as_view(), name='report_team'),
    path('reports/company/', CompanyReportView.as_view(), name='report_company'),
    path('reports/export/', ExportReportView.as_view(), name='export-report'),
]
