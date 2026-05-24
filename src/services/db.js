/**
 * PrecioAlerta AR — Base de datos SQLite
 * =======================================
 * Tablas:
 *   productos       — catálogo unificado por EAN
 *   precio_records  — historial de precios (append-only)
 *   alertas         — alertas de precio por usuario
 *   canasta         — lista de compras
 *   canasta_items   — productos en la canasta
 *   busquedas       — historial de búsquedas
 */

import * as SQLite from 'expo-sqlite';

let _db = null;

// ─── Conexión ─────────────────────────────────────────────────────────────────

export async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('precioalerta.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  return _db;
}

// ─── Schema / Migraciones ─────────────────────────────────────────────────────

export async function inicializarDB() {
  const db = await getDB();

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS productos (
      id            TEXT NOT NULL,
      super_id      TEXT NOT NULL,
      ean           TEXT,
      nombre        TEXT NOT NULL,
      marca         TEXT,
      categoria     TEXT,
      imagen_url    TEXT,
      url_producto  TEXT,
      creado_en     TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, super_id)
    );

    CREATE INDEX IF NOT EXISTS idx_productos_ean     ON productos(ean);
    CREATE INDEX IF NOT EXISTS idx_productos_nombre  ON productos(nombre);
    CREATE INDEX IF NOT EXISTS idx_productos_super   ON productos(super_id);

    CREATE TABLE IF NOT EXISTS precio_records (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id   TEXT NOT NULL,
      super_id      TEXT NOT NULL,
      precio        REAL NOT NULL,
      precio_lista  REAL,
      descuento_pct INTEGER DEFAULT 0,
      en_oferta     INTEGER DEFAULT 0,
      promo_texto   TEXT,
      registrado_en TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (producto_id, super_id) REFERENCES productos(id, super_id)
    );

    CREATE INDEX IF NOT EXISTS idx_precios_producto  ON precio_records(producto_id, super_id);
    CREATE INDEX IF NOT EXISTS idx_precios_fecha     ON precio_records(registrado_en);
    CREATE INDEX IF NOT EXISTS idx_precios_super     ON precio_records(super_id);

    CREATE TABLE IF NOT EXISTS alertas (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id     TEXT NOT NULL,
      super_id        TEXT,
      precio_objetivo REAL NOT NULL,
      activa          INTEGER DEFAULT 1,
      creada_en       TEXT NOT NULL DEFAULT (datetime('now')),
      disparada_en    TEXT
    );

    CREATE TABLE IF NOT EXISTS canasta (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre      TEXT NOT NULL DEFAULT 'Mi canasta',
      creada_en   TEXT NOT NULL DEFAULT (datetime('now')),
      activa      INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS canasta_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      canasta_id  INTEGER NOT NULL,
      producto_id TEXT NOT NULL,
      super_id    TEXT NOT NULL,
      cantidad    INTEGER DEFAULT 1,
      FOREIGN KEY (canasta_id) REFERENCES canasta(id) ON DELETE CASCADE,
      UNIQUE (canasta_id, producto_id, super_id)
    );

    CREATE TABLE IF NOT EXISTS busquedas (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      query       TEXT NOT NULL,
      resultados  INTEGER DEFAULT 0,
      buscado_en  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log('✅ DB inicializada');
}

// ─── Productos ────────────────────────────────────────────────────────────────

/**
 * Upsert de un producto. Si ya existe actualiza nombre/imagen/url.
 */
export async function upsertProducto(db, { id, superId, ean, nombre, marca, categoria, imagenUrl, urlProducto }) {
  await db.runAsync(`
    INSERT INTO productos (id, super_id, ean, nombre, marca, categoria, imagen_url, url_producto, actualizado_en)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id, super_id) DO UPDATE SET
      nombre       = excluded.nombre,
      marca        = excluded.marca,
      imagen_url   = excluded.imagen_url,
      url_producto = excluded.url_producto,
      actualizado_en = datetime('now')
  `, [id, superId, ean ?? null, nombre, marca ?? null, categoria ?? null, imagenUrl ?? null, urlProducto ?? null]);
}

