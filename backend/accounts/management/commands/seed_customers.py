"""Add a sample customer: a multi-branch restaurant group.

Idempotent: the customer is matched on username and branches on (customer, name), so running
it twice adds nothing.

    python manage.py seed_customers            # create it if missing
    python manage.py seed_customers --remove   # delete it, with its branches and licences
"""

from datetime import timedelta

from accounts.models import CustomerBranch, CustomerLicense, SoftwareType, User
from django.core.management.base import BaseCommand
from django.utils import timezone

USERNAME = 'zaytoun'
PASSWORD = 'zaytoun1234'

CUSTOMER = {
    'full_name': 'Zaytoun Grill',
    'email': 'it@zaytoungrill.example',
    'phone': '+962 6 552 4400',
    'address': 'Head office: Zahran Street, Building 21, 4th floor, Amman, Jordan',
    'tax_number': '1099384',
    # Falls back to whatever software type exists if this one hasn't been set up.
    'software_type': 'Aloha',
}

# (branch name, address)
BRANCHES = [
    ('Abdoun', 'Abdoun Circle, Al Sa\'ada Street, Amman'),
    ('Sweifieh', 'Wakalat Street, opposite the pedestrian mall, Amman'),
    ('Khalda', 'Wasfi Al-Tal Street (Gardens), near the 7th Circle, Amman'),
    ('Mecca Street', 'Mecca Street, Al Hussein Complex, ground floor, Amman'),
    ('Irbid', 'University Street, next to the north gate, Irbid'),
]

# (licence name, start offset in days, end offset in days) — relative to today, so the
# sample always has one licence that is current and one that is close to expiring.
LICENSES = [
    ('POS licence — 12 terminals', -300, 65),
    ('Back-office & reporting module', -120, 245),
]


class Command(BaseCommand):
    help = 'Add a sample multi-branch restaurant customer (safe to re-run).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--remove',
            action='store_true',
            help='Delete the sample customer along with its branches and licences.',
        )

    def handle(self, *args, **options):
        if options['remove']:
            deleted, _ = User.objects.filter(username=USERNAME, role=User.Role.CUSTOMER).delete()
            self.stdout.write(self.style.SUCCESS(f'Removed the sample customer ({deleted} rows).'))
            return

        # Only set a software type that actually exists, rather than inventing taxonomy.
        software = CUSTOMER['software_type']
        if not SoftwareType.objects.filter(name__iexact=software).exists():
            fallback = SoftwareType.objects.values_list('name', flat=True).first()
            self.stdout.write(
                self.style.WARNING(
                    f'Software type "{software}" not found — using '
                    f'{f'"{fallback}"' if fallback else 'none'} instead.'
                )
            )
            software = fallback or ''

        customer = User.objects.filter(username=USERNAME).first()
        if customer is None:
            customer = User.objects.create_user(
                username=USERNAME,
                password=PASSWORD,
                role=User.Role.CUSTOMER,
                full_name=CUSTOMER['full_name'],
                email=CUSTOMER['email'],
                phone=CUSTOMER['phone'],
                address=CUSTOMER['address'],
                tax_number=CUSTOMER['tax_number'],
                software_types=[software] if software else [],
            )
            created = True
        else:
            created = False

        today = timezone.localdate()
        branches_added = sum(
            CustomerBranch.objects.get_or_create(
                customer=customer, name=name, defaults={'address': address}
            )[1]
            for name, address in BRANCHES
        )
        licenses_added = sum(
            CustomerLicense.objects.get_or_create(
                customer=customer,
                name=name,
                defaults={
                    'start_date': today + timedelta(days=start),
                    'end_date': today + timedelta(days=end),
                },
            )[1]
            for name, start, end in LICENSES
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'{"Created" if created else "Found"} customer "{CUSTOMER["full_name"]}" '
                f'(@{USERNAME}) — {branches_added} branches and {licenses_added} licences added.'
            )
        )
        if created:
            self.stdout.write(f'Sign-in for testing: {USERNAME} / {PASSWORD}')
