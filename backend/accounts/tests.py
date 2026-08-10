from django.test import TestCase
from rest_framework.test import APIClient

from tickets.models import TicketSettings

from .models import StaffRole, User


class StaffPermissionResolutionTests(TestCase):
    """`User.has_staff_permission` is the single gate every permission check goes
    through, so each way of resolving it is pinned down here."""

    def setUp(self):
        self.role = StaffRole.objects.create(name='KB Editor', allow_agent_manage_kb=True)

    def make(self, role, staff_role=None, username=None):
        return User.objects.create_user(
            username=username or f'{role}{User.objects.count()}',
            full_name='Test Person',
            password='testpass123',
            role=role,
            staff_role=staff_role,
        )

    def test_customer_never_holds_staff_permissions(self):
        customer = self.make(User.Role.CUSTOMER)
        self.assertFalse(customer.has_staff_permission('allow_agent_manage_kb'))

    def test_admin_without_role_holds_everything(self):
        admin = self.make(User.Role.ADMIN)
        self.assertTrue(admin.has_staff_permission('allow_agent_manage_kb'))
        self.assertTrue(admin.has_staff_permission('allow_agent_delete'))

    def test_role_grants_exactly_its_flags(self):
        agent = self.make(User.Role.AGENT, staff_role=self.role)
        self.assertTrue(agent.has_staff_permission('allow_agent_manage_kb'))
        self.assertFalse(agent.has_staff_permission('allow_agent_delete'))

    def test_role_narrows_an_admin(self):
        """The point of allowing roles on admins: a limited admin is held to the
        role, not waved through for being an admin."""
        admin = self.make(User.Role.ADMIN, staff_role=self.role)
        self.assertTrue(admin.has_staff_permission('allow_agent_manage_kb'))
        self.assertFalse(admin.has_staff_permission('allow_agent_delete'))
        self.assertFalse(admin.is_full_admin)

    def test_agent_without_role_falls_back_to_site_settings(self):
        """Installations that never create a role must behave exactly as before."""
        agent = self.make(User.Role.AGENT)
        settings = TicketSettings.get_solo()
        settings.allow_agent_delete = True
        settings.save()
        self.assertTrue(agent.has_staff_permission('allow_agent_delete'))
        self.assertFalse(agent.has_staff_permission('allow_agent_manage_kb'))

    def test_role_overrides_site_settings_rather_than_adding_to_them(self):
        settings = TicketSettings.get_solo()
        settings.allow_agent_delete = True
        settings.save()
        agent = self.make(User.Role.AGENT, staff_role=self.role)
        # The role does not grant delete, so the site-wide switch must not leak in.
        self.assertFalse(agent.has_staff_permission('allow_agent_delete'))

    def test_permission_map_covers_every_flag(self):
        from core.models import PERMISSION_FLAGS

        self.assertEqual(set(self.make(User.Role.ADMIN).permission_map()), set(PERMISSION_FLAGS))


class StaffRoleApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='rootadmin', full_name='Root', password='testpass123', role=User.Role.ADMIN
        )
        self.role = StaffRole.objects.create(name='Support Lead')

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def test_agent_cannot_manage_roles(self):
        agent = User.objects.create_user(
            username='agent1', full_name='Agent', password='testpass123', role=User.Role.AGENT
        )
        self.auth(agent)
        self.assertEqual(self.client.get('/api/roles/').status_code, 403)

    def test_limited_admin_cannot_manage_roles(self):
        """Otherwise an admin restricted by a role could edit that role and hand
        themselves back whatever it withholds."""
        limited = User.objects.create_user(
            username='limited', full_name='Limited', password='testpass123',
            role=User.Role.ADMIN, staff_role=self.role,
        )
        self.auth(limited)
        self.assertEqual(self.client.get('/api/roles/').status_code, 403)

    def test_full_admin_can_create_a_role(self):
        self.auth(self.admin)
        response = self.client.post(
            '/api/roles/', {'name': 'Triage', 'allow_agent_self_assign': True}, format='json'
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(StaffRole.objects.get(name='Triage').allow_agent_self_assign)

    def test_last_full_admin_cannot_be_restricted(self):
        """Locking the final unrestricted admin into a role would leave nobody
        able to hand the permissions back out."""
        self.auth(self.admin)
        response = self.client.patch(
            f'/api/users/agents/{self.admin.pk}/', {'staff_role': self.role.pk}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.admin.refresh_from_db()
        self.assertIsNone(self.admin.staff_role)

    def test_an_admin_can_be_restricted_while_another_remains(self):
        User.objects.create_user(
            username='admin2', full_name='Second', password='testpass123', role=User.Role.ADMIN
        )
        self.auth(self.admin)
        response = self.client.patch(
            f'/api/users/agents/{self.admin.pk}/', {'staff_role': self.role.pk}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_deleting_a_role_reverts_its_holders(self):
        agent = User.objects.create_user(
            username='agent2', full_name='Agent Two', password='testpass123',
            role=User.Role.AGENT, staff_role=self.role,
        )
        self.auth(self.admin)
        self.assertEqual(self.client.delete(f'/api/roles/{self.role.pk}/').status_code, 200)
        agent.refresh_from_db()
        self.assertIsNone(agent.staff_role)
        self.assertTrue(User.objects.filter(pk=agent.pk).exists())

    def test_reports_follow_the_view_reports_permission(self):
        """Reports were admin-only. They now follow the flag, so an agent granted
        it gets in — and, critically, an agent without a role still does not,
        since the site-wide default is off."""
        plain_agent = User.objects.create_user(
            username='plainagent', full_name='Plain', password='testpass123', role=User.Role.AGENT
        )
        self.auth(plain_agent)
        self.assertEqual(self.client.get('/api/reports/summary/').status_code, 403)

        reporting = StaffRole.objects.create(name='Reporting', allow_agent_view_reports=True)
        plain_agent.staff_role = reporting
        plain_agent.save()
        self.auth(plain_agent)
        self.assertEqual(self.client.get('/api/reports/summary/').status_code, 200)

    def test_admin_keeps_reports_but_a_role_can_withhold_them(self):
        self.auth(self.admin)
        self.assertEqual(self.client.get('/api/reports/summary/').status_code, 200)

        limited = User.objects.create_user(
            username='limitedadmin', full_name='Limited', password='testpass123',
            role=User.Role.ADMIN, staff_role=self.role,
        )
        self.auth(limited)
        self.assertEqual(self.client.get('/api/reports/summary/').status_code, 403)

    def test_section_flags_default_on_so_nothing_is_hidden_by_upgrading(self):
        """These withhold access staff already had, so an agent with no role, and
        a freshly created role, must both still see everything."""
        agent = User.objects.create_user(
            username='defaultagent', full_name='Default', password='testpass123',
            role=User.Role.AGENT,
        )
        for flag in ('allow_agent_view_tickets', 'allow_agent_view_customers',
                     'allow_agent_view_projects'):
            self.assertTrue(agent.has_staff_permission(flag), flag)

        self.auth(self.admin)
        created = self.client.post('/api/roles/', {'name': 'Fresh'}, format='json').json()
        for flag in ('allow_agent_view_tickets', 'allow_agent_view_customers',
                     'allow_agent_view_projects'):
            self.assertTrue(created[flag], flag)

    def test_a_role_can_hide_sections_from_an_agent(self):
        hidden = StaffRole.objects.create(
            name='Projects Only',
            allow_agent_view_tickets=False,
            allow_agent_view_customers=False,
            allow_agent_view_projects=True,
        )
        agent = User.objects.create_user(
            username='projectsonly', full_name='Projects', password='testpass123',
            role=User.Role.AGENT, staff_role=hidden,
        )
        self.auth(agent)
        self.assertEqual(self.client.get('/api/tickets/').status_code, 403)
        self.assertEqual(self.client.get('/api/users/customers/').status_code, 403)
        self.assertEqual(self.client.get('/api/projects/').status_code, 200)

    def test_hiding_sections_never_affects_a_customer(self):
        """Customers hold no staff permissions, so a naive check would lock them
        out of their own tickets."""
        customer = User.objects.create_user(
            username='acustomer', full_name='A Customer', password='testpass123',
            role=User.Role.CUSTOMER,
        )
        settings = TicketSettings.get_solo()
        settings.allow_agent_view_tickets = False
        settings.save()
        self.auth(customer)
        self.assertEqual(self.client.get('/api/tickets/').status_code, 200)

    def test_me_reports_resolved_permissions(self):
        self.auth(self.admin)
        data = self.client.get('/api/auth/me/').json()
        self.assertTrue(data['is_full_admin'])
        self.assertTrue(data['permissions']['allow_agent_manage_kb'])


class NewCustomerIsActiveTests(TestCase):
    """The customer form posts multipart (it can carry attachments) and never
    sends is_active. DRF reads a missing boolean in form data as False, which
    silently created every new customer deactivated."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='cadmin', full_name='Admin', password='testpass123', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)

    def post(self, username, **extra):
        payload = {
            'username': username, 'full_name': 'Probe', 'password': 'abcd12345',
            'licenses': '[]', 'branches': '[]', **extra,
        }
        return self.client.post('/api/users/customers/', payload, format='multipart')

    def test_a_new_customer_is_active_by_default(self):
        response = self.post('newcustomer')
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()['is_active'])
        self.assertTrue(User.objects.get(username='newcustomer').is_active)

    def test_an_explicit_false_is_still_honoured(self):
        response = self.post('inactiveone', is_active='false')
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.json()['is_active'])

    def test_the_activate_toggle_still_works(self):
        self.post('togglee')
        customer = User.objects.get(username='togglee')
        off = self.client.patch(
            f'/api/users/customers/{customer.pk}/', {'is_active': False}, format='json'
        )
        self.assertFalse(off.json()['is_active'])
        on = self.client.patch(
            f'/api/users/customers/{customer.pk}/', {'is_active': True}, format='json'
        )
        self.assertTrue(on.json()['is_active'])
