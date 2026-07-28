"""Populate the knowledge base with a starter set of help articles.

Idempotent: articles are matched on title, so running it twice adds nothing. Categories are
matched by name and only used if they already exist — the command never invents taxonomy.

    python manage.py seed_kb            # add anything missing
    python manage.py seed_kb --replace  # overwrite the body/category of seeded articles
"""

from accounts.models import User
from django.core.management.base import BaseCommand
from tickets.models import Article, Category

# (title, category name or None, body). Bodies are plain text; blank lines separate
# paragraphs, which is exactly how the article page renders them.
ARTICLES = [
    (
        'Submitting a ticket and tracking it',
        'Software',
        """Every request you send us becomes a ticket with its own reference number, for example HERMES-TKT-26-000123. Quote that number in any follow-up and we can find your request instantly.

To submit a ticket while signed in, open Tickets and choose New ticket. Describe what happened, what you expected instead, and attach a screenshot if you have one — a screenshot usually saves a whole round of questions.

If you do not have an account, use the public form instead. You will be given a reference number at the end. Save it: together with the phone number you entered, it is what lets you open the tracking page later.

You can reply to our answers directly from the ticket, and you will be notified when the status changes.""",
    ),
    (
        'What each ticket status means',
        'Software',
        """Unassigned means we have received the ticket but nobody has picked it up yet. This is normal for a few minutes during working hours.

Assigned means a specific agent is now responsible for it. In progress means they are actively working on it.

On hold means we are waiting for something — usually information from you, a part on order, or a third-party supplier. The reason is always shown on the ticket.

Resolved means we believe the problem is fixed and are waiting for you to confirm. Closed means the ticket is finished; you will be invited to rate the service, and closed tickets can no longer receive replies.""",
    ),
    (
        'How priorities are decided',
        'Software',
        """Urgent is for a complete stop: nobody can work, a whole branch is offline, or data is at risk.

High is for something that blocks one person or one important process, with no workaround.

Medium is the default. The problem is real and needs fixing, but there is a way to keep working in the meantime.

Low is for cosmetic issues, questions, and requests that are not time-sensitive.

If you believe a ticket has the wrong priority, say so in a reply — an agent can change it.""",
    ),
    (
        'Resetting your password',
        'Software',
        """If you are signed in, open Settings and choose Security. Enter your current password, then the new one twice, and save. Passwords must be at least 8 characters.

If you cannot sign in at all, contact your administrator — they can set a new password for your account from the user management screen.

Use a password you do not use anywhere else. If you suspect someone else knows your password, change it immediately and tell us so we can check the account's recent activity.""",
    ),
    (
        'The printer is not printing: first checks',
        'Printer',
        """Work through these in order before opening a ticket. They resolve most cases in a couple of minutes.

Check that the printer is powered on and shows no error light or message on its panel. Open and close the paper tray, and confirm there is paper and no jam.

Confirm the cable is seated at both ends, or — for a network printer — that its display shows an IP address. If the address starts with 169. the printer has not received one from the network.

Send a test page from the printer's own panel. If the test page prints, the printer is fine and the problem is on the computer. If it does not, the problem is the printer itself.

Restart the printer and the computer, in that order. If it still fails, open a ticket and include the printer model, its location, and any error text shown on the panel.""",
    ),
    (
        'Adding a printer on Windows',
        'Printer',
        """Open Settings, then Bluetooth & devices, then Printers & scanners, and choose Add device.

Wait for the list to populate. If your printer appears, select it and let Windows install the driver.

If it does not appear, choose Add manually, then "Add a printer using an IP address or hostname". Enter the printer's IP address exactly as shown on its panel.

If Windows asks for a driver it cannot find, open a ticket with the printer's model number and we will send you the correct one. Do not download drivers from search results — they are a common source of malware.""",
    ),
    (
        'Paper jams: clearing them safely',
        'Printer',
        """Turn the printer off before reaching inside. This stops the rollers from turning while your hands are in the path.

Pull jammed paper in the direction it was travelling, slowly and with both hands. Pulling backwards can leave torn pieces behind or damage the rollers.

Check every access door, including the rear one and the duplex unit, and remove any torn fragments. A scrap left behind causes the next jam.

If the same tray jams repeatedly, the paper may be damp or the tray guides may be set to the wrong size. Open a ticket if it continues — it usually means a roller needs replacing.""",
    ),
    (
        'Scanner is not detected',
        'Hardware',
        """Confirm the scanner is powered and that its USB cable is connected directly to the computer rather than through a hub. Hubs are a frequent cause of scanners disappearing.

Try a different USB port. If the scanner is shared over the network, check that the host computer is switched on.

Open the scanning software and look for a device selection menu — sometimes the scanner is connected but a different device is selected.

If it is still not found, note the scanner model and whether its light is on, and open a ticket.""",
    ),
    (
        'The computer has become slow',
        'Hardware',
        """Restart it first. A machine that has not been restarted in weeks accumulates background processes, and this alone fixes many complaints.

Check free disk space. Below roughly 10% free, most systems slow down noticeably. Empty the recycle bin and remove old downloads.

Close applications you are not using, particularly browser tabs — each one holds memory.

If it is still slow after that, open a ticket and tell us when it started, whether it affects everything or one particular program, and whether anything was installed or changed around that time.""",
    ),
    (
        'Backing up your data before an update',
        'Software',
        """Take a backup before any major update, however routine it looks. An update that goes wrong is recoverable; an update that goes wrong without a backup often is not.

Copy your working files to the location your organisation uses for backups — not to a second folder on the same computer, which does not protect you if the disk itself fails.

Note down anything that is not a file: licence keys, custom settings, saved report layouts. These are the things people discover missing after an update.

If you are unsure what needs backing up for the system you use, open a ticket before the update and ask.""",
    ),
]


class Command(BaseCommand):
    help = 'Add a starter set of knowledge-base articles (safe to re-run).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--replace',
            action='store_true',
            help='Overwrite the body and category of articles that already exist.',
        )

    def handle(self, *args, **options):
        author = User.objects.filter(role=User.Role.ADMIN).order_by('id').first()
        categories = {c.name.lower(): c for c in Category.objects.all()}

        created = updated = skipped = 0
        for title, category_name, body in ARTICLES:
            category = categories.get((category_name or '').lower())
            article, was_created = Article.objects.get_or_create(
                title=title,
                defaults={
                    'body': body,
                    'category': category,
                    'is_published': True,
                    'author': author,
                },
            )
            if was_created:
                created += 1
            elif options['replace']:
                article.body = body
                article.category = category
                article.is_published = True
                article.save(update_fields=['body', 'category', 'is_published'])
                updated += 1
            else:
                skipped += 1

        missing = {name for _, name, _ in ARTICLES if name and name.lower() not in categories}
        if missing:
            self.stdout.write(
                self.style.WARNING(
                    f'Categories not found, those articles were left uncategorised: '
                    f'{", ".join(sorted(missing))}'
                )
            )
        self.stdout.write(
            self.style.SUCCESS(
                f'Knowledge base seeded — {created} created, {updated} updated, {skipped} already present.'
            )
        )
