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
  Modal
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import axios from "axios";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useRouter } from "expo-router";
import Footer from '../components/Footer';

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

export default function ScanScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ blob: Blob; fileType: string } | null>(null);
  const patientIdInputRef = React.useRef<TextInput>(null);
  const [prediction, setPrediction] = useState<{
    predicted_class: string;
    confidence: number;
    probabilities: {
      normal: number;
      malignant: number;
      benign: number;
    };
  } | null>(null);
  const [patientIdError, setPatientIdError] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const router = useRouter();

  const validateAndPickImage = () => {
    if (!patientId.trim()) {
      setPatientIdError(true);
      Alert.alert(
        "Missing Patient ID",
        "Please enter a patient ID before selecting an image.",
        [{ text: "OK" }]
      );
      patientIdInputRef.current?.focus();
      return false;
    }
    setPatientIdError(false);
    return true;
  };

  const pickImage = async () => {
    if (!validateAndPickImage()) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      console.log('Image picker result:', result);

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedAsset = result.assets[0];
        setImage(selectedAsset.uri);
        
        // Get the actual file data
        const response = await fetch(selectedAsset.uri);
        const blob = await response.blob();
        
        // Save the blob for later processing
        const fileType = selectedAsset.uri.split('.').pop() || 'jpg';
        setSelectedFile({ blob, fileType });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleUpload = async (blob: Blob, asset: any) => {
    try {
      setIsLoading(true);

      // Create form data
      const formData = new FormData();
      
      // Get file extension and type
      const uriParts = asset.uri.split('.');
      const fileType = uriParts[uriParts.length - 1] || 'jpg';
      
      // Save the blob and fileType for later use when saving to database
      setSelectedFile({ blob, fileType });
      
      // Append the file blob with the correct filename and type
      formData.append('file', blob, `scan.${fileType}`);

      console.log('Uploading image:', {
        filename: `scan.${fileType}`,
        type: `image/${fileType}`,
        size: blob.size
      });

      // Make the request for prediction only
      const response = await axios.post('http://localhost:5000/predict', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Accept': 'application/json',
        },
        transformRequest: (data) => {
          return data;
        },
        timeout: 30000,
      });

      console.log('Server response:', response.data);

      if (response.data) {
        setPrediction(response.data);
      } else {
        throw new Error('No data received from server');
      }
      
    } catch (error: any) {
      console.error('Upload error:', error);
      console.error('Error details:', error.response?.data);
      
      let errorMessage = 'Failed to upload image. ';
      if (error.response?.status === 400) {
        errorMessage += error.response.data.error || 'Please ensure the image is a valid CT scan.';
      } else if (error.response?.status === 500) {
        errorMessage += error.response.data.error || 'Server error occurred.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      Alert.alert("Error", errorMessage);
      setPrediction(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToDatabase = async () => {
    if (!selectedFile || !prediction || !patientId) {
      Alert.alert(
        "Missing Information",
        "Please ensure you have selected an image, processed it, and entered a patient ID.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      setIsSaving(true);

      const formData = new FormData();
      formData.append('file', selectedFile.blob, `scan.${selectedFile.fileType}`);
      formData.append('patientId', patientId);
      formData.append('prediction', JSON.stringify(prediction));

      const response = await axios.post('http://localhost:5000/save-record', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Show the custom success popup
      setShowSuccessPopup(true);
      
      // Keep the isSaving state true until user dismisses the popup
      
    } catch (error: any) {
      setIsSaving(false);
      console.error('Save error:', error);
      
      Alert.alert(
        "Error Saving Record", 
        "Failed to save record to database. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  // Function to handle popup actions
  const handlePopupAction = (action: 'history' | 'new' | 'close') => {
    setShowSuccessPopup(false);
    setIsSaving(false);
    
    if (action === 'history') {
      router.push({
        pathname: '/history',
        params: { id: patientId }
      });
    } else if (action === 'new') {
      setImage(null);
      setPrediction(null);
      setSelectedFile(null);
      setPatientId("");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[Colors.gradient.start, Colors.gradient.middle, Colors.gradient.end]}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Patient Information</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>
                  Patient ID <Text style={styles.requiredStar}>*</Text>
                </Text>
                <TextInput
                  ref={patientIdInputRef}
                  style={[
                    styles.input,
                    patientIdError && styles.inputError
                  ]}
                  value={patientId}
                  onChangeText={(text) => {
                    setPatientId(text);
                    if (text.trim()) {
                      setPatientIdError(false);
                    }
                  }}
                  placeholder="Enter patient ID"
                  placeholderTextColor={Colors.text.muted}
                />
                {patientIdError && (
                  <Text style={styles.errorText}>
                    Patient ID is required
                  </Text>
                )}
              </View>

              <View style={styles.content}>
                <Text style={styles.title}>Upload CT Scan Image</Text>
                <Text style={styles.subtitle}>
                  Our AI system will analyze your CT scan and provide results within seconds
                </Text>

                {!image ? (
                  <TouchableOpacity 
                    style={[
                      styles.uploadArea, 
                      isDragging && styles.uploadAreaActive,
                      patientIdError && styles.uploadAreaDisabled
                    ]}
                    onPress={pickImage}
                  >
                    <View style={styles.uploadContent}>
                      <MaterialCommunityIcons 
                        name="cloud-upload-outline" 
                        size={48} 
                        color={Colors.accent.blue}
                      />
                      <Text style={styles.uploadText}>
                        Drag and drop your CT scan image here, or
                      </Text>
                      <TouchableOpacity 
                        style={styles.browseButton}
                        onPress={pickImage}
                      >
                        <Text style={styles.browseButtonText}>Browse Files</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.imagePreviewContainer}>
                    <Image 
                      source={{ uri: image }} 
                      style={styles.imagePreview} 
                      resizeMode="contain"
                    />
                    <View style={styles.imagePreviewActions}>
                      <TouchableOpacity 
                        style={styles.previewButton}
                        onPress={() => {
                          setImage(null);
                          setPrediction(null);
                          setSelectedFile(null);
                        }}
                      >
                        <MaterialCommunityIcons 
                          name="close" 
                          size={24} 
                          color={Colors.status.error}
                        />
                        <Text style={[styles.previewButtonText, { color: Colors.status.error }]}>
                          Remove
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.previewButton}
                        onPress={pickImage}
                      >
                        <MaterialCommunityIcons 
                          name="image-plus" 
                          size={24} 
                          color={Colors.accent.blue}
                        />
                        <Text style={[styles.previewButtonText, { color: Colors.accent.blue }]}>
                          Change Image
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {!prediction && selectedFile && (
                      <TouchableOpacity
                        style={[styles.processButton, isLoading && styles.processButtonDisabled]}
                        onPress={() => handleUpload(selectedFile.blob, { uri: image })}
                        disabled={isLoading}
                      >
                        <View style={styles.processButtonContent}>
                          <MaterialCommunityIcons 
                            name="brain" 
                            size={24} 
                            color={Colors.text.primary} 
                          />
                          <Text style={styles.processButtonText}>
                            {isLoading ? 'Processing...' : 'Process Image'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            </View>
            
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.accent.blue} />
                <Text style={styles.loadingText}>Processing image...</Text>
              </View>
            )}
            
            {prediction && (
              <View style={[styles.resultCard, { 
                borderColor: prediction.predicted_class === 'Malignant' ? Colors.status.error : 
                            prediction.predicted_class === 'Benign' ? Colors.status.warning : 
                            Colors.status.success,
                backgroundColor: Colors.card
              }]}>
                <Text style={styles.resultTitle}>Analysis Results</Text>
                
                <View style={styles.resultContent}>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultLabel}>Diagnosis:</Text>
                    <Text style={[styles.resultValue, { 
                      color: prediction.predicted_class === 'Malignant' ? Colors.status.error : 
                             prediction.predicted_class === 'Benign' ? Colors.status.warning : 
                             Colors.status.success
                    }]}>{prediction.predicted_class}</Text>
                  </View>
                  
                  <Text style={styles.resultDisclaimer}>
                    This is an AI-assisted analysis and should not replace professional medical advice.
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.saveButton,
                      isSaving && styles.saveButtonDisabled
                    ]}
                    onPress={handleSaveToDatabase}
                    disabled={isSaving}
                  >
                    <View style={styles.saveButtonContent}>
                      <MaterialCommunityIcons 
                        name="database-plus" 
                        size={24} 
                        color={Colors.text.primary} 
                      />
                      <Text style={styles.saveButtonText}>
                        {isSaving ? 'Saving to Database...' : 'Save to Database'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Success Popup */}
            <Modal
              visible={showSuccessPopup}
              transparent={true}
              animationType="fade"
            >
              <View style={styles.modalOverlay}>
                <View style={styles.popupContainer}>
                  <View style={styles.popupHeader}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={48}
                      color={Colors.status.success}
                    />
                    <Text style={styles.popupTitle}>Success</Text>
                  </View>
                  
                  <View style={styles.popupContent}>
                    <Text style={styles.popupMessage}>
                      Record saved successfully!
                    </Text>
                    <View style={styles.popupDetails}>
                      <Text style={styles.popupDetailText}>
                        <Text style={styles.popupDetailLabel}>Patient ID: </Text>
                        {patientId}
                      </Text>
                      <Text style={styles.popupDetailText}>
                        <Text style={styles.popupDetailLabel}>Diagnosis: </Text>
                        {prediction?.predicted_class}
                      </Text>
                      <Text style={styles.popupDetailText}>
                        <Text style={styles.popupDetailLabel}>Confidence: </Text>
                        {prediction ? `${(prediction.confidence * 100).toFixed(1)}%` : ''}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.popupActions}>
                    <TouchableOpacity
                      style={[styles.popupButton, styles.popupButtonPrimary]}
                      onPress={() => handlePopupAction('history')}
                    >
                      <MaterialCommunityIcons
                        name="history"
                        size={20}
                        color={Colors.background}
                      />
                      <Text style={styles.popupButtonTextPrimary}>View History</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.popupButton, styles.popupButtonSecondary]}
                      onPress={() => handlePopupAction('new')}
                    >
                      <MaterialCommunityIcons
                        name="image-plus"
                        size={20}
                        color={Colors.accent.blue}
                      />
                      <Text style={styles.popupButtonTextSecondary}>New Scan</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.popupButton, styles.popupButtonTertiary]}
                      onPress={() => handlePopupAction('close')}
                    >
                      <Text style={styles.popupButtonTextTertiary}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
          <Footer />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    width: "100%",
    maxWidth: 600,
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text.primary,
    marginBottom: 20,
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 15,
    color: Colors.text.primary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 40,
    maxWidth: 600,
  },
  uploadArea: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.default,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadAreaActive: {
    borderColor: Colors.border.active,
    backgroundColor: Colors.overlay.light,
  },
  uploadAreaDisabled: {
    opacity: 0.6,
    borderColor: Colors.border.default,
  },
  uploadContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  uploadText: {
    color: Colors.text.secondary,
    fontSize: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  browseButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  browseButtonText: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 25,
    marginBottom: 25,
    borderLeftWidth: 8,
    width: "100%",
    maxWidth: 600,
    shadowColor: Colors.background,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.text.primary,
    marginBottom: 20,
    textAlign: "center",
  },
  resultContent: {
    backgroundColor: Colors.surface,
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
    color: Colors.text.primary,
  },
  resultDisclaimer: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 20,
    fontStyle: "italic",
    textAlign: "center",
  },
  resultLabel: {
    fontSize: 18,
    color: Colors.text.primary,
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.overlay.dark,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  loadingText: {
    color: Colors.text.primary,
    marginTop: 12,
    fontSize: 16,
  },
  imagePreviewContainer: {
    width: '100%',
    aspectRatio: 16/9,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border.default,
    overflow: 'hidden',
    padding: 16,
  },
  imagePreview: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  imagePreviewActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  previewButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: Colors.accent.blue,
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    width: '100%',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  inputError: {
    borderColor: Colors.status.error,
    borderWidth: 2,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: 14,
    marginTop: 4,
    marginLeft: 4,
  },
  requiredStar: {
    color: Colors.status.error,
    fontSize: 16,
  },
  processButton: {
    backgroundColor: Colors.accent.green,
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    width: '100%',
  },
  processButtonDisabled: {
    opacity: 0.6,
  },
  processButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  processButtonText: {
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContainer: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  popupHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  popupTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 8,
  },
  popupContent: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  popupMessage: {
    fontSize: 18,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  popupDetails: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
  },
  popupDetailText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 8,
  },
  popupDetailLabel: {
    fontWeight: 'bold',
  },
  popupActions: {
    flexDirection: 'column',
    gap: 12,
  },
  popupButton: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  popupButtonPrimary: {
    backgroundColor: Colors.accent.blue,
  },
  popupButtonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.accent.blue,
  },
  popupButtonTertiary: {
    backgroundColor: 'transparent',
  },
  popupButtonTextPrimary: {
    color: Colors.background,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  popupButtonTextSecondary: {
    color: Colors.accent.blue,
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  popupButtonTextTertiary: {
    color: Colors.text.secondary,
    fontSize: 16,
  },
}); 