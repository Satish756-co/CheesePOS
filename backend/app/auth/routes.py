from datetime import datetime, timedelta
import hashlib
import secrets
import html as html_mod
import threading
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt
)
from flask_mail import Message
from app.extensions import db, limiter, mail
from app.models import User, Tenant, AuditLog, get_role_config

auth_bp = Blueprint('auth', __name__)


def log_audit(user_id, action, tenant_id=None, resource_type=None, resource_id=None, old=None, new=None):
    log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        old_values=old,
        new_values=new,
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent', '')[:500],
    )
    db.session.add(log)


@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    user = User.query.filter_by(email=data['email'].lower().strip()).first()

    if not user or not user.check_password(data['password']):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.utcnow() + timedelta(minutes=30)
            db.session.commit()
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    if user.locked_until and user.locked_until > datetime.utcnow():
        return jsonify({'error': 'Account temporarily locked due to too many failed attempts'}), 403

    # Check tenant subscription (skip for super admin)
    if not user.is_super_admin and user.tenant_id:
        tenant = Tenant.query.get(user.tenant_id)
        if tenant and tenant.deletion_status == 'pending_deletion':
            return jsonify({'error': 'This account has been deactivated. Please contact support.'}), 403
        if tenant and tenant.status in ('suspended', 'expired'):
            return jsonify({'error': 'Subscription expired. Please renew your plan.', 'status': tenant.status}), 403

    # Reset failed attempts
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    additional_claims = {
        'tenant_id': user.tenant_id,
        'role': user.role,
        'is_super_admin': user.is_super_admin,
        'tv': user.token_version,
    }

    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    refresh_token = create_refresh_token(identity=str(user.id))

    log_audit(user.id, 'user.login', tenant_id=user.tenant_id)
    db.session.commit()

    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
        'tenant': Tenant.query.get(user.tenant_id).to_dict(include_subscription=True) if user.tenant_id else None,
        'effective_permissions': get_role_config(user.tenant_id, user.role) if user.tenant_id else None,
    })


@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user or not user.is_active:
        return jsonify({'error': 'User not found or deactivated'}), 401

    additional_claims = {
        'tenant_id': user.tenant_id,
        'role': user.role,
        'is_super_admin': user.is_super_admin,
        'tv': user.token_version,
    }
    access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    return jsonify({'access_token': access_token})


@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    response = {'user': user.to_dict()}
    if user.tenant_id:
        tenant = Tenant.query.get(user.tenant_id)
        response['tenant'] = tenant.to_dict(include_subscription=True) if tenant else None
        response['effective_permissions'] = get_role_config(user.tenant_id, user.role)

    return jsonify(response)


@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    data = request.get_json()

    if not user.check_password(data.get('current_password', '')):
        return jsonify({'error': 'Current password is incorrect'}), 400

    new_password = data.get('new_password', '')
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    user.set_password(new_password)
    # Bump token_version to kick all other sessions; this device gets a fresh token below
    user.token_version = (user.token_version or 0) + 1
    log_audit(user.id, 'user.password_changed', tenant_id=user.tenant_id)
    db.session.commit()

    # Re-issue tokens with the new version so the current session stays valid
    additional_claims = {
        'tenant_id': user.tenant_id,
        'role': user.role,
        'is_super_admin': user.is_super_admin,
        'tv': user.token_version,
    }
    new_access_token = create_access_token(identity=str(user.id), additional_claims=additional_claims)
    new_refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        'message': 'Password changed successfully',
        'access_token': new_access_token,
        'refresh_token': new_refresh_token,
    })


@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    user_id = get_jwt_identity()
    log_audit(int(user_id), 'user.logout')
    db.session.commit()
    return jsonify({'message': 'Logged out successfully'})


def _send_reset_email(app, msg):
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            app.logger.error(f'Reset email failed: {e}')


@auth_bp.route('/forgot-password', methods=['POST'])
@limiter.limit("5 per hour")
def forgot_password():
    data = request.get_json()
    email = (data.get('email') or '').lower().strip()
    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    # Always return success so we don't leak which emails exist
    if not user:
        return jsonify({'message': 'If that email is registered, a reset link has been sent.'})

    token = secrets.token_urlsafe(32)
    user.password_reset_token = hashlib.sha256(token.encode()).hexdigest()
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()

    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:5173')
    reset_url = f"{frontend_url}/reset-password?token={token}"

    try:
        msg = Message(
            subject='Reset your CheesePOS password',
            recipients=[user.email],
            html=f"""
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
              <h2 style="color:#1d4ed8">Reset your password</h2>
              <p>Hi {html_mod.escape(user.first_name)},</p>
              <p>We received a request to reset your CheesePOS password.
                 Click the button below to choose a new password.</p>
              <a href="{reset_url}"
                 style="display:inline-block;margin:16px 0;padding:12px 24px;
                        background:#1d4ed8;color:#fff;border-radius:8px;
                        text-decoration:none;font-weight:bold">
                Reset Password
              </a>
              <p style="color:#6b7280;font-size:13px">
                This link expires in <strong>1 hour</strong>.
                If you didn't request a reset, ignore this email.
              </p>
              <p style="color:#6b7280;font-size:12px">
                Or copy this link:<br>
                <a href="{reset_url}" style="color:#1d4ed8">{reset_url}</a>
              </p>
            </div>
            """,
        )
        app = current_app._get_current_object()
        thread = threading.Thread(target=lambda: _send_reset_email(app, msg))
        thread.daemon = True
        thread.start()
    except Exception as e:
        current_app.logger.error(f"Failed to queue reset email to {email}: {e}")

    return jsonify({'message': 'If that email is registered, a reset link has been sent.'})


@auth_bp.route('/reset-password', methods=['POST'])
@limiter.limit("10 per hour")
def reset_password():
    data = request.get_json()
    token = (data.get('token') or '').strip()
    new_password = data.get('new_password', '')

    if not token:
        return jsonify({'error': 'Reset token is required'}), 400
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    user = User.query.filter_by(password_reset_token=token_hash).first()
    if not user or not user.password_reset_expires or user.password_reset_expires < datetime.utcnow():
        return jsonify({'error': 'Reset link is invalid or has expired'}), 400

    user.set_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.failed_login_attempts = 0
    user.locked_until = None
    log_audit(user.id, 'user.password_reset', tenant_id=user.tenant_id)
    db.session.commit()

    return jsonify({'message': 'Password reset successfully. You can now log in.'})


@auth_bp.route('/set-initial-password', methods=['POST'])
@jwt_required()
def set_initial_password():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    if not user.must_change_password:
        return jsonify({'error': 'No password change required'}), 403

    data = request.get_json() or {}
    new_password = data.get('new_password', '')
    if len(new_password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400

    user.set_password(new_password)
    user.must_change_password = False
    user.token_version = (user.token_version or 0) + 1
    log_audit(user.id, 'user.initial_password_set', tenant_id=user.tenant_id)
    db.session.commit()

    from flask_jwt_extended import create_access_token, create_refresh_token
    access_token = create_access_token(
        identity=user.id,
        additional_claims={'ver': user.token_version, 'role': user.role, 'is_super_admin': user.is_super_admin}
    )
    refresh_token = create_refresh_token(
        identity=user.id,
        additional_claims={'ver': user.token_version}
    )
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(),
    })
