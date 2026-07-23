import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MediaArtwork } from './MediaArtwork';
import { GOLD_ACCENT } from '../theme/programme';
import { scale } from '../utils/responsive';

export function initialsForName(name = '') {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return initials || '?';
}

/**
 * Avatar + name + role card used by the Cast and Crew rails.
 *
 * `canPeek` drives a persistent corner badge: long-press is only wired when we
 * have a TMDb id, so the badge is the visible contract for which cards respond
 * to a hold. Without it the gesture is undiscoverable.
 */
export function PersonCard({
  person,
  colors,
  typography,
  accent = false,
  canPeek = false,
  onPress,
  onLongPress,
}) {
  const peekHint = canPeek ? '. Hold for a quick filmography preview' : '';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      onLongPress={canPeek ? onLongPress : undefined}
      delayLongPress={canPeek ? 400 : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${person.name}, ${person.roleLabel}. View filmography${peekHint}`}
      activeOpacity={0.78}
    >
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatarRing,
            !person.profileUrl && {
              backgroundColor: accent ? GOLD_ACCENT + '18' : colors.surfaceContainerHigh,
            },
          ]}
        >
          {person.profileUrl ? (
            <MediaArtwork
              uri={person.profileUrl}
              style={styles.avatar}
              accessibilityLabel={`${person.name} profile photo`}
              title={person.name}
              icon="person-outline"
              compactFallback
              instant
            />
          ) : (
            <Text
              style={[
                styles.avatarInitials,
                { color: accent ? GOLD_ACCENT : colors.onSurface, ...typography.labelSm },
              ]}
            >
              {initialsForName(person.name)}
            </Text>
          )}
        </View>

        {canPeek ? (
          <View
            style={[
              styles.peekBadge,
              { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.background },
            ]}
            pointerEvents="none"
          >
            <Ionicons name="ellipsis-horizontal" size={11} color={GOLD_ACCENT} />
          </View>
        ) : null}
      </View>

      <Text
        style={[styles.name, { color: colors.onSurface, ...typography.bodyMd }]}
        numberOfLines={2}
      >
        {person.name}
      </Text>
      <Text
        style={[styles.role, { color: colors.onSurfaceVariant, ...typography.labelSm }]}
        numberOfLines={2}
      >
        {person.roleLabel}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    width: scale(92),
  },
  avatarWrap: {
    marginBottom: scale(10),
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: scale(38),
    height: scale(76),
    justifyContent: 'center',
    overflow: 'hidden',
    width: scale(76),
  },
  avatar: {
    height: '100%',
    width: '100%',
  },
  avatarInitials: {
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  peekBadge: {
    alignItems: 'center',
    borderRadius: scale(11),
    borderWidth: 1.5,
    bottom: -1,
    height: scale(22),
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: scale(22),
  },
  name: {
    fontWeight: '800',
    minHeight: 40,
    textAlign: 'center',
  },
  role: {
    fontWeight: '700',
    minHeight: 32,
    textAlign: 'center',
  },
});
