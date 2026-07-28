"""Populate the Projects board with a starter set of projects and tasks.

Idempotent: projects are matched on name and tasks on (project, title), so running it twice
adds nothing. Dates are relative to the day it runs, so the board always looks current.

    python manage.py seed_projects            # add anything missing
    python manage.py seed_projects --remove   # delete the seeded projects and their tasks
"""

from datetime import timedelta

from accounts.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone
from projects.models import Project, Task

# (title, status, priority, start offset in days, due offset in days, description)
# Offsets are relative to today: negative is in the past.
PROJECTS = [
    (
        'Helpdesk rollout — Amman office',
        'Move the Amman office onto the new ticketing system: import users, train staff, and retire the old shared mailbox.',
        [
            ('Import staff accounts from the old system', 'done', 'high', -21, -14,
             'Export from the legacy tool, map roles, and load agents and customers.'),
            ('Configure ticket categories', 'done', 'medium', -18, -12,
             'Set up the category tree and default priorities to match how the team actually triages.'),
            ('Train agents on the new workflow', 'in_review', 'high', -10, -2,
             'Two sessions: triage and assignment, then the knowledge base and canned answers.'),
            ('Write the customer-facing announcement', 'in_progress', 'medium', -5, 3,
             'Short email explaining the new tracking page and the reference number.'),
            ('Retire the shared support mailbox', 'todo', 'high', 4, 12,
             'Forward it to the ticket intake for one month, then close it.'),
            ('Collect feedback after two weeks', 'todo', 'low', 14, 21,
             'Short survey to agents on what is slower than before.'),
        ],
    ),
    (
        'Printer fleet refresh',
        'Replace the ageing printers across all branches, standardise on two models, and set up network printing properly.',
        [
            ('Inventory every printer and its age', 'done', 'medium', -30, -24,
             'Model, serial, location, page count, and who depends on it.'),
            ('Agree the two standard models', 'done', 'high', -24, -18,
             'One workgroup mono, one colour multifunction, both with network and duplex.'),
            ('Get quotes from three suppliers', 'in_progress', 'high', -12, 2,
             'Include toner cost per page, not just the hardware price.'),
            ('Plan the swap schedule by branch', 'in_progress', 'medium', -6, 7,
             'One branch per week, starting with the branch with the oldest units.'),
            ('Write the printer setup article', 'in_review', 'low', -4, 1,
             'Step-by-step for adding the new models, for the knowledge base.'),
            ('Arrange disposal of the old units', 'todo', 'low', 10, 25,
             'Certified disposal, with the asset tags recorded before collection.'),
        ],
    ),
    (
        'Q3 backup and recovery review',
        'Verify that backups actually restore, document the procedure, and close the gaps found along the way.',
        [
            ('List every system that holds customer data', 'done', 'urgent', -20, -16,
             'Including the ones nobody remembers until they fail.'),
            ('Test a full restore on the file server', 'in_progress', 'urgent', -8, 4,
             'A backup that has never been restored is not a backup.'),
            ('Check backup retention settings', 'in_review', 'high', -6, 0,
             'Confirm the retention window matches what we tell customers.'),
            ('Document the recovery procedure', 'todo', 'high', 2, 10,
             'Written so someone who was not involved can follow it under pressure.'),
            ('Schedule the next quarterly test', 'todo', 'medium', 12, 15,
             'Calendar invite with the checklist attached.'),
        ],
    ),
]


class Command(BaseCommand):
    help = 'Add sample projects and board tasks (safe to re-run).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--remove',
            action='store_true',
            help='Delete the seeded projects (and their tasks) instead of creating them.',
        )

    def handle(self, *args, **options):
        names = [name for name, _, _ in PROJECTS]

        if options['remove']:
            deleted, _ = Project.objects.filter(name__in=names).delete()
            self.stdout.write(self.style.SUCCESS(f'Removed seeded projects ({deleted} rows).'))
            return

        owner = User.objects.filter(role=User.Role.ADMIN).order_by('id').first()
        if owner is None:
            self.stderr.write('No admin user found — create one first.')
            return
        # Tasks are spread across the staff so the board shows several assignees.
        staff = list(User.objects.filter(role__in=[User.Role.ADMIN, User.Role.AGENT]).order_by('id'))
        today = timezone.localdate()

        projects_created = tasks_created = 0
        for name, description, tasks in PROJECTS:
            project, created = Project.objects.get_or_create(
                name=name, defaults={'description': description, 'created_by': owner}
            )
            projects_created += int(created)

            for index, (title, status, priority, start_offset, due_offset, task_body) in enumerate(tasks):
                _, task_created = Task.objects.get_or_create(
                    project=project,
                    title=title,
                    defaults={
                        'description': task_body,
                        'status': status,
                        'priority': priority,
                        'assignee': staff[index % len(staff)] if staff else None,
                        'start_date': today + timedelta(days=start_offset),
                        'due_date': today + timedelta(days=due_offset),
                        'created_by': owner,
                    },
                )
                tasks_created += int(task_created)

        self.stdout.write(
            self.style.SUCCESS(
                f'Projects seeded — {projects_created} projects and {tasks_created} tasks created.'
            )
        )
