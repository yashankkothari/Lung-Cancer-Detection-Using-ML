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
  Dimensions
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

export default function App() {
  const [image, setImage] = useState<ImageState>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [riskLevel, setRiskLevel] = useState<string>("");
  const [riskColor, setRiskColor] = useState<string>("#000");

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

  const uploadImage = async () => {
    if (!image) return;

    setLoading(true);
    const formData = new FormData();
    
    try {
      if (Platform.OS === "web" && image.file) {
        // For web with file object available
        formData.append("file", image.file);
        console.log("Web formData prepared with File object");
      } else if (Platform.OS === "web" && image.uri) {
        // For web with base64 data URI
        // Convert data URI to blob
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
          console.log("Web formData prepared from data URI");
        }
      } else {
        // For mobile
        formData.append("file", {
          uri: image.uri,
          name: image.name || "image.jpg",
          type: image.type || "image/jpeg",
        } as any);
        console.log("Mobile formData prepared");
      }

      console.log("Sending request to backend...");
      const res = await axios.post("http://192.168.0.175:5000/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      console.log("Response received:", res.data);
      const probability = res.data.lung_cancer_probability;
      setPrediction(`${(probability * 100).toFixed(2)}%`);
      
      // Set risk level based on probability
      if (probability < 0.3) {
        setRiskLevel("Low Risk");
        setRiskColor("#4CAF50");
      } else if (probability < 0.7) {
        setRiskLevel("Moderate Risk");
        setRiskColor("#FF9800");
      } else {
        setRiskLevel("High Risk");
        setRiskColor("#F44336");
      }
      
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
                  </View>
                </View>
              )}
              
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>About Lung Cancer</Text>
                
                <Text style={styles.infoText}>
                  Lung cancer is one of the most common cancers worldwide, with over 2 million new cases diagnosed each year. Early detection is crucial for successful treatment.
                </Text>
                
                <Text style={styles.infoSubtitle}>Warning Signs:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Persistent cough that doesn't go away</Text>
                  <Text style={styles.bulletItem}>• Chest pain that worsens with deep breathing</Text>
                  <Text style={styles.bulletItem}>• Hoarseness or change in voice</Text>
                  <Text style={styles.bulletItem}>• Unexplained weight loss</Text>
                  <Text style={styles.bulletItem}>• Shortness of breath</Text>
                  <Text style={styles.bulletItem}>• Coughing up blood</Text>
                </View>
                
                <Text style={styles.infoSubtitle}>Risk Factors:</Text>
                <View style={styles.bulletList}>
                  <Text style={styles.bulletItem}>• Smoking (responsible for 80-90% of cases)</Text>
                  <Text style={styles.bulletItem}>• Exposure to secondhand smoke</Text>
                  <Text style={styles.bulletItem}>• Exposure to radon gas</Text>
                  <Text style={styles.bulletItem}>• Family history of lung cancer</Text>
                  <Text style={styles.bulletItem}>• Exposure to asbestos and other carcinogens</Text>
                </View>
                
                <Text style={styles.infoSubtitle}>Prevention:</Text>
                <Text style={styles.infoText}>
                  The best way to prevent lung cancer is to never smoke or to quit smoking. Regular screenings for high-risk individuals can help detect cancer early when it's most treatable.
                </Text>
              </View>
            </View>
            
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                This application is for educational purposes only. Always consult with a healthcare professional for medical advice.
              </Text>
            </View>
          </View>
        </ScrollView>
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
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#E0E0E0",
    marginTop: 5,
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
    backgroundColor: "rgba(255, 255, 255, 0.2)",
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
  infoCard: {
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
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 15,
    lineHeight: 20,
  },
  infoSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  bulletList: {
    marginBottom: 15,
  },
  bulletItem: {
    fontSize: 14,
    color: "#E0E0E0",
    marginBottom: 5,
    lineHeight: 20,
  },
  footer: {
    width: "100%",
    marginTop: 10,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  footerText: {
    fontSize: 12,
    color: "#E0E0E0",
    textAlign: "center",
    fontStyle: "italic",
  }
});