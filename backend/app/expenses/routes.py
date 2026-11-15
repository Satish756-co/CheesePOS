from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from datetime import date
from app.extensions import db
from app.models import Expense
from app.auth.decorators import tenant_required

expenses_bp = Blueprint('expenses', __name__)

EXPENSE_CATEGORIES = [
    'rent', 'electricity', 'salaries', 'maintenance',
    'transport', 'cleaning', 'marketing', 'other'
]


@expenses_bp.route('/', methods=['GET'])
@jwt_required()
@tenant_required
def list_expenses():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    outlet_id = request.args.get('outlet_id', type=int)
    category = request.args.get('category')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    page = request.args.get('page', 1, type=int)

    q = Expense.query.filter_by(tenant_id=tenant_id).filter(Expense.reset_batch_id.is_(None))
    if outlet_id:
        q = q.filter_by(outlet_id=outlet_id)
    if category:
        q = q.filter_by(category=category)
    if date_from:
        q = q.filter(Expense.expense_date >= date.fromisoformat(date_from))
    if date_to:
        q = q.filter(Expense.expense_date <= date.fromisoformat(date_to))

    pagination = q.order_by(Expense.expense_date.desc()).paginate(page=page, per_page=30, error_out=False)

    total = sum(float(e.amount) for e in pagination.items)
    return jsonify({
        'expenses': [e.to_dict() for e in pagination.items],
        'total': pagination.total,
        'pages': pagination.pages,
        'total_amount': total,
        'categories': EXPENSE_CATEGORIES,
    })


@expenses_bp.route('/', methods=['POST'])
@jwt_required()
@tenant_required
def create_expense():
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    user_id = int(get_jwt_identity())
    data = request.get_json()

    if not data or not data.get('outlet_id') or not data.get('category') or not data.get('description') or data.get('amount') is None:
        return jsonify({'error': 'outlet_id, category, description, and amount are required'}), 400

    expense = Expense(
        tenant_id=tenant_id,
        outlet_id=data['outlet_id'],
        expense_date=date.fromisoformat(data.get('expense_date', date.today().isoformat())),
        category=data['category'],
        description=data['description'],
        amount=data['amount'],
        payment_mode=data.get('payment_mode', 'cash'),
        reference_number=data.get('reference_number'),
        recorded_by=user_id,
        status='approved',
    )
    db.session.add(expense)
    db.session.commit()
    return jsonify(expense.to_dict()), 201


@expenses_bp.route('/<int:expense_id>', methods=['PUT'])
@jwt_required()
@tenant_required
def update_expense(expense_id):
    claims = get_jwt()
    tenant_id = claims.get('tenant_id')
    expense = Expense.query.filter_by(id=expense_id, tenant_id=tenant_id).filter(Expense.reset_batch_id.is_(None)).first_or_404()
    data = request.get_json()

    for field in ['category', 'description', 'amount', 'payment_mode', 'status']:
        if field in data:
            setattr(expense, field, data[field])

    db.session.commit()
    return jsonify(expense.to_dict())
