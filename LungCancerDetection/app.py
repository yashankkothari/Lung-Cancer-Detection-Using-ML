from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import io
from PIL import Image
import traceback
import logging
import os

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Global variable for the model
model = None

def load_model_from_checkpoint():
    global model
    try:
        # Define your model architecture first (this depends on how your model was created)
        # For example:
        model = tf.keras.Sequential([
            # Define your layers here
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', input_shape=(224, 224, 3)),
            # ... other layers
            tf.keras.layers.Dense(1, activation='sigmoid')
        ])
        
        # Point to the checkpoint files
        checkpoint_dir = "Model"
        checkpoint_prefix = "model-0020"
        checkpoint_path = os.path.join(checkpoint_dir, checkpoint_prefix)
        
        if not os.path.exists(os.path.join(checkpoint_dir, f"{checkpoint_prefix}.index")):
            raise FileNotFoundError(f"Checkpoint files not found in: {checkpoint_dir}")
        
        # Load weights from checkpoint
        model.load_weights(checkpoint_path)
        logger.info("Model weights loaded successfully from checkpoint")
        
        # Print model summary for debugging
        for layer in model.layers:
            logger.info(f"Layer: {layer.name}, Input shape: {layer.input_shape}, Output shape: {layer.output_shape}")
        
        return True
    except Exception as e:
        logger.error(f"Error loading model: {str(e)}")
        traceback.print_exc()
        return False

# Try to load the model at startup
load_model_success = load_model_from_checkpoint()

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
    model_status = "Model loaded" if model is not None else "Model not loaded"
    return f"Lung Cancer Detection API is running! Use /predict to send an image. {model_status}"

@app.route("/predict", methods=["POST"])
def predict():
    global model
    
    try:
        logger.info("Received prediction request")
        
        # Check if model is loaded
        if model is None:
            # Try to load the model again
            if not load_model_from_checkpoint():
                logger.error("Model could not be loaded")
                return jsonify({"error": "Model could not be loaded"}), 500
        
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
        
        # Add detailed logging about the prediction
        logger.info(f"Prediction type: {type(prediction)}")
        logger.info(f"Prediction shape: {prediction.shape if hasattr(prediction, 'shape') else 'no shape'}")
        logger.info(f"Prediction value: {prediction}")
        
        # Handle different prediction shapes more safely
        try:
            # Check if prediction is a numpy array
            if isinstance(prediction, np.ndarray):
                # Handle based on array dimensions
                if len(prediction.shape) == 1:
                    # It's a 1D array
                    probability = float(prediction[0])
                elif len(prediction.shape) == 2:
                    # It's a 2D array (batch, predictions)
                    probability = float(prediction[0][0])
                else:
                    # It's a higher dimensional array, try to flatten
                    flat_pred = prediction.flatten()
                    probability = float(flat_pred[0])
            # Check if prediction is a list
            elif isinstance(prediction, list):
                # It's a list, try to get the first element
                probability = float(prediction[0])
            # If it's a tensor, convert to numpy first
            elif tf.is_tensor(prediction):
                np_prediction = prediction.numpy()
                if len(np_prediction.shape) == 1:
                    probability = float(np_prediction[0])
                else:
                    probability = float(np_prediction[0][0])
            else:
                # Fallback, try direct conversion
                probability = float(prediction)
                
            logger.info(f"Final probability: {probability}")
        except (IndexError, TypeError, ValueError) as e:
            logger.error(f"Could not extract probability: {e}")
            logger.error(f"Prediction shape: {prediction.shape if hasattr(prediction, 'shape') else 'unknown'}")
            return jsonify({"error": "Could not process prediction value"}), 500

        return jsonify({"lung_cancer_probability": probability})
    
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)