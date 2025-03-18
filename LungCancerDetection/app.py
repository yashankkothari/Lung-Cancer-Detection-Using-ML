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

# Define global variables
model = None
model_loaded = False

# Define your classes (verify these match your training classes)
CANCER_TYPES = [
    "Normal",
    "Benign", 
    "Malignant"
]

# Load the model using the correct MediaPipe format
try:
    logger.info("Starting model loading process for MediaPipe model")
    
    # MediaPipe Model Maker saves models in SavedModel format in the export_dir
    model_dir = os.path.join(os.getcwd(), "Model")
    
    # Check if the directory exists
    if not os.path.exists(model_dir):
        logger.error(f"Model directory not found: {model_dir}")
        model_loaded = False
    else:
        # List the contents of the model directory
        logger.info(f"Model directory contents: {os.listdir(model_dir)}")
        
        # Try to load the model as a SavedModel
        try:
            # MediaPipe models are saved as TFLite models or SavedModels
            # First, check if there's a saved_model.pb file
            saved_model_path = os.path.join(model_dir, "saved_model.pb")
            if os.path.exists(saved_model_path) or os.path.exists(os.path.join(model_dir, "saved_model")):
                # Load as SavedModel
                model = tf.saved_model.load(model_dir)
                logger.info("Model loaded as SavedModel")
                
                # For SavedModel format, we need to get the concrete function
                infer = model.signatures["serving_default"]
                logger.info(f"Model input: {list(infer.structured_input_signature[1].keys())}")
                logger.info(f"Model output: {list(infer.structured_outputs.keys())}")
                
                # Test prediction
                test_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
                input_tensor = tf.convert_to_tensor(test_input)
                test_output = infer(**{list(infer.structured_input_signature[1].keys())[0]: input_tensor})
                output_key = list(test_output.keys())[0]
                logger.info(f"Test prediction: {test_output[output_key]}")
                
                model_loaded = True
            
            # If no SavedModel, check for TFLite model
            elif any(f.endswith('.tflite') for f in os.listdir(model_dir)):
                tflite_file = next(f for f in os.listdir(model_dir) if f.endswith('.tflite'))
                tflite_path = os.path.join(model_dir, tflite_file)
                logger.info(f"Found TFLite model: {tflite_path}")
                
                # Load TFLite model
                interpreter = tf.lite.Interpreter(model_path=tflite_path)
                interpreter.allocate_tensors()
                
                # Get input and output tensors
                input_details = interpreter.get_input_details()
                output_details = interpreter.get_output_details()
                
                logger.info(f"TFLite input details: {input_details}")
                logger.info(f"TFLite output details: {output_details}")
                
                # Set model to the interpreter
                model = interpreter
                model_loaded = True
                logger.info("Loaded model as TFLite interpreter")
            
            # Try loading from checkpoint as a last resort
            elif os.path.exists(os.path.join(model_dir, "model-0020.index")):
                logger.info("Attempting to load from checkpoint")
                
                # Create a fresh model with MobileNetV2 and a classification head
                base_model = tf.keras.applications.MobileNetV2(
                    input_shape=(224, 224, 3),
                    include_top=False,
                    weights=None
                )
                
                # Add classification layers
                x = base_model.output
                x = tf.keras.layers.GlobalAveragePooling2D()(x)
                x = tf.keras.layers.Dense(128, activation='relu')(x)
                predictions = tf.keras.layers.Dense(len(CANCER_TYPES), activation='softmax')(x)
                
                model = tf.keras.Model(inputs=base_model.input, outputs=predictions)
                
                # Load the checkpoint
                checkpoint_path = os.path.join(model_dir, "model-0020")
                checkpoint = tf.train.Checkpoint(model=model)
                status = checkpoint.restore(checkpoint_path)
                status.expect_partial()
                
                # Test the model
                test_input = np.random.random((1, 224, 224, 3))
                test_output = model.predict(test_input)
                logger.info(f"Test prediction from checkpoint: {test_output}")
                
                model_loaded = True
                logger.info("Model loaded from checkpoint")
            else:
                logger.error("No suitable model format found in model directory")
                model_loaded = False
                
            # Check if predictions are uniform
            is_uniform = False
            if model_loaded:
                if isinstance(model, tf.lite.Interpreter):
                    # For TFLite model
                    test_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
                    interpreter = model
                    input_details = interpreter.get_input_details()
                    output_details = interpreter.get_output_details()
                    interpreter.set_tensor(input_details[0]['index'], test_input)
                    interpreter.invoke()
                    test_output = interpreter.get_tensor(output_details[0]['index'])
                    
                elif hasattr(model, 'signatures'):
                    # For SavedModel with signatures
                    test_input = np.random.random((1, 224, 224, 3)).astype(np.float32)
                    input_tensor = tf.convert_to_tensor(test_input)
                    infer = model.signatures["serving_default"]
                    input_key = list(infer.structured_input_signature[1].keys())[0]
                    test_output_dict = infer(**{input_key: input_tensor})
                    output_key = list(test_output_dict.keys())[0]
                    test_output = test_output_dict[output_key].numpy()
                else:
                    # For regular Keras model
                    test_input = np.random.random((1, 224, 224, 3))
                    test_output = model.predict(test_input)
                
                logger.info(f"Test output shape: {test_output.shape}")
                logger.info(f"Test output values: {test_output}")
                
                # Check if all values are the same
                is_uniform = np.allclose(test_output[0], test_output[0][0], rtol=1e-5)
                logger.info(f"Uniform predictions: {is_uniform}")
            
            if is_uniform:
                logger.warning("⚠️ Model is returning uniform predictions. Check if weights were correctly loaded.")
            
        except Exception as e:
            logger.error(f"Error loading model: {str(e)}")
            traceback.print_exc()
            model_loaded = False
            
