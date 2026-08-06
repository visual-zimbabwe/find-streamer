import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

const TAGLINE = 'What are you watching tonight?';

export function AppHeader({ onBack, showBack, transparent, centeredTitleOnly }) {
  const { theme } = useTheme();
  const { colors, typography } = theme;

  return (
    <View
      style={[
        styles.header,
        centeredTitleOnly && styles.headerCentered,
        { backgroundColor: transparent ? 'transparent' : colors.background },
      ]}
    >
      <View style={[styles.brand, centeredTitleOnly && styles.brandCentered]}>
        {showBack && (
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </TouchableOpacity>
        )}
        {!showBack && centeredTitleOnly && (
          <Text style={[styles.centeredWordmark, { color: '#fff' }]} accessibilityRole="header">
            Trova
          </Text>
        )}
        {!showBack && !centeredTitleOnly && (
          <View style={styles.titleContainer}>
            <Text style={[styles.logo, { color: colors.primary, ...typography.headlineMd }]}>
              Trova
            </Text>
            <Text style={[styles.tagline, { color: colors.onSurfaceVariant }]}>{TAGLINE}</Text>
          </View>
        )}
      </View>
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
  headerCentered: {
    justifyContent: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandCentered: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    marginRight: 8,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
  },
  logo: {
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '500',
  },
  centeredWordmark: {
    fontFamily: fonts.wordmark,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    fontStyle: 'italic',
    letterSpacing: 0,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
