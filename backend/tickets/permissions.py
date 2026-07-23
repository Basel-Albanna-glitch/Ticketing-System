from rest_framework.permissions import BasePermission

from accounts.models import User


class CanViewTicket(BasePermission):
    """Read access: admin, any agent (agents can watch every ticket), or the ticket's
    own customer. Other customers cannot see it."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role in (User.Role.ADMIN, User.Role.AGENT):
            return True
        return user == obj.customer


class CanEditTicket(BasePermission):
    """Write access to a ticket's own fields (status, deadline, …): admin, the agent the
    ticket is assigned to, or an agent the admin added as a collaborator. Any other agent
    is read-only."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True
        if user.role == User.Role.AGENT:
            return user == obj.assigned_agent or obj.collaborators.filter(pk=user.pk).exists()
        return False


class CanDeleteTicket(BasePermission):
    """Delete a ticket: always allowed for admins. The assigned agent may delete only when
    the 'agents can delete tickets' permission is enabled in settings. Collaborators and
    other agents can never delete. Deleting a ticket removes its comments, attachments and
    activity along with it."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.role == User.Role.ADMIN:
            return True
        if user.role == User.Role.AGENT and user == obj.assigned_agent:
            from .models import TicketSettings
            return TicketSettings.get_solo().allow_agent_delete
        return False
