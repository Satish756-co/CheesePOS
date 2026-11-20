from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt
from app.auth.decorators import tenant_required
from app import whatsapp_client as wa

whatsapp_bp = Blueprint('whatsapp', __name__)


@whatsapp_bp.route('/status', methods=['GET'])
@jwt_required()
@tenant_required
def status():
    tenant_id = get_jwt().get('tenant_id')
    return jsonify(wa.get_status(tenant_id))


@whatsapp_bp.route('/connect', methods=['POST'])
@jwt_required()
@tenant_required
def connect():
    tenant_id = get_jwt().get('tenant_id')
    return jsonify(wa.connect(tenant_id))


@whatsapp_bp.route('/disconnect', methods=['POST'])
@jwt_required()
@tenant_required
def disconnect():
    tenant_id = get_jwt().get('tenant_id')
    return jsonify(wa.disconnect(tenant_id))
