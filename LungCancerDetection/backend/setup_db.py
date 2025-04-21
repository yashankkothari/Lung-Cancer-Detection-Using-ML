from db import get_users_collection, get_patient_records_collection

def setup_database():
    # Get collections
    users = get_users_collection()
    patient_records = get_patient_records_collection()

    # Create indexes
    print("Creating indexes...")
    
    # Create unique index on email field in users collection
    users.create_index("email", unique=True)
    print("Created unique index on email field in users collection")
    
    # Create index on user_id in patient_records for faster queries
    patient_records.create_index("user_id")
    print("Created index on user_id in patient_records collection")
    
    # Create index on scan_date for sorting and filtering
    patient_records.create_index("scan_date")
    print("Created index on scan_date in patient_records collection")
    
    print("Database setup completed successfully!")

if __name__ == "__main__":
    setup_database()