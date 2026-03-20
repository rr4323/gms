"""
Google Calendar integration service.
Handles OAuth flow, event creation, and sync.
"""
import logging

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

# Google OAuth settings (set these in environment)
GOOGLE_CLIENT_ID = getattr(settings, 'GOOGLE_CALENDAR_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = getattr(settings, 'GOOGLE_CALENDAR_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = getattr(settings, 'GOOGLE_CALENDAR_REDIRECT_URI', '')
GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar']


def get_auth_url():
    """Generate the Google OAuth authorization URL."""
    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_config(
            {
                'web': {
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uris': [GOOGLE_REDIRECT_URI],
                    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                    'token_uri': 'https://oauth2.googleapis.com/token',
                }
            },
            scopes=GOOGLE_SCOPES,
        )
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        auth_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
        )
        return auth_url
    except ImportError:
        logger.warning('google-auth-oauthlib not installed. Google Calendar integration disabled.')
        return None


def exchange_code(code):
    """Exchange the authorization code for tokens."""
    try:
        from google_auth_oauthlib.flow import Flow
        flow = Flow.from_client_config(
            {
                'web': {
                    'client_id': GOOGLE_CLIENT_ID,
                    'client_secret': GOOGLE_CLIENT_SECRET,
                    'redirect_uris': [GOOGLE_REDIRECT_URI],
                    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                    'token_uri': 'https://oauth2.googleapis.com/token',
                }
            },
            scopes=GOOGLE_SCOPES,
        )
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        flow.fetch_token(code=code)
        credentials = flow.credentials
        return {
            'access_token': credentials.token,
            'refresh_token': credentials.refresh_token,
            'token_expires_at': credentials.expiry,
        }
    except ImportError:
        logger.warning('google-auth-oauthlib not installed.')
        return None
    except Exception as e:
        logger.error(f'Failed to exchange code: {e}')
        return None


def create_calendar_event(integration, goal):
    """
    Create a Google Calendar event for a goal deadline.
    Returns the external event ID or None.
    """
    try:
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=integration.access_token,
            refresh_token=integration.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
        )
        service = build('calendar', 'v3', credentials=creds)

        event = {
            'summary': f'[GMS] {goal.name}',
            'description': goal.description or f'Goal deadline: {goal.name}',
            'start': {'date': str(goal.due_date)},
            'end': {'date': str(goal.due_date)},
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'popup', 'minutes': 1440},  # 1 day before
                ],
            },
        }
        calendar_id = integration.calendar_id or 'primary'
        created = service.events().insert(calendarId=calendar_id, body=event).execute()
        return created.get('id')
    except ImportError:
        logger.warning('Google API client not installed.')
        return None
    except Exception as e:
        logger.error(f'Failed to create calendar event: {e}')
        return None


def sync_events(integration):
    """
    Pull events from Google Calendar.
    Returns a list of event dicts.
    """
    try:
        from googleapiclient.discovery import build
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token=integration.access_token,
            refresh_token=integration.refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=GOOGLE_CLIENT_ID,
            client_secret=GOOGLE_CLIENT_SECRET,
        )
        service = build('calendar', 'v3', credentials=creds)

        now = timezone.now().isoformat()
        calendar_id = integration.calendar_id or 'primary'
        events_result = service.events().list(
            calendarId=calendar_id,
            timeMin=now,
            maxResults=50,
            singleEvents=True,
            orderBy='startTime',
        ).execute()
        return events_result.get('items', [])
    except ImportError:
        logger.warning('Google API client not installed.')
        return []
    except Exception as e:
        logger.error(f'Failed to sync events: {e}')
        return []
