from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import io
from PIL import Image
import traceback
import logging
import tensorflow as tf

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Load the TFLite model
try:
    interpreter = tf.lite.Interpreter(model_path="Model/model.tflite")
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    logger.info("TFLite model loaded successfully")
    logger.info(f"Input details: {input_details}")
    logger.info(f"Output details: {output_details}")
    
    # Log model input shape requirements
    input_shape = input_details[0]['shape']
    logger.info(f"Model expects input shape: {input_shape}")
    
    # Log model output shape
    output_shape = output_details[0]['shape']
    logger.info(f"Model output shape: {output_shape}")
    
    # Log input data type
    input_dtype = input_details[0]['dtype']
    logger.info(f"Model expects input dtype: {input_dtype}")
    
    # Log output data type
    output_dtype = output_details[0]['dtype']
    logger.info(f"Model output dtype: {output_dtype}")
    
    # Log quantization details if any
    if 'quantization' in input_details[0]:
        logger.info(f"Input quantization: {input_details[0]['quantization']}")
    if 'quantization' in output_details[0]:
        logger.info(f"Output quantization: {output_details[0]['quantization']}")
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
        img_array = np.array(image, dtype=np.float32) / 255.0
        logger.info(f"Initial array shape: {img_array.shape}")
        
        # Make sure the array has shape (224, 224, 3)
        if len(img_array.shape) == 2:  # If grayscale, add color dimension
            logger.info("Converting grayscale to RGB by stacking")
            img_array = np.stack((img_array,) * 3, axis=-1)
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        
        # Log the shape to verify it matches what the model expects
        logger.info(f"Preprocessed image shape: {img_array.shape}")
        
        # Log value ranges
        logger.info(f"Input value range: min={np.min(img_array)}, max={np.max(img_array)}")
        
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

        # Preprocess the image
        img_array = preprocess_image(image)
        logger.info("Image preprocessed successfully")
        
        # Set input tensor
        interpreter.set_tensor(input_details[0]['index'], img_array)
        
        # Make prediction
        interpreter.invoke()
        
        # Get prediction result
        prediction = interpreter.get_tensor(output_details[0]['index'])
        logger.info(f"Raw prediction: {prediction}")
        logger.info(f"Prediction shape: {prediction.shape}")
        logger.info(f"Prediction dtype: {prediction.dtype}")
        
        # Get probabilities for each class
        probabilities = prediction[0]  # Shape should be (3,) for three classes
        logger.info(f"Class probabilities: {probabilities}")
        
        # Get the predicted class index
        predicted_class = np.argmax(probabilities)
        
        # Map class indices to labels - matching the training data folder structure
        class_labels = ['Normal', 'Malignant', 'Benign']  # Updated order to match training data
        predicted_label = class_labels[predicted_class]
        
        # Get confidence score
        confidence = float(probabilities[predicted_class])
        
        # Log detailed prediction information
        logger.info("Detailed prediction information:")
        logger.info(f"Raw probabilities: {probabilities}")
        logger.info(f"Predicted class index: {predicted_class}")
        logger.info(f"Predicted class: {predicted_label}")
        logger.info(f"Confidence: {confidence}")
        logger.info(f"All class probabilities:")
        for i, (label, prob) in enumerate(zip(class_labels, probabilities)):
            logger.info(f"{label}: {float(prob)}")

        return jsonify({
            "predicted_class": predicted_label,
            "confidence": confidence,
            "probabilities": {
                "normal": float(probabilities[0]),
                "malignant": float(probabilities[1]),
                "benign": float(probabilities[2])
            }
        })
    
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)