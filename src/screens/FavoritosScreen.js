import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, shadow } from '../theme';
import { formatPrecio } from '../services/precios';
import { useStore } from '../store';

function FavItem({ item, onRemove }) {
  const superColor = colors[item.superId] ?? colors.primary;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {item.imagen ? (
          <Image source={{ uri: item.imagen }} style={styles.img} resizeMode="contain" />
        ) : (
          <View style={[styles.img, styles.imgPlaceholder]} />
        )}
        <View style={styles.info}>
          <View style={styles.superRow}>
            <View style={[styles.dot, { backgroundColor: superColor }]} />
            <Text style={styles.superNombre}>{item.superNombre ?? item.superId}</Text>
          </View>
          <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
          <Text style={styles.marca}>{item.marca}</Text>
          <Text style={styles.precio}>{formatPrecio(item.precio)}</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
          <Text style={{ fontSize: 18, color: colors.danger }}>♥</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function FavoritosScreen() {
  const { favoritos, toggleFavorito } = useStore();

  if (!favoritos.length) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}><Text style={styles.headerTitle}>Favoritos</Text></View>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.emptyTitle}>Sin favoritos todavía</Text>
          <Text style={styles.emptySub}>Guardá productos desde el comparador para seguir sus precios</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favoritos</Text>
        <Text style={styles.headerCant}>{favoritos.length} productos</Text>
      </View>
      <FlatList
        data={favoritos}
        keyExtractor={(item, i) => `${item.id}-${item.superId}-${i}`}
        renderItem={({ item }) => (
          <FavItem item={item} onRemove={() => toggleFavorito(item)} />
        )}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: colors.surface },
  header:        { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  headerTitle:   { fontSize: font.size.xl, fontWeight: font.medium, color: colors.primary, flex: 1 },
  headerCant:    { fontSize: font.size.sm, color: colors.tertiary },
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon:     { fontSize: 48, marginBottom: spacing.lg, color: colors.border },
  emptyTitle:    { fontSize: font.size.xl, fontWeight: font.medium, color: colors.primary, marginBottom: spacing.sm },
  emptySub:      { fontSize: font.size.md, color: colors.secondary, textAlign: 'center', lineHeight: 22 },
  card:          { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, ...shadow.sm },
  row:           { flexDirection: 'row', gap: spacing.sm },
  img:           { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.surface },
  imgPlaceholder:{ backgroundColor: colors.surface },
  info:          { flex: 1 },
  superRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 3 },
  dot:           { width: 7, height: 7, borderRadius: radius.full },
  superNombre:   { fontSize: font.size.xs, color: colors.secondary },
  nombre:        { fontSize: font.size.sm, color: colors.primary, lineHeight: 18, marginBottom: 2 },
  marca:         { fontSize: font.size.xs, color: colors.tertiary, marginBottom: spacing.xs },
  precio:        { fontSize: font.size.lg, fontWeight: font.bold, color: colors.primary },
  removeBtn:     { padding: spacing.xs },
});
