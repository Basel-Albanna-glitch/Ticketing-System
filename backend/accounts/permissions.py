from rest_framework.permissions import BasePermission

from .models import User


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)


class IsAgent(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.AGENT)


class HasStaffPermission(BasePermission):
    """Holds a named permission, resolved through the user's role (or the
    site-wide defaults when they have none). Instantiate with the flag:

        permission_classes = [IsAuthenticated, HasStaffPermission('allow_agent_manage_kb')]

    Unlike the plain role checks this also covers admins, so a limited admin is
    held to the same flag as everyone else.
    """

    def __init__(self, flag):
        self.flag = flag

    def __call__(self):
        """Allow the instance to sit directly in `permission_classes`.

        DRF builds its permissions with `[cls() for cls in permission_classes]`,
        which expects classes. This one has to be constructed with a flag, so it
        answers that call with itself — letting the same object be used both in
        `permission_classes` and in a `get_permissions()` return list.
        """
        return self

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.has_staff_permission(self.flag)
        )


class CanViewSection(BasePermission):
    """Gate a whole staff-facing section (tickets, customers, projects).

    Customers pass straight through: these flags describe what staff may reach,
    and a customer's access to their own tickets and profile is governed by the
    object-level rules, not by this. Withholding the flag from a customer would
    lock them out of the portal entirely.

    Used the same way as HasStaffPermission — constructed with the flag name and
    usable in `permission_classes` or a `get_permissions()` list.
    """

    def __init__(self, flag):
        self.flag = flag

    def __call__(self):
        return self

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.role == User.Role.CUSTOMER:
            return True
        return user.has_staff_permission(self.flag)


class IsFullAdmin(BasePermission):
    """An admin who has not been narrowed by a StaffRole. Editing the roles
    themselves is gated on this: an admin restricted by a role must not be able
    to edit that role and hand themselves back whatever it withholds."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_full_admin)


class IsAdminOrAgent(BasePermission):
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in (User.Role.ADMIN, User.Role.AGENT)
        )


class IsCustomer(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.CUSTOMER)
