import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';

export default function ReportIndex() {
  useEffect(() => {
    // Redirect to the report editor
    router.replace('/report-editor');
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1a73e8" />
      <Text style={styles.text}>Loading report editor...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#141e30',
  },
  text: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
}); 