export async function buscarProductosPorNombre(query, limite = 20) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT p.*, pr.precio, pr.precio_lista, pr.descuento_pct, pr.en_oferta,
           pr.promo_texto, pr.registrado_en AS ultimo_precio_en
    FROM productos p
    LEFT JOIN precio_records pr ON pr.id = (
      SELECT id FROM precio_records
      WHERE producto_id = p.id AND super_id = p.super_id
      ORDER BY registrado_en DESC LIMIT 1
    )
    WHERE p.nombre LIKE ?
    ORDER BY pr.precio ASC
    LIMIT ?
  `, [`%${query}%`, limite]);
}

export async function buscarProductosPorEAN(ean) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT p.*, pr.precio, pr.precio_lista, pr.descuento_pct, pr.en_oferta, pr.registrado_en
    FROM productos p
    LEFT JOIN precio_records pr ON pr.id = (
      SELECT id FROM precio_records
      WHERE producto_id = p.id AND super_id = p.super_id
      ORDER BY registrado_en DESC LIMIT 1
    )
    WHERE p.ean = ?
    ORDER BY pr.precio ASC
  `, [ean]);
}

// ─── Precios ──────────────────────────────────────────────────────────────────

/**
 * Guarda un precio solo si cambió respecto al último registrado.
 * Evita duplicados innecesarios en el historial.
 */
export async function guardarPrecio(db, { productoId, superId, precio, precioLista, descuentoPct, enOferta, promoTexto }) {
  const ultimo = await db.getFirstAsync(`
    SELECT precio FROM precio_records
    WHERE producto_id = ? AND super_id = ?
    ORDER BY registrado_en DESC LIMIT 1
  `, [productoId, superId]);

  if (ultimo && Math.abs(ultimo.precio - precio) < 0.01) return false;

  await db.runAsync(`
    INSERT INTO precio_records (producto_id, super_id, precio, precio_lista, descuento_pct, en_oferta, promo_texto)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [productoId, superId, precio, precioLista ?? null, descuentoPct ?? 0, enOferta ? 1 : 0, promoTexto ?? null]);

  return true;
}

/**
 * Historial de precios de un producto en un supermercado (últimos N días).
 */
export async function getHistorialPrecios(productoId, superId, dias = 90) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT precio, precio_lista, descuento_pct, en_oferta, promo_texto, registrado_en
    FROM precio_records
    WHERE producto_id = ? AND super_id = ?
      AND registrado_en >= datetime('now', '-${dias} days')
    ORDER BY registrado_en ASC
  `, [productoId, superId]);
}

/**
 * Precio actual (último registrado) de un producto.
 */
export async function getPrecioActual(productoId, superId) {
  const db = await getDB();
  return db.getFirstAsync(`
    SELECT * FROM precio_records
    WHERE producto_id = ? AND super_id = ?
    ORDER BY registrado_en DESC LIMIT 1
  `, [productoId, superId]);
}

/**
 * Estadísticas de precio: mínimo, máximo, promedio histórico.
 */
export async function getEstadisticasPrecios(productoId, superId) {
  const db = await getDB();
  return db.getFirstAsync(`
    SELECT
      MIN(precio)  AS precio_min,
      MAX(precio)  AS precio_max,
      AVG(precio)  AS precio_avg,
      COUNT(*)     AS total_registros,
      MIN(registrado_en) AS primer_registro,
      MAX(registrado_en) AS ultimo_registro
    FROM precio_records
    WHERE producto_id = ? AND super_id = ?
  `, [productoId, superId]);
}

// ─── Guardado masivo post-scraping ────────────────────────────────────────────

/**
 * Guarda todos los resultados de una búsqueda en la DB.
 * Usa transacción para performance.
 */
