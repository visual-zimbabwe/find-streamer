import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme/ThemeProvider';
import { HomeStack } from './HomeStack';
import { SearchStack } from './SearchStack';
import { DiscoverStack } from './DiscoverStack';
import { SettingsStack } from './SettingsStack';

const Tab = createBottomTabNavigator();

export function RootTabs() {
  const { theme } = useTheme();
  const tabScreenOptions = useMemo(
    () => ({
      headerShown: false,
      lazy: false,
      sceneStyle: { backgroundColor: theme.colors.background },
    }),
    [theme.colors.background],
  );

  return (
    <Tab.Navigator tabBar={() => null} screenOptions={tabScreenOptions}>
      <Tab.Screen name="home" component={HomeStack} />
      <Tab.Screen name="search" component={SearchStack} />
      <Tab.Screen name="discover" component={DiscoverStack} />
      <Tab.Screen name="settings" component={SettingsStack} />
    </Tab.Navigator>
  );
}
