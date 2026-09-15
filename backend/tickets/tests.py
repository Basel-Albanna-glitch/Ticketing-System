import shutil
import tempfile
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts.models import CustomerBranch, User
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

    def collaborator_alerts_for(self, user):
        return Notification.objects.filter(
            recipient=user, kind=Notification.Kind.COLLABORATOR_ADDED
        )

    def test_adding_a_collaborator_alerts_them_once(self):
        url = f'/api/tickets/{self.ticket().pk}/collaborators/'
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(url, {'collaborators': [self.agent.pk]}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.collaborator_alerts_for(self.agent).count(), 1)
        # Saving the same list again adds nobody new.
        self.client.patch(url, {'collaborators': [self.agent.pk]}, format='json')
        self.assertEqual(self.collaborator_alerts_for(self.agent).count(), 1)

    def test_agents_picked_after_the_first_at_creation_are_alerted_as_collaborators(self):
        colleague = self.make('colleague', User.Role.AGENT)
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            '/api/tickets/',
            {
                'subject': 'Card reader offline',
                'description': 'No card payments since this morning.',
                'category': self.category.pk,
                'priority': 'high',
                'customer_id': self.customer.pk,
                'assigned_agent_ids': [self.agent.pk, colleague.pk],
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.alerts_for(self.agent).count(), 1)
        self.assertEqual(self.collaborator_alerts_for(colleague).count(), 1)
        self.assertFalse(self.alerts_for(colleague).exists())


