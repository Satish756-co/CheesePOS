#!/usr/bin/env python3
"""
Quick-start script for local development without Docker.
Requires Python 3.11+ and PostgreSQL installed locally.
"""
import subprocess
import sys
import os

def run(cmd, cwd=None):
    print(f"$ {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"Command failed: {cmd}")
        sys.exit(1)

print("=" * 50)
print("  BarPro POS – Local Dev Setup")
print("=" * 50)

backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
frontend_dir = os.path.join(os.path.dirname(__file__), 'frontend')

print("\n1. Installing Python dependencies...")
run(f"pip install -r requirements.txt", cwd=backend_dir)

print("\n2. Setting up environment...")
env_file = os.path.join(os.path.dirname(__file__), '.env')
env_example = os.path.join(os.path.dirname(__file__), '.env.example')
if not os.path.exists(env_file):
    import shutil
    shutil.copy(env_example, env_file)
    print("   .env file created. Edit it with your PostgreSQL credentials.")

print("\n3. Running database migrations...")
run("flask db upgrade", cwd=backend_dir)

print("\n4. Seeding initial data...")
run("flask init-db", cwd=backend_dir)
run("flask seed-plans", cwd=backend_dir)
run("flask create-superadmin", cwd=backend_dir)

print("\n5. Installing Node.js dependencies...")
run("npm install", cwd=frontend_dir)

print("\n" + "=" * 50)
print("  Setup complete!")
print("=" * 50)
print("\nStart the backend:  cd backend && flask run")
print("Start the frontend: cd frontend && npm run dev")
print("\nSuper Admin login: admin@barpro.in / Admin@123")
print("=" * 50)
