from datetime import timedelta
from unittest import mock

from django.core import mail
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from accounts.models import CustomerLicense, NotificationPreference, User

from . import licenses as licenses_module
from . import models as models_module
from . import push
from .licenses import sweep_license_expiry
from .models import DeviceToken, LicenseExpiryReminder, Notification, notify


def _run_now(fn, *args, **kwargs):
    """Stand-in for run_in_background so queued mail lands before assertions."""
    fn(*args, **kwargs)


class LicenseExpirySweepTests(TestCase):
    def setUp(self):
        self.today = timezone.localdate()
        self.customer = User.objects.create_user(
            username='cust', full_name='Zaytoun Grill', email='it@zaytoun.example',
            role=User.Role.CUSTOMER,
        )
        self.admin = User.objects.create_user(
            username='boss', full_name='The Admin', email='admin@hermes.example',
            role=User.Role.ADMIN,
        )
        patcher = mock.patch('notifications.emails.run_in_background', _run_now)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _license(self, days_from_today, name='POS licence'):
        return CustomerLicense.objects.create(
            customer=self.customer, name=name,
            end_date=self.today + timedelta(days=days_from_today),
        )

    def test_alerts_customer_and_admin_at_each_stage(self):
        self._license(30)
        self.assertEqual(sweep_license_expiry(), 1)

        recipients = set(
            Notification.objects.filter(
                kind=Notification.Kind.LICENSE_EXPIRY
            ).values_list('recipient__username', flat=True)
        )
        self.assertEqual(recipients, {'cust', 'boss'})
        self.assertEqual(
            sorted(to for m in mail.outbox for to in m.to),
            ['admin@hermes.example', 'it@zaytoun.example'],
        )
        notification = Notification.objects.filter(recipient=self.admin).get()
        self.assertEqual(notification.customer_id, self.customer.id)
        self.assertIn('expires in 30 days', notification.message)

    def test_each_stage_sends_once(self):
        license_obj = self._license(30)
        self.assertEqual(sweep_license_expiry(), 1)
        self.assertEqual(sweep_license_expiry(), 0, 'same day must not re-send')

        # Next stage: 7 days out is a new deadline and alerts again.
        license_obj.end_date = self.today + timedelta(days=7)
        license_obj.save()
        self.assertEqual(sweep_license_expiry(), 1)
        self.assertEqual(sweep_license_expiry(), 0)
        self.assertEqual(Notification.objects.filter(recipient=self.admin).count(), 2)

    def test_missed_stages_collapse_into_one_alert(self):
        """A sweep that has not run for weeks announces the deadline once, not per stage."""
        self._license(2)
        self.assertEqual(sweep_license_expiry(), 1)
        self.assertEqual(Notification.objects.filter(recipient=self.admin).count(), 1)
        # 30 and 7 are recorded as covered, so they cannot fire later.
        self.assertEqual(
            sorted(LicenseExpiryReminder.objects.values_list('days_before', flat=True)),
            [7, 30],
        )

    def test_far_future_and_long_expired_are_left_alone(self):
        self._license(60)
        self._license(-90, name='Old licence')
        self.assertEqual(sweep_license_expiry(), 0)
        self.assertFalse(Notification.objects.exists())
        self.assertFalse(mail.outbox)

    def test_just_expired_still_alerts(self):
        self._license(-2)
        self.assertEqual(sweep_license_expiry(), 1)
        self.assertIn('expired 2 days ago', Notification.objects.first().message)

    def test_survives_the_customer_save_license_rebuild(self):
        """Saving a customer deletes and recreates its licences; reminders must not repeat."""
        self._license(7)
        self.assertEqual(sweep_license_expiry(), 1)
        self.customer.licenses.all().delete()
        self._license(7)
        self.assertEqual(sweep_license_expiry(), 0)

    def test_respects_the_email_opt_out(self):
        NotificationPreference.objects.create(
            user=self.admin, email_on_license_expiry=False
        )
        self._license(1)
        sweep_license_expiry()
        self.assertEqual([to for m in mail.outbox for to in m.to], ['it@zaytoun.example'])
        # The in-app notification is not governed by the email preference.
        self.assertTrue(Notification.objects.filter(recipient=self.admin).exists())

    def test_licenses_without_an_end_date_are_ignored(self):
        CustomerLicense.objects.create(customer=self.customer, name='Perpetual')
        self.assertEqual(sweep_license_expiry(), 0)

    def test_opportunistic_sweep_runs_at_most_hourly(self):
        licenses_module._last_sweep = None
        with mock.patch.object(licenses_module, 'run_in_background') as queued:
            licenses_module.maybe_sweep_license_expiry()
            licenses_module.maybe_sweep_license_expiry()
        self.assertEqual(queued.call_count, 1)
        self.addCleanup(setattr, licenses_module, '_last_sweep', None)


