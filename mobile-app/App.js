import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useTheme, ThemeProvider } from './src/theme/ThemeProvider'; // Keep ThemeProvider if still used elsewhere

export default function App() {
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <MobileApp />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

function MobileApp() {
  const { theme, resolvedMode, ready } = useTheme();

  // Load the main search HTML file
  const source = require('./Trova/main_search/code.html');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style="light" />
      <WebView
        originWhitelist={['*']}
        source={source}
        style={{ flex: 1 }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </SafeAreaView>
  );
}
