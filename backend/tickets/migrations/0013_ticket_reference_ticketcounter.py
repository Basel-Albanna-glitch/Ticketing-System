from django.db import migrations, models


def populate_references(apps, schema_editor):
    Ticket = apps.get_model('tickets', 'Ticket')
    TicketCounter = apps.get_model('tickets', 'TicketCounter')
    counters = {}
    for ticket in Ticket.objects.order_by('created_at', 'id'):
        year = ticket.created_at.year
        number = counters.get(year, 0) + 1
        counters[year] = number
        ticket.reference = f'HERMES-TKT-{year % 100:02d}-{number:06d}'
        ticket.save(update_fields=['reference'])
    for year, number in counters.items():
        TicketCounter.objects.update_or_create(year=year, defaults={'last_number': number})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tickets', '0012_alter_attachment_uploaded_by'),
    ]

    operations = [
        migrations.CreateModel(
            name='TicketCounter',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('year', models.PositiveIntegerField(unique=True)),
                ('last_number', models.PositiveIntegerField(default=0)),
            ],
        ),
        migrations.AddField(
            model_name='ticket',
            name='reference',
            field=models.CharField(blank=True, default='', max_length=30),
        ),
        migrations.RunPython(populate_references, noop),
        migrations.AlterField(
            model_name='ticket',
            name='reference',
            field=models.CharField(blank=True, max_length=30, unique=True),
        ),
    ]
