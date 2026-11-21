from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy.orm import joinedload
from app.extensions import db
from app.utils import parse_ist_date, parse_ist_date_end, ist_today
from app.auth.decorators import tenant_required
from app.models.salon import (
    SalonServiceCategory, SalonService, SalonPackage, SalonPackageService,
    SalonCoupon, SalonBill, SalonBillItem,
    SalonServiceOutletPrice, SalonPackageOutletPrice,
    SalonBillCancelRequest,
)
from app.models import Expense, User, Outlet, get_role_config

salon_bp = Blueprint('salon', __name__)

_MANAGERS = ('owner', 'admin', 'manager')


def _manager_required():
    role = get_jwt().get('role')
    if role not in _MANAGERS:
        return jsonify({'error': 'Manager or higher role required'}), 403
    return None


# ─────────────────────────────────────────
# Service Categories
# ─────────────────────────────────────────

@salon_bp.route('/service-categories', methods=['GET'])
@jwt_required()
@tenant_required
def list_service_categories():
    tenant_id = get_jwt().get('tenant_id')
    cats = SalonServiceCategory.query.filter_by(tenant_id=tenant_id).order_by(
        SalonServiceCategory.sort_order, SalonServiceCategory.name
    ).all()
    return jsonify([c.to_dict() for c in cats])


