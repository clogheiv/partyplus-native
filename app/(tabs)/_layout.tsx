import { router, Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        sceneStyle: {
          backgroundColor: '#08111f',
        },
        tabBarStyle: {
          backgroundColor: '#08111f',
          borderTopColor: '#243554',
        },
        tabBarActiveTintColor: '#f6efe7',
        tabBarInactiveTintColor: '#8ea4c5',
        tabBarLabelStyle: {
          fontWeight: '700',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-party"
        listeners={{
          tabPress: () => {
            router.replace("/create-party");
          },
        }}
        options={{
          title: 'Create Party',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="plus.circle.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="share"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
