import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function BottomNav() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.glass, paddingBottom: insets.bottom + 8, borderTopColor: colors.outlineVariant + '26' }]}>
      <TouchableOpacity style={[styles.navItem, { backgroundColor: colors.surfaceContainer, borderRadius: 12 }]}>
        <Text style={{ color: colors.primary, fontSize: 24 }}>🔍</Text>
        <Text style={[styles.navLabel, { color: colors.primary, ...typography.labelSm }]}>Search</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.navItem}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 24 }}>🔖</Text>
        <Text style={[styles.navLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Watchlist</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.navItem}>
        <Text style={{ color: colors.onSurfaceVariant, fontSize: 24 }}>👤</Text>
        <Text style={[styles.navLabel, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    zIndex: 100,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  navLabel: {
    fontWeight: '600',
    marginTop: 4,
  },
});
