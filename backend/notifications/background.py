import logging
import threading

from django.db import connections

logger = logging.getLogger(__name__)


def run_in_background(fn, *args, **kwargs):
    """Run ``fn`` off the request thread, fire-and-forget.

    Outbound notifications (SMTP, WhatsApp) talk to remote servers and cost
    seconds per call. Done inline they dominate the response time of the API
    action that triggered them — a ticket status change spent longer sending
    mail than doing the work. Nothing in the response depends on the result, so
    the caller does not wait for it.

    Failures are logged and swallowed: a mail-server problem must never surface
    as a failed request, matching the ``fail_silently`` behaviour these calls
    already had.

    Note the thread is a daemon, so a send still in flight is abandoned if the
    process exits. That is the accepted trade-off for not running a task queue;
    move to Celery/RQ if delivery has to be guaranteed.
    """

    def target():
        try:
            fn(*args, **kwargs)
        except Exception:
            logger.exception(
                'background task %s failed', getattr(fn, '__name__', repr(fn))
            )
        finally:
            # Django's connection handler is thread-local, so a task that touches
            # the ORM opens a connection of its own. Nothing closes it when the
            # thread ends, so without this every background task would leak one.
            connections.close_all()

    threading.Thread(target=target, daemon=True).start()
