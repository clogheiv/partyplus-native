import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, router, usePathname, useRootNavigationState, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { routeFromUrl } from '@/src/lib/deepLinkRouting';
import { StartupDeepLinkContext } from '@/src/lib/startupDeepLinkContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

const prefix = Linking.createURL('/');
const PARTYPLUS_NAV_THEME = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#2f61f3',
    background: '#08111f',
    card: '#08111f',
    text: '#f6efe7',
    border: '#243554',
    notification: '#ff9f87',
  },
};

export const linking = {
  prefixes: [prefix, 'partyplusnative://'],
  config: {
    screens: {
      'i/[id]': 'i/:id',
      'party/[id]': 'party/:id',
      '(tabs)': '',
      '(tabs)/create-party': 'create-party',
      '(tabs)/explore': 'explore',
    },
  },
};

function getFirstParam(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : undefined;
  }
  return undefined;
}

function getRouteLabel(route: Href | null) {
  if (!route) return null;
  if (typeof route === 'string') return route;

  if (route.pathname === '/party/[id]') {
    const id = getFirstParam(route.params?.id);
    return id ? `/party/${id}` : route.pathname;
  }

  return route.pathname;
}

function routeToDebugString(route: Href | null) {
  if (!route) return null;
  if (typeof route === 'string') return route;
  try {
    return JSON.stringify(route);
  } catch {
    return route.pathname;
  }
}

export default function RootLayout() {
  const pathname = usePathname();
  const rootNavState = useRootNavigationState();
  const didInitialReplaceRef = useRef(false);
  const [initialLinkResolved, setInitialLinkResolved] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<Href | null>(null);
  const [startupRoutePending, setStartupRoutePending] = useState(false);
  const [startupTargetPath, setStartupTargetPath] = useState<string | null>(null);

  // Capture initial URL + runtime deep links (NO navigation here)
  useEffect(() => {
    let sub: { remove: () => void } | undefined;

    const captureInitial = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        console.log("[deep-link] initialUrl", initialUrl);
        if (initialUrl) {
          const r = routeFromUrl(initialUrl);
          console.log("[deep-link] initialRoute", routeToDebugString(r));
          if (r) {
            const routeLabel = getRouteLabel(r);
            setPendingRoute(r);
            setStartupRoutePending(true);
            setStartupTargetPath(routeLabel);
          }
        }
      } finally {
        setInitialLinkResolved(true);
      }
    };

    const captureIncoming = (e: { url: string }) => {
      console.log("[deep-link] incomingUrl", e.url);
      const r = routeFromUrl(e.url);
      console.log("[deep-link] incomingRoute", routeToDebugString(r));
      if (r) {
        const routeLabel = getRouteLabel(r);
        didInitialReplaceRef.current = false;
        setPendingRoute(r);
        setStartupRoutePending(true);
        setStartupTargetPath(routeLabel);
      }
    };

    captureInitial();
    sub = Linking.addEventListener('url', captureIncoming);

    return () => sub?.remove?.();
  }, []);

  // Navigate only after root navigator is mounted
  useEffect(() => {
    if (!initialLinkResolved) return;
    if (!rootNavState?.key) return; // navigator not ready
    if (!pendingRoute) return;
    if (didInitialReplaceRef.current) return;

    didInitialReplaceRef.current = true;
    const target = pendingRoute;
    console.log("[deep-link] navigatingTo", routeToDebugString(target));

    router.replace(target as any);
  }, [initialLinkResolved, pendingRoute, rootNavState?.key]);

  useEffect(() => {
    if (!startupRoutePending || !startupTargetPath) return;
    if (pathname !== startupTargetPath) return;

    setStartupRoutePending(false);
    setStartupTargetPath(null);
    setPendingRoute(null);
  }, [pathname, startupRoutePending, startupTargetPath]);

  if (!initialLinkResolved) {
    return (
      <StartupDeepLinkContext.Provider value={{ initialLinkResolved, startupRoutePending }}>
        <ThemeProvider value={PARTYPLUS_NAV_THEME}>
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              backgroundColor: '#08111f',
            }}
          >
            <ActivityIndicator />
          </View>
          <StatusBar style="light" />
        </ThemeProvider>
      </StartupDeepLinkContext.Provider>
    );
  }

  // IMPORTANT: Stack renders on first render (no conditional early returns)
  return (
    <StartupDeepLinkContext.Provider value={{ initialLinkResolved, startupRoutePending }}>
      <ThemeProvider value={PARTYPLUS_NAV_THEME}>
        <View style={{ flex: 1, backgroundColor: '#08111f' }}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#08111f' },
              headerTintColor: '#f6efe7',
              headerTitleStyle: { color: '#f6efe7', fontWeight: '700' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: '#08111f' },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="share" options={{ title: 'Share Invite' }} />
            <Stack.Screen name="load-parties" options={{ title: 'Parties' }} />
            <Stack.Screen name="pick-action" options={{ title: 'Choose Action' }} />
            <Stack.Screen name="i/[id]" options={{ title: 'Invite' }} />
            <Stack.Screen name="__share" options={{ title: 'Invite' }} />
            <Stack.Screen name="party/[id]" options={{ title: 'Party' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          {startupRoutePending ? (
            <View
              style={{
                ...StyleSheet.absoluteFillObject,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
                backgroundColor: '#08111f',
              }}
            >
              <ActivityIndicator />
            </View>
          ) : null}
        </View>
        <StatusBar style="light" />
      </ThemeProvider>
    </StartupDeepLinkContext.Provider>
  );
}
