import React, { memo } from 'react';
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { buildScorecardItems } from '../lib/programmeScorecardModel';

/**
 * ProgrammeScorecard
 *
 * Monochromatic, high-discipline multi-source rating scorecard for Trova's
 * Programme Detail view. Unifies disparate third-party rating services (TMDb,
 * IMDb, Rotten Tomatoes, Metacritic) into a single horizontal surface pill with
 * subtle vertical dividers and clean typography, eliminating clashing brand colors
 * while preserving multi-source depth and deep linking.
 */
export const ProgrammeScorecard = memo(function ProgrammeScorecard({
  tmdbRating,
  tmdbUrl,
  imdbRating,
  imdbUrl,
  rottenTomatoes,
  rottenTomatoesUrl,
  metascore,
  metacriticUrl,
  title,
  style,
}) {
  const items = buildScorecardItems({
    tmdbRating,
    tmdbUrl,
    imdbRating,
    imdbUrl,
    rottenTomatoes,
    rottenTomatoesUrl,
    metascore,
    metacriticUrl,
    title,
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      {items.map((item, index) => {
        const handlePress = () => {
          if (!item.url) return;
          try {
            Haptics.selectionAsync();
          } catch {
            // Non-critical if unsupported
          }
          Linking.openURL(item.url).catch(() => {});
        };

        return (
          <React.Fragment key={item.key}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              onPress={handlePress}
              disabled={!item.url}
              activeOpacity={0.72}
              style={styles.item}
              accessibilityRole="button"
              accessibilityLabel={item.a11yLabel}
            >
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.value}>{item.value}</Text>
            </TouchableOpacity>
          </React.Fragment>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    borderRadius: 8,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  value: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
