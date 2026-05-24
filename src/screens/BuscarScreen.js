import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  ActivityIndicator, StyleSheet, ScrollView, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow, SUPERS } from '../theme';
import { buscarEnTodos, precioMinimo, rankingPorSuper, formatPrecio } from '../services/precios';
import { useStore } from '../store';

// Normalizar respuesta del backend al formato interno de la app
function normalizarResultados(data) {
  return data.map(r => ({
    superId:     r.superId ?? r.super_id,
    superNombre: r.superNombre ?? r.super_nombre,
    superColor:  r.superColor ?? r.super_color,
    productos:   (r.productos ?? []).map(p => ({
      id:           p.id,
      nombre:       p.nombre,
      marca:        p.marca ?? '',
      ean:          p.ean ?? '',
      precio:       parseFloat(p.precio),
      precioLista:  parseFloat(p.precio_lista ?? p.precio),
      descuentoPct: p.descuento_pct ?? 0,
      enOferta:     p.en_oferta ?? false,
      promoTexto:   p.promo_texto ?? '',
      imagen:       p.imagen_url ?? '',
      urlProducto:  p.url_producto ?? '',
    })),
    error: r.error ?? null,
  }));
}

// ─── Chips de búsquedas rápidas ───────────────────────────────────────────────

const SUGERIDAS = ['leche entera', 'aceite girasol', 'yerba mate', 'arroz', 'azúcar', 'fideos'];

function ChipSugerida({ texto, onPress }) {
  return (
    <TouchableOpacity style={styles.chip} onPress={() => onPress(texto)} activeOpacity={0.7}>
      <Text style={styles.chipText}>{texto}</Text>
    </TouchableOpacity>
  );
}

// ─── Badge de oferta ──────────────────────────────────────────────────────────

function Badge({ texto, tipo = 'oferta' }) {
  const c = colors.badge[tipo] ?? colors.badge.oferta;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{texto}</Text>
    </View>
  );
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

