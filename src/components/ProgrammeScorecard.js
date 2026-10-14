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
              style={[styles.item, index === 0 && styles.firstItem]}
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
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  firstItem: {
    paddingLeft: 0,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  label: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
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
