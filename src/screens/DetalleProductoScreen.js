import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator,
  StyleSheet, Image, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow } from '../theme';
import { getHistorialPrecios } from '../services/precios';
import { formatPrecio } from '../services/precios';

function MiniChart({ datos }) {
  if (!datos.length) return null;
  const precios = datos.map(d => d.precio);
  const min = Math.min(...precios);
  const max = Math.max(...precios);
  const rango = max - min || 1;
  const W = 280, H = 60, PAD = 4;

  const puntos = datos.map((d, i) => ({
    x: PAD + (i / Math.max(datos.length - 1, 1)) * (W - PAD * 2),
    y: PAD + (1 - (d.precio - min) / rango) * (H - PAD * 2),
    precio: d.precio,
    fecha: d.registrado_en,
  }));

  const path = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Evolución de precio (últimos 90 días)</Text>
      <View style={{ height: H + 8 }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
          <path d={path} fill="none" stroke={colors.best} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {puntos.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r="3" fill={colors.best} />
          ))}
        </svg>
      </View>
      <View style={styles.chartLegend}>
        <Text style={styles.chartLegendText}>mín {formatPrecio(min)}</Text>
        <Text style={styles.chartLegendText}>máx {formatPrecio(max)}</Text>
      </View>
    </View>
  );
}

function StatCard({ label, valor }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValor}>{valor}</Text>
    </View>
  );
}

export default function DetalleProductoScreen({ route, navigation }) {
  const { producto, superId, superNombre, superColor } = route.params;
  const [historial, setHistorial] = useState([]);
  const [stats, setStats]         = useState(null);
  const [cargando, setCargando]   = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const histData = await getHistorialPrecios(producto.id, superId);
        const historial = histData?.historial ?? [];
        const stats = histData?.stats ?? null;
        setHistorial(historial);
        setStats(stats);
      } catch (e) {
        console.warn('Error cargando historial:', e);
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [producto.id, superId]);

  const precioActual = historial.length ? historial[historial.length - 1].precio : producto.precio;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{producto.nombre}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info del producto */}
        <View style={styles.productoHeader}>
          {producto.imagen ? (
            <Image source={{ uri: producto.imagen }} style={styles.imagen} resizeMode="contain" />
          ) : (
            <View style={[styles.imagen, styles.imagenPlaceholder]} />
          )}
          <View style={styles.productoMeta}>
            <Text style={styles.nombre}>{producto.nombre}</Text>
            <Text style={styles.marca}>{producto.marca}</Text>
            <View style={styles.superPill}>
              <View style={[styles.superDot, { backgroundColor: superColor }]} />
              <Text style={styles.superNombre}>{superNombre}</Text>
            </View>
            <Text style={styles.precioGrande}>{formatPrecio(precioActual)}</Text>
            {producto.precioLista > precioActual && (
              <Text style={styles.precioViejo}>antes {formatPrecio(producto.precioLista)}</Text>
            )}
          </View>
        </View>

        {cargando ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Cargando historial...</Text>
          </View>
        ) : (
          <>
            {/* Estadísticas */}
            {stats && stats.total_registros > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Estadísticas de precio</Text>
                <View style={styles.statsGrid}>
                  <StatCard label="mínimo histórico" valor={formatPrecio(stats.precio_min)} />
                  <StatCard label="máximo histórico" valor={formatPrecio(stats.precio_max)} />
                  <StatCard label="promedio"          valor={formatPrecio(stats.precio_avg)} />
                  <StatCard label="registros"         valor={String(stats.total_registros)} />
                </View>
              </View>
            )}

            {/* Gráfico */}
            {historial.length > 1 && (
              <View style={styles.section}>
                <MiniChart datos={historial} />
              </View>
            )}

            {/* Historial tabla */}
            {historial.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Últimos registros</Text>
                {[...historial].reverse().slice(0, 15).map((r, i) => (
                  <View key={i} style={styles.histRow}>
                    <Text style={styles.histFecha}>
                      {new Date(r.registrado_en).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    </Text>
                    <Text style={styles.histPrecio}>{formatPrecio(r.precio)}</Text>
                    {r.descuento_pct > 0 && (
                      <View style={styles.histBadge}>
                        <Text style={styles.histBadgeText}>-{r.descuento_pct}%</Text>
                      </View>
                    )}
                    {r.promo_texto ? (
                      <Text style={styles.histPromo}>{r.promo_texto}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            {historial.length === 0 && (
              <View style={styles.sinHistorial}>
                <Text style={styles.sinHistorialText}>
                  Todavía no hay historial guardado para este producto.{'\n'}
                  Buscalo de nuevo en unos días para ver la evolución del precio.
                </Text>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: colors.surface },
  header:            { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: spacing.md },
  backBtn:           { padding: spacing.xs },
  backIcon:          { fontSize: 22, color: colors.primary },
  headerTitle:       { flex: 1, fontSize: font.size.lg, fontWeight: font.medium, color: colors.primary },
  productoHeader:    { backgroundColor: colors.white, padding: spacing.lg, flexDirection: 'row', gap: spacing.lg, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  imagen:            { width: 90, height: 90, borderRadius: radius.lg, backgroundColor: colors.surface },
  imagenPlaceholder: { backgroundColor: colors.surface },
  productoMeta:      { flex: 1 },
  nombre:            { fontSize: font.size.md, fontWeight: font.medium, color: colors.primary, lineHeight: 20, marginBottom: spacing.xs },
  marca:             { fontSize: font.size.sm, color: colors.secondary, marginBottom: spacing.sm },
  superPill:         { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  superDot:          { width: 8, height: 8, borderRadius: radius.full },
  superNombre:       { fontSize: font.size.sm, color: colors.secondary },
  precioGrande:      { fontSize: font.size.xxl, fontWeight: font.bold, color: colors.primary },
  precioViejo:       { fontSize: font.size.sm, color: colors.tertiary, textDecorationLine: 'line-through', marginTop: 2 },
  loading:           { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingText:       { fontSize: font.size.md, color: colors.secondary },
  section:           { margin: spacing.lg, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, ...shadow.sm },
  sectionTitle:      { fontSize: font.size.sm, color: colors.tertiary, marginBottom: spacing.md },
  statsGrid:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statCard:          { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md },
  statLabel:         { fontSize: font.size.xs, color: colors.tertiary, marginBottom: spacing.xs },
  statValor:         { fontSize: font.size.lg, fontWeight: font.medium, color: colors.primary },
  chartContainer:    {},
  chartTitle:        { fontSize: font.size.sm, color: colors.tertiary, marginBottom: spacing.sm },
  chartLegend:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  chartLegendText:   { fontSize: font.size.xs, color: colors.tertiary },
  histRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border, gap: spacing.sm },
  histFecha:         { fontSize: font.size.sm, color: colors.secondary, width: 60 },
  histPrecio:        { fontSize: font.size.md, fontWeight: font.medium, color: colors.primary, flex: 1 },
  histBadge:         { backgroundColor: colors.badge.oferta.bg, borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 1 },
  histBadgeText:     { fontSize: font.size.xs, color: colors.badge.oferta.text, fontWeight: font.medium },
  histPromo:         { fontSize: font.size.xs, color: colors.badge.promo.text },
  sinHistorial:      { margin: spacing.lg, padding: spacing.lg, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border },
  sinHistorialText:  { fontSize: font.size.md, color: colors.secondary, lineHeight: 22, textAlign: 'center' },
});
