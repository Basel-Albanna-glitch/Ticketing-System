import django.db.models.deletion
from django.db import migrations, models


def carry_single_reminders(apps, schema_editor):
    """Each to-do's one reminder becomes its first TodoReminder, sent state and all."""
    TodoItem = apps.get_model('projects', 'TodoItem')
    TodoReminder = apps.get_model('projects', 'TodoReminder')
    TodoReminder.objects.bulk_create(
        TodoReminder(
            todo_id=item.pk,
            offset_minutes=item.remind_offset_minutes,
            remind_at=item.remind_at,
            sent_at=item.reminder_sent_at,
        )
        for item in TodoItem.objects.exclude(remind_at=None)
    )


def fold_back_soonest_reminder(apps, schema_editor):
    """Reverse: only one reminder fits the old fields, so each to-do keeps its soonest."""
    TodoItem = apps.get_model('projects', 'TodoItem')
    TodoReminder = apps.get_model('projects', 'TodoReminder')
    seen = set()
    for reminder in TodoReminder.objects.order_by('todo_id', 'remind_at'):
        if reminder.todo_id in seen:
            continue
        seen.add(reminder.todo_id)
        TodoItem.objects.filter(pk=reminder.todo_id).update(
            remind_offset_minutes=reminder.offset_minutes,
            remind_at=reminder.remind_at,
            reminder_sent_at=reminder.sent_at,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0018_todoassigneecompletion'),
    ]

    operations = [
        migrations.CreateModel(
            name='TodoReminder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('offset_minutes', models.PositiveIntegerField(blank=True, null=True)),
                ('remind_at', models.DateTimeField()),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('todo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reminders', to='projects.todoitem')),
            ],
            options={
                'ordering': ['remind_at', 'id'],
                'indexes': [models.Index(fields=['sent_at', 'remind_at'], name='projects_todoreminder_due_idx')],
            },
        ),
        migrations.RunPython(carry_single_reminders, fold_back_soonest_reminder),
        migrations.RemoveIndex(
            model_name='todoitem',
            name='projects_to_remind__1c42e3_idx',
        ),
        migrations.RemoveField(
            model_name='todoitem',
            name='remind_at',
        ),
        migrations.RemoveField(
            model_name='todoitem',
            name='remind_offset_minutes',
        ),
        migrations.RemoveField(
            model_name='todoitem',
            name='reminder_sent_at',
        ),
    ]