function ProductoCard({ producto, superId, superNombre, superColor, esMejorGlobal }) {
  const { toggleFavorito, esFavorito } = useStore();
  const fav = esFavorito(producto.id, superId);

  return (
    <View style={[styles.productoCard, esMejorGlobal && styles.productoCardBest]}>
      {esMejorGlobal && (
        <View style={styles.bestTag}>
          <Text style={styles.bestTagText}>mejor precio</Text>
        </View>
      )}
      <View style={styles.productoRow}>
        {producto.imagen ? (
          <Image source={{ uri: producto.imagen }} style={styles.productoImg} resizeMode="contain" />
        ) : (
          <View style={[styles.productoImg, styles.productoImgPlaceholder]} />
        )}
        <View style={styles.productoInfo}>
          <Text style={styles.productoNombre} numberOfLines={2}>{producto.nombre}</Text>
          <Text style={styles.productoMarca}>{producto.marca}</Text>
          <View style={styles.precioRow}>
            <Text style={[styles.precio, esMejorGlobal && styles.precioBest]}>
              {formatPrecio(producto.precio)}
            </Text>
            {producto.precioLista > producto.precio && (
              <Text style={styles.precioViejo}>{formatPrecio(producto.precioLista)}</Text>
            )}
            {producto.descuentoPct > 0 && <Badge texto={`-${producto.descuentoPct}%`} tipo="oferta" />}
            {producto.promoTexto ? <Badge texto={producto.promoTexto} tipo="promo" /> : null}
          </View>
        </View>
        <TouchableOpacity onPress={() => toggleFavorito({ ...producto, superId })} style={styles.favBtn}>
          <Text style={{ fontSize: 20, color: fav ? colors.danger : colors.border }}>{fav ? '♥' : '♡'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Sección por supermercado ─────────────────────────────────────────────────

function SuperSeccion({ resultado, mejorGlobal }) {
  const { superId, superNombre, superColor, productos, error } = resultado;
  const superInfo = SUPERS.find(s => s.id === superId);

  return (
    <View style={styles.superSeccion}>
      <View style={styles.superHeader}>
        <View style={[styles.superDot, { backgroundColor: superColor }]} />
        <Text style={styles.superNombre}>{superNombre}</Text>
        <Text style={styles.superCant}>
          {error ? 'error' : productos.length ? `${productos.length} resultados` : 'sin resultados'}
        </Text>
      </View>
      {productos.length === 0 && !error && (
        <Text style={styles.sinResultados}>No se encontraron productos</Text>
      )}
      {error && <Text style={styles.errorText}>No disponible ahora</Text>}
      {productos.map((p, i) => (
        <ProductoCard
          key={`${superId}-${p.id}-${i}`}
          producto={p}
          superId={superId}
          superNombre={superNombre}
          superColor={superColor}
          esMejorGlobal={mejorGlobal && p.id === mejorGlobal.id && superId === mejorGlobal.superId}
        />
      ))}
    </View>
  );
}

// ─── Banner ganador ───────────────────────────────────────────────────────────

function GanadorBanner({ ranking }) {
  if (!ranking.length) return null;
  const winner = ranking[0];
  const loser  = ranking[ranking.length - 1];
  const ahorro = Math.round(loser.minPrecio - winner.minPrecio);
  return (
    <View style={styles.ganadorBanner}>
      <Text style={styles.ganadorEmoji}>🏆</Text>
      <View style={styles.ganadorInfo}>
        <Text style={styles.ganadorTitle}>
          <Text style={{ fontWeight: font.bold, color: winner.superColor }}>{winner.superNombre}</Text>
          {' '}tiene el precio más bajo
        </Text>
        {ahorro > 0 && (
          <Text style={styles.ganadorSub}>
            Ahorrás hasta {formatPrecio(ahorro)} vs {loser.superNombre}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Ranking de precios ───────────────────────────────────────────────────────

function RankingBar({ ranking }) {
  if (!ranking.length) return null;
  return (
    <View style={styles.rankingCard}>
      <Text style={styles.rankingTitle}>precio más bajo por super</Text>
      {ranking.map((r, i) => (
        <View key={r.superId} style={styles.rankingRow}>
          <View style={[styles.rankingDot, { backgroundColor: r.superColor }]} />
          <Text style={styles.rankingNombre}>{r.superNombre}</Text>
          {i === 0 && <View style={styles.rankingBestPill}><Text style={styles.rankingBestText}>más barato</Text></View>}
          <Text style={[styles.rankingPrecio, i === 0 && styles.rankingPrecioBest]}>
            {formatPrecio(r.minPrecio)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function BuscarScreen() {
  const [inputQuery, setInputQuery] = useState('');
  const { resultados, cargando, error, historial, setResultados, setCargando, setError, agregarHistorial, query, setQuery } = useStore();

  const buscar = useCallback(async (q) => {
    const texto = (q ?? inputQuery).trim();
    if (!texto) return;
    setInputQuery(texto);
    setQuery(texto);
    agregarHistorial(texto);
    setCargando(true);
    try {
      const raw = await buscarEnTodos(texto);
      const res = normalizarResultados(raw);
      setResultados(res);
    } catch (e) {
      setError(e.message);
    }
  }, [inputQuery]);

  const mejor   = precioMinimo(resultados);
  const ranking = rankingPorSuper(resultados);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Barra de búsqueda */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={inputQuery}
            onChangeText={setInputQuery}
            placeholder="Buscar producto..."
            placeholderTextColor={colors.tertiary}
            returnKeyType="search"
            onSubmitEditing={() => buscar()}
            clearButtonMode="while-editing"
          />
        </View>
        <TouchableOpacity style={styles.searchBtn} onPress={() => buscar()} activeOpacity={0.8}>
          <Text style={styles.searchBtnText}>Comparar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Estado vacío */}
        {!cargando && resultados.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Compará precios en 5 supermercados</Text>
            <Text style={styles.emptySubtitle}>Buscá cualquier producto y encontrá dónde conviene comprarlo</Text>
            <View style={styles.chipsRow}>
              {SUGERIDAS.map(s => <ChipSugerida key={s} texto={s} onPress={buscar} />)}
            </View>
            {historial.length > 0 && (
              <View style={styles.historialSection}>
                <Text style={styles.historialTitle}>Búsquedas recientes</Text>
                {historial.slice(0, 5).map(h => (
                  <TouchableOpacity key={h} onPress={() => buscar(h)} style={styles.historialItem}>
                    <Text style={styles.historialIcon}>🕐</Text>
                    <Text style={styles.historialTexto}>{h}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Cargando */}
        {cargando && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Buscando en 5 supermercados...</Text>
          </View>
        )}

        {/* Resultados */}
        {!cargando && resultados.length > 0 && (
          <>
            <GanadorBanner ranking={ranking} />
            <RankingBar ranking={ranking} />
            {resultados.map(r => (
              <SuperSeccion key={r.superId} resultado={r} mejorGlobal={mejor} />
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: colors.surface },
  searchContainer:  { flexDirection: 'row', padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  searchBar:        { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.full, paddingHorizontal: spacing.md, height: 42 },
  searchIcon:       { fontSize: 16, marginRight: spacing.sm },
  searchInput:      { flex: 1, fontSize: font.size.md, color: colors.primary, height: '100%' },
  searchBtn:        { backgroundColor: colors.primary, borderRadius: radius.full, paddingHorizontal: spacing.lg, justifyContent: 'center', height: 42 },
  searchBtnText:    { color: colors.white, fontSize: font.size.md, fontWeight: font.medium },

  emptyState:       { padding: spacing.xl, alignItems: 'center' },
  emptyTitle:       { fontSize: font.size.xl, fontWeight: font.medium, color: colors.primary, textAlign: 'center', marginBottom: spacing.sm },
  emptySubtitle:    { fontSize: font.size.md, color: colors.secondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  chipsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center', marginBottom: spacing.xl },
  chip:             { backgroundColor: colors.white, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 },
  chipText:         { fontSize: font.size.sm, color: colors.secondary },

  historialSection: { width: '100%', marginTop: spacing.md },
  historialTitle:   { fontSize: font.size.sm, color: colors.tertiary, marginBottom: spacing.sm, fontWeight: font.medium },
  historialItem:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  historialIcon:    { fontSize: 14 },
  historialTexto:   { fontSize: font.size.md, color: colors.secondary },

  loadingContainer: { padding: spacing.xxl, alignItems: 'center', gap: spacing.md },
  loadingText:      { fontSize: font.size.md, color: colors.secondary },

  ganadorBanner:    { margin: spacing.lg, marginBottom: spacing.sm, padding: spacing.md, backgroundColor: colors.bestBg, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.bestBorder, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ganadorEmoji:     { fontSize: 22 },
  ganadorInfo:      { flex: 1 },
  ganadorTitle:     { fontSize: font.size.md, color: colors.best, lineHeight: 20 },
  ganadorSub:       { fontSize: font.size.sm, color: colors.best, opacity: 0.8, marginTop: 2 },

  rankingCard:      { marginHorizontal: spacing.lg, marginBottom: spacing.md, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, ...shadow.sm },
  rankingTitle:     { fontSize: font.size.xs, color: colors.tertiary, marginBottom: spacing.sm, textTransform: 'lowercase' },
  rankingRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm },
  rankingDot:       { width: 8, height: 8, borderRadius: radius.full },
  rankingNombre:    { flex: 1, fontSize: font.size.md, color: colors.primary },
  rankingBestPill:  { backgroundColor: colors.bestBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  rankingBestText:  { fontSize: font.size.xs, color: colors.best, fontWeight: font.medium },
  rankingPrecio:    { fontSize: font.size.md, fontWeight: font.medium, color: colors.secondary },
  rankingPrecioBest:{ color: colors.best },

  superSeccion:     { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  superHeader:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  superDot:         { width: 10, height: 10, borderRadius: radius.full },
  superNombre:      { fontSize: font.size.lg, fontWeight: font.medium, color: colors.primary, flex: 1 },
  superCant:        { fontSize: font.size.sm, color: colors.tertiary },
  sinResultados:    { fontSize: font.size.sm, color: colors.tertiary, paddingVertical: spacing.sm },
  errorText:        { fontSize: font.size.sm, color: colors.danger, paddingVertical: spacing.sm },

  productoCard:     { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, padding: spacing.md, ...shadow.sm },
  productoCardBest: { borderColor: colors.bestBorder, borderWidth: 1.5 },
  bestTag:          { alignSelf: 'flex-start', backgroundColor: colors.bestBg, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 2, marginBottom: spacing.xs },
  bestTagText:      { fontSize: font.size.xs, color: colors.best, fontWeight: font.medium },
  productoRow:      { flexDirection: 'row', gap: spacing.sm },
  productoImg:      { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface },
  productoImgPlaceholder: { backgroundColor: colors.surface },
  productoInfo:     { flex: 1 },
  productoNombre:   { fontSize: font.size.sm, color: colors.primary, lineHeight: 18, marginBottom: 2 },
  productoMarca:    { fontSize: font.size.xs, color: colors.tertiary, marginBottom: spacing.xs },
  precioRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  precio:           { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  precioBest:       { color: colors.best },
  precioViejo:      { fontSize: font.size.xs, color: colors.tertiary, textDecorationLine: 'line-through' },
  favBtn:           { padding: spacing.xs },
  badge:            { borderRadius: radius.sm, paddingHorizontal: spacing.xs, paddingVertical: 1 },
  badgeText:        { fontSize: font.size.xs, fontWeight: font.medium },
});
