import { QueryClientProvider } from '@tanstack/react-query';
import { Slot, usePathname, useRouter, useSegments } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FeedbackProvider } from '@/components/feedback';
import { isCockpitRoot } from '@/components/shell';
import { useLayout } from '@/design/layout';
import { AuthProvider, useAuth } from '@/state/auth';
import { createQueryClient } from '@/state/query';
import { ThemeProvider, useTheme } from '@/state/theme';

export default function RootLayout() {
  const [client] = useState(createQueryClient);

  return (
    <SafeAreaProvider>
      <Head>
        <title>sidehustle</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <AuthProvider>
            <FeedbackProvider>
              <ThemedTree />
            </FeedbackProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

function ThemedTree() {
  const { scheme, color } = useTheme();
  const pathname = usePathname();
  const phone = useLayout().phone;
  const immersive = phone && isCockpitRoot(pathname);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      return;
    }

    document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover');
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: color.paper }}>
      <StatusBar style={immersive || scheme === 'dark' ? 'light' : 'dark'} />
      <Gate />
    </View>
  );
}

function Splash() {
  const { color } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: color.paper, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={color.ink} />
    </View>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onAuthScreen = segments[0] === 'login' || segments[0] === 'register';
  const redirecting = !loading && ((user && onAuthScreen) || (!user && !onAuthScreen));

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user && !onAuthScreen) {
      router.replace('/login');
    }

    if (user && onAuthScreen) {
      router.replace('/');
    }
  }, [loading, user, onAuthScreen, router]);

  if (loading || redirecting) {
    return <Splash />;
  }

  return <Slot />;
}
