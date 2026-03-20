"""
Microsoft Teams webhook notification service.
Posts adaptive cards to Teams channels on goal status changes.
"""
import logging

import requests

logger = logging.getLogger(__name__)


def send_goal_notification(webhook_url, goal, event_type, user=None):
    """
    Send a goal status notification to a Teams channel via incoming webhook.

    Args:
        webhook_url: The Teams incoming webhook URL
        goal: Goal model instance
        event_type: String describing the event (e.g., 'approved', 'completed')
        user: Optional User who triggered the event
    """
    status_colors = {
        'draft': '#6B7280',
        'pending': '#F59E0B',
        'active': '#3B82F6',
        'completed': '#10B981',
        'rejected': '#EF4444',
        'scored': '#8B5CF6',
    }

    color = status_colors.get(goal.status, '#6B7280')
    actor = user.get_full_name() if user else 'System'

    # Teams Adaptive Card payload
    payload = {
        'type': 'message',
        'attachments': [
            {
                'contentType': 'application/vnd.microsoft.card.adaptive',
                'content': {
                    '$schema': 'http://adaptivecards.io/schemas/adaptive-card.json',
                    'type': 'AdaptiveCard',
                    'version': '1.4',
                    'body': [
                        {
                            'type': 'TextBlock',
                            'text': f'🎯 Goal {event_type.title()}',
                            'weight': 'Bolder',
                            'size': 'Large',
                            'color': 'Accent',
                        },
                        {
                            'type': 'FactSet',
                            'facts': [
                                {'title': 'Goal', 'value': goal.name},
                                {'title': 'Status', 'value': goal.get_status_display()},
                                {'title': 'By', 'value': actor},
                                {'title': 'Progress', 'value': f'{goal.target_completion}%'},
                            ],
                        },
                    ],
                },
            }
        ],
    }

    if goal.description:
        payload['attachments'][0]['content']['body'].append({
            'type': 'TextBlock',
            'text': goal.description[:200],
            'wrap': True,
            'size': 'Small',
            'color': 'Default',
        })

    try:
        response = requests.post(webhook_url, json=payload, timeout=10)
        response.raise_for_status()
        logger.info(f'Teams notification sent: {event_type} for goal {goal.id}')
        return True
    except requests.RequestException as e:
        logger.error(f'Failed to send Teams notification: {e}')
        return False


def notify_goal_status_change(goal, old_status, new_status, user=None):
    """
    Send notifications to all active Teams integrations for this goal's org/team.
    """
    from ..models import TeamsIntegration

    integrations = TeamsIntegration.objects.filter(is_active=True)

    # Filter by organization
    if goal.organization:
        org_integrations = integrations.filter(organization=goal.organization)
    else:
        org_integrations = TeamsIntegration.objects.none()

    # Filter by team
    if goal.team:
        team_integrations = integrations.filter(team=goal.team)
    else:
        team_integrations = TeamsIntegration.objects.none()

    # Combine and deduplicate
    all_integrations = (org_integrations | team_integrations).distinct()

    event_type = f'{old_status} → {new_status}'
    for integration in all_integrations:
        send_goal_notification(integration.webhook_url, goal, event_type, user)
