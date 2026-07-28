import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)


def is_configured():
    """True when both the access token and phone-number id are set."""
    return bool(settings.WHATSAPP_ACCESS_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID)


def to_international(phone):
    """Reduce a phone number to WhatsApp's expected form: digits only, no '+'. If a
    default country code is configured and the number starts with a trunk '0', swap the
    leading 0 for the country code (e.g. 0791234567 -> 962791234567)."""
    digits = re.sub(r'\D', '', phone or '')
    cc = re.sub(r'\D', '', settings.WHATSAPP_DEFAULT_COUNTRY_CODE or '')
    if cc and digits.startswith('0'):
        digits = cc + digits[1:]
    return digits


def notify_staff_new_ticket(ticket):
    """WhatsApp the configured staff number(s) that a new ticket was opened.

    No-op unless WhatsApp is configured and WHATSAPP_NOTIFY_NUMBERS is set. Reuses the
    approved status template, whose 3 body variables become: ticket id, subject, status.
    """
    numbers = [n.strip() for n in (settings.WHATSAPP_NOTIFY_NUMBERS or '').split(',') if n.strip()]
    if not numbers or not is_configured():
        return
    who = ticket.customer.full_name if ticket.customer_id else (ticket.guest_name or 'a guest')
    for number in numbers:
        send_whatsapp_template(
            number,
            [str(ticket.id), f'{ticket.subject} (from {who})', 'New ticket — Unassigned'],
        )


def send_whatsapp_template(to_phone, body_params, template_name=None, lang=None):
    """Send a WhatsApp *template* message via the Meta Cloud API.

    Best-effort and side-effect-safe: returns True on apparent success, False otherwise,
    and never raises (a WhatsApp outage must not break the request that triggered it).
    Does nothing (returns False) when WhatsApp isn't configured.
    """
    if not is_configured():
        return False
    to = to_international(to_phone)
    if not to:
        return False

    url = (
        f'https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}'
        f'/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages'
    )
    components = (
        [{'type': 'body', 'parameters': [{'type': 'text', 'text': str(p)} for p in body_params]}]
        if body_params
        else []
    )
    payload = {
        'messaging_product': 'whatsapp',
        'to': to,
        'type': 'template',
        'template': {
            'name': template_name or settings.WHATSAPP_TEMPLATE_NAME,
            'language': {'code': lang or settings.WHATSAPP_TEMPLATE_LANG},
            'components': components,
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        method='POST',
        headers={
            'Authorization': f'Bearer {settings.WHATSAPP_ACCESS_TOKEN}',
            'Content-Type': 'application/json',
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
        return True
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode(errors='replace')[:500]
        logger.warning('WhatsApp send failed (%s): %s', exc.code, detail)
    except Exception as exc:  # noqa: BLE001 - never let a mail/WhatsApp issue break the view
        logger.warning('WhatsApp send error: %s', exc)
    return False
