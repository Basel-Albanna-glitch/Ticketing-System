"""Widen a task's single assignee into a set of assignees.

The old ``assignee`` FK is dropped, so the existing links are copied into the new
M2M first. ``reverse`` keeps the pair symmetrical: it takes the first assignee
back, which is lossless for any task that only ever had one.
"""

from django.conf import settings
from django.db import migrations, models


def copy_assignee_to_assignees(apps, schema_editor):
    Task = apps.get_model('projects', 'Task')
    for task in Task.objects.exclude(assignee__isnull=True).iterator():
        task.assignees.add(task.assignee_id)


def copy_assignees_to_assignee(apps, schema_editor):
    Task = apps.get_model('projects', 'Task')
    for task in Task.objects.prefetch_related('assignees').iterator():
        first = task.assignees.first()
        if first is not None:
            task.assignee = first
            task.save(update_fields=['assignee'])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('projects', '0003_project_customer_project_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='assignees',
            field=models.ManyToManyField(
                blank=True, related_name='tasks_assigned', to=settings.AUTH_USER_MODEL
            ),
        ),
        migrations.RunPython(copy_assignee_to_assignees, copy_assignees_to_assignee),
        migrations.RemoveField(
            model_name='task',
            name='assignee',
        ),
    ]
