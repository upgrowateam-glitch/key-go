import React from 'react';
import { ColorValue, Text, View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, CalendarCheck, Car, Home, User } from 'lucide-react-native';
import { boxShadow, useThemeColors } from '../../theme';
import { KeyGoHeader } from '../../components/ui/KeyGoHeader';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../services/auth';

/** Tab label with the KeyGo gold marker under the active tab. */
function TabLabel({ focused, color, children }: { focused: boolean; color: ColorValue; children: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 10, fontWeight: focused ? '800' : '600', letterSpacing: 0.2 }} numberOfLines={1}>
        {children}
      </Text>
      <View style={{ width: 22, height: 3, borderRadius: 2, marginTop: 3, backgroundColor: focused ? colors.highlight : 'transparent' }} />
    </View>
  );
}

export default function TabLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { customerId } = useAuth();
  const { notifications } = useApp();

  if (!customerId) return <Redirect href={'/login' as any} />;

  const unread = notifications.filter((n) => n.unread && n.customerId === customerId).length;

  return (
    <Tabs
      screenOptions={{
        header: () => <KeyGoHeader />,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderRadius: 24,
          marginHorizontal: 10,
          marginTop: 6,
          marginBottom: Math.max(insets.bottom, 10),
          height: 66,
          paddingTop: 6,
          paddingBottom: 4,
          elevation: 6,
          ...boxShadow(colors.shadow, { y: 3, blur: 12, opacity: 0.12 }),
        },
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabel: ({ focused, color, children }) => (
          <TabLabel focused={focused} color={color}>
            {children}
          </TabLabel>
        ),
        sceneStyle: { backgroundColor: colors.bg },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color, size }) => <Home size={size || 20} color={color} /> }} />
      <Tabs.Screen name="explore" options={{ title: 'Fleet', tabBarIcon: ({ color, size }) => <Car size={size || 20} color={color} /> }} />
      <Tabs.Screen name="bookings" options={{ title: 'My Trips', tabBarIcon: ({ color, size }) => <CalendarCheck size={size || 20} color={color} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          // Reached from the bell in the header; not shown in the tab bar
          href: null,
          tabBarBadge: unread || undefined,
          tabBarBadgeStyle: { backgroundColor: colors.highlight, color: colors.onHighlight },
          tabBarIcon: ({ color, size }) => <Bell size={size || 20} color={color} />,
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <User size={size || 20} color={color} /> }} />
    </Tabs>
  );
}
