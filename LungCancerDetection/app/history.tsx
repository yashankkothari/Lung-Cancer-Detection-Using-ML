import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { API_BASE_URL, ENDPOINTS } from '../constants/api';
import Footer from '../components/Footer';

interface PatientRecord {
  patientId: string;
  timestamp: string;
  diagnosis: string;
  confidence: number;
  probabilities: {
    normal: number;
    benign: number;
    malignant: number;
  };
}

export default function History() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [patientId, setPatientId] = useState(params.id?.toString() || '');
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (params.id) {
      handleSearch();
    }
  }, [params.id]);

  const handleSearch = async () => {
    if (!patientId.trim()) {
      setError('Please enter a patient ID');
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await axios.get(`${API_BASE_URL}${ENDPOINTS.HISTORY}/${patientId.trim()}`);
      setRecords(response.data);
      if (response.data.length === 0) {
        setError('No records found for this patient');
      }
    } catch (err) {
      console.error('Error fetching patient history:', err);
      setError('Failed to fetch patient records');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDiagnosisColor = (diagnosis: string) => {
    switch (diagnosis.toLowerCase()) {
      case 'normal':
        return '#10b981';
      case 'benign':
        return '#f59e0b';
      case 'malignant':
        return '#ef4444';
      default:
        return '#6b7280';
    }
  };

  const renderRecord = ({ item }: { item: PatientRecord }) => (
    <View style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <Text style={styles.timestamp}>{formatDate(item.timestamp)}</Text>
        <View style={[styles.diagnosisTag, { backgroundColor: getDiagnosisColor(item.diagnosis) }]}>
          <Text style={styles.diagnosisText}>{item.diagnosis}</Text>
        </View>
      </View>
      
      <View style={styles.confidenceContainer}>
        <Text style={styles.confidenceLabel}>Confidence:</Text>
        <Text style={styles.confidenceValue}>{(item.confidence * 100).toFixed(1)}%</Text>
      </View>

      <View style={styles.probabilitiesContainer}>
        <View style={styles.probabilityItem}>
          <Text style={styles.probabilityLabel}>Normal</Text>
          <Text style={styles.probabilityValue}>{(item.probabilities.normal * 100).toFixed(1)}%</Text>
        </View>
        <View style={styles.probabilityItem}>
          <Text style={styles.probabilityLabel}>Benign</Text>
          <Text style={styles.probabilityValue}>{(item.probabilities.benign * 100).toFixed(1)}%</Text>
        </View>
        <View style={styles.probabilityItem}>
          <Text style={styles.probabilityLabel}>Malignant</Text>
          <Text style={styles.probabilityValue}>{(item.probabilities.malignant * 100).toFixed(1)}%</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Patient ID"
          value={patientId}
          onChangeText={setPatientId}
          onSubmitEditing={handleSearch}
          placeholderTextColor="#64748b"
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={styles.loadingText}>Loading patient records...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : searched && records.length > 0 ? (
        <FlatList
          data={records}
          renderItem={renderRecord}
          keyExtractor={(item) => item.timestamp}
          contentContainerStyle={styles.listContainer}
        />
      ) : searched ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-outline" size={48} color="#64748b" />
          <Text style={styles.noRecordsText}>No records found</Text>
        </View>
      ) : (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={48} color="#64748b" />
          <Text style={styles.initialText}>Enter a patient ID to view their scan history</Text>
        </View>
      )}
      <Footer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1e293b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchButton: {
    backgroundColor: '#6366f1',
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
  },
  noRecordsText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  initialText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 16,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timestamp: {
    fontSize: 14,
    color: '#64748b',
  },
  diagnosisTag: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  diagnosisText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
  },
  confidenceValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  probabilitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
  },
  probabilityItem: {
    alignItems: 'center',
  },
  probabilityLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  probabilityValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
}); 