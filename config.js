// Configuración pública de la aplicación (sin secretos: la clave publicable es segura en el navegador
// porque todas las tablas tienen RLS y las escrituras sensibles pasan por Edge Functions).
export const CONFIG = {
  SUPABASE_URL: 'https://nzvlixwppiyyhpuuihjz.supabase.co',
  SUPABASE_KEY: 'sb_publishable_oPD46pfwDDhBFkxBgwglKg_F798vNe1',
  DOMINIO_INTERNO: 'porteria.le1.invalid',
  ZONA: 'America/Bogota',
  // Estructura del conjunto (también la impone la base de datos): torres 1 a 43,
  // pisos 1 a 6 y cuatro apartamentos por piso → apartamentos 101 a 604.
  TORRES: 43,
  PISOS: 6,
  APTOS_POR_PISO: 4,
  // Clave de sitio (pública) de Cloudflare Turnstile para el ingreso. Vacía = sin captcha.
  // Activar también en Supabase → Authentication → Attack Protection con la clave secreta.
  TURNSTILE_SITE_KEY: '',
  VERSION: '1.4.0',
};
