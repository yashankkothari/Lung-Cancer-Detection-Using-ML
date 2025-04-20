# Lung Cancer Detection Using Machine Learning

A comprehensive application for early detection of lung cancer using machine learning and medical imaging. This project combines a React Native mobile app with a Flask backend to provide accurate predictions and detailed medical reports.

## Features

- **AI-Powered Analysis**: Upload CT scan images for instant analysis
- **Detailed Medical Reports**: Get comprehensive reports with risk assessment
- **Patient Management**: Store and track patient records
- **Secure Authentication**: User authentication with JWT tokens
- **Cross-Platform**: Works on both mobile and web platforms

## Technology Stack

### Frontend
- React Native
- Expo
- TypeScript
- Axios for API communication
- AsyncStorage for local data persistence

### Backend
- Flask (Python)
- TensorFlow/Keras for ML model
- MongoDB for database
- JWT for authentication
- PIL for image processing

## Project Structure

```
LungCancerDetection/
├── app/                    # React Native frontend
│   ├── (tabs)/             # Tab-based navigation
│   ├── context/            # React context providers
│   └── components/         # Reusable UI components
├── backend/                # Flask backend
│   ├── app.py              # Main Flask application
│   ├── db.py               # Database connection
│   └── .env                # Environment variables
└── model/                  # ML model files
    └── Lung_Model.h5       # Trained model
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- Python (v3.8 or higher)
- MongoDB
- Expo CLI

### Backend Setup
1. Navigate to the backend directory:
   ```
   cd LungCancerDetection/backend
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Set up environment variables in `.env`:
   ```
   MONGO_URI=your_mongodb_connection_string
   SECRET_KEY=your_jwt_secret_key
   ```

5. Start the Flask server:
   ```
   python app.py
   ```

### Frontend Setup
1. Navigate to the project root:
   ```
   cd LungCancerDetection
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the Expo development server:
   ```
   npx expo start
   ```

## Usage

1. **Authentication**
   - Sign up with email and password
   - Log in to access the application

2. **Image Analysis**
   - Enter patient details
   - Upload a CT scan image
   - Get instant analysis results

3. **View Reports**
   - Access detailed medical reports
   - View patient history
   - Track risk levels over time

## API Endpoints

- `POST /api/signup`: User registration
- `POST /api/login`: User authentication
- `POST /predict`: Image analysis
- `GET /api/reports`: Get user reports
- `GET /api/reports/<report_id>`: Get specific report

## Security Features

- JWT-based authentication
- Password hashing
- CORS protection
- Input validation
- Secure file handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Medical imaging dataset providers
- Open-source ML libraries
- React Native community
- Flask framework

## Support

For support, please open an issue in the GitHub repository or contact the development team.

---

**Note**: This application is for educational purposes only and should not be used as a substitute for professional medical advice.
