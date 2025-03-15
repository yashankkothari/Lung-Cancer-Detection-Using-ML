from tensorflow.keras.models import load_model

model = load_model("Lung_Model.h5")

import numpy as np
from tensorflow.keras.preprocessing import image
from PIL import Image
from tensorflow.keras.preprocessing import image

def preprocess_image(img_path):
    img = image.load_img(img_path, target_size=(224, 224))  # Resize to match model input
    img_array = image.img_to_array(img)  # Convert image to array
    img_array = np.expand_dims(img_array, axis=0)  # Add batch dimension
    img_array = img_array / 255.0  # Normalize (if required)
    return img_array

# Example image path
img_path = "Test/normal4.jpeg"  # Replace with your image file
input_image = preprocess_image(img_path)

# Get model prediction
prediction = model.predict(input_image)

# Assuming it's a binary classification (0 = No Cancer, 1 = Cancer)
probability = float(prediction[0][0])  # Extract probability score

# Print the result
print(f"Lung Cancer Probability: {probability:.4f}")