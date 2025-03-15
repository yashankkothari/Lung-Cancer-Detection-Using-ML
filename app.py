from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
import numpy as np
import io
from PIL import Image

app = Flask(__name__)

# Load the trained model
model = load_model("Lung_Model.h5")  # Ensure this file exists

# Preprocessing function
def preprocess_image(image):
    image = image.resize((224, 224))  # Resize to model input size
    img_array = np.array(image) / 255.0  # Normalize pixel values
    if img_array.ndim == 2:  # If grayscale, convert to RGB
        img_array = np.expand_dims(img_array, axis=-1)  # (224, 224) -> (224, 224, 1)
        img_array = np.repeat(img_array, 3, axis=-1)  # (224, 224, 1) -> (224, 224, 3)
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension -> (1, 224, 224, 3)
    return img_array

@app.route("/", methods=["GET"])
def home():
    return "Lung Cancer Detection API is running! Use /predict to send an image."

@app.route("/predict", methods=["POST"])
def predict():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    image = Image.open(io.BytesIO(file.read()))  # Read image

    # Preprocess the image and make a prediction
    img_array = preprocess_image(image)
    prediction = model.predict(img_array)
    probability = float(prediction[0][0])  # Assuming binary classification

    return jsonify({"lung_cancer_probability": probability})

if __name__ == "__main__":
    app.run(debug=True)
