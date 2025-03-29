import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Header() {
  const router = useRouter();
  const [patientId, setPatientId] = useState('');

  const handleSearch = () => {
    if (patientId.trim()) {
      router.push({
        pathname: '/history',
        params: { id: patientId.trim() }
      });
    }
  };

  const handleLogoPress = () => {
    router.push('/');
  };

  const handleHistoryPress = () => {
    router.push('/history');
  };

  return (
    <LinearGradient
      colors={['#1e293b', '#0f172a']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <TouchableOpacity onPress={handleLogoPress} style={styles.logoContainer}>
        <Ionicons name="medical" size={24} color="#6366f1" />
        <Text style={styles.logoText}>OncoLytix</Text>
      </TouchableOpacity>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.input}
          placeholder="Enter Patient ID"
          placeholderTextColor="#64748b"
          value={patientId}
          onChangeText={setPatientId}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={handleHistoryPress} style={styles.iconButton}>
        <Ionicons name="person-circle-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 32,
    paddingBottom: 16,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    backgroundColor: '#ffffff15',
    borderRadius: 8,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    height: 40,
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#6366f1',
    height: 40,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 