except Exception as e:
    model_loaded = False
    logger.error(f"Error during model initialization: {str(e)}")
    traceback.print_exc()

def preprocess_image(image):
    try:
        logger.info(f"Original image size: {image.size}, mode: {image.mode}")
        
        # Convert to RGB if needed
        if image.mode != "RGB":
            image = image.convert("RGB")
            logger.info("Converted image to RGB mode")
        
        # Resize to 224x224 (MobileNetV2 input size)
        image = image.resize((224, 224))
        logger.info("Resized image to 224x224")
        
        # Convert to numpy array
        img_array = np.array(image)
        logger.info(f"Image array shape: {img_array.shape}")
        
        # MobileNetV2 preprocessing - scale to [-1, 1]
        img_array = img_array.astype(np.float32)
        
        # MediaPipe Model Maker uses [-1,1] normalization for MobileNetV2
        img_array = (img_array - 127.5) / 127.5
        
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        logger.info(f"Final preprocessed array shape: {img_array.shape}")
        
        return img_array
    except Exception as e:
        logger.error(f"Error in image preprocessing: {str(e)}")
        traceback.print_exc()
        raise

@app.route("/", methods=["GET"])
def home():
    return "Lung Cancer Classification API is running! Use /predict to send an image."

@app.route("/predict", methods=["POST"])
def predict():
    try:
        logger.info("Received prediction request")
        
        # Check if model is loaded
        if not model_loaded or model is None:
            logger.error("Model not loaded, cannot make predictions")
            return jsonify({"error": "Model not available. Please check server logs."}), 503
        
        if "file" not in request.files:
            logger.error("No file part in the request")
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        logger.info(f"Received file: {file.filename}")
        
        # Open and preprocess the image
        image_bytes = file.read()
        image = Image.open(io.BytesIO(image_bytes))
        img_array = preprocess_image(image)
        
        # Make prediction based on model type
        if isinstance(model, tf.lite.Interpreter):
            # TFLite model prediction
            interpreter = model
            input_details = interpreter.get_input_details()
            output_details = interpreter.get_output_details()
            
            # Set input tensor
            interpreter.set_tensor(input_details[0]['index'], img_array)
            
            # Run inference
            interpreter.invoke()
            
            # Get output predictions
            predictions = interpreter.get_tensor(output_details[0]['index'])
            logger.info(f"TFLite prediction shape: {predictions.shape}")
            logger.info(f"Raw predictions: {predictions}")
            
        elif hasattr(model, 'signatures'):
            # SavedModel with signatures
            infer = model.signatures["serving_default"]
            input_key = list(infer.structured_input_signature[1].keys())[0]
            
            # Convert to tensor
            input_tensor = tf.convert_to_tensor(img_array)
            
            # Run inference
            output_dict = infer(**{input_key: input_tensor})
            
            # Get output from dictionary
            output_key = list(output_dict.keys())[0]
            predictions = output_dict[output_key].numpy()
            logger.info(f"SavedModel prediction shape: {predictions.shape}")
            logger.info(f"Raw predictions: {predictions}")
            
        else:
            # Standard Keras model
            predictions = model.predict(img_array)
            logger.info(f"Keras prediction shape: {predictions.shape}")
            logger.info(f"Raw predictions: {predictions}")
        
        # Process results - assume predictions shape is [1, num_classes]
        class_probs = predictions[0]
        predicted_class_index = np.argmax(class_probs)
        
        # Get the class name
        if predicted_class_index < len(CANCER_TYPES):
            predicted_class = CANCER_TYPES[predicted_class_index]
        else:
            predicted_class = f"Unknown Class {predicted_class_index}"
        
        # Create results dictionary
        results = {
            "predicted_class": predicted_class,
            "confidence": float(class_probs[predicted_class_index]),
            "class_probabilities": {
                CANCER_TYPES[i] if i < len(CANCER_TYPES) else f"Class {i}": float(class_probs[i])
                for i in range(len(class_probs))
            }
        }
        
        # Add cancer probability calculation (sum of Benign and Malignant)
        if len(CANCER_TYPES) == 3:  # Normal, Benign, Malignant
            results["cancer_probability"] = float(class_probs[1] + class_probs[2])  # Sum of Benign + Malignant
            results["malignant_probability"] = float(class_probs[2])  # Just Malignant
        
        logger.info(f"Classification results: {results}")
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error in prediction: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/status", methods=["GET"])
def status():
    """Endpoint to check model and server status"""
    model_type = "Unknown"
    if model_loaded:
        if isinstance(model, tf.lite.Interpreter):
            model_type = "TFLite Model"
        elif hasattr(model, 'signatures'):
            model_type = "SavedModel with signatures"
        else:
            model_type = "Standard Keras Model"
            
    return jsonify({
        "server": "running",
        "model_loaded": model_loaded,
        "model_type": model_type,
        "classes": CANCER_TYPES,
        "tensorflow_version": tf.__version__,
        "model_directory": os.path.join(os.getcwd(), "Model"),
        "model_files": os.listdir(os.path.join(os.getcwd(), "Model")) if os.path.exists(os.path.join(os.getcwd(), "Model")) else []
    })

if __name__ == "__main__":
    logger.info("Starting Flask server")
    app.run(host='0.0.0.0', port=5000, debug=True)