import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image } from 'react-native';
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
  const uri = Image.resolveAssetSource(source).uri;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <WebView
        originWhitelist={['*']}
        source={{ uri: `${uri}?mode=${resolvedMode}` }}
        style={{ flex: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
      />
    </SafeAreaView>
  );
}
