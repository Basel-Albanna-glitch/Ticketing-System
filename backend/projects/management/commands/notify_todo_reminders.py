from django.core.management.base import BaseCommand

from projects.reminders import sweep_todo_reminders


class Command(BaseCommand):
    help = (
        'Send any to-do reminders that have come due. Safe to run repeatedly: each '
        'reminder goes out once. Schedule it every few minutes (cron / Windows Task '
        'Scheduler) for delivery that does not depend on someone having the app open.'
    )

    def handle(self, *args, **options):
        count = sweep_todo_reminders()
        self.stdout.write(self.style.SUCCESS(f'Sent {count} reminder(s).'))
