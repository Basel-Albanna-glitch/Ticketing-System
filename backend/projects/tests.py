from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User

from .models import Project, Task


class ClosedProjectTests(TestCase):
    """Closing a project archives it: agents can no longer touch it, and nobody
    can delete it until it is reopened."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='padmin', full_name='Admin', password='testpass123', role=User.Role.ADMIN
        )
        self.agent = User.objects.create_user(
            username='pagent', full_name='Agent', password='testpass123', role=User.Role.AGENT
        )
        self.project = Project.objects.create(name='Delivery', created_by=self.admin)
        self.project.assignees.add(self.agent)

    def close(self):
        Project.objects.filter(pk=self.project.pk).update(status=Project.Status.CLOSED)

    def test_agent_can_edit_an_open_project_they_are_on(self):
        self.client.force_authenticate(user=self.agent)
        response = self.client.patch(
            f'/api/projects/{self.project.pk}/', {'name': 'Renamed'}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_agent_cannot_edit_a_closed_project(self):
        self.close()
        self.client.force_authenticate(user=self.agent)
        response = self.client.patch(
            f'/api/projects/{self.project.pk}/', {'name': 'Renamed'}, format='json'
        )
        self.assertEqual(response.status_code, 403)

    def test_agent_cannot_reopen_a_closed_project(self):
        """Otherwise the freeze would be one request away from being undone."""
        self.close()
        self.client.force_authenticate(user=self.agent)
        response = self.client.patch(
            f'/api/projects/{self.project.pk}/', {'status': 'open'}, format='json'
        )
        self.assertEqual(response.status_code, 403)

    def test_admin_can_still_edit_and_reopen_a_closed_project(self):
        self.close()
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/projects/{self.project.pk}/', {'status': 'open'}, format='json'
        )
        self.assertEqual(response.status_code, 200)

    def test_a_closed_project_cannot_be_deleted_even_by_an_admin(self):
        self.close()
        self.client.force_authenticate(user=self.admin)
        response = self.client.delete(f'/api/projects/{self.project.pk}/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Project.objects.filter(pk=self.project.pk).exists())

    def test_reopening_makes_it_deletable_again(self):
        """The rule is a speed bump, not a dead end."""
        self.close()
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/projects/{self.project.pk}/', {'status': 'open'}, format='json')
        self.assertEqual(self.client.delete(f'/api/projects/{self.project.pk}/').status_code, 204)

    def test_can_delete_flag_matches_the_rule(self):
        """The UI hides the delete button on this flag, so it must not promise a
        delete the API will refuse."""
        self.client.force_authenticate(user=self.admin)
        open_payload = self.client.get(f'/api/projects/{self.project.pk}/').json()
        self.assertTrue(open_payload['can_delete'])

        self.close()
        closed_payload = self.client.get(f'/api/projects/{self.project.pk}/').json()
        self.assertFalse(closed_payload['can_delete'])
        # Still editable by an admin — the two flags are deliberately different.
        self.assertTrue(closed_payload['can_edit'])

    def test_a_project_with_unfinished_tasks_cannot_be_closed(self):
        Task.objects.create(
            project=self.project,
            title='Outstanding',
            status=Task.Status.TODO,
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            f'/api/projects/{self.project.pk}/', {'status': 'closed'}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Outstanding', str(response.json()))


class NewTaskRequirementsTests(TestCase):
    """A task added from now on must say who and when. Existing tasks predate the
    rule, so editing one must not demand details nobody recorded."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            username='tadmin', full_name='Admin', password='testpass123', role=User.Role.ADMIN
        )
        self.project = Project.objects.create(name='Work', created_by=self.admin)
        self.client.force_authenticate(user=self.admin)

    def post(self, **extra):
        payload = {'project': self.project.pk, 'title': 'A task', **extra}
        return self.client.post('/api/tasks/', payload, format='json')

    def test_assignee_is_required(self):
        response = self.post(due_date='2026-09-01')
        self.assertEqual(response.status_code, 400)
        self.assertIn('assignee_ids', response.json())

    def test_due_date_is_required(self):
        response = self.post(assignee_ids=[self.admin.pk])
        self.assertEqual(response.status_code, 400)
        self.assertIn('due_date', response.json())

    def test_a_complete_task_is_accepted(self):
        response = self.post(assignee_ids=[self.admin.pk], due_date='2026-09-01')
        self.assertEqual(response.status_code, 201)

    def test_an_older_incomplete_task_stays_editable(self):
        legacy = Task.objects.create(
            project=self.project, title='Legacy', created_by=self.admin
        )
        response = self.client.patch(
            f'/api/tasks/{legacy.pk}/', {'title': 'Legacy renamed'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
