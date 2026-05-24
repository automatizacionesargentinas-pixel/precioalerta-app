export const colors = {
  dia:       '#E30613',
  carrefour: '#004A97',
  coto:      '#E30613',
  jumbo:     '#00813A',
  disco:     '#C8102E',

  best:      '#0F6E56',
  bestBg:    '#E1F5EE',
  bestBorder:'#5DCAA5',

  primary:   '#1A1A1A',
  secondary: '#6B6B6B',
  tertiary:  '#9E9E9E',
  border:    '#E8E8E8',
  surface:   '#F5F5F5',
  white:     '#FFFFFF',
  danger:    '#E24B4A',
  warning:   '#EF9F27',

  badge: {
    oferta:   { bg: '#FCEBEB', text: '#A32D2D' },
    promo:    { bg: '#FAEEDA', text: '#633806' },
    mejor:    { bg: '#E1F5EE', text: '#085041' },
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

export const radius = {
  sm: 6, md: 10, lg: 14, xl: 20, full: 999,
};

export const font = {
  regular: '400',
  medium:  '500',
  bold:    '700',
  size: { xs: 11, sm: 12, md: 14, lg: 16, xl: 18, xxl: 22, xxxl: 28 },
};

export const shadow = {
  sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  md: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
};

export const SUPERS = [
  { id: 'dia',      nombre: 'DIA',       color: colors.dia,       base: 'https://diaonline.supermercadosdia.com.ar', tipo: 'vtex' },
  { id: 'carrefour',nombre: 'Carrefour', color: colors.carrefour, base: 'https://www.carrefour.com.ar',             tipo: 'vtex' },
  { id: 'coto',     nombre: 'Coto',      color: colors.coto,      base: 'https://www.cotodigital.com.ar',           tipo: 'coto' },
  { id: 'jumbo',    nombre: 'Jumbo',     color: colors.jumbo,     base: 'https://www.jumbo.com.ar',                 tipo: 'vtex' },
  { id: 'disco',    nombre: 'Disco',     color: colors.disco,     base: 'https://www.disco.com.ar',                 tipo: 'vtex' },
];
