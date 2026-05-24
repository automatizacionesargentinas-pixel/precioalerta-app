import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow } from '../theme';
import { formatPrecio } from '../services/precios';
import {
  getAlertas, crearAlerta, eliminarAlerta,
  pedirPermisosNotificaciones, notificarAlertaDisparada,
} from '../services/alertas';

// ─── Tarjeta de alerta ────────────────────────────────────────────────────────

function AlertaCard({ alerta, onEliminar }) {
  const superColor = colors[alerta.super_id] ?? colors.primary;
  const bajoPrecio = alerta.precio_actual && alerta.precio_actual <= alerta.precio_objetivo;

  return (
    <View style={[styles.card, bajoPrecio && styles.cardDisparada]}>
      {bajoPrecio && (
        <View style={styles.disparadaBanner}>
          <Text style={styles.disparadaText}>¡Precio alcanzado!</Text>
        </View>
      )}
      <View style={styles.cardRow}>
        {alerta.imagen_url ? (
          <Image source={{ uri: alerta.imagen_url }} style={styles.img} resizeMode="contain" />
        ) : (
          <View style={[styles.img, styles.imgPlaceholder]} />
        )}
        <View style={styles.cardInfo}>
          <Text style={styles.cardNombre} numberOfLines={2}>{alerta.nombre ?? 'Producto'}</Text>
          {alerta.marca ? <Text style={styles.cardMarca}>{alerta.marca}</Text> : null}

          {alerta.super_id && (
            <View style={styles.superRow}>
              <View style={[styles.superDot, { backgroundColor: superColor }]} />
              <Text style={styles.superNombre}>{alerta.super_id}</Text>
            </View>
          )}

          <View style={styles.precioRow}>
            <View style={styles.precioBloque}>
              <Text style={styles.precioLabel}>objetivo</Text>
              <Text style={styles.precioObjetivo}>{formatPrecio(alerta.precio_objetivo)}</Text>
            </View>
            {alerta.precio_actual && (
              <View style={styles.precioBloque}>
                <Text style={styles.precioLabel}>actual</Text>
                <Text style={[styles.precioActual, bajoPrecio && styles.precioOk]}>
                  {formatPrecio(alerta.precio_actual)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={onEliminar} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.deleteIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Modal para crear alerta ──────────────────────────────────────────────────

function CrearAlertaPanel({ visible, onCrear, onCancelar }) {
  const [productoId, setProductoId]   = useState('');
  const [superId, setSuperId]         = useState('');
  const [precioStr, setPrecioStr]     = useState('');

  if (!visible) return null;

  const handleCrear = () => {
    const precio = parseFloat(precioStr.replace(',', '.'));
    if (!productoId.trim() || isNaN(precio) || precio <= 0) {
      Alert.alert('Datos incompletos', 'Completá el ID del producto y el precio objetivo.');
      return;
    }
    onCrear({ productoId: productoId.trim(), superId: superId.trim() || null, precioObjetivo: precio });
    setProductoId(''); setSuperId(''); setPrecioStr('');
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Nueva alerta de precio</Text>
      <Text style={styles.panelHint}>
        Tip: el ID del producto lo encontrás en los resultados de búsqueda
      </Text>
      <TextInput
        style={styles.input}
        placeholder="ID del producto"
        value={productoId}
        onChangeText={setProductoId}
        autoCapitalize="none"
        placeholderTextColor={colors.tertiary}
      />
      <TextInput
        style={styles.input}
        placeholder="Supermercado (opcional): dia, carrefour, coto..."
        value={superId}
        onChangeText={setSuperId}
        autoCapitalize="none"
        placeholderTextColor={colors.tertiary}
      />
      <TextInput
        style={styles.input}
        placeholder="Precio objetivo (ej: 1500)"
        value={precioStr}
        onChangeText={setPrecioStr}
        keyboardType="numeric"
        placeholderTextColor={colors.tertiary}
      />
      <View style={styles.panelBtns}>
        <TouchableOpacity style={styles.btnSecundario} onPress={onCancelar}>
          <Text style={styles.btnSecundarioText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimario} onPress={handleCrear}>
          <Text style={styles.btnPrimarioText}>Crear alerta</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function AlertasScreen() {
  const [alertas, setAlertas]         = useState([]);
  const [cargando, setCargando]       = useState(true);
  const [mostrarPanel, setMostrarPanel] = useState(false);
  const [permiso, setPermiso]         = useState(null);

  const cargarAlertas = useCallback(async () => {
    setCargando(true);
    try {
      const data = await getAlertas();
      setAlertas(data);
    } catch (e) {
      console.warn('Error cargando alertas:', e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarAlertas();
    pedirPermisosNotificaciones().then(setPermiso);
  }, []);

  const handleCrear = async ({ productoId, superId, precioObjetivo }) => {
    try {
      await crearAlerta({ productoId, superId, precioObjetivo });
      setMostrarPanel(false);
      await cargarAlertas();
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear la alerta. Verificá el ID del producto.');
    }
  };

  const handleEliminar = (id) => {
    Alert.alert('Eliminar alerta', '¿Querés eliminar esta alerta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await eliminarAlerta(id);
          await cargarAlertas();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Alertas</Text>
          <Text style={styles.headerSub}>{alertas.length} activas</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setMostrarPanel(true)}>
          <Text style={styles.addBtnText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Aviso de permisos */}
      {permiso === false && (
        <View style={styles.permisoAviso}>
          <Text style={styles.permisoAvisoText}>
            Las notificaciones están desactivadas. Activálas en Configuración para recibir alertas de precio.
          </Text>
        </View>
      )}

      {/* Panel de creación */}
      <CrearAlertaPanel
        visible={mostrarPanel}
        onCrear={handleCrear}
        onCancelar={() => setMostrarPanel(false)}
      />

      {/* Lista */}
      {cargando ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : alertas.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>Sin alertas activas</Text>
          <Text style={styles.emptySub}>
            Creá una alerta para que te avisemos cuando un producto baje al precio que querés.
          </Text>
          <TouchableOpacity style={styles.btnPrimario} onPress={() => setMostrarPanel(true)}>
            <Text style={styles.btnPrimarioText}>Crear primera alerta</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={alertas}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <AlertaCard alerta={item} onEliminar={() => handleEliminar(item.id)} />
          )}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshing={cargando}
          onRefresh={cargarAlertas}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.surface },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerTitle:      { fontSize: font.size.xl, fontWeight: font.medium, color: colors.primary },
  headerSub:        { fontSize: font.size.sm, color: colors.tertiary, marginTop: 2 },
  addBtn:           { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  addBtnText:       { color: colors.white, fontSize: font.size.md, fontWeight: font.medium },

  permisoAviso:     { margin: spacing.lg, padding: spacing.md, backgroundColor: '#FAEEDA', borderRadius: radius.md, borderWidth: 0.5, borderColor: '#EF9F27' },
  permisoAvisoText: { fontSize: font.size.sm, color: '#633806', lineHeight: 18 },

  panel:            { margin: spacing.lg, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 0.5, borderColor: colors.border, ...shadow.md },
  panelTitle:       { fontSize: font.size.lg, fontWeight: font.medium, color: colors.primary, marginBottom: spacing.xs },
  panelHint:        { fontSize: font.size.sm, color: colors.tertiary, marginBottom: spacing.lg, lineHeight: 18 },
  input:            { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: font.size.md, color: colors.primary, marginBottom: spacing.sm, backgroundColor: colors.surface },
  panelBtns:        { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btnPrimario:      { flex: 1, backgroundColor: colors.primary, borderRadius: radius.full, padding: spacing.md, alignItems: 'center' },
  btnPrimarioText:  { color: colors.white, fontSize: font.size.md, fontWeight: font.medium },
  btnSecundario:    { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.full, padding: spacing.md, alignItems: 'center' },
  btnSecundarioText:{ color: colors.secondary, fontSize: font.size.md },

  loading:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:            { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon:        { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle:       { fontSize: font.size.xl, fontWeight: font.medium, color: colors.primary, marginBottom: spacing.sm },
  emptySub:         { fontSize: font.size.md, color: colors.secondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },

  card:             { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, overflow: 'hidden', ...shadow.sm },
  cardDisparada:    { borderColor: colors.bestBorder, borderWidth: 1.5 },
  disparadaBanner:  { backgroundColor: colors.bestBg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md },
  disparadaText:    { fontSize: font.size.sm, color: colors.best, fontWeight: font.medium },
  cardRow:          { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  img:              { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surface },
  imgPlaceholder:   { backgroundColor: colors.surface },
  cardInfo:         { flex: 1 },
  cardNombre:       { fontSize: font.size.sm, color: colors.primary, lineHeight: 18, marginBottom: 2, fontWeight: font.medium },
  cardMarca:        { fontSize: font.size.xs, color: colors.tertiary, marginBottom: spacing.xs },
  superRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  superDot:         { width: 7, height: 7, borderRadius: radius.full },
  superNombre:      { fontSize: font.size.xs, color: colors.secondary },
  precioRow:        { flexDirection: 'row', gap: spacing.lg },
  precioBloque:     {},
  precioLabel:      { fontSize: font.size.xs, color: colors.tertiary, marginBottom: 2 },
  precioObjetivo:   { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  precioActual:     { fontSize: font.size.lg, fontWeight: font.bold, color: colors.secondary },
  precioOk:         { color: colors.best },
  deleteBtn:        { padding: spacing.xs },
  deleteIcon:       { fontSize: 16, color: colors.tertiary },
});
