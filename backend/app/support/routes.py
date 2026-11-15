from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from flask_mail import Message
from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import joinedload
import html as html_mod
import threading
from app.extensions import db, mail
from app.models import SupportTicket, TicketMessage, User, Tenant
from app.auth.decorators import tenant_required

support_bp = Blueprint('support', __name__)


def _send_async(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            app.logger.error(f'Support ticket email failed: {e}')


def _send_ticket_email(app, ticket, raiser, tenant, first_message):
    priority_colors = {'low': '#6b7280', 'normal': '#2563eb', 'high': '#f97316', 'urgent': '#dc2626'}
    priority_color = priority_colors.get(ticket.priority, '#2563eb')
    msg = Message(
        subject=f'[{ticket.ticket_number}] New Support Ticket — {html_mod.escape(ticket.subject)}',
        recipients=['cheesepossupport@gmail.com'],
        html=f"""
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
          <div style="background:#1e293b;color:#fff;padding:16px 24px;border-radius:8px;margin-bottom:24px">
            <h2 style="margin:0;font-size:18px">New Support Ticket — CheesePOS</h2>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">{html_mod.escape(ticket.ticket_number)}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280;width:140px">Customer</td>
              <td style="padding:10px 0;font-weight:bold;color:#111827">{html_mod.escape(tenant.business_name if tenant else 'Unknown')}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Raised By</td>
              <td style="padding:10px 0;color:#111827">{html_mod.escape(f"{raiser.first_name} {raiser.last_name}".strip() if raiser else 'Unknown')}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Subject</td>
              <td style="padding:10px 0;font-weight:bold;color:#111827">{html_mod.escape(ticket.subject)}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Category</td>
              <td style="padding:10px 0;color:#111827;text-transform:capitalize">{html_mod.escape(ticket.category.replace('_', ' '))}</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:10px 0;color:#6b7280">Priority</td>
              <td style="padding:10px 0"><span style="background:{priority_color};color:#fff;padding:2px 10px;border-radius:99px;font-size:12px;font-weight:bold;text-transform:capitalize">{html_mod.escape(ticket.priority)}</span></td>
            </tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280;font-weight:bold;text-transform:uppercase;letter-spacing:.05em">Customer's Message</p>
            <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap">{html_mod.escape(first_message)}</p>
          </div>
          <div style="margin-top:20px;padding:12px 16px;background:#fef3c7;border-radius:8px;font-size:13px;color:#92400e">
            Log in to the admin panel to respond to this ticket.
          </div>
        </div>
        """,
    )
    thread = threading.Thread(target=_send_async, args=(app, msg))
    thread.daemon = True
    thread.start()


def _message_dict(m, senders_map=None, is_super_admin_sender=None):
    """Build message dict. Forces is_system=True for null-sender messages."""
    md = m.to_dict()
    if m.is_system or m.sender_id is None:
        md['is_system'] = True
        md['sender_name'] = 'System'
        md['is_staff'] = False
    else:
        sender = (senders_map or {}).get(m.sender_id) if senders_map else User.query.get(m.sender_id)
        md['sender_name'] = f"{sender.first_name} {sender.last_name}".strip() if sender else 'Unknown'
        md['is_staff'] = sender.is_super_admin if sender else (is_super_admin_sender or False)
    return md


def _system_message(ticket_id, text):
    msg = TicketMessage(ticket_id=ticket_id, sender_id=None, message=text, is_system=True)
    db.session.add(msg)
    return msg


def _ticket_dict_single(t, viewer_is_admin=False):
    """Build a ticket dict for a single ticket (used after mutations, not in list)."""
    d = t.to_dict()
    d['tenant_name'] = t.tenant.business_name if t.tenant else None
    d['message_count'] = t.messages.count()
    raiser = User.query.get(t.raised_by) if t.raised_by else None
    d['raised_by_name'] = f"{raiser.first_name} {raiser.last_name}".strip() if raiser else None
    d['raised_by_email'] = raiser.email if raiser else None
    first = t.messages.filter_by(is_system=False).order_by(TicketMessage.created_at.asc()).first()
    d['preview'] = first.message[:120] if first else None
    if viewer_is_admin:
        d['has_unread'] = bool(
            t.last_customer_message_at and (
                t.staff_last_read_at is None or
                t.last_customer_message_at > t.staff_last_read_at
            )
        )
    else:
        d['has_unread'] = bool(
            t.last_staff_message_at and (
                t.customer_last_read_at is None or
                t.last_staff_message_at > t.customer_last_read_at
            )
        )
    return d


# ─── List ───────────────────────────────────────────────────────────────────

@support_bp.route('/tickets', methods=['GET'])
@jwt_required()
@tenant_required
def list_tickets():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    is_super_admin = claims.get('is_super_admin', False)
    role = claims.get('role')
    user_id = int(get_jwt_identity())
    status = request.args.get('status')
    page = request.args.get('page', 1, type=int)

    # Eager-load tenant to avoid N+1 on tenant.business_name
    q = SupportTicket.query.options(joinedload(SupportTicket.tenant))
    if not is_super_admin:
        q = q.filter_by(tenant_id=tenant_id)
        if role not in ('owner', 'admin'):
            q = q.filter_by(raised_by=user_id)
    if status:
        q = q.filter_by(status=status)

    pagination = q.order_by(SupportTicket.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    ticket_list = pagination.items

    if not ticket_list:
        return jsonify({'tickets': [], 'total': pagination.total, 'pages': pagination.pages, 'total_unread': 0})

    ticket_ids = [t.id for t in ticket_list]

    # Batch load raised_by users in one query
    raised_by_ids = list({t.raised_by for t in ticket_list if t.raised_by})
    users_map = {u.id: u for u in User.query.filter(User.id.in_(raised_by_ids)).all()} if raised_by_ids else {}

    # Batch message counts in one aggregation query
    counts_q = db.session.query(
        TicketMessage.ticket_id,
        func.count(TicketMessage.id).label('cnt')
    ).filter(TicketMessage.ticket_id.in_(ticket_ids)).group_by(TicketMessage.ticket_id).all()
    counts_map = {row.ticket_id: row.cnt for row in counts_q}

    # Batch previews: first non-system message per ticket via subquery (2 queries total)
    min_ids_sq = db.session.query(
        TicketMessage.ticket_id,
        func.min(TicketMessage.id).label('min_id')
    ).filter(
        TicketMessage.ticket_id.in_(ticket_ids),
        TicketMessage.is_system == False
    ).group_by(TicketMessage.ticket_id).subquery()

    preview_rows = db.session.query(
        TicketMessage.ticket_id, TicketMessage.message
    ).join(min_ids_sq, TicketMessage.id == min_ids_sq.c.min_id).all()
    previews_map = {row.ticket_id: row.message[:120] for row in preview_rows}

    tickets = []
    for t in ticket_list:
        d = t.to_dict()
        d['tenant_name'] = t.tenant.business_name if t.tenant else None
        d['message_count'] = counts_map.get(t.id, 0)
        raiser = users_map.get(t.raised_by)
        d['raised_by_name'] = f"{raiser.first_name} {raiser.last_name}".strip() if raiser else None
        d['raised_by_email'] = raiser.email if raiser else None
        d['preview'] = previews_map.get(t.id)
        if is_super_admin:
            d['has_unread'] = bool(
                t.last_customer_message_at and (
                    t.staff_last_read_at is None or
                    t.last_customer_message_at > t.staff_last_read_at
                )
            )
        else:
            d['has_unread'] = bool(
                t.last_staff_message_at and (
                    t.customer_last_read_at is None or
                    t.last_staff_message_at > t.customer_last_read_at
                )
            )
        tickets.append(d)

    total_unread = sum(1 for t in tickets if t.get('has_unread'))
    return jsonify({
        'tickets': tickets,
        'total': pagination.total,
        'pages': pagination.pages,
        'total_unread': total_unread,
    })


# ─── Unread count ────────────────────────────────────────────────────────────

@support_bp.route('/unread-count', methods=['GET'])
@jwt_required()
@tenant_required
def get_unread_count():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    is_super_admin = claims.get('is_super_admin', False)
    role = claims.get('role')
    user_id = int(get_jwt_identity())

    q = SupportTicket.query
    if not is_super_admin:
        q = q.filter_by(tenant_id=tenant_id)
        if role not in ('owner', 'admin'):
            q = q.filter_by(raised_by=user_id)

    if is_super_admin:
        count = q.filter(
            SupportTicket.last_customer_message_at.isnot(None),
            db.or_(
                SupportTicket.staff_last_read_at.is_(None),
                SupportTicket.last_customer_message_at > SupportTicket.staff_last_read_at,
            )
        ).count()
    else:
        count = q.filter(
            SupportTicket.last_staff_message_at.isnot(None),
            db.or_(
                SupportTicket.customer_last_read_at.is_(None),
                SupportTicket.last_staff_message_at > SupportTicket.customer_last_read_at,
            )
        ).count()

    return jsonify({'count': count})


# ─── Create ─────────────────────────────────────────────────────────────────

@support_bp.route('/tickets', methods=['POST'])
@jwt_required()
@tenant_required
def create_ticket():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get('subject'):
        return jsonify({'error': 'subject is required'}), 400
    if not data.get('message'):
        return jsonify({'error': 'message is required'}), 400

    count = SupportTicket.query.count()
    ticket_number = f"SUP-{str(count + 1).zfill(6)}"

    now = datetime.utcnow()
    ticket = SupportTicket(
        tenant_id=tenant_id,
        ticket_number=ticket_number,
        subject=data['subject'],
        category=data.get('category', 'other'),
        priority=data.get('priority', 'normal'),
        raised_by=user_id,
        last_customer_message_at=now,
        customer_last_read_at=now,
    )
    db.session.add(ticket)
    db.session.flush()

    msg = TicketMessage(ticket_id=ticket.id, sender_id=user_id, message=data['message'])
    db.session.add(msg)
    db.session.commit()

    raiser = User.query.get(user_id)
    tenant_obj = Tenant.query.get(tenant_id)
    app = current_app._get_current_object()
    _send_ticket_email(app, ticket, raiser, tenant_obj, data['message'])

    return jsonify(_ticket_dict_single(ticket)), 201


# ─── Get ─────────────────────────────────────────────────────────────────────

@support_bp.route('/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_ticket(ticket_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    is_super_admin = claims.get('is_super_admin', False)

    ticket = SupportTicket.query.options(joinedload(SupportTicket.tenant)).get_or_404(ticket_id)
    if not is_super_admin and ticket.tenant_id != tenant_id:
        return jsonify({'error': 'Access denied'}), 403

    data = _ticket_dict_single(ticket, viewer_is_admin=is_super_admin)

    msgs = ticket.messages.filter_by(is_internal=False).order_by(TicketMessage.created_at.asc()).all()

    # Batch load all senders in one query
    sender_ids = list({m.sender_id for m in msgs if m.sender_id and not m.is_system})
    senders_map = {u.id: u for u in User.query.filter(User.id.in_(sender_ids)).all()} if sender_ids else {}

    data['messages'] = [_message_dict(m, senders_map=senders_map) for m in msgs]
    return jsonify(data)


# ─── Mark read ───────────────────────────────────────────────────────────────

@support_bp.route('/tickets/<int:ticket_id>/read', methods=['PATCH'])
@jwt_required()
@tenant_required
def mark_ticket_read(ticket_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    is_super_admin = claims.get('is_super_admin', False)

    ticket = SupportTicket.query.get_or_404(ticket_id)
    if not is_super_admin and ticket.tenant_id != tenant_id:
        return jsonify({'error': 'Access denied'}), 403

    now = datetime.utcnow()
    if is_super_admin:
        ticket.staff_last_read_at = now
    else:
        ticket.customer_last_read_at = now
    db.session.commit()
    return jsonify({'ok': True})


# ─── Reply ───────────────────────────────────────────────────────────────────

@support_bp.route('/tickets/<int:ticket_id>/reply', methods=['POST'])
@jwt_required()
@tenant_required
def reply_ticket(ticket_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    is_super_admin = claims.get('is_super_admin', False)

    ticket = SupportTicket.query.get_or_404(ticket_id)
    if not is_super_admin and ticket.tenant_id != tenant_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json()
    if not data or not data.get('message'):
        return jsonify({'error': 'message is required'}), 400

    now = datetime.utcnow()
    msg = TicketMessage(
        ticket_id=ticket.id,
        sender_id=user_id,
        message=data['message'],
        is_internal=bool(data.get('is_internal')) and is_super_admin,
    )
    db.session.add(msg)

    if is_super_admin:
        ticket.last_staff_message_at = now
        ticket.staff_last_read_at = now
    else:
        ticket.last_customer_message_at = now
        ticket.customer_last_read_at = now

    sys_msg = None
    if ticket.status == 'open' and is_super_admin:
        ticket.status = 'in_progress'
        sys_msg = _system_message(ticket.id, 'Ticket picked up by support team')

    db.session.commit()

    sender = User.query.get(user_id)
    md = _message_dict(msg, senders_map={user_id: sender} if sender else {})
    result = {'message': md}
    if sys_msg is not None:
        result['system_message'] = _message_dict(sys_msg)
    return jsonify(result), 201


# ─── Status ──────────────────────────────────────────────────────────────────

STATUS_LABELS = {
    'open':        'Ticket reopened',
    'in_progress': 'Ticket set to in progress',
    'resolved':    'Ticket marked as resolved',
    'closed':      'Ticket closed',
}

@support_bp.route('/tickets/<int:ticket_id>/status', methods=['PATCH'])
@jwt_required()
@tenant_required
def update_ticket_status(ticket_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    is_super_admin = claims.get('is_super_admin', False)

    ticket = SupportTicket.query.get_or_404(ticket_id)
    if not is_super_admin and ticket.tenant_id != tenant_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json() or {}
    new_status = data.get('status')
    allowed = ['open', 'in_progress', 'resolved', 'closed']
    if new_status not in allowed:
        return jsonify({'error': f'status must be one of {allowed}'}), 400

    if not is_super_admin and new_status not in ('closed', 'open'):
        return jsonify({'error': 'Insufficient permissions'}), 403

    ticket.status = new_status
    if new_status == 'resolved':
        ticket.resolved_at = datetime.utcnow()
    elif new_status == 'open' and ticket.resolved_at:
        ticket.resolved_at = None

    actor = User.query.get(user_id)
    actor_name = f"{actor.first_name} {actor.last_name}".strip() if actor else 'Someone'
    label = STATUS_LABELS.get(new_status, f'Status changed to {new_status}')
    _system_message(ticket.id, f'{label} by {actor_name}')

    db.session.commit()
    return jsonify(_ticket_dict_single(ticket, viewer_is_admin=is_super_admin))


# ─── Feedback ────────────────────────────────────────────────────────────────

@support_bp.route('/tickets/<int:ticket_id>/feedback', methods=['PATCH'])
@jwt_required()
@tenant_required
def submit_feedback(ticket_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')

    ticket = SupportTicket.query.get_or_404(ticket_id)
    if ticket.tenant_id != tenant_id:
        return jsonify({'error': 'Access denied'}), 403

    data = request.get_json() or {}
    rating = data.get('rating')
    if rating is not None:
        if not isinstance(rating, int) or not (1 <= rating <= 5):
            return jsonify({'error': 'rating must be 1–5'}), 400
        ticket.customer_rating = rating
    ticket.customer_feedback = data.get('feedback', ticket.customer_feedback)
    db.session.commit()
    return jsonify(_ticket_dict_single(ticket))
