import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { formatAwardCounts } from '../lib/wikidataAwards';
import { GOLD_ACCENT } from '../theme/programme';

/**
 * Bottom-sheet content for a title's awards. The rail shows one tile per
 * ceremony; this is where the categories behind each tile live, plus the handoff
 * to IMDb's full awards page for the long tail we don't carry.
 */
export function AwardsSheetContent({ ceremonies, colors, typography, onOpenImdb, onDismiss }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
      {ceremonies.map((ceremony, index) => (
        <View
          key={ceremony.key}
          style={[
            styles.group,
            index < ceremonies.length - 1 && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.outlineVariant + '55',
            },
          ]}
        >
          <View style={styles.groupHeader}>
            <Text
              style={[styles.ceremony, { color: colors.onSurface, ...typography.bodyMd }]}
              numberOfLines={2}
            >
              {ceremony.label}
            </Text>
            <Text style={[styles.counts, { color: GOLD_ACCENT, ...typography.labelSm }]}>
              {formatAwardCounts(ceremony)}
            </Text>
          </View>

          {ceremony.categories.map((category) => (
            <View key={category.id} style={styles.categoryRow}>
              <Ionicons
                name={category.wins > 0 ? 'trophy' : 'ellipse-outline'}
                size={13}
                color={category.wins > 0 ? GOLD_ACCENT : colors.onSurfaceVariant}
                style={styles.categoryIcon}
              />
              <Text
                style={[styles.category, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
              >
                {category.label}
              </Text>
              <Text
                style={[
                  styles.outcome,
                  {
                    color: category.wins > 0 ? GOLD_ACCENT : colors.onSurfaceVariant,
                    ...typography.labelSm,
                  },
                ]}
              >
                {category.wins > 0 ? 'Won' : 'Nominated'}
              </Text>
            </View>
          ))}
        </View>
      ))}

      {onOpenImdb ? (
        <TouchableOpacity
          style={styles.imdbRow}
          onPress={() => {
            onOpenImdb();
            onDismiss();
          }}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="View the full awards list on IMDb"
        >
          <Text style={[styles.imdbText, { color: GOLD_ACCENT, ...typography.bodyMd }]}>
            View full awards on IMDb
          </Text>
          <Ionicons name="open-outline" size={16} color={GOLD_ACCENT} />
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  group: {
    gap: 8,
    paddingVertical: 14,
  },
  groupHeader: {
    gap: 3,
  },
  ceremony: {
    fontWeight: '700',
  },
  counts: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  categoryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  categoryIcon: {
    width: 14,
  },
  category: {
    flex: 1,
    fontWeight: '600',
    minWidth: 0,
  },
  outcome: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  imdbRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingBottom: 8,
    paddingTop: 18,
  },
  imdbText: {
    fontWeight: '700',
  },
});
