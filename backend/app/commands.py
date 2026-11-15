import click
from flask import current_app
from app.extensions import db
from app.models import User, Plan, Tenant


def register_commands(app):

    @app.cli.command('create-superadmin')
    def create_superadmin():
        email = current_app.config['SUPER_ADMIN_EMAIL']
        password = current_app.config['SUPER_ADMIN_PASSWORD']

        existing = User.query.filter_by(email=email).first()
        if existing:
            click.echo(f'Super admin already exists: {email}')
            return

        user = User(
            first_name='Super',
            last_name='Admin',
            email=email,
            role='super_admin',
            is_super_admin=True,
            is_active=True,
        )
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        click.echo(f'Super admin created: {email}')

    @app.cli.command('seed-plans')
    def seed_plans():
        plans_data = [
            {
                'name': 'Basic', 'slug': 'basic', 'display_order': 1,
                'description': 'Perfect for single outlet bars',
                'price_monthly': 1499, 'price_yearly': 14990,
                'max_outlets': 1, 'max_users': 3,
                'features': {
                    'billing': True, 'inventory': True, 'basic_reports': True,
                    'table_billing': False, 'kot': False, 'advanced_reports': False,
                    'multi_outlet': False,
                }
            },
            {
                'name': 'Standard', 'slug': 'standard', 'display_order': 2,
                'description': 'For growing bars and restaurants',
                'price_monthly': 2499, 'price_yearly': 24990,
                'max_outlets': 3, 'max_users': 10,
                'features': {
                    'billing': True, 'inventory': True, 'basic_reports': True,
                    'table_billing': True, 'kot': True, 'advanced_reports': True,
                    'multi_outlet': True,
                }
            },
            {
                'name': 'Professional', 'slug': 'professional', 'display_order': 3,
                'description': 'Full-featured for established businesses',
                'price_monthly': 4999, 'price_yearly': 49990,
                'max_outlets': 5, 'max_users': 25,
                'features': {
                    'billing': True, 'inventory': True, 'basic_reports': True,
                    'table_billing': True, 'kot': True, 'advanced_reports': True,
                    'multi_outlet': True, 'custom_reports': True, 'api_access': True,
                    'priority_support': True,
                }
            },
        ]

        for p in plans_data:
            if not Plan.query.filter_by(slug=p['slug']).first():
                plan = Plan(**p)
                db.session.add(plan)
                click.echo(f'Created plan: {p["name"]}')
            else:
                click.echo(f'Plan already exists: {p["name"]}')

        db.session.commit()
        click.echo('Plans seeded successfully')

    @app.cli.command('init-db')
    def init_db():
        click.echo('Creating database tables...')
        db.create_all()
        click.echo('Done.')
