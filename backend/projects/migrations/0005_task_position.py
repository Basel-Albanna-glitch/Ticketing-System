"""Give tasks a manual rank within their project.

Existing rows are numbered in the order the list already showed them — stage first,
then soonest due date, undated last — so nothing appears to jump on first load.
"""

from django.db import migrations, models

STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'done']


def seed_positions(apps, schema_editor):
    Task = apps.get_model('projects', 'Task')
    Project = apps.get_model('projects', 'Project')

    def sort_key(task):
        stage = STATUS_ORDER.index(task.status) if task.status in STATUS_ORDER else len(STATUS_ORDER)
        # None sorts after any real date, matching the list's "undated last" rule.
        return (stage, task.due_date is None, task.due_date or '', task.id)

    for project_id in Project.objects.values_list('id', flat=True):
        tasks = sorted(Task.objects.filter(project_id=project_id), key=sort_key)
        for index, task in enumerate(tasks):
            task.position = index
        Task.objects.bulk_update(tasks, ['position'])


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0004_task_assignees'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='position',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name='task',
            options={'ordering': ['position', 'id']},
        ),
        migrations.AddIndex(
            model_name='task',
            index=models.Index(fields=['project', 'position'], name='projects_ta_project_98f10b_idx'),
        ),
        migrations.RunPython(seed_positions, migrations.RunPython.noop),
    ]
