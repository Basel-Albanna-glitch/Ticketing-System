"""Give a to-do's window a time of day.

The old date-only fields are replaced by datetimes. Existing values are carried over
at the start of their day, in the project's timezone, so nothing shifts by a day for
anyone east or west of UTC.
"""

from django.db import migrations, models
from django.utils import timezone


def dates_to_datetimes(apps, schema_editor):
    TodoItem = apps.get_model('projects', 'TodoItem')
    for item in TodoItem.objects.exclude(start_date=None, due_date=None):
        if item.start_date:
            item.start_at = timezone.make_aware(
                timezone.datetime.combine(item.start_date, timezone.datetime.min.time())
            )
        if item.due_date:
            item.due_at = timezone.make_aware(
                timezone.datetime.combine(item.due_date, timezone.datetime.min.time())
            )
        item.save(update_fields=['start_at', 'due_at'])


def datetimes_to_dates(apps, schema_editor):
    TodoItem = apps.get_model('projects', 'TodoItem')
    for item in TodoItem.objects.exclude(start_at=None, due_at=None):
        item.start_date = timezone.localdate(item.start_at) if item.start_at else None
        item.due_date = timezone.localdate(item.due_at) if item.due_at else None
        item.save(update_fields=['start_date', 'due_date'])


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0011_todo_dates_customer'),
    ]

    operations = [
        migrations.AddField(
            model_name='todoitem',
            name='start_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='todoitem',
            name='due_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(dates_to_datetimes, datetimes_to_dates),
        migrations.RemoveField(model_name='todoitem', name='start_date'),
        migrations.RemoveField(model_name='todoitem', name='due_date'),
    ]
