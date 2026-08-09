from django.core.management.base import BaseCommand

from notifications.licenses import sweep_license_expiry


class Command(BaseCommand):
    help = (
        'Notify admins and customers about licenses that are near, or just past, their '
        'end date. Safe to run repeatedly: each reminder is sent once per deadline. '
        'Schedule it daily (cron / Windows Task Scheduler).'
    )

    def handle(self, *args, **options):
        count = sweep_license_expiry()
        self.stdout.write(self.style.SUCCESS(f'Alerted on {count} license(s).'))
