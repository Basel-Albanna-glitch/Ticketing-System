from .models import TicketActivity


def log_activity(ticket, actor, activity_type, description, metadata=None):
    return TicketActivity.objects.create(
        ticket=ticket,
        actor=actor,
        activity_type=activity_type,
        description=description,
        metadata=metadata or {},
    )
