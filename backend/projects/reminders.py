"""To-do reminders.

There is no task queue in this project, so this follows the same shape as the licence
expiry sweep: a function that finds what is due, a management command for cron, and an
opportunistic trigger hung off the notification poll so an install with no cron still
gets its reminders. Correctness never depends on the schedule — ``reminder_sent_at`` is
what prevents a second send, so an extra sweep is wasted work rather than a duplicate.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from notifications.emails import email_users
from notifications.models import Notification, notify

from .models import TodoItem

logger = logging.getLogger(__name__)


def reminder_recipients(todo):
    """Who should hear about this to-do.

    A private to-do is its author's alone, so its reminder is too — mailing an assignee
    the title of an item they cannot open would hand them the one thing privacy is
    supposed to withhold. Otherwise it goes to whoever is carrying it, falling back to
    the author when nobody has taken it.
    """
    if todo.is_private:
        return [todo.created_by] if todo.created_by_id else []
    people = list(todo.assignees.all())
    if people:
        return people
    return [todo.created_by] if todo.created_by_id else []


def sweep_todo_reminders():
    """Send every reminder that has come due. Returns how many to-dos were alerted on."""
    now = timezone.now()
    due = (
        TodoItem.objects.filter(
            done=False,
            remind_at__isnull=False,
            remind_at__lte=now,
            reminder_sent_at__isnull=True,
        )
        .select_related('created_by')
        .prefetch_related('assignees')
    )

    sent = 0
    for todo in due:
        # Claim it before sending. Gunicorn runs several workers, each with its own
        # idea of when it last swept, so two can reach the same row at once; the
        # conditional update means exactly one of them wins and sends.
        claimed = TodoItem.objects.filter(
            pk=todo.pk, reminder_sent_at__isnull=True
        ).update(reminder_sent_at=now)
        if not claimed:
            continue

        recipients = reminder_recipients(todo)
        if not recipients:
            continue

        headline = f'Reminder: {todo.title}'
        notify(recipients, headline[:255], kind=Notification.Kind.GENERAL)

        lines = [todo.title, '']
        if todo.due_at:
            due_local = timezone.localtime(todo.due_at).strftime('%Y-%m-%d %H:%M')
            lines.append(f'Due {due_local}')
        if todo.notes.strip():
            lines.append(todo.notes.strip())
        lines.append('')
        lines.append(f'Open your to-do list: {settings.FRONTEND_URL}/todo/inbox')
        email_users(recipients, headline, '\n'.join(lines), 'email_on_todo_reminder')
        sent += 1

    if sent:
        logger.info('to-do reminder sweep alerted on %s item(s)', sent)
    return sent


# Wall-clock of the last sweep this process kicked off, for the opportunistic trigger.
_last_sweep = None
# Tighter than the licence sweep's hour: a reminder set for 09:00 that arrives at 10:00
# is not a reminder. The notification bell polls every 15s while anyone is signed in.
_SWEEP_INTERVAL = timedelta(minutes=1)


def maybe_sweep_todo_reminders():
    """Run the sweep unless this process already did within the last minute.

    Returns immediately — the sweep itself runs on a background thread.
    """
    global _last_sweep
    now = timezone.now()
    if _last_sweep is not None and now - _last_sweep < _SWEEP_INTERVAL:
        return
    _last_sweep = now
    from notifications.background import run_in_background

    run_in_background(sweep_todo_reminders)
