"""License-expiry alerts.

A customer's licence has an end date but nothing watched it, so a lapse was only ever
noticed by opening the profile. This sweeps the licences that are near (or just past)
their end date and, once per deadline stage, raises an in-app notification and emails
both the customer and every admin.
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.models import CustomerLicense, User

from .background import run_in_background
from .emails import email_users
from .models import LicenseExpiryReminder, Notification, notify

logger = logging.getLogger(__name__)

# Reminder stages, in days before the end date. 0 is the expiry day itself.
LEAD_DAYS = (30, 7, 1, 0)

# How long after expiry a licence still gets an alert. Without this a sweep that did not
# run for a few days would silently skip the deadline it exists to announce; anything
# older than the window is history, not news.
EXPIRED_GRACE_DAYS = 7


def _describe(license_name, customer_name, end_date, days_left):
    """Human-readable one-liner for a licence's position relative to its end date."""
    name = license_name or 'Untitled license'
    if days_left > 1:
        when = f'expires in {days_left} days'
    elif days_left == 1:
        when = 'expires tomorrow'
    elif days_left == 0:
        when = 'expires today'
    elif days_left == -1:
        when = 'expired yesterday'
    else:
        when = f'expired {-days_left} days ago'
    return f'License "{name}" for {customer_name} {when} ({end_date:%Y-%m-%d}).'


def sweep_license_expiry():
    """Send any license-expiry alerts that are due. Safe to run repeatedly.

    Returns the number of licences alerted about.
    """
    today = timezone.localdate()
    window_start = today - timedelta(days=EXPIRED_GRACE_DAYS)
    window_end = today + timedelta(days=max(LEAD_DAYS))

    licenses = CustomerLicense.objects.filter(
        end_date__isnull=False,
        end_date__gte=window_start,
        end_date__lte=window_end,
    ).select_related('customer')

    admins = list(User.objects.filter(role=User.Role.ADMIN, is_active=True))
    sent = 0

    for license_obj in licenses:
        customer = license_obj.customer
        days_left = (license_obj.end_date - today).days
        due = [d for d in LEAD_DAYS if days_left <= d]
        if not due:
            continue

        # Claim the stages first: the unique constraint is what guarantees one send per
        # deadline, even if two sweeps overlap. Nothing claimed means nothing to say.
        with transaction.atomic():
            existing = set(
                LicenseExpiryReminder.objects.filter(
                    customer=customer, license_name=license_obj.name,
                    end_date=license_obj.end_date, days_before__in=due,
                )
                .select_for_update()
                .values_list('days_before', flat=True)
            )
            fresh = [d for d in due if d not in existing]
            if not fresh:
                continue
            LicenseExpiryReminder.objects.bulk_create(
                [
                    LicenseExpiryReminder(
                        customer=customer, license_name=license_obj.name,
                        end_date=license_obj.end_date, days_before=d,
                    )
                    for d in fresh
                ],
                ignore_conflicts=True,
            )

        headline = _describe(
            license_obj.name, customer.full_name or customer.username,
            license_obj.end_date, days_left,
        )[:255]
        link = f'{settings.FRONTEND_URL}/customers/{customer.id}'

        # Admins and the customer both see it in the bell and get the mail. The customer
        # is listed separately so their notification survives them also being an admin.
        notify(
            admins, headline, kind=Notification.Kind.LICENSE_EXPIRY, customer=customer,
        )
        if customer not in admins:
            notify(
                [customer], headline,
                kind=Notification.Kind.LICENSE_EXPIRY, customer=customer,
            )
        body = (
            f'{headline}\n\n'
            'Please renew it to avoid an interruption of service.\n\n'
            f'View the customer profile: {link}'
        )
        email_users(
            [customer, *(a for a in admins if a != customer)],
            headline, body, 'email_on_license_expiry',
        )
        sent += 1

    if sent:
        logger.info('license expiry sweep alerted on %s license(s)', sent)
    return sent


# Wall-clock of the last sweep this process kicked off, for the opportunistic trigger below.
_last_sweep = None
_SWEEP_INTERVAL = timedelta(hours=1)


def maybe_sweep_license_expiry():
    """Run the sweep if this process has not run it in the last hour.

    There is no task queue here, so an alert that only ever fired from ``cron`` would
    never fire at all on an install that has not set one up. The notification bell polls
    while anyone is signed in, which is a reliable enough heartbeat to hang an hourly
    sweep off. Correctness does not depend on the interval: ``LicenseExpiryReminder``
    is what prevents duplicates, so an extra sweep is wasted work, never a second email.

    Returns immediately — the sweep itself runs on a background thread.
    """
    global _last_sweep
    now = timezone.now()
    if _last_sweep is not None and now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    run_in_background(sweep_license_expiry)
