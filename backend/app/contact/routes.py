from flask import Blueprint, request, jsonify, current_app
from flask_mail import Message
from app.extensions import mail, limiter
import html as html_mod
import threading

contact_bp = Blueprint('contact', __name__)


def _send_async(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            app.logger.error(f'Contact email failed: {e}')


@contact_bp.route('/', methods=['POST'])
@limiter.limit('5 per hour')
def submit_enquiry():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid request'}), 400

    business_name = data.get('business_name', '').strip()
    email = data.get('email', '').strip()
    phone = data.get('phone', '').strip()
    description = data.get('description', '').strip()

    if not business_name or not email or not phone:
        return jsonify({'error': 'Business name, email and phone are required'}), 400

    msg = Message(
        subject=f'New CheesePOS Enquiry — {business_name}',
        recipients=['cheesepossupport@gmail.com'],
        html=f"""
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <div style="background:#2563eb;color:#fff;padding:16px 24px;border-radius:8px;margin-bottom:24px">
            <h2 style="margin:0;font-size:20px">New Enquiry — CheesePOS</h2>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280;width:140px">Business Name</td>
              <td style="padding:10px 0;font-weight:bold;color:#111827">{html_mod.escape(business_name)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Email</td>
              <td style="padding:10px 0;color:#111827">{html_mod.escape(email)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Phone</td>
              <td style="padding:10px 0;color:#111827">{html_mod.escape(phone)}</td>
            </tr>
            <tr>
              <td style="padding:10px 0;color:#6b7280;vertical-align:top">Message</td>
              <td style="padding:10px 0;color:#111827">{html_mod.escape(description) if description else '<em style="color:#9ca3af">No message provided</em>'}</td>
            </tr>
          </table>
          <div style="margin-top:24px;padding:12px 16px;background:#f0fdf4;border-radius:8px;font-size:13px;color:#166534">
            Reply directly to this email to respond to the enquiry.
          </div>
        </div>
        """,
        reply_to=email,
    )

    app = current_app._get_current_object()
    thread = threading.Thread(target=_send_async, args=(app, msg))
    thread.daemon = True
    thread.start()

    return jsonify({'message': 'Enquiry received successfully'}), 200
