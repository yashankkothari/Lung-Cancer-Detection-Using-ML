import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';

// Configure axios defaults
const api = axios.create({
  baseURL: 'http://localhost:5000',  // Use localhost for web browsers
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Change to false since we're using token-based auth
  timeout: 10000, // 10 seconds timeout
});

// Add request interceptor to handle CORS and authentication
api.interceptors.request.use(
  async (config) => {
    console.log('Making request to:', config.url);
    console.log('Request data:', config.data);
    
    // Get token from AsyncStorage
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor to handle CORS
api.interceptors.response.use(
  (response) => {
    console.log('Received response:', response.data);
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Error response:', error.response.data);
      console.error('Status code:', error.response.status);
      return Promise.reject(error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
      if (error.code === 'ECONNREFUSED') {
        return Promise.reject(new Error('Server is not running. Please start the server and try again.'));
      }
      return Promise.reject(new Error('No response from server. Please check if the server is running.'));
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      return Promise.reject(error);
    }
  }
);

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      if (storedToken) {
        // Set token in axios defaults
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        // Verify token with backend
        const response = await api.get('/api/verify');
        console.log('Token verification response:', response.data);
        
        setToken(storedToken);
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      // Clear invalid token
      await AsyncStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with:', { email });
      console.log('Attempting login...');
      const response = await api.post('/api/login', {
        email,
        password,
      });
      
      console.log('Login response:', response.data);
      const { token, user } = response.data;
      
      // Store token in AsyncStorage
      await AsyncStorage.setItem('token', token);
      
      // Set token in axios defaults
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update state
      setToken(token);
      setUser(user);
      
      // Navigate to home screen
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response) {
        throw new Error(error.response.data.message || 'Login failed');
      } else if (error.request) {
        throw new Error('No response from server. Please check if the server is running.');
      } else {
        throw new Error('Login failed. Please try again.');
      }
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      console.log('Attempting signup with:', { name, email });
      
      const response = await api.post('/api/signup', {
        name,
        email,
        password,
      });
      
      console.log('Signup response:', response.data);
      
      if (response.status === 201) {
        // After successful signup, automatically log the user in
        await login(email, password);
      } else {
        throw new Error(response.data.message || 'Signup failed');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Error response:', error.response.data);
        throw new Error(error.response.data.message || 'Signup failed');
      } else if (error.request) {
        // The request was made but no response was received
        console.error('No response received:', error.request);
        throw new Error('No response from server. Please check if the server is running.');
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error setting up request:', error.message);
        throw new Error('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      setToken(null);
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Failed to logout');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Add default export
export default AuthProvider; 