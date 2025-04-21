from flask import Flask, request, jsonify
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

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# MongoDB connection using environment variable
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
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

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

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
        # Convert PIL Image to OpenCV format (RGB to BGR)
        img_array = np.array(image)
        img_array = img_array[:, :, ::-1]  # RGB to BGR
        
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
        
        # Get predicted class
        predicted_class_idx = np.argmax(probabilities)
        class_names = ['Normal', 'Benign', 'Malignant']
        predicted_class = class_names[predicted_class_idx]
        
        # Create probabilities dictionary
        prob_dict = {
            'normal': float(probabilities[0]),
            'benign': float(probabilities[1]),
            'malignant': float(probabilities[2])
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
def get_history():
    try:
        # Get all records from MongoDB
        records = list(records_collection.find({}, {'_id': 0}))
        
        # Convert ObjectId to string for JSON serialization
        for record in records:
            record['timestamp'] = record['timestamp']
        
        return jsonify(records)
    
    except Exception as e:
        logger.error(f"Error in history endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/history/<patient_id>', methods=['GET'])
def get_patient_history(patient_id):
    try:
        # Get records for specific patient
        records = list(records_collection.find(
            {'patientId': patient_id},
            {'_id': 0}
        ))
        
        # Convert ObjectId to string for JSON serialization
        for record in records:
            record['timestamp'] = record['timestamp']
        
        return jsonify(records)
    
    except Exception as e:
        logger.error(f"Error in patient history endpoint: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    try:
        # Get total number of scans
        total_scans = records_collection.count_documents({})
        
        # Get number of detected cases (malignant)
        detected_cases = records_collection.count_documents({"diagnosis": "Malignant"})
        
        # Get number of active patients (patients with scans in the last 30 days)
        thirty_days_ago = datetime.now().isoformat()[:10]  # Get date part only
        active_patients = len(records_collection.distinct("patientId", {
            "timestamp": {"$gte": thirty_days_ago}
        }))
        
        # Calculate success rate (based on model confidence > 90%)
        high_confidence_scans = records_collection.count_documents({"confidence": {"$gt": 0.9}})
        success_rate = (high_confidence_scans / total_scans * 100) if total_scans > 0 else 0
        
        # Calculate trends
        prev_thirty_days = (datetime.now() - timedelta(days=30)).isoformat()[:10]
        prev_scans = records_collection.count_documents({
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago}
        })
        current_scans = records_collection.count_documents({
            "timestamp": {"$gte": thirty_days_ago}
        })
        
        scan_trend = calculate_trend(prev_scans, current_scans)
        
        prev_cases = records_collection.count_documents({
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago},
            "diagnosis": "Malignant"
        })
        current_cases = records_collection.count_documents({
            "timestamp": {"$gte": thirty_days_ago},
            "diagnosis": "Malignant"
        })
        
        cases_trend = calculate_trend(prev_cases, current_cases)
        
        prev_active = len(records_collection.distinct("patientId", {
            "timestamp": {"$gte": prev_thirty_days, "$lt": thirty_days_ago}
        }))
        current_active = len(records_collection.distinct("patientId", {
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
            record = {
                'patientId': patient_id,
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)