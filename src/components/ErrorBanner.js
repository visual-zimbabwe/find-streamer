import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';

export function ErrorBanner({
  message,
  title,
  icon = 'wifi-outline',
  actionLabel,
  onPress,
  onDismiss,
  placement = 'bottom',
}) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  if (!message) return null;

  const containerStyle =
    placement === 'top'
      ? [styles.container, styles.top, { top: insets.top + 8 }]
      : [styles.container, styles.bottom, { bottom: insets.bottom + 88 }];

  const content = (
    <View
      style={[
        styles.banner,
        {
          backgroundColor: colors.surfaceContainerHighest,
          borderColor: colors.outlineVariant + '55',
          borderRadius: radii.lg,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.primary + '22' }]}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.copy}>
        {title ? (
          <Text
            style={[styles.title, { color: colors.onSurface, ...typography.labelSm }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        <Text
          style={[styles.message, { color: colors.onSurfaceVariant, ...typography.bodyMd }]}
          numberOfLines={2}
        >
          {message}
        </Text>
      </View>
      {actionLabel && (
        <Text style={[styles.action, { color: colors.primary, ...typography.labelSm }]}>
          {actionLabel}
        </Text>
      )}
      {onDismiss && (
        <TouchableOpacity
          style={styles.dismiss}
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
        >
          <Ionicons name="close" size={18} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View pointerEvents="box-none" style={containerStyle}>
      {onPress ? (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ? `${message} ${actionLabel}` : message}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    left: 16,
    position: 'absolute',
    right: 16,
    zIndex: 40,
  },
  top: {},
  bottom: {},
  banner: {
    alignItems: 'center',
    borderWidth: 1,
    elevation: 8,
    flexDirection: 'row',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  message: {
    lineHeight: 18,
  },
  action: {
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  dismiss: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
