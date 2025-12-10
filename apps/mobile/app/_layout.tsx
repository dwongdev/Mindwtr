import '../polyfills';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert } from 'react-native';

import { ThemeProvider, useTheme } from '../contexts/theme-context';
import { LanguageProvider, useLanguage } from '../contexts/language-context';
import { setStorageAdapter, useTaskStore } from '@focus-gtd/core';
import { mobileStorage } from '../lib/storage-adapter';
import { ErrorBoundary } from '../components/ErrorBoundary';

// Initialize storage for mobile
let storageInitError: Error | null = null;
try {
  setStorageAdapter(mobileStorage);
} catch (e) {
  storageInitError = e as Error;
  console.error('[Mobile] Failed to initialize storage adapter:', e);
}

function RootLayoutContent() {
  const { colorScheme, isDark } = useTheme();
  const [storageWarningShown, setStorageWarningShown] = useState(false);

  useEffect(() => {
    // Show storage error alert if initialization failed
    if (storageInitError && !storageWarningShown) {
      setStorageWarningShown(true);
      Alert.alert(
        '⚠️ Storage Error',
        'Failed to initialize storage. Your data will NOT be saved. Please restart the app.\n\nError: ' + storageInitError.message,
        [{ text: 'OK' }]
      );
    }

    // Load data from storage
    const loadData = async () => {
      try {
        const store = useTaskStore.getState();
        await store.fetchData();
      } catch (e) {
        console.error('[Mobile] Failed to load data:', e);
        Alert.alert(
          '⚠️ Data Load Error',
          'Failed to load your data. Some tasks may be missing.\n\nError: ' + (e as Error).message,
          [{ text: 'OK' }]
        );
      } finally {
        // Hide splash screen (safe for web)
        if (typeof SplashScreen?.hideAsync === 'function') {
          SplashScreen.hideAsync().catch(console.warn);
        }
      }
    };

    loadData();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
          <Stack.Screen
            name="global-search"
            options={{
              headerShown: false,
              presentation: 'modal',
              animation: 'slide_from_bottom'
            }}
          />
          <Stack.Screen
            name="check-focus"
            options={{
              headerShown: false,
            }}
          />
        </Stack>
        <StatusBar style="auto" />
      </NavigationThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <RootLayoutContent />
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
