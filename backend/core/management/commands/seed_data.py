"""
Management command to seed initial data (roles, entities, priorities, etc.).
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from core.models import (
    Entity, Priority, GoalPeriod, Role,
    EvaluatorDimension, EvaluationRating, Team, UserRole,
)

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed initial reference data and demo users for GMS'

    def add_arguments(self, parser):
        parser.add_argument(
            '--no-input', action='store_true',
            help='Skip confirmation prompts.',
        )

    def handle(self, *args, **options):
        self.stdout.write('Seeding reference data...')

        # ── Entities ──
        for name in ['company', 'team', 'individual']:
            Entity.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('  ✓ Entities'))

        # ── Priorities ──
        for name in ['high', 'medium', 'low']:
            Priority.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('  ✓ Priorities'))

        # ── Goal Periods ──
        for name in ['yearly', 'quarterly', 'monthly']:
            GoalPeriod.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('  ✓ Goal Periods'))

        # ── Roles ──
        for name in ['leadership', 'evaluator', 'team_member']:
            Role.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('  ✓ Roles'))

        # ── Evaluator Dimensions ──
        for name in ['Quality', 'Ownership', 'Communication', 'Timeliness', 'Initiative']:
            EvaluatorDimension.objects.get_or_create(name=name)
        self.stdout.write(self.style.SUCCESS('  ✓ Evaluator Dimensions'))

        # ── Evaluation Ratings ──
        ratings = [
            ('Below Expectations', 1),
            ('Partially Meets', 2),
            ('Meets Expectations', 3),
            ('Exceeds Expectations', 4),
            ('Above Expectations', 5),
        ]
        for name, score in ratings:
            EvaluationRating.objects.get_or_create(name=name, defaults={'score': score})
        self.stdout.write(self.style.SUCCESS('  ✓ Evaluation Ratings'))

        # ── Demo Team ──
        team, _ = Team.objects.get_or_create(
            name='Engineering',
            defaults={'description': 'Core engineering team'},
        )

        # ── Demo Users ──
        admin_user = self._create_user(
            'admin', 'admin@gms.local', 'admin123',
            first_name='System', last_name='Admin',
            user_type='admin',
        )

        manager_user = self._create_user(
            'manager', 'manager@gms.local', 'manager123',
            first_name='Sarah', last_name='Johnson',
            user_type='manager', team=team,
        )
        team.lead = manager_user
        team.save(update_fields=['lead'])

        member_user = self._create_user(
            'member', 'member@gms.local', 'member123',
            first_name='Alex', last_name='Rivera',
            user_type='member', team=team, evaluator=manager_user,
        )

        member2_user = self._create_user(
            'member2', 'member2@gms.local', 'member123',
            first_name='Jordan', last_name='Chen',
            user_type='member', team=team, evaluator=manager_user,
        )

        # Assign roles
        leadership_role = Role.objects.get(name='leadership')
        evaluator_role = Role.objects.get(name='evaluator')
        member_role = Role.objects.get(name='team_member')

        UserRole.objects.get_or_create(user=admin_user, role=leadership_role)
        UserRole.objects.get_or_create(user=manager_user, role=evaluator_role)
        UserRole.objects.get_or_create(user=member_user, role=member_role)
        UserRole.objects.get_or_create(user=member2_user, role=member_role)

        self.stdout.write(self.style.SUCCESS('  ✓ Demo Users & Team'))
        self.stdout.write(self.style.SUCCESS('\n✅ Seeding complete!'))
        self.stdout.write('\nDemo accounts:')
        self.stdout.write('  admin    / admin123    (Leadership)')
        self.stdout.write('  manager  / manager123  (Evaluator)')
        self.stdout.write('  member   / member123   (Team Member)')
        self.stdout.write('  member2  / member123   (Team Member)')

    def _create_user(self, username, email, password, **kwargs):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, **kwargs},
        )
        if created:
            user.set_password(password)
            user.save()
        return user
