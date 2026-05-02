import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export function StatePanel({ type, title, description, onRetry }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;

  const panels = {
    loading: { icon: 'sync-outline', color: colors.primary },
    error: { icon: 'alert-circle-outline', color: colors.error },
    empty: { icon: 'folder-open-outline', color: colors.onSurfaceVariant },
    welcome: { icon: 'sparkles-outline', color: colors.primary }
  };
  
  const config = panels[type] || panels.empty;

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: config.color + '15' }]}>
        <Ionicons name={config.icon} size={48} color={config.color} />
      </View>
      <Text style={[styles.title, { color: colors.onSurface, ...typography.headlineMd }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.onSurfaceVariant, ...typography.bodyLg }]}>
        {description}
      </Text>
      
      {onRetry && (
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary, borderRadius: radii.full }]}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={[styles.buttonText, { color: colors.onPrimary, ...typography.labelLg }]}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  buttonText: {
    fontWeight: '700',
  },
});
