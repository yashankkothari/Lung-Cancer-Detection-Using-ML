from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from tensorflow.keras.models import load_model
import numpy as np
import io
from werkzeug.security import generate_password_hash, check_password_hash
import jwt 
import datetime
from functools import wraps
import os
from dotenv import load_dotenv
from PIL import Image
import traceback
import logging
from pymongo import MongoClient
from bson import ObjectId
import socket
from db import get_users_collection, get_patient_records_collection, get_db
from werkzeug.utils import secure_filename
import tensorflow as tf
import base64
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Set secret key for JWT
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
if not app.config['SECRET_KEY']:
    raise ValueError("No SECRET_KEY set in environment variables")

# Configure CORS with specific settings
CORS(app, 
     resources={r"/*": {
         "origins": ["*"],  # Allow all origins during development
         "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
         "allow_headers": ["Content-Type", "Authorization"],
         "supports_credentials": False,  # Change to False since we're using token-based auth
         "max_age": 3600
     }},
     supports_credentials=False)  # Change to False since we're using token-based auth

# Root route to handle base URL
@app.route('/')
def root():
    return jsonify({
        'status': 'success',
        'message': 'Lung Cancer Detection API is running',
        'available_endpoints': [
            '/api/test',
            '/api/signup',
            '/api/login',
            '/api/verify',
            '/api/patient-records',
            '/predict',
            '/api/generate-report',
            '/api/reports'
        ]
    })

# Handle OPTIONS requests for all routes
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
    response.headers['Access-Control-Allow-Credentials'] = 'false'
    response.headers['Access-Control-Max-Age'] = '3600'
    return response

# Handle OPTIONS requests
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify({"status": "ok"})
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE,OPTIONS'
        response.headers['Access-Control-Allow-Credentials'] = 'false'
        response.headers['Access-Control-Max-Age'] = '3600'
        return response

