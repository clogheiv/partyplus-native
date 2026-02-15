import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

const prefix = Linking.createURL('/');

export const linking = {
  prefixes: [prefix, 'partyplusnative://', 'partyplus://', 'https://partyplus-invite.netlify.app'],
  config: {
    screens: {
      __share: '__share',
      'party/[id]': 'party/:id',
      share: 'share',
      '(tabs)': '',
      '(tabs)/create-party': 'create-party',
      '(tabs)/explore': 'explore',
    },
  },
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = async () => {
      const url = await Linking.getInitialURL();
      if (url != null) {
        // Deep link launched the app; route accordingly
        Linking.addEventListener('url', handleUrl);
      }
    };

    const handleUrl = ({ url }: { url: string }) => {
      const parsed = Linking.parse(url);
      const path = parsed.path ?? '';
      const queryParams = (parsed.queryParams ?? {}) as Record<string, any>;

      if (path === 'party/:id' || path.startsWith('party/')) {
        const id = queryParams.id ?? path.split('/')[1];
        if (id) {
          router.push(`/party/${id}`);
        }
      } else if (path === '__share') {
        router.push('/__share');
      }
    };

    handleDeepLink();

    const sub = Linking.addEventListener('url', handleUrl);

    return () => {
      sub.remove();
    };
  }, [router]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