export async function guardarResultadosBusqueda(resultados) {
  const db = await getDB();
  let guardados = 0;
  let preciosCambiados = 0;

  await db.withTransactionAsync(async () => {
    for (const resultado of resultados) {
      for (const p of resultado.productos) {
        await upsertProducto(db, {
          id:          p.id,
          superId:     resultado.superId,
          ean:         p.ean,
          nombre:      p.nombre,
          marca:       p.marca,
          categoria:   p.categoria,
          imagenUrl:   p.imagen,
          urlProducto: p.urlProducto,
        });

        const cambio = await guardarPrecio(db, {
          productoId:  p.id,
          superId:     resultado.superId,
          precio:      p.precio,
          precioLista: p.precioLista,
          descuentoPct: p.descuentoPct,
          enOferta:    p.enOferta,
          promoTexto:  p.promoTexto,
        });

        guardados++;
        if (cambio) preciosCambiados++;
      }
    }
  });

  console.log(`💾 DB: ${guardados} productos procesados, ${preciosCambiados} precios nuevos guardados`);
  return { guardados, preciosCambiados };
}

// ─── Alertas ──────────────────────────────────────────────────────────────────

export async function crearAlerta({ productoId, superId, precioObjetivo }) {
  const db = await getDB();
  const { lastInsertRowId } = await db.runAsync(`
    INSERT INTO alertas (producto_id, super_id, precio_objetivo)
    VALUES (?, ?, ?)
  `, [productoId, superId ?? null, precioObjetivo]);
  return lastInsertRowId;
}

export async function getAlertas() {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT a.*, p.nombre, p.marca, p.imagen_url, p.super_id AS super_id_producto,
           pr.precio AS precio_actual
    FROM alertas a
    JOIN productos p ON p.id = a.producto_id AND (p.super_id = a.super_id OR a.super_id IS NULL)
    LEFT JOIN precio_records pr ON pr.id = (
      SELECT id FROM precio_records
      WHERE producto_id = a.producto_id
        AND (super_id = a.super_id OR a.super_id IS NULL)
      ORDER BY registrado_en DESC LIMIT 1
    )
    WHERE a.activa = 1
    ORDER BY a.creada_en DESC
  `);
}

export async function eliminarAlerta(id) {
  const db = await getDB();
  await db.runAsync('UPDATE alertas SET activa = 0 WHERE id = ?', [id]);
}

/**
 * Verifica alertas contra precios actuales. Devuelve las que se dispararon.
 */
export async function verificarAlertas() {
  const db = await getDB();
  const disparadas = await db.getAllAsync(`
    SELECT a.id, a.producto_id, a.super_id, a.precio_objetivo,
           p.nombre, p.marca,
           pr.precio AS precio_actual, pr.super_id AS super_precio
    FROM alertas a
    JOIN productos p ON p.id = a.producto_id
    JOIN precio_records pr ON pr.producto_id = a.producto_id
      AND (pr.super_id = a.super_id OR a.super_id IS NULL)
      AND pr.id = (
        SELECT id FROM precio_records
        WHERE producto_id = a.producto_id
        ORDER BY registrado_en DESC LIMIT 1
      )
    WHERE a.activa = 1
      AND pr.precio <= a.precio_objetivo
      AND a.disparada_en IS NULL
  `);

  for (const alerta of disparadas) {
    await db.runAsync(
      `UPDATE alertas SET disparada_en = datetime('now') WHERE id = ?`,
      [alerta.id]
    );
  }

  return disparadas;
}

// ─── Canasta ──────────────────────────────────────────────────────────────────

export async function getCanastaActiva() {
  const db = await getDB();
  let canasta = await db.getFirstAsync(
    `SELECT * FROM canasta WHERE activa = 1 ORDER BY creada_en DESC LIMIT 1`
  );
  if (!canasta) {
    const { lastInsertRowId } = await db.runAsync(
      `INSERT INTO canasta (nombre) VALUES ('Mi canasta')`
    );
    canasta = { id: lastInsertRowId, nombre: 'Mi canasta' };
  }
  return canasta;
}

export async function agregarACanasta(canastaId, { productoId, superId, cantidad = 1 }) {
  const db = await getDB();
  await db.runAsync(`
    INSERT INTO canasta_items (canasta_id, producto_id, super_id, cantidad)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(canasta_id, producto_id, super_id) DO UPDATE SET cantidad = cantidad + ?
  `, [canastaId, productoId, superId, cantidad, cantidad]);
}

export async function getCanastaItems(canastaId) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT ci.*, p.nombre, p.marca, p.imagen_url,
           pr.precio AS precio_actual, pr.descuento_pct, pr.promo_texto
    FROM canasta_items ci
    JOIN productos p ON p.id = ci.producto_id AND p.super_id = ci.super_id
    LEFT JOIN precio_records pr ON pr.id = (
      SELECT id FROM precio_records
      WHERE producto_id = ci.producto_id AND super_id = ci.super_id
      ORDER BY registrado_en DESC LIMIT 1
    )
    WHERE ci.canasta_id = ?
    ORDER BY p.nombre ASC
  `, [canastaId]);
}

