from flask import Flask, request, jsonify, session
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from datetime import datetime, timedelta
from pymongo import MongoClient
import logging
from dotenv import load_dotenv
import json
import cv2
import bcrypt
from functools import wraps
import uuid
import jwt
from datetime import datetime, timedelta

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-for-jwt')
app.config['JWT_EXPIRATION_HOURS'] = 24  # Token valid for 24 hours
CORS(app, supports_credentials=True)

# MongoDB connection using environment variable
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb+srv://kothariyashank:Oldisgold123@lungcancer.bschu4v.mongodb.net/?retryWrites=true&w=majority&appName=LungCancer')
try:
    client = MongoClient(MONGODB_URI)
    # Test the connection
    client.server_info()
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"Failed to connect to MongoDB: {str(e)}")
    raise

db = client['lung_cancer_db']
records_collection = db['patient_records']
scans_collection = db['scans']
patients_collection = db['patients']
doctors_collection = db['doctors']

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# JWT token helper functions
def generate_jwt_token(doctor_id):
    """Generate a JWT token for the doctor"""
    payload = {
        'doctor_id': str(doctor_id),
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
    }
    token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')
    return token

def token_required(f):
    """Decorator to protect routes that require authentication"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from Authorization header or cookie
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        
        if not token:
            return jsonify({'message': 'Authentication token is missing!'}), 401
        
        try:
            # Decode the token
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_doctor = doctors_collection.find_one({'_id': data['doctor_id']})
            if not current_doctor:
                return jsonify({'message': 'Invalid authentication token!'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Authentication token has expired!'}), 401
        except (jwt.InvalidTokenError, Exception) as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({'message': 'Invalid authentication token!'}), 401
            
        # Add current doctor to the request context
        request.current_doctor = current_doctor
        return f(*args, **kwargs)
    
    return decorated

# Load the TFLite model
model_path = os.path.join('Model', 'model.tflite')
try:
    # Load the TFLite model
    interpreter = tf.lite.Interpreter(model_path=model_path)
    interpreter.allocate_tensors()
    logger.info("Successfully loaded TFLite model")
except Exception as e:
    logger.error(f"Failed to load TFLite model: {str(e)}")
    raise

# Get input and output tensors
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Log model details
logger.info(f"Model Input Details: {input_details}")
logger.info(f"Model Output Details: {output_details}")

def preprocess_image(image):
    """Preprocess the image for model input exactly as done during training"""
    try:
        # Convert PIL Image to numpy array
        img_array = np.array(image)
        
        # Resize to 224x224 as done in training
        img_array = cv2.resize(img_array, (224, 224))
        
        # Convert to float32 and normalize to [0, 1]
        img_array = img_array.astype('float32') / 255.0
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        logger.info(f"Preprocessed image shape: {img_array.shape}")
        logger.info(f"Value range: min={np.min(img_array)}, max={np.max(img_array)}")
        
        return img_array
        
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        raise

def predict_image(image):
    """Make prediction using the TFLite model"""
    try:
        # Convert to RGB if not already
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Preprocess the image
        processed_image = preprocess_image(image)
        
        # Set input tensor
        interpreter.set_tensor(input_details[0]['index'], processed_image)
        
        # Run inference
        interpreter.invoke()
        
        # Get output tensor
        output_data = interpreter.get_tensor(output_details[0]['index'])
        
        # Get probabilities for each class
        probabilities = output_data[0]
        logger.info(f"Raw probabilities: {probabilities}")
        
        # Get predicted class - the new model has classes in order: benign, malignant, normal
        predicted_class_idx = np.argmax(probabilities)
        class_names = ['benign', 'malignant', 'normal']
        predicted_class = class_names[predicted_class_idx].capitalize()
        
        # Create probabilities dictionary
        prob_dict = {
            'benign': float(probabilities[0]),
            'malignant': float(probabilities[1]),
            'normal': float(probabilities[2])
        }
        
        logger.info(f"Prediction result: {predicted_class} with probabilities {prob_dict}")
        
        return {
            'predicted_class': predicted_class,
            'confidence': float(probabilities[predicted_class_idx]),
            'probabilities': prob_dict
        }
        
    except Exception as e:
        logger.error(f"Error making prediction: {str(e)}")
        raise

@app.route('/predict', methods=['POST'])
@token_required
def predict():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        # Read the image file
        try:
            # Read the file into memory
            file_bytes = file.read()
            file_stream = io.BytesIO(file_bytes)
            
            # Open and verify the image
            image = Image.open(file_stream)
            image.verify()  # Verify it's a valid image
            
            # Reopen because verify() closes the file
            file_stream.seek(0)
            image = Image.open(file_stream)
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
                
            logger.info(f"Image opened successfully. Size: {image.size}, Mode: {image.mode}")
            
        except Exception as e:
            logger.error(f"Failed to open image: {str(e)}")
            return jsonify({'error': f'Invalid image file: {str(e)}'}), 400

        # Get prediction
        try:
            prediction = predict_image(image)
            logger.info(f"Prediction successful: {prediction}")
            return jsonify(prediction)
        except Exception as e:
            logger.error(f"Prediction failed: {str(e)}")
            return jsonify({'error': f'Failed to process image: {str(e)}'}), 500

    except Exception as e:
        app.logger.error(f"Error during prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/history', methods=['GET'])
@token_required
def get_history():
    """Get all records across all patients for the authenticated doctor"""
    try:
        # Get doctor ID from authenticated user
        doctor_id = request.current_doctor['_id']
        
        # Get all records for this doctor from MongoDB
        records = list(scans_collection.find({'doctorId': doctor_id}, {'_id': 0}))
        
        # Ensure proper formatting of timestamps and add patient names
        for record in records:
            # Format timestamp if it exists
            if 'timestamp' in record:
                record['timestamp'] = record['timestamp'].isoformat() if isinstance(record['timestamp'], datetime) else record['timestamp']
            
            # Try to get patient name
            if 'patientId' in record:
                patient = patients_collection.find_one({'_id': record['patientId']})
                if patient:
                    record['patientName'] = patient.get('name', 'Unknown')
                else:
                    record['patientName'] = 'Unknown'
        
        logger.info(f"Retrieved {len(records)} records for doctor {doctor_id}")
        return jsonify(records)
    
    except Exception as e:
        logger.error(f"Error in history endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/history/<patient_id>', methods=['GET'])
@token_required
def get_patient_history(patient_id):
    """Get records for a specific patient"""
    try:
        # Get doctor ID from authenticated user
        doctor_id = request.current_doctor['_id']
        
        # First check if this patient exists and belongs to this doctor
        patient = patients_collection.find_one({'_id': patient_id})
        if not patient:
            # If patient doesn't exist in patients collection, check if there are scans with this patient ID
            scan_exists = scans_collection.find_one({'patientId': patient_id, 'doctorId': doctor_id})
            if not scan_exists:
                return jsonify({'error': 'Patient not found'}), 404
        
        # Get records for specific patient belonging to this doctor
        records = list(scans_collection.find(
            {'patientId': patient_id, 'doctorId': doctor_id},
            {'_id': 0}
        ))
        
        # Ensure proper formatting of timestamps
        for record in records:
            if 'timestamp' in record:
                record['timestamp'] = record['timestamp'].isoformat() if isinstance(record['timestamp'], datetime) else record['timestamp']
            
            # Add patient name if available
            if patient:
                record['patientName'] = patient.get('name', 'Unknown')
        
        logger.info(f"Retrieved {len(records)} records for patient {patient_id}")
        return jsonify(records)
    
    except Exception as e:
        logger.error(f"Error in patient history endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
@token_required
def get_stats():
    try:
        # Get doctor ID from authenticated user
        doctor_id = request.current_doctor['_id']
        
        # Get total number of scans for this doctor
        total_scans = records_collection.count_documents({'doctorId': doctor_id})
        
        # Get number of detected cases (malignant) for this doctor
        detected_cases = records_collection.count_documents({
            "doctorId": doctor_id,
            "diagnosis": "Malignant"
        })
        
        # Get number of active patients (patients with scans in the last 30 days)
        thirty_days_ago = datetime.now().isoformat()[:10]  # Get date part only
        active_patients = len(records_collection.distinct("patientId", {
            "doctorId": doctor_id,
            "timestamp": {"$gte": thirty_days_ago}
        }))
        
        # Calculate success rate (based on model confidence > 90%)
        high_confidence_scans = records_collection.count_documents({
            "doctorId": doctor_id,
            "confidence": {"$gt": 0.9}
        })
        success_rate = (high_confidence_scans / total_scans * 100) if total_scans > 0 else 0
        
        # Calculate trends
        prev_thirty_days = (datetime.now() - timedelta(days=30)).isoformat()[:10]
        prev_scans = records_collection.count_documents({
            "doctorId": doctor_id,
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago}
        })
        current_scans = records_collection.count_documents({
            "doctorId": doctor_id,
            "timestamp": {"$gte": thirty_days_ago}
        })
        
        scan_trend = calculate_trend(prev_scans, current_scans)
        
        prev_cases = records_collection.count_documents({
            "doctorId": doctor_id,
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago},
            "diagnosis": "Malignant"
        })
        current_cases = records_collection.count_documents({
            "doctorId": doctor_id,
            "timestamp": {"$gte": thirty_days_ago},
            "diagnosis": "Malignant"
        })
        
        cases_trend = calculate_trend(prev_cases, current_cases)
        
        prev_active = len(records_collection.distinct("patientId", {
            "doctorId": doctor_id,
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago}
        }))
        current_active = len(records_collection.distinct("patientId", {
            "doctorId": doctor_id,
            "timestamp": {"$gte": thirty_days_ago}
        }))
        
        patients_trend = calculate_trend(prev_active, current_active)
        
        stats = {
            "total_scans": {
                "value": total_scans,
                "trend": scan_trend
            },
            "detected_cases": {
                "value": detected_cases,
                "trend": cases_trend
            },
            "success_rate": {
                "value": round(success_rate, 1)
            },
            "active_patients": {
                "value": current_active,
                "trend": patients_trend
            }
        }
        
        logger.info(f"Stats calculated: {json.dumps(stats)}")
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error calculating stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

def calculate_trend(prev_value, current_value):
    """Calculate percentage change between two values"""
    if prev_value == 0:
        return {
            "value": 0,
            "isPositive": True
        }
    
    change = ((current_value - prev_value) / prev_value) * 100
    return {
        "value": round(abs(change), 1),
        "isPositive": change >= 0
    }

@app.route('/save-record', methods=['POST'])
@token_required
def save_record():
    try:
        logger.info("Received save record request")
        logger.info(f"Files in request: {list(request.files.keys())}")
        logger.info(f"Form data in request: {list(request.form.keys())}")
        
        # Check for required data
        if 'file' not in request.files:
            logger.error("No file in save request")
            return jsonify({'success': False, 'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            logger.error("Empty filename")
            return jsonify({'success': False, 'error': 'No file selected'}), 400
            
        patient_id = request.form.get('patientId')
        if not patient_id:
            logger.error("No patient ID provided")
            return jsonify({'success': False, 'error': 'No patient ID provided'}), 400
            
        prediction_data = request.form.get('prediction')
        if not prediction_data:
            logger.error("No prediction data provided")
            return jsonify({'success': False, 'error': 'No prediction data provided'}), 400
            
        try:
            prediction = json.loads(prediction_data)
            logger.info(f"Parsed prediction data: {prediction}")
        except json.JSONDecodeError as e:
            logger.error(f"Invalid prediction data format: {e}")
            return jsonify({'success': False, 'error': 'Invalid prediction data format'}), 400

        # Save the image file
        try:
            if not os.path.exists('uploads'):
                os.makedirs('uploads')
                
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{patient_id}_{timestamp}.jpg"
            filepath = os.path.join('uploads', filename)
            file.save(filepath)
            logger.info(f"Image saved to: {filepath}")
            
        except Exception as e:
            logger.error(f"Failed to save image file: {e}")
            return jsonify({'success': False, 'error': 'Failed to save image file'}), 500
        
        # Create database record
        try:
            # Get doctor ID from authenticated user
            doctor_id = request.current_doctor['_id']
            
            record = {
                'patientId': patient_id,
                'doctorId': doctor_id,  # Associate with the logged-in doctor
                'timestamp': datetime.now(),
                'imagePath': filepath,
                'diagnosis': prediction['predicted_class'],
                'confidence': prediction['confidence'],
                'probabilities': prediction['probabilities']
            }
            
            # Save to MongoDB
            result = db.scans.insert_one(record)
            logger.info(f"Record saved to MongoDB with ID: {result.inserted_id}")
            
            return jsonify({
                'success': True,
                'message': 'Record saved successfully',
                'recordId': str(result.inserted_id)
            })
            
        except Exception as e:
            logger.error(f"Failed to save to MongoDB: {e}")
            # Try to delete the saved image if database save fails
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                except:
                    pass
            return jsonify({'success': False, 'error': 'Failed to save record to database'}), 500

    except Exception as e:
        logger.error(f"Unexpected error in save_record endpoint: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/signup', methods=['POST'])
def signup():
    try:
        # Get doctor data from request
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        # Check required fields
        required_fields = ['email', 'password', 'name']
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
                
        # Check if email already exists
        if doctors_collection.find_one({'email': data['email']}):
            return jsonify({'success': False, 'message': 'Email already registered'}), 409
            
        # Use plaintext password - no hashing
        password = data['password']
        
        # Create new doctor document
        new_doctor = {
            '_id': str(uuid.uuid4()),
            'email': data['email'],
            'password': password,
            'name': data['name'],
            'created_at': datetime.now()
        }
        
        # Insert into database
        result = doctors_collection.insert_one(new_doctor)
        
        if result.acknowledged:
            # Generate JWT token
            token = generate_jwt_token(new_doctor['_id'])
            
            return jsonify({
                'success': True,
                'message': 'Doctor registered successfully',
                'token': token,
                'doctor': {
                    'id': new_doctor['_id'],
                    'name': new_doctor['name'],
                    'email': new_doctor['email']
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to register doctor'}), 500
            
    except Exception as e:
        logger.error(f"Error in signup: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        # Get login data from request
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        # Check required fields
        if 'email' not in data or 'password' not in data:
            return jsonify({'success': False, 'message': 'Email and password are required'}), 400
            
        # Find doctor by email
        doctor = doctors_collection.find_one({'email': data['email']})
        if not doctor:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
        
        # Check if password field exists
        if 'password' not in doctor:
            logger.error("Doctor record is missing password field")
            return jsonify({'success': False, 'message': 'Invalid account data'}), 500
        
        # Check password - simple plaintext comparison
        input_password = data['password']
        stored_password = doctor['password']
        
        if input_password == stored_password:
            # Generate JWT token
            token = generate_jwt_token(doctor['_id'])
            
            return jsonify({
                'success': True,
                'message': 'Login successful',
                'token': token,
                'doctor': {
                    'id': doctor['_id'],
                    'name': doctor['name'],
                    'email': doctor['email']
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Invalid email or password'}), 401
            
    except Exception as e:
        logger.error(f"Error in login: {str(e)}")
        return jsonify({'success': False, 'message': 'Login failed'}), 500

@app.route('/doctor/profile', methods=['GET'])
@token_required
def get_doctor_profile():
    """Get the profile of the currently authenticated doctor"""
    try:
        doctor = request.current_doctor
        return jsonify({
            'success': True,
            'doctor': {
                'id': doctor['_id'],
                'name': doctor['name'],
                'email': doctor['email']
            }
        })
    except Exception as e:
        logger.error(f"Error getting doctor profile: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/patients', methods=['GET'])
@token_required
def get_patients():
    """Get all patients for the logged-in doctor"""
    try:
        # Get doctor ID from authenticated user
        doctor_id = request.current_doctor['_id']
        
        # Get all patients associated with this doctor
        patients_list = list(patients_collection.find(
            {'doctorId': doctor_id}, 
            {'password': 0}  # Exclude password field if it exists
        ))
        
        # Format patient data for frontend
        formatted_patients = []
        for patient in patients_list:
            # Get scan count for this patient
            scan_count = scans_collection.count_documents({
                'patientId': patient['_id'], 
                'doctorId': doctor_id
            })
            
            # Get latest scan date
            latest_scan = scans_collection.find_one(
                {'patientId': patient['_id'], 'doctorId': doctor_id},
                sort=[('timestamp', -1)]
            )
            
            # Format patient data
            patient_data = {
                'id': patient['_id'],
                'name': patient.get('name', 'Unknown'),
                'age': patient.get('age'),
                'gender': patient.get('gender'),
                'bloodGroup': patient.get('bloodGroup'),
                'medicalHistory': patient.get('medicalHistory', ''),
                'doctorNotes': patient.get('doctorNotes', ''),
                'scanCount': scan_count,
                'lastScan': latest_scan['timestamp'].isoformat() if latest_scan and 'timestamp' in latest_scan else None
            }
            formatted_patients.append(patient_data)
        
        logger.info(f"Found {len(formatted_patients)} patients for doctor {doctor_id}")
        return jsonify({
            'success': True,
            'patients': formatted_patients
        })
        
    except Exception as e:
        logger.error(f"Error retrieving patients: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/patients', methods=['POST'])
@token_required
def add_patient():
    """Add a new patient for the logged-in doctor"""
    try:
        # Get doctor ID from authenticated user
        doctor_id = request.current_doctor['_id']
        
        # Get patient data from request
        data = request.json
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
            
        # Check required fields
        if 'name' not in data:
            return jsonify({'success': False, 'message': 'Patient name is required'}), 400
        
        # Generate a patient ID if not provided
        patient_id = data.get('patientId') or str(uuid.uuid4())
                
        # Create new patient
        new_patient = {
            '_id': patient_id,
            'name': data['name'],
            'age': data.get('age'),
            'gender': data.get('gender'),
            'bloodGroup': data.get('bloodGroup'),
            'medicalHistory': data.get('medicalHistory', ''),
            'doctorNotes': data.get('doctorNotes', ''),
            'doctorId': doctor_id,  # Associate with the current doctor
            'created_at': datetime.now()
        }
        
        # Insert into database
        result = patients_collection.insert_one(new_patient)
        
        if result.acknowledged:
            return jsonify({
                'success': True,
                'message': 'Patient added successfully',
                'patient': {
                    'id': new_patient['_id'],
                    'name': new_patient['name']
                }
            })
        else:
            return jsonify({'success': False, 'message': 'Failed to add patient'}), 500
            
    except Exception as e:
        logger.error(f"Error adding patient: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/patients/<patient_id>', methods=['GET'])
@token_required
def get_patient(patient_id):
    """Get a specific patient's details"""
    try:
        doctor_id = request.current_doctor['_id']
        
        # Check if this patient belongs to the doctor
        patient_record = records_collection.find_one({'patientId': patient_id, 'doctorId': doctor_id})
        if not patient_record:
            return jsonify({'success': False, 'message': 'Patient not found'}), 404
        
        # Get patient details
        patient = patients_collection.find_one({'_id': patient_id})
        if not patient:
            return jsonify({'success': False, 'message': 'Patient not found'}), 404
            
        # Count scans
        scan_count = records_collection.count_documents({'patientId': patient_id, 'doctorId': doctor_id})
        
        # Get latest scan
        latest_scan = records_collection.find_one(
            {'patientId': patient_id, 'doctorId': doctor_id},
            sort=[('timestamp', -1)]
        )
        
        # Get scan history
        scans = list(records_collection.find(
            {'patientId': patient_id, 'doctorId': doctor_id},
            {'_id': 0, 'diagnosis': 1, 'confidence': 1, 'timestamp': 1}
        ).sort('timestamp', -1))
        
        # Format patient data
        patient_data = {
            'id': patient['_id'],
            'name': patient.get('name', 'Unknown'),
            'age': patient.get('age'),
            'gender': patient.get('gender'),
            'medical_history': patient.get('medical_history', ''),
            'scanCount': scan_count,
            'lastScan': latest_scan['timestamp'] if latest_scan else None,
            'scans': scans
        }
        
        return jsonify({
            'success': True,
            'patient': patient_data
        })
        
    except Exception as e:
        logger.error(f"Error retrieving patient: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)