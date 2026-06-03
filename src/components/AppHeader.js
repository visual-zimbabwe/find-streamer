import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import MorphingText from '../lib/expo-morphing-text/components/morphing-text';

const TAGLINES = [
  "What are you watching tonight?",
  "Find your next favorite...",
  "Discover new worlds...",
  "Your streaming companion...",
];

export function AppHeader({ onBack, showBack, transparent, centeredTitleOnly }) {
  const { theme, resolvedMode } = useTheme();
  const { colors, spacing, typography, radii } = theme;
  const [taglineIndex, React_setTaglineIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      React_setTaglineIndex(prev => (prev + 1) % TAGLINES.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[
      styles.header,
      centeredTitleOnly && styles.headerCentered,
      { backgroundColor: transparent ? 'transparent' : colors.background },
    ]}>
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
          <Text
            style={[
              styles.centeredWordmark,
              { color: resolvedMode === 'dark' ? '#fff' : colors.onSurface },
            ]}
            accessibilityRole="header"
          >
            Trova
          </Text>
        )}
        {!showBack && !centeredTitleOnly && (
          <View style={styles.titleContainer}>
            <Text style={[styles.logo, { color: colors.primary, ...typography.headlineMd }]}>Trova</Text>
            <MorphingText
              text={TAGLINES[taglineIndex]}
              fontSize={12}
              color={colors.onSurfaceVariant}
              animationDuration={300}
              fontStyle={{ fontWeight: '500' }}
            />
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
  centeredWordmark: {
    fontFamily: Platform.select({ android: 'serif', ios: 'Georgia', default: 'serif' }),
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
