"""
PDF and CSV report generation for GMS.
"""
import csv
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)


def generate_report_pdf(report_data, report_type='individual'):
    """Generate a PDF report and return bytes."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=0.75 * inch, leftMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle', parent=styles['Title'],
        fontSize=18, spaceAfter=20,
    )
    heading_style = ParagraphStyle(
        'CustomHeading', parent=styles['Heading2'],
        fontSize=14, spaceAfter=10, spaceBefore=15,
    )

    elements = []

    # Title
    title_map = {
        'individual': 'Individual Performance Report',
        'team': 'Team Performance Report',
        'company': 'Company Performance Report',
    }
    elements.append(Paragraph(title_map.get(report_type, 'Report'), title_style))
    elements.append(Paragraph(
        f'Generated on {datetime.now().strftime("%B %d, %Y at %I:%M %p")}',
        styles['Normal'],
    ))
    elements.append(Spacer(1, 20))

    if report_type == 'individual':
        _build_individual_pdf(elements, report_data, styles, heading_style)
    elif report_type == 'team':
        _build_team_pdf(elements, report_data, styles, heading_style)
    elif report_type == 'company':
        _build_company_pdf(elements, report_data, styles, heading_style)

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()


def _build_individual_pdf(elements, data, styles, heading_style):
    user = data.get('user', {})
    summary = data.get('summary', {})
    goals = data.get('goals', [])

    elements.append(Paragraph(
        f'Employee: {user.get("first_name", "")} {user.get("last_name", "")}',
        heading_style,
    ))
    elements.append(Spacer(1, 10))

    # Summary table
    summary_data = [
        ['Metric', 'Value'],
        ['Total Goals', str(summary.get('total', 0))],
        ['Completed', str(summary.get('completed', 0))],
        ['Active', str(summary.get('active', 0))],
        ['Pending', str(summary.get('pending', 0))],
        ['Average Score', str(summary.get('average_score', 'N/A'))],
    ]
    table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
    table.setStyle(_table_style())
    elements.append(table)
    elements.append(Spacer(1, 20))

    # Goals table
    if goals:
        elements.append(Paragraph('Goals', heading_style))
        goal_rows = [['Goal', 'Status', 'Completion %', 'Due Date', 'Rating']]
        for g in goals:
            goal_rows.append([
                g.get('name', ''),
                g.get('status', ''),
                f"{g.get('target_completion', 0)}%",
                str(g.get('due_date', '')),
                g.get('final_rating', '—'),
            ])
        gt = Table(goal_rows, colWidths=[2.2 * inch, 1 * inch, 1 * inch, 1 * inch, 1.3 * inch])
        gt.setStyle(_table_style())
        elements.append(gt)


def _build_team_pdf(elements, data, styles, heading_style):
    for team_report in data:
        team = team_report.get('team', {})
        elements.append(Paragraph(f'Team: {team.get("name", "")}', heading_style))

        summary_data = [
            ['Metric', 'Value'],
            ['Total Goals', str(team_report.get('total_goals', 0))],
            ['Completed', str(team_report.get('completed', 0))],
            ['Average Score', str(team_report.get('average_score', 'N/A'))],
        ]
        table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
        table.setStyle(_table_style())
        elements.append(table)
        elements.append(Spacer(1, 10))

        # Members
        members = team_report.get('members', [])
        if members:
            member_rows = [['Member', 'Goals', 'Completed', 'Avg Score']]
            for m in members:
                u = m.get('user', {})
                member_rows.append([
                    f"{u.get('first_name', '')} {u.get('last_name', '')}",
                    str(m.get('total_goals', 0)),
                    str(m.get('completed', 0)),
                    str(m.get('average_score', 'N/A')),
                ])
            mt = Table(member_rows, colWidths=[2.5 * inch, 1.3 * inch, 1.3 * inch, 1.4 * inch])
            mt.setStyle(_table_style())
            elements.append(mt)
        elements.append(Spacer(1, 20))


def _build_company_pdf(elements, data, styles, heading_style):
    elements.append(Paragraph('Company Summary', heading_style))

    summary_data = [
        ['Metric', 'Value'],
        ['Total Goals', str(data.get('total_goals', 0))],
        ['Completed', str(data.get('completed', 0))],
        ['Active', str(data.get('active', 0))],
        ['Pending', str(data.get('pending', 0))],
        ['Average Score', str(data.get('average_score', 'N/A'))],
    ]
    table = Table(summary_data, colWidths=[3 * inch, 3 * inch])
    table.setStyle(_table_style())
    elements.append(table)
    elements.append(Spacer(1, 20))

    # Team Summary
    teams = data.get('team_summary', [])
    if teams:
        elements.append(Paragraph('By Team', heading_style))
        team_rows = [['Team', 'Total', 'Completed', 'Avg Score']]
        for t in teams:
            team_rows.append([
                t.get('team__name', ''),
                str(t.get('total', 0)),
                str(t.get('completed', 0)),
                str(t.get('avg_score', 'N/A')),
            ])
        tt = Table(team_rows, colWidths=[2.5 * inch, 1.3 * inch, 1.3 * inch, 1.4 * inch])
        tt.setStyle(_table_style())
        elements.append(tt)


def _table_style():
    return TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#6C63FF')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#F8F9FA')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#DEE2E6')),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F8F9FA')]),
    ])


def generate_report_csv(report_data, report_type='individual'):
    """Generate a CSV report and return string content."""
    output = io.StringIO()
    writer = csv.writer(output)

    if report_type == 'individual':
        user = report_data.get('user', {})
        writer.writerow(['Individual Performance Report'])
        writer.writerow([f'{user.get("first_name", "")} {user.get("last_name", "")}'])
        writer.writerow([])

        writer.writerow(['Goal', 'Status', 'Completion %', 'Due Date', 'Weightage', 'Rating', 'Score'])
        for g in report_data.get('goals', []):
            writer.writerow([
                g.get('name', ''),
                g.get('status', ''),
                g.get('target_completion', 0),
                g.get('due_date', ''),
                g.get('weightage', ''),
                g.get('final_rating', ''),
                '',
            ])

        summary = report_data.get('summary', {})
        writer.writerow([])
        writer.writerow(['Summary'])
        writer.writerow(['Total Goals', summary.get('total', 0)])
        writer.writerow(['Completed', summary.get('completed', 0)])
        writer.writerow(['Average Score', summary.get('average_score', 'N/A')])

    elif report_type == 'team':
        writer.writerow(['Team Performance Report'])
        writer.writerow([])
        for team_report in report_data:
            team = team_report.get('team', {})
            writer.writerow([f'Team: {team.get("name", "")}'])
            writer.writerow(['Member', 'Total Goals', 'Completed', 'Avg Score'])
            for m in team_report.get('members', []):
                u = m.get('user', {})
                writer.writerow([
                    f'{u.get("first_name", "")} {u.get("last_name", "")}',
                    m.get('total_goals', 0),
                    m.get('completed', 0),
                    m.get('average_score', 'N/A'),
                ])
            writer.writerow([])

    elif report_type == 'company':
        writer.writerow(['Company Performance Report'])
        writer.writerow([])
        writer.writerow(['Total Goals', report_data.get('total_goals', 0)])
        writer.writerow(['Completed', report_data.get('completed', 0)])
        writer.writerow(['Average Score', report_data.get('average_score', 'N/A')])
        writer.writerow([])
        writer.writerow(['Team', 'Total', 'Completed', 'Avg Score'])
        for t in report_data.get('team_summary', []):
            writer.writerow([
                t.get('team__name', ''),
                t.get('total', 0),
                t.get('completed', 0),
                t.get('avg_score', 'N/A'),
            ])

    output.seek(0)
    return output.getvalue()
