import * as React from "react";
import { Stack, useRouter, usePathname } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Create an authentication context
type AuthContextType = {
  isAuthenticated: boolean;
  doctorProfile: any;
  signIn: (token: string, profile: any) => void;
  signOut: () => void;
};

export const AuthContext = React.createContext<AuthContextType>({
  isAuthenticated: false,
  doctorProfile: null,
  signIn: () => {},
  signOut: () => {},
});

function CustomHeader() {
  const [patientId, setPatientId] = useState('');

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.logo}>LungCare</Text>
      </View>
      <View style={styles.headerCenter}>
        <TextInput
          style={styles.patientInput}
          placeholder="Enter Patient ID"
          placeholderTextColor={Colors.text.secondary}
          value={patientId}
          onChangeText={setPatientId}
        />
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="notifications-outline" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="person-circle-outline" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    // Add any custom fonts here if needed
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const router = useRouter();
  const pathname = usePathname();

  // Check for existing auth token
  useEffect(() => {
    async function loadAuthState() {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const profileJson = await AsyncStorage.getItem('doctorProfile');
        
        if (token && profileJson) {
          const profile = JSON.parse(profileJson);
          setIsAuthenticated(true);
          setDoctorProfile(profile);
        }
      } catch (error) {
        console.error('Failed to load auth state', error);
      } finally {
        setIsAuthReady(true);
      }
    }

    loadAuthState();
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (isAuthReady && !isAuthenticated) {
      // These paths don't require authentication
      const publicPaths = ['/', '/login', '/signup'];
      
      if (!publicPaths.includes(pathname)) {
        router.replace('/login');
      }
    }
  }, [isAuthReady, isAuthenticated, pathname, router]);

  // Auth context functions
  const signIn = async (token: string, profile: any) => {
    try {
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('doctorProfile', JSON.stringify(profile));
      setIsAuthenticated(true);
      setDoctorProfile(profile);
    } catch (error) {
      console.error('Failed to save auth data', error);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('doctorProfile');
      setIsAuthenticated(false);
      setDoctorProfile(null);
      router.replace('/login');
    } catch (error) {
      console.error('Failed to sign out', error);
    }
  };

  React.useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded || !isAuthReady) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, doctorProfile, signIn, signOut }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          header: () => <Header />,
          headerTransparent: true,
          contentStyle: {
            backgroundColor: '#f8fafc',
          },
        }}
      >
        <Stack.Screen
          name="index"
          options={{
            title: "Home",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="login"
          options={{
            title: "Login",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            title: "Sign Up",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="scan"
          options={{
            title: "Scan CT Image",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="history"
          options={{
            title: "Patient History",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="patients"
          options={{
            title: "Patients",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="add-patient"
          options={{
            title: "Add Patient",
            headerShown: true,
          }}
        />
      </Stack>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  headerLeft: {
    flex: 1,
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 15,
  },
  logo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  patientInput: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
    color: Colors.text.primary,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  headerButton: {
    padding: 8,
  },
});
