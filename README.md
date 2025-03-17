# Lung Cancer Detection Using Machine Learning (React Native + Expo)

This project is a **React Native mobile application** using **Expo** to provide an interface for predicting lung cancer chances based on CT scan images. A **Flask API** runs in the backend to process the images using a **machine learning model**.

## 🚀 Features
- Upload **CT scan images** via mobile app
- **Machine learning model** predicts lung cancer probability
- **Interactive UI** with **React Native** & **Expo**
- **Flask API** for backend processing

---
## 📦 Installation & Setup

### 1️⃣ Clone the Repository
```sh
git clone https://github.com/yashankkothari/Lung-Cancer-Detection-Using-ML.git
cd Lung-Cancer-Detection-Using-ML
```

### 2️⃣ Install Expo CLI (if not installed)
```sh
npm install -g expo-cli
```

### 3️⃣ Install Dependencies
```sh
cd LungCancerDetection 
npm install
```
---
## ⚙️ Setting Up the Model
Since GitHub restricts files over **100MB**, you'll need to manually download the model file.

### 📥 Download `Lung_Model.h5`
1. Download it from https://drive.google.com/file/d/1334YgXUGplhYJMp-g1w8IrRoG8wTN92B/view?usp=sharing
2. Move it to the project directory: `LungCancerDetection/Lung_Model.h5`

---
## 🏃 Running the Application
### 1️⃣ Start the Backend (Flask API)
```sh
python app.py
```
By default, the API runs at **http://127.0.0.1:5000**

### 2️⃣ Start the Frontend (React App)
```sh
cd LungCancerDetection
npm install
npm start web/expo start web

---
## 🧪 Testing the API
You can test the API using **Postman** or **cURL**:
```sh
curl -X POST "http://127.0.0.1:5000/predict" -F "file=@sample_ct_scan.png"
```

---
## 📜 License
This project is **open-source** under the MIT License.

### 👨‍💻 Developed by Yashank Kothari
