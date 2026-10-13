// JobCore screen #0007 - tabs-layout - Tabs
import { Tabs } from 'expo-router';
import { colors, HelpCircle, getHelpStep, useWalkthrough } from '@jobcore/ui';

export default function TabsLayout() {
  const { showHelp } = useWalkthrough();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        sceneStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Tabs.Screen name="calendar" options={{
          title: 'Calendar',
          headerRight: () => (
            <HelpCircle
              onPress={() => showHelp(getHelpStep('calendar')?.id ?? 'calendar')}
              testID="calendar-help"
            />
          ),
        }}
      />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', headerShown: false }} />
    </Tabs>
  );
}