class DeviceRegistrationTests(APITestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            username='agent', full_name='An Agent', role=User.Role.AGENT
        )
        self.other = User.objects.create_user(
            username='other', full_name='Someone Else', role=User.Role.AGENT
        )
        self.url = reverse('device-list')
        self.client.force_authenticate(self.agent)

    def test_registering_twice_keeps_one_row(self):
        self.assertEqual(self.client.post(self.url, {'token': 'abc'}).status_code, 201)
        self.assertEqual(self.client.post(self.url, {'token': 'abc'}).status_code, 200)
        self.assertEqual(DeviceToken.objects.filter(token='abc').count(), 1)

    def test_registering_a_token_moves_it_to_the_new_user(self):
        """A shared phone must not keep alerting the person who logged out."""
        DeviceToken.objects.create(user=self.other, token='shared')
        self.client.post(self.url, {'token': 'shared'})
        self.assertEqual(DeviceToken.objects.get(token='shared').user, self.agent)

    def test_unregister_removes_only_your_own_device(self):
        DeviceToken.objects.create(user=self.other, token='theirs')
        DeviceToken.objects.create(user=self.agent, token='mine')

        self.client.post(reverse('device-unregister'), {'token': 'theirs'})
        self.assertTrue(DeviceToken.objects.filter(token='theirs').exists())

        self.client.post(reverse('device-unregister'), {'token': 'mine'})
        self.assertFalse(DeviceToken.objects.filter(token='mine').exists())

    def test_registration_requires_authentication(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.post(self.url, {'token': 'abc'}).status_code, 401)


class PushDispatchTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='agent', full_name='An Agent', role=User.Role.AGENT
        )
        DeviceToken.objects.create(user=self.user, token='device-1')
        patcher = mock.patch.object(models_module, 'run_in_background', _run_now)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_notify_pushes_with_the_notification_id(self):
        """The id must travel, or the poller redraws the same alert separately."""
        with mock.patch.object(push, 'is_configured', return_value=True), \
                mock.patch.object(push, 'send_alerts') as send:
            notify([self.user], 'Ticket #3 was assigned to you')

        note = Notification.objects.get(recipient=self.user)
        targets, title, body, data = send.call_args.args
        self.assertEqual(list(targets), [(self.user.pk, note.pk)])
        self.assertEqual(title, 'Ticket update')
        self.assertEqual(body, 'Ticket #3 was assigned to you')
        self.assertEqual(data['kind'], Notification.Kind.GENERAL)

    def test_notify_still_records_when_push_is_unconfigured(self):
        with mock.patch.object(push, 'is_configured', return_value=False), \
                mock.patch.object(push, 'send_alerts') as send:
            notify([self.user], 'No Firebase here')

        send.assert_not_called()
        self.assertTrue(Notification.objects.filter(recipient=self.user).exists())

    def test_send_alerts_prunes_tokens_fcm_reports_dead(self):
        DeviceToken.objects.create(user=self.user, token='device-2')
        # device-1 delivers, device-2 is gone (uninstalled app).
        sends = {'device-1': (True, False), 'device-2': (False, True)}
        with mock.patch.object(push, 'is_configured', return_value=True), \
                mock.patch.object(push, '_send', side_effect=lambda t, *a: sends[t]):
            sent = push.send_alerts([(self.user.pk, 1)], 'Title', 'Body')

        self.assertEqual(sent, 1)
        self.assertEqual(
            list(DeviceToken.objects.values_list('token', flat=True)), ['device-1']
        )

    def test_send_alerts_is_a_no_op_without_credentials(self):
        with mock.patch.object(push, 'is_configured', return_value=False):
            self.assertEqual(push.send_alerts([(self.user.pk, 1)], 'T', 'B'), 0)
