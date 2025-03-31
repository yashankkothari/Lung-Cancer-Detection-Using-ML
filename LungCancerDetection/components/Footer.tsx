import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../constants/Colors';

export default function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.purpose}>
        Early detection of lung cancer through AI-powered analysis can significantly improve survival rates by enabling timely intervention and treatment.
      </Text>
      <Text style={styles.disclaimer}>
        This application is for educational purposes only. Always consult with a healthcare professional for medical advice.
      </Text>
      <View style={styles.credits}>
        <Text style={styles.creditHeader}>Developed by:</Text>
        <Text style={styles.creditText}>Yashank Kothari</Text>
        <Text style={styles.creditText}>Peeth Chowdhary</Text>
        <Text style={styles.creditText}>Manas Mapuskar</Text>
        <Text style={styles.creditText}>Nilansh Jain</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  purpose: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 16,
    opacity: 0.95,
  },
  disclaimer: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
    opacity: 0.9,
  },
  credits: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
  },
  creditHeader: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    opacity: 0.9,
    width: '100%',
    textAlign: 'center',
    marginBottom: 8,
  },
  creditText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.8,
  },
}); 