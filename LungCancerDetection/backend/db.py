from pymongo import MongoClient
from dotenv import load_dotenv
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# MongoDB connection string
MONGODB_URI = os.getenv('MONGO_URI', 'mongodb+srv://nilanshjain:Nilanshavi3rd@miniproject.hh17z84.mongodb.net/?retryWrites=true&w=majority&appName=Miniproject')

# Create MongoDB client
try:
    logger.info("Attempting to connect to MongoDB...")
    logger.info(f"Using connection string: {MONGODB_URI.replace('nilanshjain', '*****')}")  # Hide password in logs
    
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    
    # Test the connection
    client.admin.command('ping')
    logger.info("Successfully connected to MongoDB")
    
    # Access the database
    db = client.get_database('Miniproject')
    logger.info(f"Connected to database: {db.name}")
    
    # Define collections
    users_collection = db.users
    patient_records_collection = db.patient_records
    logger.info("Collections initialized")
    
    # Create indexes
    try:
        # Create unique index on email field
        users_collection.create_index('email', unique=True)
        logger.info("Created unique index on email field")
        
        # Create index on user_id for faster queries
        patient_records_collection.create_index('user_id')
        logger.info("Created index on user_id field")
        
        # Create index on scan_date for sorting
        patient_records_collection.create_index('scan_date')
        logger.info("Created index on scan_date field")
    except Exception as e:
        logger.error(f"Error creating indexes: {str(e)}")
        # Don't raise here, as indexes might already exist
        
except Exception as e:
    logger.error(f"Error connecting to MongoDB: {str(e)}")
    logger.error("Please check:")
    logger.error("1. Your MongoDB Atlas username and password are correct")
    logger.error("2. Your IP address is whitelisted in MongoDB Atlas")
    logger.error("3. The database name exists in your cluster")
    raise

def get_db():
    """Return the database instance"""
    return db

def get_users_collection():
    """Return the users collection"""
    return users_collection

def get_patient_records_collection():
    """Return the patient records collection"""
    return patient_records_collection