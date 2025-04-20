import React, { useState } from "react";
import { 
  View, 
  TouchableOpacity, 
  Image, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  Platform, 
  ScrollView,
  SafeAreaView,
  Dimensions,
  TextInput,
  Alert,
  Modal,
  FlatList
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { usePatient } from "../context/PatientContext";
import { useAuth } from '../context/AuthContext';

// Define interfaces based on the actual response formats
interface WebDocumentResult {
  canceled: boolean;
  assets?: Array<{
    uri: string;
    mimeType: string;
    name: string;
    size: number;
  }>;
  output?: FileList;
}

interface MobileImageResult {
  canceled: boolean;
  assets?: Array<{
    uri: string;
    width: number;
    height: number;
    type?: string;
    fileName?: string;
    fileSize?: number;
  }>;
}

type ImageState = {
  uri: string;
  name?: string;
  type?: string;
  file?: File;
} | null;

const { width } = Dimensions.get("window");

export default function App() {
  const [image, setImage] = useState<ImageState>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [riskLevel, setRiskLevel] = useState<string>("");
  const [riskColor, setRiskColor] = useState<string>("#000");
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientGender, setPatientGender] = useState("");
  const [report, setReport] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const { createRecord } = usePatient();
  const { token } = useAuth();
  const [reportId, setReportId] = useState<string | null>(null);

  const pickImage = async () => {
    console.log("Opening image picker...");
    
    if (Platform.OS === "web") {
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: "image/*" }) as WebDocumentResult;
        console.log("Document Picker Result:", result);
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          console.log("Selected asset:", asset);
          
          // Create a standardized image state object
          setImage({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType,
            file: result.output?.[0]
          });
        }
      } catch (error) {
        console.error("Document picker error:", error);
      }
    } else {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [4, 3],
          quality: 1,
        }) as MobileImageResult;
      
        console.log("Image Picker Result:", result);
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          setImage({
            uri: asset.uri,
            name: asset.fileName,
            type: asset.type
          });
        }
      } catch (error) {
        console.error("Image picker error:", error);
      }
    }
  };

  const generateReport = async (predictionData: any) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/generate-report",
        {
          patient_name: patientName,
          age: patientAge,
          gender: patientGender,
          prediction: predictionData.prediction,
          probability: predictionData.probability,
          risk_level: predictionData.risk_level
        },
        {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      setReport(response.data.report);
      setShowReport(true);
    } catch (error) {
      console.error("Error generating report:", error);
      Alert.alert("Error", "Failed to generate report");
    }
  };

  const uploadImage = async () => {
    if (!image) return;
    if (!patientName || !patientAge || !patientGender) {
      Alert.alert('Error', 'Please fill in all patient details');
      return;
    }

    if (!token) {
      Alert.alert('Error', 'Please login to make predictions');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    
    try {
      if (Platform.OS === "web" && image.file) {
        formData.append("file", image.file);
      } else if (Platform.OS === "web" && image.uri) {
        const dataUriParts = image.uri.match(/^data:(.*?);base64,(.*)$/);
        if (dataUriParts) {
          const [, mimeType, base64Data] = dataUriParts;
          const byteString = atob(base64Data);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          
          const blob = new Blob([ab], { type: mimeType });
          formData.append("file", blob, image.name || "image.jpg");
        }
      } else {
        formData.append("file", {
          uri: image.uri,
          name: image.name || "image.jpg",
          type: image.type || "image/jpeg",
        } as any);
      }

      formData.append("patient_name", patientName);
      formData.append("age", patientAge);
      formData.append("gender", patientGender);

      const res = await axios.post("http://localhost:5000/predict", formData, {
        headers: { 
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
      });
      
      const probability = res.data.lung_cancer_probability;
      const predictionText = `${(probability * 100).toFixed(2)}%`;
      setPrediction(predictionText);
      
      let riskLevelText = "";
      if (probability < 0.3) {
        riskLevelText = "Low Risk";
        setRiskColor("#4CAF50");
      } else if (probability < 0.7) {
        riskLevelText = "Moderate Risk";
        setRiskColor("#FF9800");
      } else {
        riskLevelText = "High Risk";
        setRiskColor("#F44336");
      }
      setRiskLevel(riskLevelText);

      // Store the report ID for later use
      setReportId(res.data.report_id);

      await createRecord({
        patient_name: patientName,
        age: parseInt(patientAge),
        gender: patientGender,
        scan_date: new Date().toISOString(),
        prediction: predictionText,
        probability: probability,
        risk_level: riskLevelText
      });

      const predictionData = {
        prediction: predictionText,
        probability: probability,
        risk_level: riskLevelText
      };

      // Generate report after successful prediction
      await generateReport(predictionData);

      Alert.alert('Success', 'Analysis completed successfully');
      
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.response) {
        console.error("Error data:", error.response.data);
        setPrediction(`Error: ${JSON.stringify(error.response.data)}`);
      } else {
        setPrediction(`Error: ${error.message}`);
      }
      setRiskLevel("Error");
      setRiskColor("#F44336");
    }

    setLoading(false);
  };

  const viewReport = async () => {
    if (!reportId) {
      Alert.alert('Error', 'No report available');
      return;
    }

    try {
      const response = await axios.get(`http://localhost:5000/api/reports/${reportId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      setReport(response.data.report);
      setShowReport(true);
    } catch (error) {
      console.error("Error fetching report:", error);
      Alert.alert("Error", "Failed to fetch report");
    }
  };

  const ReportModal = () => (
    <Modal
      visible={showReport}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowReport(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.reportContainer}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>Medical Report</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowReport(false)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.reportScrollView}>
            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Patient Information</Text>
              <Text style={styles.reportText}>Name: {report?.patient_name}</Text>
              <Text style={styles.reportText}>Age: {report?.age}</Text>
              <Text style={styles.reportText}>Gender: {report?.gender}</Text>
              <Text style={styles.reportText}>Scan Date: {report?.scan_date}</Text>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Diagnosis Results</Text>
              <Text style={styles.reportText}>Prediction: {report?.prediction}</Text>
              <Text style={styles.reportText}>Risk Level: {report?.risk_level}</Text>
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Doctor's Notes</Text>
              {report?.doctor_notes.map((note: string, index: number) => (
                <Text key={index} style={styles.reportText}>• {note}</Text>
              ))}
            </View>

            <View style={styles.reportSection}>
              <Text style={styles.sectionTitle}>Recommendations</Text>
              {report?.recommendations.map((rec: string, index: number) => (
                <Text key={index} style={styles.reportText}>• {rec}</Text>
              ))}
            </View>
          </ScrollView>
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
        <ScrollView style={styles.scrollView}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Lung Cancer Detection</Text>
              <Text style={styles.subtitle}>AI-Powered Early Detection Tool</Text>
            </View>
            
            <View style={styles.cardContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Patient Information</Text>
                
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Patient Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={patientName}
                    onChangeText={setPatientName}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Age"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={patientAge}
                    onChangeText={setPatientAge}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Gender"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={patientGender}
                    onChangeText={setPatientGender}
                  />
                </View>

                <Text style={styles.cardTitle}>Upload CT Scan Image</Text>
                
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={pickImage}
                >
                  <Text style={styles.buttonText}>Select Image</Text>
                </TouchableOpacity>
                
                {image && image.uri && (
                  <View style={styles.imageContainer}>
                    <Text style={styles.imageLabel}>
                      {image.name || 'Selected Image'}
                    </Text>
                    
                    <Image 
                      source={{ uri: image.uri }} 
                      style={styles.image} 
                      onError={(e) => console.error("Image loading error:", e.nativeEvent)}
                    />
                    
                    <TouchableOpacity 
                      style={[styles.actionButton, !image && styles.disabledButton]}
                      onPress={uploadImage} 
                      disabled={!image || loading}
                    >
                      <Text style={styles.actionButtonText}>
                        {loading ? "Processing..." : "Analyze Image"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {loading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#FFFFFF" />
                    <Text style={styles.loadingText}>Analyzing image...</Text>
                  </View>
                )}
              </View>
              
              {prediction && (
                <View style={[styles.resultCard, { borderColor: riskColor }]}>
                  <Text style={styles.resultTitle}>Analysis Results</Text>
                  
                  <View style={styles.resultContent}>
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Probability:</Text>
                      <Text style={[styles.resultValue, { color: riskColor }]}>{prediction}</Text>
                    </View>
                    
                    <View style={styles.resultItem}>
                      <Text style={styles.resultLabel}>Assessment:</Text>
                      <Text style={[styles.resultValue, { color: riskColor }]}>{riskLevel}</Text>
                    </View>
                    
                    <Text style={styles.resultDisclaimer}>
                      This is an AI-assisted analysis and should not replace professional medical advice.
                    </Text>
                    
                    <TouchableOpacity
                      style={styles.viewReportButton}
                      onPress={viewReport}
                    >
                      <Text style={styles.viewReportButtonText}>View Detailed Report</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
        <ReportModal />
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
  scrollView: {
    flex: 1,
  },
  container: { 
    flex: 1, 
    alignItems: "center",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: "#FFFFFF",
    textAlign: "center",
  },
  cardContainer: {
    width: "100%",
    maxWidth: 600,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
    textAlign: "center",
  },
  uploadButton: {
    backgroundColor: "#3498db",
    borderRadius: 10,
    padding: 15,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderStyle: "dashed",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  imageContainer: { 
    alignItems: "center",
    marginTop: 15,
  },
  imageLabel: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 10,
  },
  image: { 
    width: width > 500 ? 300 : width - 80, 
    height: width > 500 ? 300 : width - 80, 
    borderRadius: 15,
    borderWidth: 3, 
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "#2c3e50",
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: "#3498db",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 25,
    alignItems: "center",
    width: "100%",
  },
  disabledButton: {
    backgroundColor: "rgba(52, 152, 219, 0.5)",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#FFFFFF",
  },
  resultCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  resultContent: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 10,
    padding: 15,
  },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  resultDisclaimer: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 15,
    fontStyle: "italic",
    textAlign: "center",
  },
  resultLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  inputContainer: {
    marginBottom: 15,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
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
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#2c3e50',
    fontWeight: 'bold',
  },
  reportScrollView: {
    maxHeight: '80%',
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
    lineHeight: 24,
  },
  viewReportButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  viewReportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});