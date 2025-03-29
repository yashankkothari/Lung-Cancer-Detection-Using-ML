import * as React from "react";
import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";

interface PatientRecord {
  patientId: string;
  timestamp: string;
  diagnosis: string;
  confidence: number;
  imageUrl: string;
}

export default function History() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchId, setSearchId] = useState("");
  const [filteredRecords, setFilteredRecords] = useState<PatientRecord[]>([]);

  useEffect(() => {
    fetchRecords();
  }, []);

  useEffect(() => {
    if (searchId.trim()) {
      const filtered = records.filter(record => 
        record.patientId.toLowerCase().includes(searchId.toLowerCase())
      );
      setFilteredRecords(filtered);
    } else {
      setFilteredRecords(records);
    }
  }, [searchId, records]);

  const fetchRecords = async () => {
    try {
      const response = await axios.get("http://192.168.0.175:5000/history");
      setRecords(response.data);
      setFilteredRecords(response.data);
    } catch (error) {
      console.error("Error fetching records:", error);
      Alert.alert("Error", "Failed to fetch patient records");
    } finally {
      setLoading(false);
    }
  };

  const getDiagnosisColor = (diagnosis: string) => {
    switch (diagnosis.toLowerCase()) {
      case 'malignant':
        return '#F44336';
      case 'benign':
        return '#FF9800';
      case 'normal':
        return '#4CAF50';
      default:
        return '#FFFFFF';
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a237e', '#0d47a1', '#1565c0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Patient History</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by Patient ID"
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={searchId}
                onChangeText={setSearchId}
              />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading records...</Text>
              </View>
            ) : filteredRecords.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchId.trim() 
                    ? "No records found for this Patient ID"
                    : "No patient records available"}
                </Text>
              </View>
            ) : (
              filteredRecords.map((record, index) => (
                <View key={index} style={styles.recordCard}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.patientId}>Patient ID: {record.patientId}</Text>
                    <Text style={styles.timestamp}>{formatDate(record.timestamp)}</Text>
                  </View>
                  
                  <View style={styles.diagnosisContainer}>
                    <Text style={styles.diagnosisLabel}>Diagnosis:</Text>
                    <Text style={[styles.diagnosisValue, { color: getDiagnosisColor(record.diagnosis) }]}>
                      {record.diagnosis}
                    </Text>
                  </View>

                  <View style={styles.imageContainer}>
                    <Text style={styles.imageLabel}>CT Scan Image:</Text>
                    <Image
                      source={{ uri: record.imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1a237e',
  },
  gradient: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  searchInput: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 15,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFFFFF",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  recordCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  patientId: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timestamp: {
    fontSize: 14,
    color: "#E0E0E0",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  diagnosisContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  diagnosisLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    marginRight: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  diagnosisValue: {
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  imageContainer: {
    marginTop: 15,
  },
  imageLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  image: {
    width: "100%",
    height: 200,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
}); 