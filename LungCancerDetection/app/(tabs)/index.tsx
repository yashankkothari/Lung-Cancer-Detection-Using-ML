import React, { useState } from "react";
import { View, Button, Image, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";

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

export default function App() {
  const [image, setImage] = useState<ImageState>(null);
  const [prediction, setPrediction] = useState<string | null>(null);
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
      setPrediction(`Lung Cancer Probability: ${res.data.lung_cancer_probability.toFixed(4)}`);
    } catch (error: any) {
      console.error("Upload error:", error);
      if (error.response) {
        console.error("Error data:", error.response.data);
        setPrediction(`Error: ${JSON.stringify(error.response.data)}`);
      } else {
        setPrediction(`Error: ${error.message}`);
      }
    }

    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Lung Cancer Detection</Text>
      
      <Button title="Pick an Image" onPress={pickImage} />
      
      {image && image.uri && (
        <View style={styles.imageContainer}>
          <Text style={styles.subtitle}>
            Selected: {image.name || 'Image'}
          </Text>
          
          <Image 
            source={{ uri: image.uri }} 
            style={styles.image} 
            onError={(e) => console.error("Image loading error:", e.nativeEvent)}
          />
        </View>
      )}
      
      <Button 
        title="Upload & Predict" 
        onPress={uploadImage} 
        disabled={!image || loading} 
      />
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066cc" />
          <Text style={styles.loadingText}>Processing image...</Text>
        </View>
      )}
      
      {prediction && (
        <View style={styles.resultContainer}>
          <Text style={styles.prediction}>{prediction}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5"
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 10
  },
  imageContainer: { 
    marginVertical: 20,
    alignItems: "center" 
  },
  image: { 
    width: 250, 
    height: 250, 
    borderRadius: 8,
    borderWidth: 1, 
    borderColor: "#ddd",
    backgroundColor: "#eee"
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: "center"
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16
  },
  resultContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: "#e6f7ff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#91d5ff"
  },
  prediction: { 
    fontSize: 18, 
    fontWeight: "bold",
    color: "#0066cc"
  }
});