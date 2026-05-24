import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, font } from '../theme';
import BuscarScreen    from '../screens/BuscarScreen';
import FavoritosScreen from '../screens/FavoritosScreen';
import AlertasScreen   from '../screens/AlertasScreen';

const Tab = createBottomTabNavigator();

const TABS = [
  { name: 'Buscar',    component: BuscarScreen,    active: '🔍', inactive: '🔍' },
  { name: 'Alertas',   component: AlertasScreen,   active: '🔔', inactive: '🔔' },
  { name: 'Favoritos', component: FavoritosScreen, active: '♥',  inactive: '♡'  },
];

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 0.5,
            borderTopColor: colors.border,
            paddingBottom: 4,
            height: 56,
          },
          tabBarActiveTintColor:   colors.primary,
          tabBarInactiveTintColor: colors.tertiary,
          tabBarLabelStyle: { fontSize: font.size.xs, fontWeight: font.medium },
          tabBarIcon: ({ focused }) => {
            const tab = TABS.find(t => t.name === route.name);
            return (
              <Text style={{ fontSize: 20, color: focused ? colors.primary : colors.tertiary }}>
                {focused ? tab.active : tab.inactive}
              </Text>
            );
          },
        })}
      >
        {TABS.map(t => (
          <Tab.Screen key={t.name} name={t.name} component={t.component} />
        ))}
      </Tab.Navigator>
    </NavigationContainer>
  );
}
