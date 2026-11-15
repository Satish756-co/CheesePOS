from app.extensions import db
from app.models.base import TimestampMixin


class SupportTicket(db.Model, TimestampMixin):
    __tablename__ = 'support_tickets'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    ticket_number = db.Column(db.String(20), nullable=False, unique=True)
    subject = db.Column(db.String(300), nullable=False)
    category = db.Column(db.String(50))
    priority = db.Column(db.String(20), default='normal')  # low, normal, high, urgent
    status = db.Column(db.String(20), default='open')      # open, in_progress, resolved, closed
    raised_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'))
    resolved_at = db.Column(db.DateTime)
    customer_rating = db.Column(db.Integer)
    customer_feedback = db.Column(db.Text)
    # Read-tracking: when each party last opened the chat
    customer_last_read_at = db.Column(db.DateTime, nullable=True)
    staff_last_read_at = db.Column(db.DateTime, nullable=True)
    # Timestamps of last real message from each side (for fast unread detection)
    last_staff_message_at = db.Column(db.DateTime, nullable=True)
    last_customer_message_at = db.Column(db.DateTime, nullable=True)

    tenant = db.relationship('Tenant', back_populates='support_tickets')
    messages = db.relationship('TicketMessage', back_populates='ticket', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'ticket_number': self.ticket_number,
            'subject': self.subject,
            'category': self.category,
            'priority': self.priority,
            'status': self.status,
            'raised_by': self.raised_by,
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'customer_rating': self.customer_rating,
            'customer_feedback': self.customer_feedback,
            'customer_last_read_at': self.customer_last_read_at.isoformat() if self.customer_last_read_at else None,
            'staff_last_read_at': self.staff_last_read_at.isoformat() if self.staff_last_read_at else None,
            'last_staff_message_at': self.last_staff_message_at.isoformat() if self.last_staff_message_at else None,
            'last_customer_message_at': self.last_customer_message_at.isoformat() if self.last_customer_message_at else None,
            'created_at': self.created_at.isoformat(),
        }


class TicketMessage(db.Model, TimestampMixin):
    __tablename__ = 'ticket_messages'

    id = db.Column(db.Integer, primary_key=True)
    ticket_id = db.Column(db.Integer, db.ForeignKey('support_tickets.id'), nullable=False)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # null for system events
    message = db.Column(db.Text, nullable=False)
    is_internal = db.Column(db.Boolean, default=False)
    is_system = db.Column(db.Boolean, default=False)   # activity log entry, not a chat bubble
    attachment_url = db.Column(db.String(500))

    ticket = db.relationship('SupportTicket', back_populates='messages')

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'message': self.message,
            'is_internal': self.is_internal,
            'is_system': self.is_system,
            'attachment_url': self.attachment_url,
            'created_at': self.created_at.isoformat(),
        }
