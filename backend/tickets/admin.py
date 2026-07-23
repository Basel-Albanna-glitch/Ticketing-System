from django.contrib import admin

from .models import Attachment, Category, Comment, Ticket, TicketActivity

admin.site.register(Category)
admin.site.register(Ticket)
admin.site.register(Comment)
admin.site.register(Attachment)
admin.site.register(TicketActivity)
