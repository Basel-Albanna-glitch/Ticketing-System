from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models

from core.models import AgentPermissionFlags


class UserManager(BaseUserManager):
    def create_user(self, username, full_name, password=None, email='', role=None, **extra_fields):
        if not username:
            raise ValueError('Users must have a username')
        user = self.model(
            username=username,
            email=self.normalize_email(email) if email else '',
            full_name=full_name,
            role=role or User.Role.CUSTOMER,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, full_name, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields['role'] = User.Role.ADMIN
        return self.create_user(username, full_name, password, **extra_fields)


class StaffRole(AgentPermissionFlags):
    """A named bundle of permissions an admin can assign to staff.

    This sits alongside `User.role`, which still decides what kind of account
    something is (customer / agent / admin); a StaffRole only tunes what a member
    of staff may do. An admin holding a role is a *limited* admin, restricted to
    exactly the flags it grants — see `User.has_staff_permission`.
    """

    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        AGENT = 'agent', 'Agent'
        ADMIN = 'admin', 'Admin'

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)
    # Only meaningful for agents and admins. Null means "no role": an agent falls
    # back to the site-wide TicketSettings, an admin keeps unrestricted access.
    # Deleting a role nulls this rather than cascading — losing a role must never
    # delete the person, and falling back always widens access, never narrows it
    # to nothing.
    staff_role = models.ForeignKey(
        'accounts.StaffRole',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users',
    )
    is_available = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    # Square JPEG written by the avatar endpoint, which normalizes whatever was uploaded.
    # The filename carries a random suffix so a replacement is never served from cache.
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)

    # Customer profile details (only meaningful for role=customer).
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    tax_number = models.CharField(max_length=100, blank=True)
    # Names of the SoftwareType entries this customer runs — names rather than ids, so
    # renaming or removing a type never rewrites a customer's record — as a list, since a
    # customer can run more than one.
    software_types = models.JSONField(default=list, blank=True)

    # Ticket-table columns this person chose to hide for themselves. It only narrows
    # what allowed_ticket_columns() permits; it can never bring a withheld one back.
    hidden_ticket_columns = models.JSONField(default=list, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.username

    @property
    def is_full_admin(self):
        """An admin with no role, i.e. one nothing is withheld from. At least one
        of these must always exist or there would be nobody left who can hand the
        permissions back out — see StaffRoleSerializer and AgentSerializer."""
        return self.role == self.Role.ADMIN and self.staff_role_id is None

    def has_staff_permission(self, flag):
        """Whether this user holds `flag` (a name from core.models.PERMISSION_FLAGS).

        Resolved in one place so every call site agrees:

        - customers never hold staff permissions;
        - a full admin holds all of them;
        - anyone with a role holds exactly what that role grants, admins included,
          which is what makes a limited admin possible;
        - an agent without a role falls back to the site-wide TicketSettings, so
          installations that never create a role behave exactly as before.
        """
        if self.role not in (self.Role.ADMIN, self.Role.AGENT):
            return False
        if self.staff_role_id:
            return bool(getattr(self.staff_role, flag))
        if self.role == self.Role.ADMIN:
            return True
        # Imported here rather than at module scope: tickets.models imports this
        # module for the AUTH_USER_MODEL reference, so a top-level import would
        # be circular.
        from tickets.models import TicketSettings

        return bool(getattr(TicketSettings.get_solo(), flag))

    def permission_map(self):
        """Every flag resolved for this user, for the client to gate its UI on."""
        from core.models import PERMISSION_FLAGS

        return {flag: self.has_staff_permission(flag) for flag in PERMISSION_FLAGS}

    def allowed_ticket_columns(self):
        """Ticket-table columns this user may see, in display order.

        Resolved like has_staff_permission: a role wins, a full admin sees every
        column, and an agent without a role falls back to the site-wide
        TicketSettings. Customers hold no role; they only lose the assignment
        columns. What someone hides for themselves is applied on top of this, never
        instead of it.
        """
        from core.models import CUSTOMER_WITHHELD_TICKET_COLUMNS, TICKET_COLUMNS

        if self.role == self.Role.CUSTOMER:
            withheld = CUSTOMER_WITHHELD_TICKET_COLUMNS
        elif self.staff_role_id:
            withheld = self.staff_role.withheld_ticket_columns
        elif self.role == self.Role.ADMIN:
            withheld = ()
        else:
            # Same reason as in has_staff_permission: a top-level import is circular.
            from tickets.models import TicketSettings

            withheld = TicketSettings.get_solo().withheld_ticket_columns
        withheld = set(withheld or ())
        return [column for column in TICKET_COLUMNS if column not in withheld]


class SoftwareType(models.Model):
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class CustomerBranch(models.Model):
    customer = models.ForeignKey(User, related_name='branches', on_delete=models.CASCADE)
    name = models.CharField(max_length=200, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name', 'id']

    def __str__(self):
        return self.name or f'Branch #{self.pk}'


def customer_attachment_upload_path(instance, filename):
    return f'customer_attachments/customer_{instance.customer_id}/{filename}'


class CustomerLicense(models.Model):
    customer = models.ForeignKey(User, related_name='licenses', on_delete=models.CASCADE)
    name = models.CharField(max_length=200, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_date', 'id']

    def __str__(self):
        return self.name or f'License #{self.pk}'


class CustomerAttachment(models.Model):
    customer = models.ForeignKey(
        User, related_name='customer_attachments', on_delete=models.CASCADE
    )
    uploaded_by = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name='+'
    )
    file = models.FileField(upload_to=customer_attachment_upload_path)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.original_filename


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='notification_preference'
    )
    email_on_new_comment = models.BooleanField(default=True)
    email_on_status_change = models.BooleanField(default=True)
    # Agents only: emailed when a ticket is handed to them.
    email_on_assignment = models.BooleanField(default=True)
    # Customers: their own licence nearing its end date. Admins: any customer's.
    email_on_license_expiry = models.BooleanField(default=True)
    # Staff: a to-do they are carrying has reached its reminder time.
    email_on_todo_reminder = models.BooleanField(default=True)

    def __str__(self):
        return f'Notification preferences for {self.user.username}'
