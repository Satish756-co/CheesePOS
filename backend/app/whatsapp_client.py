import os
import threading
import time
import random
import requests
from flask import current_app

WHATSAPP_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://whatsapp:3001')


def _url(path):
    return f'{WHATSAPP_URL.rstrip("/")}/{path.lstrip("/")}'


def get_status(tenant_id):
    try:
        r = requests.get(_url(f'/status/{tenant_id}'), timeout=5)
        return r.json()
    except Exception as e:
        return {'status': 'error', 'error': str(e)}


def connect(tenant_id):
    try:
        r = requests.post(_url(f'/connect/{tenant_id}'), timeout=30)
        return r.json()
    except Exception as e:
        return {'status': 'error', 'error': str(e)}


def disconnect(tenant_id):
    try:
        r = requests.delete(_url(f'/disconnect/{tenant_id}'), timeout=10)
        return r.json()
    except Exception as e:
        return {'error': str(e)}


def send_message(tenant_id, phone, message):
    """Send immediately. Returns dict with success or error."""
    try:
        r = requests.post(_url('/send'), json={
            'tenantId': str(tenant_id),
            'phone': phone,
            'message': message,
        }, timeout=15)
        return r.json()
    except Exception as e:
        return {'error': str(e)}


def send_message_async(tenant_id, phone, message):
    """Fire-and-forget — does not block the request."""
    app = current_app._get_current_object()

    def _send():
        with app.app_context():
            result = send_message(tenant_id, phone, message)
            if result.get('error'):
                app.logger.warning(f'[WA] send failed tenant={tenant_id}: {result["error"]}')

    t = threading.Thread(target=_send, daemon=True)
    t.start()


def send_bulk_async(tenant_id, recipients, message_fn, delay_range=(45, 90)):
    """
    Send to a list of recipients with a random delay between each message.
    recipients: list of phone strings
    message_fn: callable(phone) -> str  (personalise per recipient)
    delay_range: (min_seconds, max_seconds) between sends
    """
    app = current_app._get_current_object()

    def _bulk():
        with app.app_context():
            for phone in recipients:
                try:
                    msg = message_fn(phone)
                    send_message(tenant_id, phone, msg)
                    app.logger.info(f'[WA] bulk sent tenant={tenant_id} phone={phone}')
                except Exception as e:
                    app.logger.warning(f'[WA] bulk failed tenant={tenant_id} phone={phone}: {e}')
                delay = random.uniform(*delay_range)
                time.sleep(delay)

    t = threading.Thread(target=_bulk, daemon=True)
    t.start()


def format_salon_bill(bill, tenant_name, outlet_name):
    items_lines = '\n'.join(
        f'  • {bi.item_name}: ₹{bi.price}' for bi in bill.items
    )
    greeting = f'Hello {bill.customer_name}! 👋\n\n' if bill.customer_name else 'Hello! 👋\n\n'
    discount_line = ''
    if bill.coupon_discount and bill.coupon_discount > 0:
        discount_line = f'🎟 Coupon ({bill.coupon_code}): -₹{bill.coupon_discount}\n'
    elif bill.discount_amount and bill.discount_amount > 0:
        discount_line = f'🏷 Discount: -₹{bill.discount_amount}\n'

    return (
        f'{greeting}'
        f'Your bill from *{tenant_name}* 🧾\n\n'
        f'📋 Bill #: {bill.bill_number}\n'
        f'📅 {bill.created_at.strftime("%d %b %Y, %I:%M %p")}\n\n'
        f'*Services:*\n{items_lines}\n\n'
        f'{discount_line}'
        f'💰 *Total: ₹{bill.total}*\n'
        f'💳 Payment: {bill.payment_method.upper()}\n\n'
        f'Thank you for visiting *{outlet_name}*! 🙏'
    )
