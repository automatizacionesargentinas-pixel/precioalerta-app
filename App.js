import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AppNavigator from './src/navigation/AppNavigator';
import { pedirPermisosNotificaciones, registrarWorkerAlertas } from './src/services/alertas';
import { colors } from './src/theme';

export default function App() {
  const [listo, setListo] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const tienePermiso = await pedirPermisosNotificaciones();
        if (tienePermiso) await registrarWorkerAlertas();
      } catch (e) {
        console.error('Error en init:', e);
      } finally {
        setListo(true);
      }
    }
    init();

    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      console.log('Notificación tocada:', data);
    });

    return () => sub.remove();
  }, []);

  if (!listo) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppNavigator />
    </SafeAreaProvider>
  );
}
