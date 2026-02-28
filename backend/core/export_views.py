"""
Export views for PDF and CSV reports.
"""
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from .models import User, Goal, Team
from .permissions import IsEvaluatorOrAdmin, IsAdminUser
from .reports import generate_report_pdf, generate_report_csv
from .serializers import GoalListSerializer, UserSerializer, TeamSerializer
from .views import IndividualReportView, TeamReportView, CompanyReportView


class ExportReportView(APIView):
    """Export reports as PDF or CSV."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get('type', 'individual')
        file_format = request.query_params.get('format', 'pdf')
        user_id = request.query_params.get('user_id')

        # Get report data based on type
        if report_type == 'individual':
            if not user_id:
                user_id = request.user.id
            # Re-use the individual report logic
            view = IndividualReportView()
            view.request = request
            response = view.get(request, int(user_id))
            report_data = response.data

        elif report_type == 'team':
            if request.user.user_type not in ('admin', 'manager'):
                return HttpResponse('Access denied', status=403)
            view = TeamReportView()
            view.request = request
            response = view.get(request)
            report_data = response.data

        elif report_type == 'company':
            if request.user.user_type != 'admin':
                return HttpResponse('Access denied', status=403)
            view = CompanyReportView()
            view.request = request
            response = view.get(request)
            report_data = response.data
        else:
            return HttpResponse('Invalid report type', status=400)

        if file_format == 'pdf':
            pdf_bytes = generate_report_pdf(report_data, report_type)
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="gms_{report_type}_report.pdf"'
            return response
        elif file_format == 'csv':
            csv_content = generate_report_csv(report_data, report_type)
            response = HttpResponse(csv_content, content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="gms_{report_type}_report.csv"'
            return response
        else:
            return HttpResponse('Invalid format. Use pdf or csv.', status=400)
