import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export function SettingsView() {
  const { theme, preference, setPreference } = useTheme();
  const { colors, spacing, typography, radii } = theme;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>APPEARANCE</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderRadius: radii.xl }]}>
          <TouchableOpacity 
            style={[styles.row, preference === 'light' && { backgroundColor: colors.surfaceContainerHigh }]} 
            onPress={() => setPreference('light')}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>☀️ Light Mode</Text>
            {preference === 'light' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
          <TouchableOpacity 
            style={[styles.row, preference === 'dark' && { backgroundColor: colors.surfaceContainerHigh }]} 
            onPress={() => setPreference('dark')}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>🌙 Dark Mode</Text>
            {preference === 'dark' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
          <View style={[styles.divider, { backgroundColor: colors.outlineVariant + '26' }]} />
          <TouchableOpacity 
            style={[styles.row, preference === 'system' && { backgroundColor: colors.surfaceContainerHigh }]} 
            onPress={() => setPreference('system')}
          >
            <Text style={[styles.rowText, { color: colors.onSurface, ...typography.bodyLg }]}>🖥️ System Default</Text>
            {preference === 'system' && <Text style={{ color: colors.primary }}>✓</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.version, { color: colors.onSurfaceVariant, ...typography.labelSm }]}>TROVA V2.4.1 (BUILD 882)</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  section: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  card: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  rowText: {
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
    paddingBottom: 60,
  },
  version: {
    fontWeight: '700',
    letterSpacing: 2,
    opacity: 0.5,
  },
});
