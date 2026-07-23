from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import NotificationPreference, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering = ['username']
    list_display = ['username', 'email', 'full_name', 'role', 'is_available', 'is_staff']
    search_fields = ['username', 'email', 'full_name']
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('full_name', 'email', 'role', 'is_available')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'full_name', 'email', 'role', 'password1', 'password2'),
        }),
    )
    readonly_fields = ['date_joined']


admin.site.register(NotificationPreference)
