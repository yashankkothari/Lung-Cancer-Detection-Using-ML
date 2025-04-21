import React, { createContext, useContext, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

interface PatientRecord {
  _id: string;
  patient_name: string;
  age: number;
  gender: string;
  scan_date: string;
  prediction: string;
  probability: number;
  risk_level: string;
  created_at: string;
}

interface PatientContextType {
  records: PatientRecord[];
  loading: boolean;
  error: string | null;
  createRecord: (record: Omit<PatientRecord, '_id' | 'created_at'>) => Promise<void>;
  fetchRecords: () => Promise<void>;
  getRecord: (id: string) => Promise<PatientRecord | null>;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const createRecord = async (record: Omit<PatientRecord, '_id' | 'created_at'>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        'http://localhost:5000/api/patient-records',
        record,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      await fetchRecords(); // Refresh the records list
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create record');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('http://localhost:5000/api/patient-records', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      setRecords(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch records');
    } finally {
      setLoading(false);
    }
  };

  const getRecord = async (id: string): Promise<PatientRecord | null> => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`http://localhost:5000/api/patient-records/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      return response.data;
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch record');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <PatientContext.Provider
      value={{
        records,
        loading,
        error,
        createRecord,
        fetchRecords,
        getRecord,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
}

export function usePatient() {
  const context = useContext(PatientContext);
  if (context === undefined) {
    throw new Error('usePatient must be used within a PatientProvider');
  }
  return context;
}

export default PatientProvider; 