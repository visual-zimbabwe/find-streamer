import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export function BottomNav({ activeTab, onTabPress }) {
  const { theme } = useTheme();
  const { colors, typography, radii } = theme;
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.background + 'cc', paddingBottom: insets.bottom + 8, borderTopColor: colors.outlineVariant + '26' }]}>
      <TouchableOpacity 
        style={[styles.navItem, activeTab === 'search' && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}
        onPress={() => onTabPress('search')}
      >
        <Ionicons 
          name={activeTab === 'search' ? "search" : "search-outline"} 
          size={24} 
          color={activeTab === 'search' ? colors.primary : colors.onSurfaceVariant} 
        />
        <Text style={[styles.navLabel, { color: activeTab === 'search' ? colors.primary : colors.onSurfaceVariant, ...typography.labelSm }]}>Search</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.navItem, activeTab === 'watchlist' && { backgroundColor: colors.surfaceContainer, borderRadius: radii.md }]}
        onPress={() => onTabPress('watchlist')}
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
    height: 80,
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
  },
  navLabel: {
    fontWeight: '600',
    marginTop: 4,
  },
});
