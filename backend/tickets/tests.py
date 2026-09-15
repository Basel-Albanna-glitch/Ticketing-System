import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

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
