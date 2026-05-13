import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

const TABS = [
  { id: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
  { id: 'search', label: 'Search', icon: 'search-outline', iconActive: 'search' },
  { id: 'discover', label: 'Discover', icon: 'options-outline', iconActive: 'options' },
  { id: 'watchlist', label: 'Watchlist', icon: 'bookmark-outline', iconActive: 'bookmark' },
];

export function BottomNav({ activeTab, onTabPress }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background + 'cc',
          paddingTop: 10,
          paddingBottom: insets.bottom + 8,
          borderTopColor: colors.outlineVariant + '26',
        },
      ]}
    >
      {TABS.map((tab) => {
        const selected = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.navItem,
              selected && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md },
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onTabPress(tab.id);
            }}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
          >
            <Ionicons
              name={selected ? tab.iconActive : tab.icon}
              size={24}
              color={selected ? colors.primary : colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.navLabel,
                {
                  color: selected ? colors.primary : colors.onSurfaceVariant,
                  ...typography.labelSm,
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
    borderTopWidth: 1,
    zIndex: 100,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 56,
    minWidth: 72,
    flex: 1,
    maxWidth: 104,
  },
  navLabel: {
    fontWeight: '600',
    marginTop: 4,
  },
});
