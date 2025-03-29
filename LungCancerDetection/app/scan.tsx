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
  Alert
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";

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

export default function Scan() {
  const [image, setImage] = useState<ImageState>(null);
  const [patientId, setPatientId] = useState("");
  const [prediction, setPrediction] = useState<{
    predicted_class: string;
    confidence: number;
    probabilities: {
      normal: number;
      malignant: number;
      benign: number;
    };
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const pickImage = async () => {
    console.log("Opening image picker...");
    
    if (Platform.OS === "web") {
      try {
        const result = await DocumentPicker.getDocumentAsync({ type: "image/*" }) as WebDocumentResult;
        console.log("Document Picker Result:", result);
        
        if (!result.canceled && result.assets && result.assets.length > 0) {
          const asset = result.assets[0];
          console.log("Selected asset:", asset);
          
          setImage({
            uri: asset.uri,
            name: asset.name,
            type: asset.mimeType,
            file: result.output?.[0]
          });
        }
      } catch (error) {
        console.error("Document picker error:", error);
        Alert.alert("Error", "Failed to pick image");
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
        Alert.alert("Error", "Failed to pick image");
      }
    }
  };

  const uploadImage = async () => {
    if (!image) {
      Alert.alert("Error", "Please select an image first");
      return;
    }

    if (!patientId.trim()) {
      Alert.alert("Error", "Please enter a patient ID");
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

      formData.append("patientId", patientId);

      const res = await axios.post("http://192.168.0.175:5000/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      setPrediction(res.data);
      
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.response) {
        console.error("Error data:", error.response.data);
        Alert.alert("Error", "Failed to process image");
        setPrediction(null);
      } else {
        Alert.alert("Error", "Failed to connect to server");
        setPrediction(null);
      }
    }

    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a237e', '#0d47a1', '#1565c0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Patient Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Patient ID</Text>
                <TextInput
                  style={styles.input}
                  value={patientId}
                  onChangeText={setPatientId}
                  placeholder="Enter patient ID"
                  placeholderTextColor="rgba(255, 255, 255, 0.5)"
                />
              </View>

              <TouchableOpacity
                style={styles.uploadButton}
                onPress={pickImage}
              >
                <Text style={styles.buttonText}>Select CT Scan Image</Text>
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
              <View style={[styles.resultCard, { 
                borderColor: prediction.predicted_class === 'Malignant' ? '#F44336' : 
                            prediction.predicted_class === 'Benign' ? '#FF9800' : '#4CAF50',
                backgroundColor: prediction.predicted_class === 'Malignant' ? 'rgba(244, 67, 54, 0.1)' :
                              prediction.predicted_class === 'Benign' ? 'rgba(255, 152, 0, 0.1)' :
                              'rgba(76, 175, 80, 0.1)'
              }]}>
                <Text style={styles.resultTitle}>Analysis Results</Text>
                
                <View style={styles.resultContent}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Diagnosis:</Text>
                    <Text style={[styles.resultValue, { 
                      color: prediction.predicted_class === 'Malignant' ? '#F44336' : 
                             prediction.predicted_class === 'Benign' ? '#FF9800' : '#4CAF50',
                      fontSize: 20,
                      fontWeight: 'bold'
                    }]}>{prediction.predicted_class}</Text>
                  </View>
                  
                  <Text style={styles.resultDisclaimer}>
                    This is an AI-assisted analysis and should not replace professional medical advice.
                  </Text>
                </View>
              </View>
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
    alignItems: "center",
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    width: "100%",
    maxWidth: 600,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    padding: 15,
    color: "#FFFFFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  uploadButton: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    borderStyle: "dashed",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  imageContainer: { 
    alignItems: "center",
    marginTop: 20,
  },
  imageLabel: {
    fontSize: 16,
    color: "#E0E0E0",
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  image: { 
    width: width > 500 ? 300 : width - 80, 
    height: width > 500 ? 300 : width - 80, 
    borderRadius: 20,
    borderWidth: 3, 
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "#1a237e",
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionButton: {
    backgroundColor: "#2196F3",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: "rgba(33, 150, 243, 0.5)",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loadingContainer: {
    marginTop: 20,
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
  resultCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    borderLeftWidth: 8,
    width: "100%",
    maxWidth: 600,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 20,
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultContent: {
    backgroundColor: "rgba(0, 0, 0, 0.1)",
    borderRadius: 15,
    padding: 20,
  },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultDisclaimer: {
    fontSize: 14,
    color: "#E0E0E0",
    marginTop: 20,
    fontStyle: "italic",
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  resultLabel: {
    fontSize: 18,
    color: "#FFFFFF",
    flex: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}); 