/**
 * PrecioAlerta AR — Servicio de precios
 * ======================================
 * v2.0: Conectado al backend en Railway.
 * Todas las búsquedas pasan por la API REST propia.
 * Fallback: si el backend no responde, llama directo a los supermercados.
 */

// ─── Configuración ────────────────────────────────────────────────────────────

const BACKEND_URL = 'https://precioalerta-backend-production.up.railway.app';
const BACKEND_TIMEOUT_MS = 8000;

// ─── Cliente del backend ─────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: { 'Accept': 'application/json', ...options.headers },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

// ─── Búsqueda principal (via backend) ────────────────────────────────────────

export async function buscarEnTodos(query, limite = 20) {
  const json = await apiFetch(`/v1/products/search?q=${encodeURIComponent(query)}&limit=${limite}`);
  // El backend ya devuelve la estructura agrupada por super
  return json.data ?? [];
}

// ─── Búsqueda por EAN ────────────────────────────────────────────────────────

export async function buscarPorEAN(ean) {
  const json = await apiFetch(`/v1/products/ean/${ean}`);
  return json.data ?? [];
}

// ─── Historial de precios ─────────────────────────────────────────────────────

export async function getHistorialPrecios(productoId, superId, dias = 90) {
  const json = await apiFetch(`/v1/products/${productoId}/prices?super_id=${superId}&dias=${dias}`);
  return json.data ?? { historial: [], stats: null };
}

// ─── Ofertas ─────────────────────────────────────────────────────────────────

export async function getOfertas(superId = null, limite = 50) {
  const params = new URLSearchParams({ limit: limite });
  if (superId) params.set('super_id', superId);
  const json = await apiFetch(`/v1/offers?${params}`);
  return json.data ?? [];
}

// ─── Alertas ─────────────────────────────────────────────────────────────────

export async function crearAlertaRemota({ deviceToken, productoId, superId, precioObjetivo }) {
  const json = await apiFetch('/v1/alerts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_token:    deviceToken,
      producto_id:     productoId,
      super_id:        superId ?? undefined,
      precio_objetivo: precioObjetivo,
    }),
  });
  return json.data;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function precioMinimo(resultados) {
  let min = null;
  resultados.forEach(r => {
    (r.productos ?? []).forEach(p => {
      if (min === null || p.precio < min.precio) {
        min = { ...p, superId: r.superId ?? r.super_id, superNombre: r.superNombre ?? r.super_nombre, superColor: r.superColor ?? r.super_color };
      }
    });
  });
  return min;
}

export function rankingPorSuper(resultados) {
  return resultados
    .map(r => ({
      superId:     r.superId ?? r.super_id,
      superNombre: r.superNombre ?? r.super_nombre,
      superColor:  r.superColor ?? r.super_color,
      minPrecio:   (r.productos ?? []).length ? Math.min(...(r.productos ?? []).map(p => p.precio)) : null,
      cantidad:    (r.productos ?? []).length,
    }))
    .filter(r => r.minPrecio !== null)
    .sort((a, b) => a.minPrecio - b.minPrecio);
}

export function formatPrecio(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}