@salon_bp.route('/service-categories', methods=['POST'])
@jwt_required()
@tenant_required
def create_service_category():
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    data = request.get_json()
    cat = SalonServiceCategory(
        tenant_id=tenant_id,
        name=data['name'].strip(),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@salon_bp.route('/service-categories/<int:cat_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_service_category(cat_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    cat = SalonServiceCategory.query.filter_by(id=cat_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    if 'name' in data:
        cat.name = data['name'].strip()
    if 'sort_order' in data:
        cat.sort_order = data['sort_order']
    if 'is_active' in data:
        cat.is_active = data['is_active']
    db.session.commit()
    return jsonify(cat.to_dict())


@salon_bp.route('/service-categories/<int:cat_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_service_category(cat_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    cat = SalonServiceCategory.query.filter_by(id=cat_id, tenant_id=tenant_id).first_or_404()
    db.session.delete(cat)
    db.session.commit()
    return jsonify({'success': True})


# ─────────────────────────────────────────
# Services
# ─────────────────────────────────────────

@salon_bp.route('/services', methods=['GET'])
@jwt_required()
@tenant_required
def list_services():
    tenant_id = get_jwt().get('tenant_id')
    args = request.args
    q = SalonService.query.filter_by(tenant_id=tenant_id)
    if args.get('category_id'):
        q = q.filter_by(category_id=int(args['category_id']))
    svcs = q.order_by(SalonService.category_id, SalonService.name).all()

    outlet_id = args.get('outlet_id')
    if outlet_id:
        overrides = {
            op.service_id: float(op.price)
            for op in SalonServiceOutletPrice.query.filter_by(outlet_id=int(outlet_id)).all()
        }
        result = []
        for s in svcs:
            d = s.to_dict()
            if s.id in overrides:
                d['price'] = overrides[s.id]
            result.append(d)
        return jsonify(result)
    return jsonify([s.to_dict() for s in svcs])


@salon_bp.route('/services', methods=['POST'])
@jwt_required()
@tenant_required
def create_service():
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    data = request.get_json()
    svc = SalonService(
        tenant_id=tenant_id,
        category_id=data.get('category_id'),
        name=data['name'].strip(),
        description=(data.get('description') or '').strip(),
        price=Decimal(str(data.get('price', 0))),
        duration_minutes=data.get('duration_minutes', 30),
        commission_pct=Decimal(str(data.get('commission_pct', 0))),
    )
    db.session.add(svc)
    db.session.commit()
    return jsonify(svc.to_dict()), 201


@salon_bp.route('/services/<int:svc_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_service(svc_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    svc = SalonService.query.filter_by(id=svc_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    for field in ('name', 'description', 'category_id', 'duration_minutes', 'is_active'):
        if field in data:
            setattr(svc, field, data[field].strip() if isinstance(data[field], str) else data[field])
    if 'price' in data:
        svc.price = Decimal(str(data['price']))
    if 'commission_pct' in data:
        svc.commission_pct = Decimal(str(data['commission_pct']))
    db.session.commit()
    return jsonify(svc.to_dict())


@salon_bp.route('/services/<int:svc_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_service(svc_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    svc = SalonService.query.filter_by(id=svc_id, tenant_id=tenant_id).first_or_404()
    db.session.delete(svc)
    db.session.commit()
    return jsonify({'success': True})


@salon_bp.route('/services/<int:svc_id>/outlet-prices', methods=['GET'])
@jwt_required()
@tenant_required
def get_service_outlet_prices(svc_id):
    tenant_id = get_jwt().get('tenant_id')
    SalonService.query.filter_by(id=svc_id, tenant_id=tenant_id).first_or_404()
    prices = SalonServiceOutletPrice.query.filter_by(service_id=svc_id).all()
    return jsonify([{'outlet_id': p.outlet_id, 'price': float(p.price)} for p in prices])


@salon_bp.route('/services/<int:svc_id>/outlet-prices', methods=['PUT'])
@jwt_required()
@tenant_required
def update_service_outlet_prices(svc_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    SalonService.query.filter_by(id=svc_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json() or []
    SalonServiceOutletPrice.query.filter_by(service_id=svc_id).delete()
    for item in data:
        if item.get('price') is not None and item.get('outlet_id'):
            db.session.add(SalonServiceOutletPrice(
                service_id=svc_id,
                outlet_id=int(item['outlet_id']),
                price=Decimal(str(item['price'])),
            ))
    db.session.commit()
    return jsonify({'success': True})


# ─────────────────────────────────────────
# Packages
# ─────────────────────────────────────────

@salon_bp.route('/packages', methods=['GET'])
@jwt_required()
@tenant_required
def list_packages():
    tenant_id = get_jwt().get('tenant_id')
    pkgs = SalonPackage.query.filter_by(tenant_id=tenant_id).order_by(SalonPackage.name).all()

    outlet_id = request.args.get('outlet_id')
    if outlet_id:
        overrides = {
            op.package_id: float(op.price)
            for op in SalonPackageOutletPrice.query.filter_by(outlet_id=int(outlet_id)).all()
        }
        result = []
        for p in pkgs:
            d = p.to_dict()
            if p.id in overrides:
                d['price'] = overrides[p.id]
            result.append(d)
        return jsonify(result)
    return jsonify([p.to_dict() for p in pkgs])


@salon_bp.route('/packages', methods=['POST'])
@jwt_required()
@tenant_required
def create_package():
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    data = request.get_json()
    pkg = SalonPackage(
        tenant_id=tenant_id,
        name=data['name'].strip(),
        description=(data.get('description') or '').strip(),
        price=Decimal(str(data['price'])),
    )
    db.session.add(pkg)
    db.session.flush()
    for svc_id in data.get('service_ids', []):
        db.session.add(SalonPackageService(package_id=pkg.id, service_id=svc_id))
    db.session.commit()
    return jsonify(pkg.to_dict()), 201


@salon_bp.route('/packages/<int:pkg_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_package(pkg_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    pkg = SalonPackage.query.filter_by(id=pkg_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    if 'name' in data:
        pkg.name = data['name'].strip()
    if 'description' in data:
        pkg.description = (data['description'] or '').strip()
    if 'price' in data:
        pkg.price = Decimal(str(data['price']))
    if 'is_active' in data:
        pkg.is_active = data['is_active']
    if 'service_ids' in data:
        pkg.items.delete()
        for svc_id in data['service_ids']:
            db.session.add(SalonPackageService(package_id=pkg.id, service_id=svc_id))
    db.session.commit()
    return jsonify(pkg.to_dict())


@salon_bp.route('/packages/<int:pkg_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_package(pkg_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    pkg = SalonPackage.query.filter_by(id=pkg_id, tenant_id=tenant_id).first_or_404()
    db.session.delete(pkg)
    db.session.commit()
    return jsonify({'success': True})


@salon_bp.route('/packages/<int:pkg_id>/outlet-prices', methods=['GET'])
@jwt_required()
@tenant_required
def get_package_outlet_prices(pkg_id):
    tenant_id = get_jwt().get('tenant_id')
    SalonPackage.query.filter_by(id=pkg_id, tenant_id=tenant_id).first_or_404()
    prices = SalonPackageOutletPrice.query.filter_by(package_id=pkg_id).all()
    return jsonify([{'outlet_id': p.outlet_id, 'price': float(p.price)} for p in prices])


@salon_bp.route('/packages/<int:pkg_id>/outlet-prices', methods=['PUT'])
@jwt_required()
@tenant_required
def update_package_outlet_prices(pkg_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    SalonPackage.query.filter_by(id=pkg_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json() or []
    SalonPackageOutletPrice.query.filter_by(package_id=pkg_id).delete()
    for item in data:
        if item.get('price') is not None and item.get('outlet_id'):
            db.session.add(SalonPackageOutletPrice(
                package_id=pkg_id,
                outlet_id=int(item['outlet_id']),
                price=Decimal(str(item['price'])),
            ))
    db.session.commit()
    return jsonify({'success': True})


# ─────────────────────────────────────────
# Coupons
# ─────────────────────────────────────────

@salon_bp.route('/coupons', methods=['GET'])
@jwt_required()
@tenant_required
def list_coupons():
    tenant_id = get_jwt().get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    active_only = request.args.get('active_only', 'false').lower() == 'true'

    q = SalonCoupon.query.filter_by(tenant_id=tenant_id)
    if active_only:
        q = q.filter_by(is_active=True)
    coupons = q.order_by(SalonCoupon.code).all()

    # When filtering by outlet: return coupons for that outlet + all-outlet coupons
    if outlet_id:
        coupons = [c for c in coupons if c.outlet_id is None or c.outlet_id == outlet_id]

    return jsonify([c.to_dict() for c in coupons])


@salon_bp.route('/coupons', methods=['POST'])
@jwt_required()
@tenant_required
def create_coupon():
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    data = request.get_json()
    code = data['code'].strip().upper()
    if SalonCoupon.query.filter_by(tenant_id=tenant_id, code=code).first():
        return jsonify({'error': 'Coupon code already exists'}), 400
    coupon = SalonCoupon(
        tenant_id=tenant_id,
        code=code,
        name=data.get('name', '').strip(),
        discount_type=data['discount_type'],
        discount_value=Decimal(str(data['discount_value'])),
        min_bill_amount=Decimal(str(data.get('min_bill_amount', 0))),
        max_discount=Decimal(str(data['max_discount'])) if data.get('max_discount') else None,
        valid_from=date.fromisoformat(data['valid_from']) if data.get('valid_from') else None,
        valid_until=date.fromisoformat(data['valid_until']) if data.get('valid_until') else None,
        usage_limit=data.get('usage_limit'),
        applies_to=data.get('applies_to', 'all'),
        allowed_service_ids=data.get('allowed_service_ids', []),
        allowed_package_ids=data.get('allowed_package_ids', []),
        outlet_id=data.get('outlet_id') or None,
    )
    db.session.add(coupon)
    db.session.commit()
    return jsonify(coupon.to_dict()), 201


@salon_bp.route('/coupons/<int:coupon_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_coupon(coupon_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    coupon = SalonCoupon.query.filter_by(id=coupon_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()
    for field in ('name', 'discount_type', 'applies_to', 'is_active', 'usage_limit',
                  'allowed_service_ids', 'allowed_package_ids'):
        if field in data:
            setattr(coupon, field, data[field])
    if 'outlet_id' in data:
        coupon.outlet_id = data['outlet_id'] or None
    if 'discount_value' in data:
        coupon.discount_value = Decimal(str(data['discount_value']))
    if 'min_bill_amount' in data:
        coupon.min_bill_amount = Decimal(str(data['min_bill_amount']))
    if 'max_discount' in data:
        coupon.max_discount = Decimal(str(data['max_discount'])) if data['max_discount'] else None
    if 'valid_from' in data:
        coupon.valid_from = date.fromisoformat(data['valid_from']) if data['valid_from'] else None
    if 'valid_until' in data:
        coupon.valid_until = date.fromisoformat(data['valid_until']) if data['valid_until'] else None
    db.session.commit()
    return jsonify(coupon.to_dict())


@salon_bp.route('/coupons/<int:coupon_id>', methods=['DELETE'])
@jwt_required()
@tenant_required
def delete_coupon(coupon_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    coupon = SalonCoupon.query.filter_by(id=coupon_id, tenant_id=tenant_id).first_or_404()
    db.session.delete(coupon)
    db.session.commit()
    return jsonify({'success': True})


@salon_bp.route('/coupons/validate', methods=['POST'])
@jwt_required()
@tenant_required
def validate_coupon():
    """Validate a coupon code for a given cart total. Called from billing in real-time."""
    tenant_id = get_jwt().get('tenant_id')
    data = request.get_json()
    code = data.get('code', '').strip().upper()
    cart_total = Decimal(str(data.get('invoice_total', data.get('cart_total', 0))))
    service_ids = data.get('service_ids', [])
    package_ids = data.get('package_ids', [])

    coupon = SalonCoupon.query.filter_by(tenant_id=tenant_id, code=code, is_active=True).first()
    if not coupon:
        return jsonify({'valid': False, 'error': 'Coupon not found or inactive'}), 200

    # Check outlet restriction — coupon with outlet_id only valid at that outlet
    outlet_id = data.get('outlet_id')
    if coupon.outlet_id and outlet_id and coupon.outlet_id != int(outlet_id):
        return jsonify({'valid': False, 'error': 'Coupon is not valid for this outlet'}), 200

    today = date.today()
    if coupon.valid_from and today < coupon.valid_from:
        return jsonify({'valid': False, 'error': 'Coupon is not yet active'}), 200
    if coupon.valid_until and today > coupon.valid_until:
        return jsonify({'valid': False, 'error': 'Coupon has expired'}), 200
    if coupon.usage_limit and coupon.used_count >= coupon.usage_limit:
        return jsonify({'valid': False, 'error': 'Coupon usage limit reached'}), 200
    if cart_total < (coupon.min_bill_amount or 0):
        return jsonify({'valid': False, 'error': f'Minimum bill amount is ₹{coupon.min_bill_amount}'}), 200

    # Check applicability
    if coupon.applies_to == 'services' and coupon.allowed_service_ids:
        if not any(sid in coupon.allowed_service_ids for sid in service_ids):
            return jsonify({'valid': False, 'error': 'Coupon not applicable for selected services'}), 200
    if coupon.applies_to == 'packages' and coupon.allowed_package_ids:
        if not any(pid in coupon.allowed_package_ids for pid in package_ids):
            return jsonify({'valid': False, 'error': 'Coupon not applicable for selected packages'}), 200

    if coupon.discount_type == 'percent':
        discount = cart_total * coupon.discount_value / 100
        if coupon.max_discount:
            discount = min(discount, coupon.max_discount)
    else:
        discount = min(coupon.discount_value, cart_total)

    return jsonify({
        'valid': True,
        'coupon_id': coupon.id,
        'code': coupon.code,
        'name': coupon.name,
        'discount_type': coupon.discount_type,
        'discount_value': float(coupon.discount_value),
        'discount_amount': float(discount),
    })


# ─────────────────────────────────────────
# Bills
# ─────────────────────────────────────────

@salon_bp.route('/bills', methods=['POST'])
@jwt_required()
@tenant_required
def create_bill():
    tenant_id = get_jwt().get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    items_data = data.get('items', [])
    if not items_data:
        return jsonify({'error': 'No items in bill'}), 400

    if data.get('outlet_id'):
        outlet = Outlet.query.filter_by(id=data['outlet_id'], tenant_id=tenant_id).first()
        if not outlet:
            return jsonify({'error': 'Invalid outlet'}), 404

    today = date.today()
    count = SalonBill.query.filter(
        SalonBill.tenant_id == tenant_id,
        db.func.date(SalonBill.created_at) == today,
    ).count()
    bill_number = f"SB-{today.strftime('%Y%m%d')}-{count + 1:04d}"

    subtotal = Decimal('0')
    bill_items = []
    for item in items_data:
        price = Decimal(str(item.get('price', 0)))
        qty = int(item.get('quantity', 1))
        commission_pct = Decimal(str(item.get('commission_pct', 0)))
        line_total = price * qty
        commission_amount = line_total * commission_pct / 100
        subtotal += line_total
        bill_items.append(SalonBillItem(
            service_id=item.get('service_id'),
            package_id=item.get('package_id'),
            item_type=item.get('item_type', 'service'),
            item_name=item.get('item_name', ''),
            price=price,
            quantity=qty,
            commission_pct=commission_pct,
            commission_amount=commission_amount,
        ))

    discount_amount = max(Decimal('0'), Decimal(str(data.get('discount_amount', 0))))
    coupon_discount = Decimal('0')
    coupon_id = None
    coupon_code = None

    # Apply and record coupon usage
    if data.get('coupon_id'):
        coupon = SalonCoupon.query.filter_by(id=data['coupon_id'], tenant_id=tenant_id, is_active=True).first()
        if coupon:
            coupon_id = coupon.id
            coupon_code = coupon.code
            coupon_discount = Decimal(str(data.get('coupon_discount', 0)))
            coupon.used_count = (coupon.used_count or 0) + 1

    total = max(Decimal('0'), subtotal - discount_amount - coupon_discount)

    bill = SalonBill(
        tenant_id=tenant_id,
        outlet_id=data.get('outlet_id'),
        bill_number=bill_number,
        customer_name=(data.get('customer_name') or '').strip() or None,
        customer_phone=(data.get('customer_phone') or '').strip() or None,
        staff_id=data.get('staff_id') or user_id,
        subtotal=subtotal,
        discount_amount=discount_amount,
        coupon_id=coupon_id,
        coupon_code=coupon_code,
        coupon_discount=coupon_discount,
        total=total,
        payment_method=data.get('payment_method', 'cash'),
        payment_reference=(data.get('payment_reference') or '').strip() or None,
        notes=(data.get('notes') or '').strip() or None,
        status='paid',
    )
    db.session.add(bill)
    db.session.flush()
    for bi in bill_items:
        bi.bill_id = bill.id
        db.session.add(bi)
    db.session.commit()

    # Send WhatsApp bill asynchronously if customer phone provided
    if bill.customer_phone:
        try:
            from app.whatsapp_client import send_message_async, format_salon_bill
            from app.models import Tenant, Outlet
            tenant = Tenant.query.get(tenant_id)
            outlet = Outlet.query.get(bill.outlet_id) if bill.outlet_id else None
            msg = format_salon_bill(
                bill,
                tenant.business_name if tenant else 'CheesePOS',
                outlet.name if outlet else (tenant.business_name if tenant else 'CheesePOS'),
            )
            send_message_async(tenant_id, bill.customer_phone, msg)
        except Exception as e:
            print(f'WhatsApp bill send skipped: {e}', flush=True)

    return jsonify(bill.to_dict(include_items=True)), 201


@salon_bp.route('/bills', methods=['GET'])
@jwt_required()
@tenant_required
def list_bills():
    tenant_id = get_jwt().get('tenant_id')
    user_id = int(get_jwt_identity())
    args = request.args
    q = SalonBill.query.filter_by(tenant_id=tenant_id)

    # Enforce data_scope from role config
    current_user = User.query.get(user_id)
    if current_user:
        role_cfg = get_role_config(tenant_id, current_user.role)
        scope = role_cfg.get('data_scope', 'all')
        if scope == 'own':
            q = q.filter(SalonBill.staff_id == user_id)
        elif scope == 'outlet':
            assigned = current_user.outlet_ids or []
            if assigned:
                q = q.filter(SalonBill.outlet_id.in_(assigned))

    if args.get('date'):
        q = q.filter(SalonBill.created_at >= parse_ist_date(args['date']),
                     SalonBill.created_at < parse_ist_date_end(args['date']))
    if args.get('staff_id'):
        q = q.filter_by(staff_id=int(args['staff_id']))
    if args.get('status'):
        q = q.filter_by(status=args['status'])
    if args.get('outlet_id'):
        q = q.filter_by(outlet_id=int(args['outlet_id']))

    page = int(args.get('page', 1))
    per_page = int(args.get('per_page', 50))
    paginated = q.options(
        joinedload(SalonBill.staff),
        joinedload(SalonBill.outlet),
    ).order_by(SalonBill.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    # Batch-load pending cancel requests for visible bills
    bill_ids = [b.id for b in paginated.items]
    pending_map = {}
    if bill_ids:
        for cr in SalonBillCancelRequest.query.filter(
            SalonBillCancelRequest.bill_id.in_(bill_ids),
            SalonBillCancelRequest.status == 'pending',
        ).all():
            pending_map[cr.bill_id] = cr

    bills_out = []
    for b in paginated.items:
        d = b.to_dict(include_items=True)
        d['cancel_request_status'] = 'pending' if b.id in pending_map else None
        bills_out.append(d)

    return jsonify({
        'bills': bills_out,
        'total': paginated.total,
        'pages': paginated.pages,
        'page': page,
    })


@salon_bp.route('/bills/<int:bill_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_bill(bill_id):
    tenant_id = get_jwt().get('tenant_id')
    bill = SalonBill.query.filter_by(id=bill_id, tenant_id=tenant_id).first_or_404()
    return jsonify(bill.to_dict(include_items=True))


@salon_bp.route('/bills/<int:bill_id>/cancel', methods=['POST'])
@jwt_required()
@tenant_required
def cancel_bill(bill_id):
    tenant_id = get_jwt().get('tenant_id')
    caller_id = int(get_jwt_identity())
    caller_role = get_jwt().get('role')
    bill = SalonBill.query.filter_by(id=bill_id, tenant_id=tenant_id).first_or_404()
    if bill.status == 'cancelled':
        return jsonify({'error': 'Bill already cancelled'}), 400
    # Block direct cancellation if the role requires manager approval for billing.cancel
    role_cfg = get_role_config(tenant_id, caller_role)
    if 'billing.cancel' in (role_cfg.get('approvals') or []):
        return jsonify({'error': 'Your role requires manager approval to cancel bills. Submit a cancel request instead.', 'requires_approval': True}), 403
    if caller_role not in _MANAGERS and bill.staff_id != caller_id:
        return jsonify({'error': 'You can only cancel bills you created'}), 403
    if bill.coupon_id:
        coupon = SalonCoupon.query.get(bill.coupon_id)
        if coupon and coupon.used_count > 0:
            coupon.used_count -= 1
    bill.status = 'cancelled'
    db.session.commit()
    return jsonify({'success': True, 'bill_number': bill.bill_number})


@salon_bp.route('/bills/<int:bill_id>/cancel-request', methods=['POST'])
@jwt_required()
@tenant_required
def request_cancel_bill(bill_id):
    tenant_id = get_jwt().get('tenant_id')
    caller_id = int(get_jwt_identity())
    caller_role = get_jwt().get('role')
    bill = SalonBill.query.filter_by(id=bill_id, tenant_id=tenant_id).first_or_404()
    if bill.status != 'paid':
        return jsonify({'error': 'Only paid bills can be cancelled'}), 400
    if caller_role in _MANAGERS:
        return jsonify({'error': 'Managers can cancel bills directly'}), 400
    if bill.staff_id != caller_id:
        return jsonify({'error': 'You can only request cancellation for bills you created'}), 403
    existing = SalonBillCancelRequest.query.filter_by(bill_id=bill_id, status='pending').first()
    if existing:
        return jsonify({'error': 'A cancel request is already pending for this bill'}), 400
    data = request.get_json() or {}
    req = SalonBillCancelRequest(
        tenant_id=tenant_id,
        bill_id=bill_id,
        requested_by=caller_id,
        reason=(data.get('reason') or '').strip() or None,
    )
    db.session.add(req)
    db.session.commit()
    return jsonify({'success': True, 'request_id': req.id})


@salon_bp.route('/cancel-requests', methods=['GET'])
@jwt_required()
@tenant_required
def list_cancel_requests():
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    status_filter = request.args.get('status', 'pending')
    q = SalonBillCancelRequest.query.filter_by(tenant_id=tenant_id)
    if status_filter != 'all':
        q = q.filter_by(status=status_filter)
    items = q.options(
        joinedload(SalonBillCancelRequest.bill),
        joinedload(SalonBillCancelRequest.requester),
    ).order_by(SalonBillCancelRequest.created_at.desc()).all()
    return jsonify([r.to_dict() for r in items])


@salon_bp.route('/cancel-requests/<int:req_id>/approve', methods=['POST'])
@jwt_required()
@tenant_required
def approve_cancel_request(req_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    reviewer_id = int(get_jwt_identity())
    cancel_req = SalonBillCancelRequest.query.filter_by(
        id=req_id, tenant_id=tenant_id, status='pending'
    ).first_or_404()
    bill = SalonBill.query.get(cancel_req.bill_id)
    if not bill or bill.status == 'cancelled':
        return jsonify({'error': 'Bill is already cancelled'}), 400
    if bill.coupon_id:
        coupon = SalonCoupon.query.get(bill.coupon_id)
        if coupon and coupon.used_count > 0:
            coupon.used_count -= 1
    bill.status = 'cancelled'
    data = request.get_json() or {}
    cancel_req.status = 'approved'
    cancel_req.reviewed_by = reviewer_id
    cancel_req.review_note = (data.get('note') or '').strip() or None
    db.session.commit()
    return jsonify({'success': True, 'bill_number': bill.bill_number})


@salon_bp.route('/cancel-requests/<int:req_id>/reject', methods=['POST'])
@jwt_required()
@tenant_required
def reject_cancel_request(req_id):
    err = _manager_required()
    if err: return err
    tenant_id = get_jwt().get('tenant_id')
    reviewer_id = int(get_jwt_identity())
    cancel_req = SalonBillCancelRequest.query.filter_by(
        id=req_id, tenant_id=tenant_id, status='pending'
    ).first_or_404()
    data = request.get_json() or {}
    cancel_req.status = 'rejected'
    cancel_req.reviewed_by = reviewer_id
    cancel_req.review_note = (data.get('note') or '').strip() or None
    db.session.commit()
    return jsonify({'success': True})


# ─────────────────────────────────────────
# Dashboard
# ─────────────────────────────────────────

@salon_bp.route('/dashboard', methods=['GET'])
@jwt_required()
@tenant_required
def salon_dashboard():
    tenant_id = get_jwt().get('tenant_id')
    today_start = parse_ist_date(date.today().isoformat())
    today_end = parse_ist_date_end(date.today().isoformat())

    today_bills = SalonBill.query.filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= today_start,
        SalonBill.created_at < today_end,
    ).all()

    today_revenue = sum(float(b.total) for b in today_bills)
    bill_count = len(today_bills)

    # Top services today
    from sqlalchemy import func
    top_services = db.session.query(
        SalonBillItem.item_name,
        func.count(SalonBillItem.id).label('count'),
        func.sum(SalonBillItem.price * SalonBillItem.quantity).label('revenue'),
    ).join(SalonBill).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= today_start,
        SalonBill.created_at < today_end,
    ).group_by(SalonBillItem.item_name).order_by(db.text('count DESC')).limit(5).all()

    # Staff performance today
    staff_perf = db.session.query(
        SalonBill.staff_id,
        func.count(SalonBill.id).label('bills'),
        func.sum(SalonBill.total).label('revenue'),
    ).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= today_start,
        SalonBill.created_at < today_end,
        SalonBill.staff_id.isnot(None),
    ).group_by(SalonBill.staff_id).all()

    staff_rows = []
    if staff_perf:
        staff_ids = [row.staff_id for row in staff_perf]
        users_map = {u.id: u for u in User.query.filter(User.id.in_(staff_ids)).all()}
        for row in staff_perf:
            u = users_map.get(row.staff_id)
            staff_rows.append({
                'staff_id': row.staff_id,
                'staff_name': u.full_name if u else 'Unknown',
                'bills': row.bills,
                'revenue': float(row.revenue or 0),
            })

    recent_bills = SalonBill.query.filter(
        SalonBill.tenant_id == tenant_id,
    ).order_by(SalonBill.created_at.desc()).limit(10).all()

    return jsonify({
        'today_revenue': today_revenue,
        'today_bills': bill_count,
        'top_services': [
            {'name': r.item_name, 'count': r.count, 'revenue': float(r.revenue or 0)}
            for r in top_services
        ],
        'staff_performance': staff_rows,
        'recent_bills': [b.to_dict() for b in recent_bills],
    })


# ─────────────────────────────────────────
# Summary
# ─────────────────────────────────────────

@salon_bp.route('/summary', methods=['GET'])
@jwt_required()
@tenant_required
def salon_summary():
    tenant_id = get_jwt().get('tenant_id')
    args = request.args
    period = args.get('period', 'today')
    outlet_id = args.get('outlet_id')

    today = date.today()

    if args.get('date_from') and args.get('date_to'):
        start = parse_ist_date(args['date_from'])
        end   = parse_ist_date_end(args['date_to'])
    elif period == 'today':
        start = parse_ist_date(today.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'week':
        from datetime import timedelta
        week_start = today - __import__('datetime').timedelta(days=today.weekday())
        start = parse_ist_date(week_start.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'last_month':
        import calendar
        first_of_this = today.replace(day=1)
        last_month_end = first_of_this - __import__('datetime').timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        start = parse_ist_date(last_month_start.isoformat())
        end = parse_ist_date_end(last_month_end.isoformat())
    else:  # month
        import calendar
        start = parse_ist_date(today.replace(day=1).isoformat())
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = parse_ist_date_end(today.replace(day=last_day).isoformat())

    q = SalonBill.query.filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= start,
        SalonBill.created_at < end,
    )
    if outlet_id:
        q = q.filter_by(outlet_id=int(outlet_id))
    bills = q.all()

    total_revenue = sum(float(b.total) for b in bills)
    total_bills = len(bills)
    cash = sum(float(b.total) for b in bills if b.payment_method == 'cash')
    upi = sum(float(b.total) for b in bills if b.payment_method == 'upi')
    card = sum(float(b.total) for b in bills if b.payment_method == 'card')

    expense_q = Expense.query.filter(
        Expense.tenant_id == tenant_id,
        Expense.expense_date >= start.date(),
        Expense.expense_date <= end.date(),
    )
    if outlet_id:
        expense_q = expense_q.filter_by(outlet_id=int(outlet_id))
    total_expenses = sum(float(e.amount) for e in expense_q.all())

    from sqlalchemy import func
    top_services = db.session.query(
        SalonBillItem.item_name,
        func.count(SalonBillItem.id).label('count'),
        func.sum(SalonBillItem.price * SalonBillItem.quantity).label('revenue'),
    ).join(SalonBill).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= start,
        SalonBill.created_at < end,
    ).group_by(SalonBillItem.item_name).order_by(db.text('count DESC')).limit(10).all()

    payment_breakdown = [
        {'method': 'Cash', 'amount': cash},
        {'method': 'UPI', 'amount': upi},
        {'method': 'Card', 'amount': card},
    ]

    return jsonify({
        'period': period,
        'total_revenue': total_revenue,
        'total_bills': total_bills,
        'cash': cash,
        'upi': upi,
        'card': card,
        'payment_breakdown': payment_breakdown,
        'total_expenses': total_expenses,
        'profit': total_revenue - total_expenses,
        'top_services': [
            {'name': r.item_name, 'count': r.count, 'revenue': float(r.revenue or 0)}
            for r in top_services
        ],
    })


@salon_bp.route('/summary/staff', methods=['GET'])
@jwt_required()
@tenant_required
def salon_summary_staff():
    tenant_id = get_jwt().get('tenant_id')
    args = request.args
    period = args.get('period', 'today')
    outlet_id = args.get('outlet_id')

    today = date.today()

    if args.get('date_from') and args.get('date_to'):
        start = parse_ist_date(args['date_from'])
        end   = parse_ist_date_end(args['date_to'])
    elif period == 'today':
        start = parse_ist_date(today.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'week':
        from datetime import timedelta
        week_start = today - timedelta(days=today.weekday())
        start = parse_ist_date(week_start.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'last_month':
        from datetime import timedelta
        first_of_this = today.replace(day=1)
        last_month_end = first_of_this - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        start = parse_ist_date(last_month_start.isoformat())
        end = parse_ist_date_end(last_month_end.isoformat())
    else:  # month
        import calendar
        start = parse_ist_date(today.replace(day=1).isoformat())
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = parse_ist_date_end(today.replace(day=last_day).isoformat())

    from sqlalchemy import func
    q = db.session.query(
        SalonBill.staff_id,
        func.count(SalonBill.id).label('bills'),
        func.sum(SalonBill.total).label('revenue'),
    ).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= start,
        SalonBill.created_at < end,
        SalonBill.staff_id.isnot(None),
    ).group_by(SalonBill.staff_id)
    if outlet_id:
        q = q.filter(SalonBill.outlet_id == int(outlet_id))

    result_rows = q.all()
    rows = []
    if result_rows:
        staff_ids = [row.staff_id for row in result_rows]
        users_map = {u.id: u for u in User.query.filter(User.id.in_(staff_ids)).all()}
        for row in result_rows:
            u = users_map.get(row.staff_id)
            rows.append({
                'id': row.staff_id,
                'name': u.full_name if u else 'Unknown',
                'bills': row.bills,
                'revenue': float(row.revenue or 0),
            })
    return jsonify(rows)


@salon_bp.route('/summary/all-outlets', methods=['GET'])
@jwt_required()
@tenant_required
def salon_summary_all_outlets():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    args = request.args
    period = args.get('period', 'today')

    today = date.today()

    if args.get('date_from') and args.get('date_to'):
        start = parse_ist_date(args['date_from'])
        end   = parse_ist_date_end(args['date_to'])
    elif period == 'today':
        start = parse_ist_date(today.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'week':
        from datetime import timedelta
        week_start = today - timedelta(days=today.weekday())
        start = parse_ist_date(week_start.isoformat())
        end = parse_ist_date_end(today.isoformat())
    elif period == 'last_month':
        from datetime import timedelta
        first_of_this = today.replace(day=1)
        last_month_end = first_of_this - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        start = parse_ist_date(last_month_start.isoformat())
        end = parse_ist_date_end(last_month_end.isoformat())
    else:  # month
        import calendar
        start = parse_ist_date(today.replace(day=1).isoformat())
        last_day = calendar.monthrange(today.year, today.month)[1]
        end = parse_ist_date_end(today.replace(day=last_day).isoformat())

    outlets = Outlet.query.filter_by(tenant_id=tenant_id, is_active=True).all()
    outlet_summaries = []
    total_revenue = 0
    total_expenses = 0

    for outlet in outlets:
        bills = SalonBill.query.filter(
            SalonBill.tenant_id == tenant_id,
            SalonBill.outlet_id == outlet.id,
            SalonBill.status == 'paid',
            SalonBill.created_at >= start,
            SalonBill.created_at < end,
        ).all()
        rev = sum(float(b.total) for b in bills)
        expenses = sum(
            float(e.amount) for e in Expense.query.filter(
                Expense.tenant_id == tenant_id,
                Expense.outlet_id == outlet.id,
                Expense.expense_date >= start.date(),
                Expense.expense_date <= end.date(),
            ).all()
        )
        total_revenue += rev
        total_expenses += expenses
        outlet_summaries.append({
            'outlet_id': outlet.id,
            'outlet_name': outlet.name,
            'revenue': rev,
            'bills': len(bills),
            'expenses': expenses,
            'profit': rev - expenses,
        })

    return jsonify({
        'period': period,
        'total_revenue': total_revenue,
        'total_expenses': total_expenses,
        'total_profit': total_revenue - total_expenses,
        'outlets': outlet_summaries,
    })


# ─────────────────────────────────────────
# Reports
# ─────────────────────────────────────────

@salon_bp.route('/reports/daily', methods=['GET'])
@jwt_required()
@tenant_required
def salon_reports_daily():
    tenant_id = get_jwt().get('tenant_id')
    args = request.args
    date_from = args.get('date_from', ist_today())
    date_to = args.get('date_to', ist_today())
    outlet_id = args.get('outlet_id')

    from sqlalchemy import func
    start = parse_ist_date(date_from)
    end = parse_ist_date_end(date_to)

    q = db.session.query(
        func.date(SalonBill.created_at).label('date'),
        func.count(SalonBill.id).label('bills'),
        func.sum(SalonBill.total).label('revenue'),
    ).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= start,
        SalonBill.created_at < end,
    )
    if outlet_id:
        q = q.filter(SalonBill.outlet_id == int(outlet_id))

    rows = q.group_by(func.date(SalonBill.created_at)).order_by(func.date(SalonBill.created_at)).all()

    return jsonify([{
        'date': str(r.date),
        'bills': r.bills,
        'revenue': float(r.revenue or 0),
    } for r in rows])


@salon_bp.route('/reports/services', methods=['GET'])
@jwt_required()
@tenant_required
def salon_reports_services():
    tenant_id = get_jwt().get('tenant_id')
    args = request.args
    date_from = args.get('date_from', ist_today())
    date_to = args.get('date_to', ist_today())
    outlet_id = args.get('outlet_id')

    from sqlalchemy import func
    start = parse_ist_date(date_from)
    end = parse_ist_date_end(date_to)

    q = db.session.query(
        SalonBillItem.item_name,
        SalonBillItem.item_type,
        func.count(SalonBillItem.id).label('count'),
        func.sum(SalonBillItem.price * SalonBillItem.quantity).label('revenue'),
    ).join(SalonBill).filter(
        SalonBill.tenant_id == tenant_id,
        SalonBill.status == 'paid',
        SalonBill.created_at >= start,
        SalonBill.created_at < end,
    )
    if outlet_id:
        q = q.filter(SalonBill.outlet_id == int(outlet_id))

    rows = q.group_by(SalonBillItem.item_name, SalonBillItem.item_type).order_by(
        db.text('revenue DESC')
    ).all()

    return jsonify([{
        'name': r.item_name,
        'type': r.item_type,
        'count': r.count,
        'revenue': float(r.revenue or 0),
    } for r in rows])
