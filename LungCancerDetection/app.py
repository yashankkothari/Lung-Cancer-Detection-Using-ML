from flask import Flask, request, jsonify
from flask_cors import CORS
from tensorflow.keras.models import load_model
import numpy as np
import io
from PIL import Image
import traceback
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

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

@app.route("/", methods=["GET"])
def home():
    return "Lung Cancer Detection API is running! Use /predict to send an image."

@app.route("/predict", methods=["POST"])
def predict():
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

        return jsonify({"lung_cancer_probability": probability})
    
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)