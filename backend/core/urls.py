"""
URL routing for the GMS core API.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from . import views
from .export_views import ExportReportView

router = DefaultRouter()
router.register(r'goals', views.GoalViewSet, basename='goal')
router.register(r'users', views.UserViewSet, basename='user')
router.register(r'teams', views.TeamViewSet, basename='team')
router.register(r'tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    # Auth
    path('auth/login/', views.LoginView.as_view(), name='login'),
    path('auth/logout/', views.LogoutView.as_view(), name='logout'),
    path('auth/me/', views.MeView.as_view(), name='me'),
    path('auth/password-change/', views.PasswordChangeView.as_view(), name='password-change'),

    # Lookups
    path('entities/', views.EntityListView.as_view(), name='entity-list'),
    path('priorities/', views.PriorityListView.as_view(), name='priority-list'),
    path('goal-periods/', views.GoalPeriodListView.as_view(), name='goalperiod-list'),
    path('dimensions/', views.DimensionListView.as_view(), name='dimension-list'),
    path('ratings/', views.RatingListView.as_view(), name='rating-list'),

    # Dashboard
    path('dashboard/', views.DashboardView.as_view(), name='dashboard'),

    # Reports
    path('reports/individual/<int:user_id>/', views.IndividualReportView.as_view(), name='individual-report'),
    path('reports/team/', views.TeamReportView.as_view(), name='team-report'),
    path('reports/company/', views.CompanyReportView.as_view(), name='company-report'),
    path('reports/export/', ExportReportView.as_view(), name='export-report'),

    # Router
    path('', include(router.urls)),
]
