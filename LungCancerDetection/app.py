from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tensorflow as tf
import numpy as np
from PIL import Image
import io
from datetime import datetime
from pymongo import MongoClient
import logging
from dotenv import load_dotenv

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

# Configure upload folder
UPLOAD_FOLDER = 'uploads'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Load the TFLite model
model_path = os.path.join('Model', 'model.tflite')
interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()

# Get input and output tensors
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

def preprocess_image(image):
    """Preprocess the image for model input"""
    try:
        # Resize image to match model input size
        image = image.resize((224, 224))
        
        # Convert to numpy array and normalize
        img_array = np.array(image)
        img_array = img_array.astype('float32') / 255.0
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        raise

def predict_image(image):
    """Make prediction using the TFLite model"""
    try:
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
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        patient_id = request.form.get('patientId')
        
        if not patient_id:
            return jsonify({'error': 'No patient ID provided'}), 400
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Read and process the image
        image = Image.open(file.stream)
        
        # Make prediction
        prediction_result = predict_image(image)
        
        # Save the image
        filename = secure_filename(file.filename)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_filename = f"{timestamp}_{filename}"
        image_path = os.path.join(UPLOAD_FOLDER, unique_filename)
        image.save(image_path)
        
        # Create record for MongoDB
        record = {
            'patientId': patient_id,
            'timestamp': datetime.now().isoformat(),
            'diagnosis': prediction_result['predicted_class'],
            'confidence': prediction_result['confidence'],
            'probabilities': prediction_result['probabilities'],
            'imageUrl': f"/uploads/{unique_filename}"
        }
        
        # Save to MongoDB
        records_collection.insert_one(record)
        
        return jsonify(prediction_result)
    
    except Exception as e:
        logger.error(f"Error in predict endpoint: {str(e)}")
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)