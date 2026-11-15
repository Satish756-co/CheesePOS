from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from app.extensions import db
from app.models import Product, ProductVariant, Category
from app.auth.decorators import tenant_required
import os
import uuid

products_bp = Blueprint('products', __name__)


@products_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_products():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    category_id = request.args.get('category_id', type=int)
    product_type = request.args.get('product_type')
    search = request.args.get('search', '')
    is_active = request.args.get('is_active', 'true').lower() == 'true'
    include_variants = request.args.get('include_variants', 'false').lower() == 'true'
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    q = Product.query.filter_by(tenant_id=tenant_id)
    if is_active:
        q = q.filter(Product.is_active.is_not(False))
    else:
        q = q.filter(Product.is_active == False)
    if category_id:
        q = q.filter_by(category_id=category_id)
    if product_type:
        q = q.filter_by(product_type=product_type)
    if search:
        q = q.filter(db.or_(
            Product.name.ilike(f'%{search}%'),
            Product.brand.ilike(f'%{search}%'),
            Product.sku.ilike(f'%{search}%'),
        ))

    pagination = q.order_by(Product.name).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'products': [p.to_dict(include_variants=include_variants) for p in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
    })


@products_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_product():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()

    if not data or not data.get('name') or not data.get('selling_price') or not data.get('category_id'):
        return jsonify({'error': 'name, category_id, and selling_price are required'}), 400
    from decimal import Decimal as D
    try:
        sp = D(str(data['selling_price']))
    except Exception:
        return jsonify({'error': 'selling_price must be a valid number'}), 400
    if sp < 0:
        return jsonify({'error': 'selling_price cannot be negative'}), 400

    product = Product(
        tenant_id=tenant_id,
        category_id=data['category_id'],
        name=data['name'],
        brand=data.get('brand') or None,
        sku=data.get('sku') or None,
        product_type=data.get('product_type', 'food'),
        unit=data.get('unit', 'piece'),
        purchase_price=data.get('purchase_price') or 0,
        selling_price=data['selling_price'],
        mrp=data.get('mrp') or None,
        tax_category=data.get('tax_category') or None,
        tax_inclusive=data.get('tax_inclusive', True),
        is_liquor=data.get('is_liquor', False),
        requires_kot=data.get('requires_kot', True),
        low_stock_threshold=data.get('low_stock_threshold') or 10,
        hsn_code=data.get('hsn_code') or None,
        barcode=data.get('barcode') or None,
    )
    db.session.add(product)
    db.session.flush()

    for v in data.get('variants', []):
        name = str(v.get('variant_name', '')).strip()
        price = v.get('selling_price')
        if not name or price is None or price == '':
            continue
        variant = ProductVariant(
            product_id=product.id,
            variant_name=name,
            size_ml=v.get('size_ml') or None,
            selling_price=price,
            purchase_price=v.get('purchase_price', 0),
            mrp=v.get('mrp'),
        )
        db.session.add(variant)

    db.session.commit()
    return jsonify(product.to_dict(include_variants=True)), 201


@products_bp.route('/<int:product_id>', methods=['GET'])
@jwt_required()
@tenant_required
def get_product(product_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    product = Product.query.filter_by(id=product_id, tenant_id=tenant_id).first_or_404()
    return jsonify(product.to_dict(include_variants=True))


@products_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_product(product_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    product = Product.query.filter_by(id=product_id, tenant_id=tenant_id).first_or_404()
    data = request.get_json()

    if 'selling_price' in data:
        from decimal import Decimal as D
        try:
            if D(str(data['selling_price'])) < 0:
                return jsonify({'error': 'selling_price cannot be negative'}), 400
        except Exception:
            return jsonify({'error': 'selling_price must be a valid number'}), 400

    for field in ['name', 'brand', 'sku', 'selling_price', 'purchase_price', 'mrp',
                  'tax_category', 'is_active', 'requires_kot', 'low_stock_threshold']:
        if field in data:
            setattr(product, field, data[field])

    # Replace variants if provided
    if 'variants' in data:
        # Delete existing variants
        product.variants.delete()
        # Add new ones (skip incomplete rows)
        for v in data['variants']:
            name = str(v.get('variant_name', '')).strip()
            price = v.get('selling_price')
            if not name or price is None or price == '':
                continue
            variant = ProductVariant(
                product_id=product.id,
                variant_name=name,
                size_ml=v.get('size_ml') or None,
                selling_price=price,
                purchase_price=v.get('purchase_price') or 0,
                mrp=v.get('mrp') or None,
            )
            db.session.add(variant)

    db.session.commit()
    return jsonify(product.to_dict(include_variants=True))


@products_bp.route('/categories', methods=['GET'])
@jwt_required()
@tenant_required
def list_categories():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    categories = Category.query.filter(
        Category.tenant_id == tenant_id,
        Category.is_active.is_not(False)
    ).order_by(Category.display_order).all()
    return jsonify([c.to_dict() for c in categories])


@products_bp.route('/categories', methods=['POST'])
@jwt_required()
@tenant_required
def create_category():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    data = request.get_json()

    cat = Category(
        tenant_id=tenant_id,
        name=data['name'],
        category_type=data.get('category_type', 'both'),
        icon=data.get('icon'),
        color=data.get('color', '#6366f1'),
        display_order=data.get('display_order', 0),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


ALLOWED_IMAGE_EXTS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}


@products_bp.route('/<int:product_id>/image', methods=['POST'])
@jwt_required()
@tenant_required
def upload_product_image(product_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    product = Product.query.filter_by(id=product_id, tenant_id=tenant_id).first_or_404()

    if 'image' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    file = request.files['image']
    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in ALLOWED_IMAGE_EXTS:
        return jsonify({'error': 'File must be jpg, jpeg, png, gif, or webp'}), 400

    upload_dir = os.path.join(current_app.root_path, '..', 'uploads', 'product_images')
    os.makedirs(upload_dir, exist_ok=True)

    # Remove old local image if present
    if product.image_url and product.image_url.startswith('/uploads/'):
        old_path = os.path.join(current_app.root_path, '..', product.image_url.lstrip('/'))
        if os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    filename = f"{uuid.uuid4().hex}.{ext}"
    file.save(os.path.join(upload_dir, filename))

    product.image_url = f"/uploads/product_images/{filename}"
    db.session.commit()

    return jsonify({'image_url': product.image_url})
