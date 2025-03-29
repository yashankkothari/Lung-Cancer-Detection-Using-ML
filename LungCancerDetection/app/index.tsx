import React from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStats } from '../hooks/useStats';

interface StatCardProps {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend }) => (
  <View style={styles.statCard}>
    <View style={styles.statHeader}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      {trend && (
        <View style={[styles.trendContainer, { backgroundColor: trend.isPositive ? '#1a8754' : '#dc3545' }]}>
          <Ionicons 
            name={trend.isPositive ? 'arrow-up-outline' : 'arrow-down-outline'} 
            size={12} 
            color="#fff" 
          />
          <Text style={styles.trendText}>{trend.value}%</Text>
        </View>
      )}
    </View>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

export default function Home() {
  const router = useRouter();
  const { stats, loading, error } = useStats();

  const handleNewScan = () => {
    router.push('/scan');
  };

  const handleViewHistory = () => {
    router.push('/history');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="warning-outline" size={48} color="#dc3545" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => router.reload()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.welcomeText}>Welcome Back!</Text>
        <Text style={styles.subtitle}>Here's your dashboard overview</Text>

        <View style={styles.statsGrid}>
          <StatCard
            title="Total Scans"
            value={String(stats?.total_scans.value || '0')}
            icon="scan-outline"
            trend={stats?.total_scans.trend}
          />
          <StatCard
            title="Detected Cases"
            value={String(stats?.detected_cases.value || '0')}
            icon="medical-outline"
            trend={stats?.detected_cases.trend}
          />
          <StatCard
            title="Success Rate"
            value={String(stats?.success_rate.value || '0')}
            icon="checkmark-circle-outline"
          />
          <StatCard
            title="Active Patients"
            value={String(stats?.active_patients.value || '0')}
            icon="people-outline"
            trend={stats?.active_patients.trend}
          />
        </View>

        <View style={styles.actionCards}>
          <TouchableOpacity onPress={handleNewScan} style={styles.actionCard}>
            <LinearGradient
              colors={['#6366f1', '#4f46e5']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="add-circle-outline" size={32} color="#fff" />
              <Text style={styles.actionTitle}>New Scan</Text>
              <Text style={styles.actionSubtitle}>Upload CT scan images</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleViewHistory} style={styles.actionCard}>
            <LinearGradient
              colors={['#3b82f6', '#2563eb']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="time-outline" size={32} color="#fff" />
              <Text style={styles.actionTitle}>View History</Text>
              <Text style={styles.actionSubtitle}>Check past scan results</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>Quick Tips</Text>
          <Text style={styles.tipText}>• Ensure CT scans are in DICOM or PNG format</Text>
          <Text style={styles.tipText}>• Keep patient information up to date</Text>
          <Text style={styles.tipText}>• Review scan history periodically</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 120 : 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    color: '#dc3545',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: (Dimensions.get('window').width - 48) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trendText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 14,
    color: '#64748b',
  },
  actionCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  actionCard: {
    width: (Dimensions.get('window').width - 48) / 2,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
  },
  tipsContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
}); 