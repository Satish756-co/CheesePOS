import os
from app import create_app
from app.extensions import db
from app.commands import register_commands

app = create_app(os.getenv('FLASK_ENV', 'development'))
register_commands(app)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
