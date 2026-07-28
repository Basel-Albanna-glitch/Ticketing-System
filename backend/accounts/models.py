from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


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


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        AGENT = 'agent', 'Agent'
        ADMIN = 'admin', 'Admin'

    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(blank=True)
    full_name = models.CharField(max_length=150)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CUSTOMER)
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
    software_type = models.CharField(max_length=100, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.username


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

    def __str__(self):
        return f'Notification preferences for {self.user.username}'
