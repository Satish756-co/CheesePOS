from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt, verify_jwt_in_request, get_jwt_identity
from app.models import User


def tenant_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if claims.get('is_super_admin'):
            return f(*args, **kwargs)
        if not claims.get('tenant_id'):
            return jsonify({'error': 'No tenant access'}), 403

        # Verify the token hasn't been invalidated (deactivation or password change)
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        if not user or not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401
        if (user.token_version or 0) != (claims.get('tv') or 0):
            return jsonify({'error': 'Session expired. Please log in again.'}), 401

        return f(*args, **kwargs)
    return decorated


def super_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if not claims.get('is_super_admin'):
            return jsonify({'error': 'Super Admin access required'}), 403
        # Verify token version so password changes invalidate super-admin sessions too
        user_id = get_jwt_identity()
        user = User.query.get(int(user_id))
        if not user or not user.is_active:
            return jsonify({'error': 'Account is deactivated'}), 401
        if (user.token_version or 0) != (claims.get('tv') or 0):
            return jsonify({'error': 'Session expired. Please log in again.'}), 401
        return f(*args, **kwargs)
    return decorated


def permission_required(permission):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            if claims.get('is_super_admin'):
                return f(*args, **kwargs)
            from app.extensions import db
            user_id = int(get_jwt_identity())
            user = db.session.get(User, user_id)
            if not user or not user.has_permission(permission):
                return jsonify({'error': f'Permission denied: {permission}'}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
