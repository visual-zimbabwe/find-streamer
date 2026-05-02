import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export function AppHeader({ onBack, showBack, onSettingsPress }) {
  const { theme } = useTheme();
  const { colors, spacing, typography, radii } = theme;

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.brand}>
        {showBack && (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: colors.surfaceContainer, borderRadius: radii.full }]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        )}
        <View style={[styles.iconPlaceholder, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Ionicons name="film" size={18} color={colors.primary} />
        </View>
        <Text style={[styles.logo, { color: colors.primary, ...typography.headlineMd }]}>Trova</Text>
      </View>
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: 'transparent' }]}
        onPress={onSettingsPress}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
      >
        <Ionicons name="settings-outline" size={24} color={colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    zIndex: 50,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    marginRight: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
