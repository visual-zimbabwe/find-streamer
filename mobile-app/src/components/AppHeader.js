import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function AppHeader({ onBack, showBack }) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      <View style={styles.brand}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={{ color: colors.onSurfaceVariant, fontSize: 24 }}>←</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.iconPlaceholder, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Text style={{ color: colors.primary, fontSize: 18 }}>🎬</Text>
        </View>
        <Text style={[styles.logo, { color: colors.primary, ...typography.headlineMd }]}>Trova</Text>
      </View>
      <TouchableOpacity style={[styles.button, { backgroundColor: 'transparent' }]}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 24 }}>⚙️</Text>
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
    width: 40,
    height: 40,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