# JWT token required decorator
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = get_users_collection().find_one({'email': data['email']})
            if not current_user:
                return jsonify({'message': 'User not found!'}), 401
        except Exception as e:
            return jsonify({'message': 'Token is invalid!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# Load the trained model
try:
    model = load_model("Lung_Model.h5")
    logger.info("Model loaded successfully")
    
    # Print model input/output shapes for debugging
    model_summary = []
    for layer in model.layers:
        model_summary.append(f"Layer: {layer.name}, Input shape: {layer.input_shape}, Output shape: {layer.output_shape}")
    logger.info("Model architecture:")
    for summary in model_summary:
        logger.info(summary)
        
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    traceback.print_exc()

# Preprocessing function
def preprocess_image(image):
    try:
        # Convert to RGB if the image is not already in RGB mode
        if image.mode != "RGB":
            image = image.convert("RGB")
            logger.info(f"Converted image to RGB mode")
        
        # Resize to model input size
        image = image.resize((224, 224))
        logger.info(f"Resized image to 224x224")
        
        # Convert to numpy array and normalize pixel values
        img_array = np.array(image) / 255.0
        logger.info(f"Initial array shape: {img_array.shape}")
        
        # Make sure the array has shape (224, 224, 3)
        if len(img_array.shape) == 2:  # If grayscale, add color dimension
            logger.info("Converting grayscale to RGB by stacking")
            img_array = np.stack((img_array,) * 3, axis=-1)
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        # Log the shape to verify it matches what the model expects
        logger.info(f"Preprocessed image shape: {img_array.shape}")
        
        return img_array
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        traceback.print_exc()
        raise

@app.route('/api/test', methods=['GET'])
def test_connection():
    try:
        # Test MongoDB connection
        users_collection = get_users_collection()
        users_collection.find_one()  # This will raise an error if connection fails
        
        return jsonify({
            'status': 'success',
            'message': 'Server and database are connected successfully',
            'model_loaded': model is not None
        })
    except Exception as e:
        logger.error(f"Test connection failed: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': f'Connection test failed: {str(e)}'
        }), 500

@app.route('/api/signup', methods=['POST'])
def signup():
    try:
        data = request.get_json()
        logger.info(f"Signup attempt with data: {data}")
        
        if not data or not all(k in data for k in ('name', 'email', 'password')):
            logger.error("Missing required fields in signup request")
            return jsonify({'message': 'Missing required fields'}), 400

        users_collection = get_users_collection()
        
        # Check if user already exists
        existing_user = users_collection.find_one({'email': data['email']})
        if existing_user:
            logger.warning(f"User already exists with email: {data['email']}")
            return jsonify({'message': 'User already exists'}), 400

        # Hash password
        hashed_password = generate_password_hash(data['password'])
        
        # Create new user
        user = {
            'name': data['name'],
            'email': data['email'],
            'password': hashed_password,
            'created_at': datetime.datetime.utcnow()
        }
        
        # Insert user and get the result
        result = users_collection.insert_one(user)
        if not result.inserted_id:
            logger.error("Failed to insert user into database")
            return jsonify({'message': 'Error creating user'}), 500
            
        logger.info(f"Successfully created user with email: {data['email']}")
        return jsonify({
            'message': 'User created successfully',
            'user_id': str(result.inserted_id)
        }), 201
        
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({'message': 'Error creating user'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or not all(k in data for k in ('email', 'password')):
            return jsonify({'message': 'Missing email or password'}), 400

        users_collection = get_users_collection()
        user = users_collection.find_one({'email': data['email']})
        
        if not user or not check_password_hash(user['password'], data['password']):
            return jsonify({'message': 'Invalid email or password'}), 401

        # Generate JWT token
        token = jwt.encode({
            'email': user['email'],
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }, app.config['SECRET_KEY'])
        
        return jsonify({
            'token': token,
            'user': {
                'email': user['email'],
                'name': user['name']
            }
        })
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'message': 'Error during login'}), 500

@app.route('/api/verify', methods=['GET'])
@token_required
def verify_token(current_user):
    return jsonify({
        'user': {
            'email': current_user['email'],
            'name': current_user['name']
        }
    })

@app.route('/api/patient-records', methods=['GET', 'POST'])
@token_required
def handle_patient_records(current_user):
    try:
        if request.method == 'GET':
            # Get all records for the current user
            records = list(get_patient_records_collection().find(
                {'user_id': str(current_user['_id'])},
                {'_id': 1, 'patient_name': 1, 'age': 1, 'gender': 1, 'scan_date': 1, 'prediction': 1, 'probability': 1, 'risk_level': 1}
            ))
            
            # Convert ObjectId to string
            for record in records:
                record['_id'] = str(record['_id'])
            
            return jsonify(records)
        
        elif request.method == 'POST':
            data = request.get_json()
            if not data or not all(k in data for k in ('patient_name', 'age', 'gender', 'scan_date', 'prediction', 'probability', 'risk_level')):
                return jsonify({'message': 'Missing required fields'}), 400
            
            # Add user_id to the record
            data['user_id'] = str(current_user['_id'])
            
            # Insert the record
            result = get_patient_records_collection().insert_one(data)
            
            return jsonify({
                'message': 'Record created successfully',
                'id': str(result.inserted_id)
            }), 201
    except Exception as e:
        logger.error(f"Patient records error: {str(e)}")
        return jsonify({'message': 'Error processing request'}), 500

@app.route('/predict', methods=['POST'])
@token_required
def predict(current_user):
    try:
        logger.info("Received prediction request")
        logger.debug(f"Request files: {request.files}")
        
        if "file" not in request.files:
            logger.error("No file part in the request")
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        logger.info(f"Received file: {file.filename}")
        
        image_bytes = file.read()
        logger.info(f"Image size: {len(image_bytes)} bytes")
        
        image = Image.open(io.BytesIO(image_bytes))
        logger.info(f"Image opened successfully: {image.size}, mode: {image.mode}")

        # Preprocess the image and make a prediction
        img_array = preprocess_image(image)
        logger.info("Image preprocessed successfully")
        
        # Make prediction
        prediction = model.predict(img_array)
        logger.info(f"Raw prediction: {prediction}")
        
        # Handle different prediction shapes
        if isinstance(prediction, list):
            probability = float(prediction[0][0])
        elif len(prediction.shape) == 2:
            probability = float(prediction[0][0])
        else:
            probability = float(prediction[0])
            
        logger.info(f"Final probability: {probability}")

        # Get patient details from request
        patient_name = request.form.get('patient_name', 'Unknown Patient')
        age = request.form.get('age', 'Unknown')
        gender = request.form.get('gender', 'Unknown')
        
        # Determine risk level
        if probability < 0.3:
            risk_level = "Low Risk"
        elif probability < 0.7:
            risk_level = "Moderate Risk"
        else:
            risk_level = "High Risk"
        
        # Generate report
        report_data = {
            'patient_name': patient_name,
            'age': age,
            'gender': gender,
            'scan_date': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'prediction': 'Lung Cancer' if probability > 0.5 else 'No Lung Cancer',
            'probability': probability,
            'risk_level': risk_level,
            'report_date': datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'report_id': str(ObjectId()),
            'doctor_notes': generate_doctor_notes(probability, risk_level),
            'recommendations': generate_recommendations(probability, risk_level),
            'user_id': current_user['_id']
        }
        
        # Store report in database
        db = get_db()
        db.reports.insert_one(report_data)
        
        return jsonify({
            'lung_cancer_probability': probability,
            'risk_level': risk_level,
            'report_id': report_data['report_id']
        })
    
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Report generation endpoint
@app.route('/api/generate-report', methods=['POST'])
@token_required
def generate_report(current_user):
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        required_fields = ['patient_name', 'age', 'gender', 'prediction', 'probability', 'risk_level']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # Generate report content
        report_content = {
            'patient_name': data['patient_name'],
            'age': data['age'],
            'gender': data['gender'],
            'scan_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'prediction': data['prediction'],
            'probability': data['probability'],
            'risk_level': data['risk_level'],
            'report_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'report_id': str(ObjectId()),
            'doctor_notes': generate_doctor_notes(data['probability'], data['risk_level']),
            'recommendations': generate_recommendations(data['probability'], data['risk_level']),
            'user_id': current_user['_id']
        }

        # Store report in database
        db = get_db()
        db.reports.insert_one(report_content)

        return jsonify({
            'message': 'Report generated successfully',
            'report': report_content
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_doctor_notes(probability, risk_level):
    notes = []
    
    if risk_level == "High Risk":
        notes.append("High probability of lung cancer detected.")
        notes.append("Immediate consultation with an oncologist is recommended.")
        notes.append("Further diagnostic tests may be required.")
    elif risk_level == "Moderate Risk":
        notes.append("Moderate probability of lung cancer detected.")
        notes.append("Regular follow-up and monitoring recommended.")
        notes.append("Consider lifestyle changes and regular check-ups.")
    else:
        notes.append("Low probability of lung cancer detected.")
        notes.append("Regular screening recommended for early detection.")
        notes.append("Maintain healthy lifestyle habits.")

    return notes

def generate_recommendations(probability, risk_level):
    recommendations = []
    
    if risk_level == "High Risk":
        recommendations.append("Schedule an appointment with an oncologist immediately.")
        recommendations.append("Consider getting a biopsy for confirmation.")
        recommendations.append("Avoid smoking and exposure to secondhand smoke.")
        recommendations.append("Maintain a healthy diet and exercise routine.")
    elif risk_level == "Moderate Risk":
        recommendations.append("Schedule a follow-up scan in 3-6 months.")
        recommendations.append("Consult with a pulmonologist for further evaluation.")
        recommendations.append("Quit smoking if applicable.")
        recommendations.append("Monitor for any respiratory symptoms.")
    else:
        recommendations.append("Regular annual screening recommended.")
        recommendations.append("Maintain a healthy lifestyle.")
        recommendations.append("Avoid exposure to environmental pollutants.")
        recommendations.append("Stay vigilant for any respiratory symptoms.")

    return recommendations

# Get user reports endpoint
@app.route('/api/reports', methods=['GET'])
@token_required
def get_user_reports(current_user):
    try:
        db = get_db()
        reports = list(db.reports.find({'user_id': current_user['_id']}))
        
        # Convert ObjectId to string for JSON serialization
        for report in reports:
            report['_id'] = str(report['_id'])
            report['user_id'] = str(report['user_id'])
        
        return jsonify({'reports': reports}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Get specific report endpoint
@app.route('/api/reports/<report_id>', methods=['GET'])
@token_required
def get_report(current_user, report_id):
    try:
        db = get_db()
        report = db.reports.find_one({
            'report_id': report_id,
            'user_id': current_user['_id']
        })
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Convert ObjectId to string for JSON serialization
        report['_id'] = str(report['_id'])
        report['user_id'] = str(report['user_id'])
        
        return jsonify({'report': report}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Generate PDF report
def generate_pdf_report(report_data):
    try:
        # Create a buffer to store the PDF
        buffer = io.BytesIO()
        
        # Create the PDF document
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
            alignment=1  # Center alignment
        )
        
        section_style = ParagraphStyle(
            'CustomSection',
            parent=styles['Heading2'],
            fontSize=18,
            spaceAfter=15
        )
        
        # Content
        content = []
        
        # Title
        content.append(Paragraph("Lung Cancer Detection Report", title_style))
        content.append(Spacer(1, 20))
        
        # Patient Information
        content.append(Paragraph("Patient Information", section_style))
        patient_data = [
            ["Name:", report_data['patient_name']],
            ["Age:", str(report_data['age'])],
            ["Gender:", report_data['gender']],
            ["Scan Date:", report_data['scan_date']],
            ["Report Date:", report_data['report_date']]
        ]
        patient_table = Table(patient_data, colWidths=[1.5*inch, 3*inch])
        patient_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        content.append(patient_table)
        content.append(Spacer(1, 20))
        
        # Diagnosis Results
        content.append(Paragraph("Diagnosis Results", section_style))
        diagnosis_data = [
            ["Prediction:", report_data['prediction']],
            ["Risk Level:", report_data['risk_level']]
        ]
        diagnosis_table = Table(diagnosis_data, colWidths=[1.5*inch, 3*inch])
        diagnosis_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ]))
        content.append(diagnosis_table)
        content.append(Spacer(1, 20))
        
        # Doctor's Notes
        content.append(Paragraph("Doctor's Notes", section_style))
        for note in report_data['doctor_notes']:
            content.append(Paragraph(f"• {note}", styles['Normal']))
            content.append(Spacer(1, 5))
        content.append(Spacer(1, 10))
        
        # Recommendations
        content.append(Paragraph("Recommendations", section_style))
        for rec in report_data['recommendations']:
            content.append(Paragraph(f"• {rec}", styles['Normal']))
            content.append(Spacer(1, 5))
        
        # Build PDF
        doc.build(content)
        buffer.seek(0)
        return buffer
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        return None

# Add PDF download endpoint
@app.route('/api/reports/<report_id>/pdf', methods=['GET'])
@token_required
def download_report_pdf(current_user, report_id):
    try:
        db = get_db()
        report = db.reports.find_one({
            'report_id': report_id,
            'user_id': current_user['_id']
        })
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Generate PDF
        pdf_buffer = generate_pdf_report(report)
        if not pdf_buffer:
            return jsonify({'error': 'Failed to generate PDF'}), 500
        
        return send_file(
            pdf_buffer,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"lung_cancer_report_{report_id}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Get local IP address
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    
    print(f"Local IP: {local_ip}")
    print(f"Server will be available at:")
    print(f"http://localhost:5000")
    print(f"http://{local_ip}:5000")
    print(f"http://192.168.0.108:5000")
    print(f"http://192.168.29.194:5000")
    
    # Add error handler for 404
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({
            'status': 'error',
            'message': 'Endpoint not found',
            'available_endpoints': [
                '/api/test',
                '/api/signup',
                '/api/login',
                '/api/verify',
                '/api/patient-records',
                '/predict',
                '/api/generate-report',
                '/api/reports'
            ]
        }), 404
    
    # Run the app on all network interfaces
    app.run(host='0.0.0.0', port=5000, debug=True) 