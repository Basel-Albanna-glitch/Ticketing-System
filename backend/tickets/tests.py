import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import User
from notifications.models import Notification

from .models import Attachment, Category, Comment, Ticket, TicketActivity

# Uploaded files land here rather than in the real media folder, and go when the tests do.
MEDIA_ROOT = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=MEDIA_ROOT)
class GuestReplyAttachmentTests(TestCase):
    """A guest can attach files to a reply on the tracking page, gated by the same
    reference + phone pair as the reply itself."""

    URL = '/api/tickets/guest/reply/'

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        self.client = APIClient()
        self.ticket = Ticket.objects.create(
            category=Category.objects.create(name='POS'),
            subject='Printer down',
            description='It stopped printing receipts.',
            guest_name='Sam',
            guest_phone='+962 79 000 1111',
        )

    def file(self, name='photo.png'):
        return SimpleUploadedFile(name, b'not really an image', content_type='image/png')

    def test_files_are_attached_to_the_reply(self):
        response = self.client.post(
            self.URL,
            {
                'reference': self.ticket.reference,
                # Typed differently from how it was stored; matching ignores formatting.
                'phone': '962-79-000-1111',
                'body': 'Here is what the screen shows.',
                'attachments': [self.file('screen.png'), self.file('receipt.png')],
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['attachments']), 2)

        comment = Comment.objects.get(ticket=self.ticket)
        attachments = Attachment.objects.filter(comment=comment)
        self.assertEqual(
            sorted(a.original_filename for a in attachments), ['receipt.png', 'screen.png']
        )
        # Filed against the ticket too, so staff see them with its other attachments.
        self.assertTrue(all(a.ticket_id == self.ticket.pk for a in attachments))
        self.assertTrue(all(a.uploaded_by_id is None for a in attachments))
        self.assertTrue(
            TicketActivity.objects.filter(
                ticket=self.ticket, activity_type=TicketActivity.ActivityType.ATTACHMENT_ADDED
            ).exists()
        )

    def test_a_reply_without_files_still_works(self):
        response = self.client.post(
            self.URL,
            {'reference': self.ticket.reference, 'phone': '+962 79 000 1111', 'body': 'Any news?'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['attachments'], [])

    def test_wrong_phone_stores_nothing(self):
        response = self.client.post(
            self.URL,
            {
                'reference': self.ticket.reference,
                'phone': '0000000',
                'body': 'Let me in.',
                'attachments': [self.file()],
            },
            format='multipart',
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Comment.objects.exists())
        self.assertFalse(Attachment.objects.exists())


class AssignmentNotificationTests(TestCase):
    """Whoever a ticket is handed to, agent or admin, gets an "assigned" notification,
    which the web app raises as a confirm / view-ticket alert. Taking a ticket
    yourself raises none."""

    def setUp(self):
        self.client = APIClient()
        # WhatsApp and email go out off-thread or to real services; neither is under test.
        for target in ('tickets.views.run_in_background', 'tickets.views.email_users'):
            patcher = mock.patch(target)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.admin = self.make('boss', User.Role.ADMIN)
        self.agent = self.make('agent', User.Role.AGENT)
        self.customer = self.make('client', User.Role.CUSTOMER)
        self.category = Category.objects.create(name='Hardware')

    def make(self, username, role):
        return User.objects.create_user(
            username=username, full_name=username.title(), password='testpass123', role=role
        )

    def ticket(self):
        return Ticket.objects.create(
            category=self.category, customer=self.customer,
            subject='Till frozen', description='The till froze mid-sale.',
        )

    def create_assigned_to(self, user):
        return self.client.post(
            '/api/tickets/',
            {
                'subject': 'Card reader offline',
                'description': 'No card payments since this morning.',
                'category': self.category.pk,
                'priority': 'high',
                'customer_id': self.customer.pk,
                'assigned_agent_ids': [user.pk],
            },
            format='json',
        )

    def alerts_for(self, user):
        return Notification.objects.filter(recipient=user, kind=Notification.Kind.ASSIGNED)

    def test_assigning_a_ticket_alerts_the_assignee(self):
        ticket = self.ticket()
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/tickets/{ticket.pk}/assign/', {'assigned_agent': self.agent.pk}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        alert = self.alerts_for(self.agent).get()
        self.assertEqual(alert.ticket_id, ticket.pk)
        self.assertFalse(alert.is_read)

    def test_an_admin_assigned_when_the_ticket_is_created_is_alerted(self):
        colleague = self.make('colleague', User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.create_assigned_to(colleague).status_code, 201)
        self.assertEqual(self.alerts_for(colleague).count(), 1)

    def test_taking_a_ticket_yourself_raises_no_alert(self):
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.create_assigned_to(self.admin).status_code, 201)
        response = self.client.patch(
            f'/api/tickets/{self.ticket().pk}/assign/', {'assigned_agent': self.admin.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.alerts_for(self.admin).exists())

