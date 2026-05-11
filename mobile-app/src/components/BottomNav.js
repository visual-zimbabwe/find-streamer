import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeProvider';

export function BottomNav({ activeTab, onTabPress }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background + 'cc', paddingTop: 10, paddingBottom: insets.bottom + 8, borderTopColor: colors.outlineVariant + '26' }]}>
      <TouchableOpacity 
        style={[styles.navItem, activeTab === 'search' && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTabPress('search'); }}
        accessibilityRole="tab"
        accessibilityLabel="Search"
        accessibilityState={{ selected: activeTab === 'search' }}
      >
        <Ionicons 
          name={activeTab === 'search' ? "search" : "search-outline"} 
          size={24} 
          color={activeTab === 'search' ? colors.primary : colors.onSurfaceVariant} 
        />
        <Text style={[styles.navLabel, { color: activeTab === 'search' ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>Search</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.navItem, activeTab === 'discover' && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTabPress('discover'); }}
        accessibilityRole="tab"
        accessibilityLabel="Discover"
        accessibilityState={{ selected: activeTab === 'discover' }}
      >
        <Ionicons 
          name={activeTab === 'discover' ? "options" : "options-outline"} 
          size={24} 
          color={activeTab === 'discover' ? colors.primary : colors.onSurfaceVariant} 
        />
        <Text style={[styles.navLabel, { color: activeTab === 'discover' ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>Discover</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, activeTab === 'watchlist' && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onTabPress('watchlist'); }}
        accessibilityRole="tab"
        accessibilityLabel="Watchlist"
        accessibilityState={{ selected: activeTab === 'watchlist' }}
      >
        <Ionicons 
          name={activeTab === 'watchlist' ? "bookmark" : "bookmark-outline"} 
          size={24} 
          color={activeTab === 'watchlist' ? colors.primary : colors.onSurfaceVariant} 
        />
        <Text style={[styles.navLabel, { color: activeTab === 'watchlist' ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>Watchlist</Text>
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    minHeight: 56,
    minWidth: 92,
  },
  navLabel: {
    fontWeight: '600',
    marginTop: 4,
  },
});
