import { create } from 'zustand';

export const useStore = create((set, get) => ({
  // Búsqueda actual
  query:      '',
  resultados: [],
  cargando:   false,
  error:      null,

  setQuery:      (query)      => set({ query }),
  setResultados: (resultados) => set({ resultados, cargando: false, error: null }),
  setCargando:   (v)          => set({ cargando: v }),
  setError:      (error)      => set({ error, cargando: false }),

  // Historial de búsquedas
  historial: [],
  agregarHistorial: (q) => {
    const prev = get().historial.filter(h => h !== q);
    set({ historial: [q, ...prev].slice(0, 10) });
  },
  limpiarHistorial: () => set({ historial: [] }),

  // Favoritos (productos)
  favoritos: [],
  toggleFavorito: (producto) => {
    const favs = get().favoritos;
    const existe = favs.find(f => f.id === producto.id && f.superId === producto.superId);
    if (existe) {
      set({ favoritos: favs.filter(f => !(f.id === producto.id && f.superId === producto.superId)) });
    } else {
      set({ favoritos: [{ ...producto, savedAt: new Date().toISOString() }, ...favs] });
    }
  },
  esFavorito: (id, superId) => {
    return get().favoritos.some(f => f.id === id && f.superId === superId);
  },
}));