export async function getTotalCanasta(canastaId) {
  const db = await getDB();
  return db.getFirstAsync(`
    SELECT
      SUM(ci.cantidad * pr.precio) AS total,
      COUNT(ci.id) AS items
    FROM canasta_items ci
    LEFT JOIN precio_records pr ON pr.id = (
      SELECT id FROM precio_records
      WHERE producto_id = ci.producto_id AND super_id = ci.super_id
      ORDER BY registrado_en DESC LIMIT 1
    )
    WHERE ci.canasta_id = ?
  `, [canastaId]);
}

// ─── Búsquedas ────────────────────────────────────────────────────────────────

export async function registrarBusqueda(query, cantResultados) {
  const db = await getDB();
  await db.runAsync(
    `INSERT INTO busquedas (query, resultados) VALUES (?, ?)`,
    [query, cantResultados]
  );
}

export async function getHistorialBusquedas(limite = 10) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT query, MAX(buscado_en) AS ultima_vez, COUNT(*) AS veces
    FROM busquedas
    GROUP BY query
    ORDER BY ultima_vez DESC
    LIMIT ?
  `, [limite]);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getResumenDB() {
  const db = await getDB();
  const [productos, precios, alertas, busquedas] = await Promise.all([
    db.getFirstAsync('SELECT COUNT(*) AS n FROM productos'),
    db.getFirstAsync('SELECT COUNT(*) AS n FROM precio_records'),
    db.getFirstAsync('SELECT COUNT(*) AS n FROM alertas WHERE activa = 1'),
    db.getFirstAsync('SELECT COUNT(*) AS n FROM busquedas'),
  ]);
  return {
    productos:  productos.n,
    precios:    precios.n,
    alertas:    alertas.n,
    busquedas:  busquedas.n,
  };
}

/**
 * Los 10 productos con mayor variación de precio en los últimos 30 días.
 */
export async function getProductosMasVolatiles(limite = 10) {
  const db = await getDB();
  return db.getAllAsync(`
    SELECT p.nombre, p.marca, p.super_id,
           MIN(pr.precio) AS precio_min,
           MAX(pr.precio) AS precio_max,
           ROUND((MAX(pr.precio) - MIN(pr.precio)) * 100.0 / MIN(pr.precio), 1) AS variacion_pct,
           COUNT(pr.id) AS registros
    FROM precio_records pr
    JOIN productos p ON p.id = pr.producto_id AND p.super_id = pr.super_id
    WHERE pr.registrado_en >= datetime('now', '-30 days')
    GROUP BY pr.producto_id, pr.super_id
    HAVING COUNT(pr.id) > 1
    ORDER BY variacion_pct DESC
    LIMIT ?
  `, [limite]);
}
