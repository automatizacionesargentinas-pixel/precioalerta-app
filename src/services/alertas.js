/**
 * PrecioAlerta AR — Sistema de Alertas y Notificaciones Push
 * Versión simplificada compatible con web y móvil.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ─── Configuración ────────────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ─── Permisos ─────────────────────────────────────────────────────────────────

export async function pedirPermisosNotificaciones() {
  if (Platform.OS === 'web') return false;
  if (!Device.isDevice) return false;

  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;

  if (existente !== 'granted') {
    const { status: nuevo } = await Notifications.requestPermissionsAsync();
    status = nuevo;
  }

  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alertas-precio', {
      name: 'Alertas de precio',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1A6B3A',
      sound: 'default',
    });
  }

  return true;
}

// ─── Notificaciones locales ───────────────────────────────────────────────────

export async function notificarAlertaDisparada({ nombre, precio, precioObjetivo, superNombre }) {
  if (Platform.OS === 'web') return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏷️ Bajó el precio — ${superNombre}`,
      body:  `${nombre} ahora cuesta $${Math.round(precio).toLocaleString('es-AR')}. Tu objetivo era $${Math.round(precioObjetivo).toLocaleString('es-AR')}.`,
      sound: 'default',
    },
    trigger: null,
  });
}

// ─── Worker (solo móvil) ─────────────────────────────────────────────────────

export async function registrarWorkerAlertas() {
  // El background fetch solo funciona en builds nativos, no en Expo Go ni web
  if (Platform.OS === 'web') return;
  try {
    const BackgroundFetch = await import('expo-background-fetch');
    const TaskManager     = await import('expo-task-manager');

    const TASK = 'VERIFICAR_ALERTAS_PRECIO';

    if (!TaskManager.isTaskDefined(TASK)) {
      TaskManager.defineTask(TASK, async () => {
        return BackgroundFetch.BackgroundFetchResult.NoData;
      });
    }

    await BackgroundFetch.registerTaskAsync(TASK, {
      minimumInterval: 30 * 60,
      stopOnTerminate: false,
      startOnBoot:     true,
    });
  } catch {
    // No disponible en este entorno — ignorar silenciosamente
  }
}

export async function cancelarTodasLasNotificaciones() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}
