from flask import Flask
from flask_cors import CORS
from api import api_bp

app = Flask(__name__)
# Enable CORS for all domains on all routes
CORS(app)

# Register the API blueprint
app.register_blueprint(api_bp, url_prefix='/api')

if __name__ == '__main__':
    # Run on port 8000 as requested
    app.run(host='0.0.0.0', port=8000, debug=True)
