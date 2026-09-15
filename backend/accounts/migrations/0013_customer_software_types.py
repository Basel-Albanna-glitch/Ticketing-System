from django.db import migrations, models


def split_into_list(apps, schema_editor):
    """Carry each customer's single software type into the new list, so nothing is lost."""
    User = apps.get_model('accounts', 'User')
    for user in User.objects.exclude(software_type=''):
        user.software_types = [user.software_type]
        user.save(update_fields=['software_types'])


def join_back(apps, schema_editor):
    """Reverse: fold the names back into one comma-separated string, clipped to the column."""
    User = apps.get_model('accounts', 'User')
    for user in User.objects.all():
        if user.software_types:
            user.software_type = ', '.join(user.software_types)[:100]
            user.save(update_fields=['software_type'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0012_ticket_column_visibility'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='software_types',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(split_into_list, join_back),
        migrations.RemoveField(
            model_name='user',
            name='software_type',
        ),
    ]
