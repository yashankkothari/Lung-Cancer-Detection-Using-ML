import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function ReportsScreen() {
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setReports(response.data.reports);
    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  const downloadPDF = async (reportId: string) => {
    try {
      const response = await axios.get(
        `http://localhost:5000/api/reports/${reportId}/pdf`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          responseType: 'blob',
        }
      );

      // Create a temporary file
      const fileUri = `${FileSystem.cacheDirectory}lung_cancer_report_${reportId}.pdf`;
      await FileSystem.writeAsStringAsync(fileUri, response.data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share Report PDF',
      });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to download PDF report');
    }
  };

  const ReportItem = ({ report }: { report: any }) => (
    <TouchableOpacity
      style={styles.reportItem}
      onPress={() => {
        setSelectedReport(report);
        setShowModal(true);
      }}
    >
      <Text style={styles.reportItemTitle}>{report.patient_name}</Text>
      <Text style={styles.reportItemDate}>{report.scan_date}</Text>
      <Text style={[
        styles.reportItemRisk,
        { color: report.risk_level === 'High Risk' ? '#F44336' : 
                report.risk_level === 'Moderate Risk' ? '#FF9800' : '#4CAF50' }
      ]}>
        {report.risk_level}
      </Text>
    </TouchableOpacity>
  );

  const ReportModal = () => (
    <Modal
      visible={showModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.reportContainer}>
          <Text style={styles.reportTitle}>Medical Report</Text>
          
          <ScrollView>
            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Patient Information</Text>
              <Text style={styles.reportText}>Name: {selectedReport?.patient_name}</Text>
              <Text style={styles.reportText}>Age: {selectedReport?.age}</Text>
              <Text style={styles.reportText}>Gender: {selectedReport?.gender}</Text>
              <Text style={styles.reportText}>Scan Date: {selectedReport?.scan_date}</Text>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Diagnosis Results</Text>
              <Text style={styles.reportText}>Prediction: {selectedReport?.prediction}</Text>
              <Text style={styles.reportText}>Risk Level: {selectedReport?.risk_level}</Text>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Doctor's Notes</Text>
              {selectedReport?.doctor_notes.map((note: string, index: number) => (
                <Text key={index} style={styles.reportText}>• {note}</Text>
              ))}
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {selectedReport?.recommendations.map((rec: string, index: number) => (
                <Text key={index} style={styles.reportText}>• {rec}</Text>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.downloadButton]}
              onPress={() => selectedReport && downloadPDF(selectedReport.report_id)}
            >
              <Text style={styles.modalButtonText}>Download PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.closeButton]}
              onPress={() => setShowModal(false)}
            >
              <Text style={styles.modalButtonText}>Close Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#2c3e50', '#3498db']}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Patient Reports</Text>
          
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>No reports available</Text>
          ) : (
            <FlatList
              data={reports}
              renderItem={({ item }) => <ReportItem report={item} />}
              keyExtractor={(item) => item.report_id}
              contentContainerStyle={styles.listContainer}
            />
          )}
          
          <ReportModal />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  listContainer: {
    paddingBottom: 20,
  },
  reportItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },
  reportItemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  reportItemDate: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 5,
  },
  reportItemRisk: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptyText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  reportContainer: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    textAlign: 'center',
    marginBottom: 20,
  },
  reportSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 10,
  },
  reportText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  downloadButton: {
    backgroundColor: '#4CAF50',
  },
  closeButton: {
    backgroundColor: '#3498db',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 