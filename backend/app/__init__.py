from flask import Flask, send_from_directory
from config import get_config
from app.extensions import db, migrate, jwt, cors, mail, limiter
import os


def create_app(env='development'):
    app = Flask(__name__)
    app.config.from_object(get_config(env))

    # Refuse to start in production with placeholder secrets
    if env == 'production':
        _WEAK_SECRETS = {
            'dev-secret-key-change-in-production',
            'dev-jwt-secret-change-in-production',
            'change-this-in-production',
        }
        jwt_key = app.config.get('JWT_SECRET_KEY', '')
        if jwt_key in _WEAK_SECRETS or len(jwt_key) < 32:
            raise RuntimeError(
                'JWT_SECRET_KEY is missing or too weak. '
                'Set a strong random value in your .env before starting in production.'
            )
        if app.config.get('SUPER_ADMIN_PASSWORD') in ('Admin@123', '', None):
            raise RuntimeError(
                'SUPER_ADMIN_PASSWORD must not be the default in production. '
                'Set a strong password in your .env.'
            )

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})
    mail.init_app(app)
    limiter.init_app(app)

    # Register all blueprints
    from app.auth.routes import auth_bp
    from app.tenants.routes import tenants_bp
    from app.outlets.routes import outlets_bp
    from app.dashboard.routes import dashboard_bp
    from app.billing.routes import billing_bp
    from app.products.routes import products_bp
    from app.inventory.routes import inventory_bp
    from app.orders.routes import orders_bp
    from app.kot.routes import kot_bp
    from app.purchases.routes import purchases_bp
    from app.expenses.routes import expenses_bp
    from app.reports.routes import reports_bp
    from app.subscriptions.routes import subscriptions_bp
    from app.admin.routes import admin_bp
    from app.support.routes import support_bp
    from app.users.routes import users_bp
    from app.contact.routes import contact_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(tenants_bp, url_prefix='/api/tenants')
    app.register_blueprint(outlets_bp, url_prefix='/api/outlets')
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(billing_bp, url_prefix='/api/billing')
    app.register_blueprint(products_bp, url_prefix='/api/products')
    app.register_blueprint(inventory_bp, url_prefix='/api/inventory')
    app.register_blueprint(orders_bp, url_prefix='/api/orders')
    app.register_blueprint(kot_bp, url_prefix='/api/kot')
    app.register_blueprint(purchases_bp, url_prefix='/api/purchases')
    app.register_blueprint(expenses_bp, url_prefix='/api/expenses')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    app.register_blueprint(subscriptions_bp, url_prefix='/api/subscriptions')
    app.register_blueprint(admin_bp, url_prefix='/api/admin')
    app.register_blueprint(support_bp, url_prefix='/api/support')
    app.register_blueprint(users_bp, url_prefix='/api/users')
    app.register_blueprint(contact_bp, url_prefix='/api/contact')

    # Health check
    @app.route('/api/health')
    def health():
        return {'status': 'healthy', 'service': 'CheesePOS API', 'version': '1.0.0'}

    # Serve uploaded product images
    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        upload_dir = os.path.join(app.root_path, '..', 'uploads')
        return send_from_directory(os.path.abspath(upload_dir), filename)

    # JSON error handlers — prevent Flask from returning HTML error pages
    from flask import jsonify as _jsonify

    @app.errorhandler(400)
    def bad_request(e):
        return _jsonify({'error': 'Bad request', 'message': str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return _jsonify({'error': 'Unauthorized'}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return _jsonify({'error': 'Forbidden'}), 403

    @app.errorhandler(404)
    def not_found(e):
        return _jsonify({'error': 'Not found'}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return _jsonify({'error': 'Method not allowed'}), 405

    @app.errorhandler(429)
    def too_many_requests(e):
        return _jsonify({'error': 'Too many requests. Please try again later.'}), 429

    @app.errorhandler(500)
    def internal_error(e):
        return _jsonify({'error': 'Internal server error'}), 500

    return app
