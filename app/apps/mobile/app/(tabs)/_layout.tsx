// JobCore screen #0007 - tabs-layout - Tabs
import { Tabs } from 'expo-router';
import { colors } from '@jobcore/ui';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', headerShown: false }} />
    </Tabs>
  );
}