class CustomerPriorityOnTicketsTests(TestCase):
    """The ticket list carries the priority staff give each ticket's customer, for staff
    only."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='boss', full_name='Boss', password='testpass123', role=User.Role.ADMIN
        )
        self.customer = User.objects.create_user(
            username='client', full_name='Client', password='testpass123',
            role=User.Role.CUSTOMER, customer_priority=User.CustomerPriority.URGENT,
        )
        category = Category.objects.create(name='Hardware')
        self.ticket = Ticket.objects.create(
            category=category, customer=self.customer, subject='Till frozen',
            description='The till froze mid-sale.', priority=Ticket.Priority.LOW,
        )
        self.guest_ticket = Ticket.objects.create(
            category=category, subject='Printer down', description='No receipts.',
            guest_name='Sam', guest_phone='0790001111',
        )

    def rows(self, user):
        self.client.force_authenticate(user=user)
        response = self.client.get('/api/tickets/')
        self.assertEqual(response.status_code, 200)
        return {row['id']: row for row in response.json()['results']}

    def test_staff_see_the_customers_priority_beside_the_tickets_own(self):
        rows = self.rows(self.admin)
        self.assertEqual(rows[self.ticket.pk]['customer_priority'], 'urgent')
        self.assertEqual(rows[self.ticket.pk]['priority'], 'low')
        self.assertIsNone(rows[self.guest_ticket.pk]['customer_priority'])

    def test_a_customer_does_not_see_it_on_their_tickets(self):
        row = self.rows(self.customer)[self.ticket.pk]
        self.assertNotIn('customer_priority', row)


class WorkPhasesAreStaffOnlyTests(TestCase):
    """Work phases are the staff side of a ticket. A customer sees none of them: not on the
    ticket, not from the phases endpoint, and not echoed in the activity feed."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='boss', full_name='Boss', password='testpass123', role=User.Role.ADMIN
        )
        self.customer = User.objects.create_user(
            username='client', full_name='Client', password='testpass123', role=User.Role.CUSTOMER
        )
        self.ticket = Ticket.objects.create(
            category=Category.objects.create(name='Hardware'), customer=self.customer,
            subject='Till frozen', description='The till froze mid-sale.',
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            f'/api/tickets/{self.ticket.pk}/phases/', {'body': 'Swapped the till cable'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def get(self, user, suffix=''):
        self.client.force_authenticate(user=user)
        return self.client.get(f'/api/tickets/{self.ticket.pk}/{suffix}')

    def phase_entries(self, user):
        return [
            a for a in self.get(user, 'activity/').json()
            if 'Swapped the till cable' in a['description']
        ]

    def test_the_ticket_carries_phases_for_staff_only(self):
        self.assertEqual(len(self.get(self.admin).json()['phases']), 1)
        customer_view = self.get(self.customer)
        self.assertEqual(customer_view.status_code, 200)
        self.assertNotIn('phases', customer_view.json())

    def test_the_phases_endpoint_refuses_a_customer(self):
        self.assertEqual(self.get(self.admin, 'phases/').status_code, 200)
        self.assertEqual(self.get(self.customer, 'phases/').status_code, 403)

    def test_a_logged_phase_is_left_out_of_the_customers_activity(self):
        self.assertEqual(len(self.phase_entries(self.admin)), 1)
        self.assertEqual(self.phase_entries(self.customer), [])


class CustomerChoosingPriorityTests(TestCase):
    """A customer's chosen priority stands only if staff let that customer choose one."""

    def setUp(self):
        self.client = APIClient()
        patcher = mock.patch('tickets.views.run_in_background')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.category = Category.objects.create(name='Hardware')

    def raise_ticket(self, allowed):
        customer = User.objects.create_user(
            username=f'client{int(allowed)}', full_name='Client', password='testpass123',
            role=User.Role.CUSTOMER, can_set_ticket_priority=allowed,
        )
        self.client.force_authenticate(user=customer)
        response = self.client.post(
            '/api/tickets/',
            {
                'subject': 'Till frozen', 'description': 'The till froze mid-sale.',
                'category': self.category.pk, 'priority': 'urgent',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        return Ticket.objects.get(pk=response.json()['id'])

    def test_an_allowed_customer_keeps_their_choice(self):
        self.assertEqual(self.raise_ticket(allowed=True).priority, Ticket.Priority.URGENT)

    def test_otherwise_the_ticket_takes_the_default(self):
        self.assertEqual(self.raise_ticket(allowed=False).priority, Ticket.Priority.MEDIUM)


class CustomerTicketBranchTests(TestCase):
    """A customer files a ticket against one of their own branches, never someone else's."""

    def setUp(self):
        self.client = APIClient()
        patcher = mock.patch('tickets.views.run_in_background')
        patcher.start()
        self.addCleanup(patcher.stop)
        self.category = Category.objects.create(name='Hardware')
        self.customer = User.objects.create_user(
            username='client', full_name='Client', password='testpass123', role=User.Role.CUSTOMER
        )
        other = User.objects.create_user(
            username='other', full_name='Other', password='testpass123', role=User.Role.CUSTOMER
        )
        self.own_branch = CustomerBranch.objects.create(customer=self.customer, name='Sweifieh')
        self.other_branch = CustomerBranch.objects.create(customer=other, name='Abdoun')
        self.client.force_authenticate(user=self.customer)

    def raise_ticket(self, branch):
        return self.client.post(
            '/api/tickets/',
            {
                'subject': 'Till frozen', 'description': 'The till froze mid-sale.',
                'category': self.category.pk, 'branch_id': branch.pk,
            },
            format='json',
        )

    def test_their_own_branch_is_kept(self):
        response = self.raise_ticket(self.own_branch)
        self.assertEqual(response.status_code, 201)
        ticket = Ticket.objects.get(pk=response.json()['id'])
        self.assertEqual(ticket.branch_id, self.own_branch.pk)

    def test_another_customers_branch_is_refused(self):
        response = self.raise_ticket(self.other_branch)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Ticket.objects.exists())


class TicketTableSortingTests(TestCase):
    """Every ticket-table column sorts, and priorities sort by importance, not alphabet."""

    def setUp(self):
        self.client = APIClient()
        admin = User.objects.create_user(
            username='boss', full_name='Boss', password='testpass123', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=admin)
        self.low_category = Category.objects.create(name='Printers', priority='low')
        self.urgent_category = Category.objects.create(name='Payments', priority='urgent')

    def ticket(self, subject, **fields):
        fields.setdefault('category', self.low_category)
        return Ticket.objects.create(subject=subject, description='-', **fields)

    def subjects(self, ordering):
        response = self.client.get('/api/tickets/', {'ordering': ordering})
        self.assertEqual(response.status_code, 200, response.content)
        return [row['subject'] for row in response.json()['results']]

    def test_requested_priority_sorts_by_importance(self):
        for subject, priority in [('H', 'high'), ('L', 'low'), ('U', 'urgent'), ('M', 'medium')]:
            self.ticket(subject, priority=priority)
        self.assertEqual(self.subjects('priority_rank'), ['L', 'M', 'H', 'U'])
        self.assertEqual(self.subjects('-priority_rank'), ['U', 'H', 'M', 'L'])

    def test_predefined_priority_honours_a_tickets_override(self):
        self.ticket('Category urgent', category=self.urgent_category)
        self.ticket('Overridden to high', category=self.low_category, category_priority_override='high')
        self.ticket('Category low', category=self.low_category)
        self.assertEqual(
            self.subjects('-predefined_priority_rank'),
            ['Category urgent', 'Overridden to high', 'Category low'],
        )

    def test_customer_sorts_guests_by_the_name_they_gave(self):
        customer = User.objects.create_user(
            username='client', full_name='Bakery Ltd', password='testpass123',
            role=User.Role.CUSTOMER,
        )
        self.ticket('Guest', guest_name='Amal')
        self.ticket('Customer', customer=customer)
        self.assertEqual(self.subjects('customer_name'), ['Guest', 'Customer'])

    def test_every_table_column_is_accepted(self):
        self.ticket('Only one')
        for field in ['customer_name', 'parent_category_name', 'sub_category_name',
                      'assigned_agent_name', 'customer_priority_rank', 'status', 'subject']:
            self.assertEqual(self.subjects(field), ['Only one'], field)

    def test_ties_keep_a_stable_order_across_pages(self):
        for n in range(15):
            self.ticket(f'T{n:02d}', priority='medium')
        first = self.client.get('/api/tickets/', {'ordering': 'priority_rank'}).json()
        second = self.client.get(
            '/api/tickets/', {'ordering': 'priority_rank', 'page': 2}
        ).json()
        seen = [r['id'] for r in first['results']] + [r['id'] for r in second['results']]
        self.assertEqual(len(seen), len(set(seen)), 'no ticket appears on both pages')
        self.assertEqual(len(seen), 15)
