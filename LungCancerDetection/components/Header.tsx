import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function Header() {
  const router = useRouter();
  const animatedValue = new Animated.Value(0);

  useEffect(() => {
    const animate = () => {
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        })
      ]).start(() => animate());
    };

    animate();
  }, []);

  const gradientColors = animatedValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#1a1a1a', '#2a2a2a', '#1a1a1a']
  });

  const handleLogoPress = () => {
    router.push('/');
  };

  const handleHistoryPress = () => {
    router.push('/history');
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: gradientColors }]}>
      <TouchableOpacity onPress={handleLogoPress} style={styles.logoContainer}>
        <Ionicons name="medical" size={24} color="#6366f1" />
        <Text style={styles.logoText}>OncoLytix</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleHistoryPress} style={styles.iconButton}>
        <Ionicons name="person-circle-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
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
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); 