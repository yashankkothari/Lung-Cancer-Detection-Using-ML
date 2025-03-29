import * as React from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function Home() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={['#1a237e', '#0d47a1', '#1565c0']}
        style={styles.gradient}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Lung Cancer Detection</Text>
              <Text style={styles.subtitle}>AI-Powered Early Detection System</Text>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.cardTitle}>About Lung Cancer</Text>
              <Text style={styles.cardText}>
                Lung cancer is one of the most common types of cancer worldwide. Early detection is crucial for successful treatment and improved survival rates. Our AI-powered system helps in the early identification of potential lung cancer cases through CT scan analysis.
              </Text>
            </View>

            <View style={styles.warningCard}>
              <Text style={styles.cardTitle}>Warning Signs</Text>
              <Text style={styles.cardText}>
                • Persistent cough{'\n'}
                • Shortness of breath{'\n'}
                • Chest pain{'\n'}
                • Unexplained weight loss{'\n'}
                • Coughing up blood
              </Text>
            </View>

            <View style={styles.riskCard}>
              <Text style={styles.cardTitle}>Risk Factors</Text>
              <Text style={styles.cardText}>
                • Smoking{'\n'}
                • Secondhand smoke exposure{'\n'}
                • Radon gas exposure{'\n'}
                • Family history of lung cancer{'\n'}
                • Occupational exposure to carcinogens
              </Text>
            </View>

            <View style={styles.preventionCard}>
              <Text style={styles.cardTitle}>Prevention Tips</Text>
              <Text style={styles.cardText}>
                • Don't smoke{'\n'}
                • Avoid secondhand smoke{'\n'}
                • Test your home for radon{'\n'}
                • Protect yourself from workplace carcinogens{'\n'}
                • Maintain a healthy diet and exercise regularly
              </Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push("/scan")}
              >
                <Text style={styles.buttonText}>Scan CT Image</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.button}
                onPress={() => router.push("/history")}
              >
                <Text style={styles.buttonText}>View Patient History</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.disclaimer}>
                This application is for educational purposes only and should not replace professional medical advice.
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
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 18,
    color: "#E0E0E0",
    textAlign: "center",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  warningCard: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.3)",
  },
  riskCard: {
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.3)",
  },
  preventionCard: {
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.3)",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 15,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  cardText: {
    fontSize: 16,
    color: "#FFFFFF",
    lineHeight: 24,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 15,
    padding: 20,
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  footer: {
    marginTop: 20,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    borderRadius: 15,
  },
  disclaimer: {
    fontSize: 14,
    color: "#E0E0E0",
    textAlign: "center",
    fontStyle: "italic",
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}); 