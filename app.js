// =====================================================================
// Portería La Esperanza 1 · Módulo 1 (acceso, evidencia sellada y recaudo)
// SP Automatizaciones
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm';
import qrcode from 'https://cdn.jsdelivr.net/npm/qrcode-generator@2.0.4/+esm';
import { CONFIG } from './config.js';

const sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
const ZONA = CONFIG.ZONA;
const PLACA = /^[A-Z0-9]{5,7}$/;
const PLACA_CARRO = /^[A-Z]{3}\d{3}$/;
const PLACA_MOTO = /^[A-Z]{3}\d{2}[A-Z]?$/;

const S = {
  usuario: null, perfil: null, cfg: null, tarifas: {}, unidades: [], unidadPorCodigo: new Map(),
  unidadPorId: new Map(), vista: null, limpieza: null, cola: 0,
};

// ---------------------------------------------------------------------
// Utilidades de interfaz
// ---------------------------------------------------------------------
function h(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') e.value = v;
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of hijos.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}
const $ = (sel, raiz = document) => raiz.querySelector(sel);

const ICONOS = {
  camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/>',
  lista: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
  reloj: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tablero: '<path d="M4 4h7v9H4zM13 4h7v5h-7zM13 11h7v9h-7zM4 15h7v5H4z"/>',
  registros: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  balanza: '<path d="M12 4v16M5 20h14M6 8h12M6 8l-3 6h6zM18 8l-3 6h6z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  salir: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  usuario: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  recargar: '<path d="M19 6v5h-5"/><path d="M18.5 11A6.5 6.5 0 1 0 17 16"/>',
  foto: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8"/>',
  escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};
function icono(nombre, tam = 18) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', tam); s.setAttribute('height', tam);
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONOS[nombre] ?? '';
  return s;
}
// Logotipos oficiales de SP Automatizaciones (manual de marca): sobre fondo oscuro se usa la
// versión monocroma negativa. El monograma suelto no baja de 24 px ni el horizontal de 100 px.
const LOGOS = {
  monograma: { src: 'marca/spa-monograma-negativo.svg', proporcion: 184 / 120 },
  horizontal: { src: 'marca/spa-logo-negativo.svg', proporcion: 293 / 64 },
};
function logo(alto = 24, variante = 'monograma') {
  const l = LOGOS[variante];
  return h('img', { class: 'logo', src: l.src, alt: 'SP Automatizaciones', height: String(alto), width: String(Math.round(alto * l.proporcion)), decoding: 'async' });
}

const cop = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const fmt = {
  hora: (iso) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)),
  horaSeg: (iso) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(iso)),
  fecha: (iso) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)),
  fechaHora: (iso) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso)),
  completa: (iso) => new Intl.DateTimeFormat('es-CO', { timeZone: ZONA, dateStyle: 'medium', timeStyle: 'medium', hourCycle: 'h23' }).format(new Date(iso)),
};
const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(new Date());
function rangoDia(fecha) {
  const inicio = new Date(`${fecha}T00:00:00-05:00`);
  return [inicio.toISOString(), new Date(inicio.getTime() + 86_400_000).toISOString()];
}
function duracion(min) {
  if (min < 60) return `${min} min`;
  const hh = Math.floor(min / 60), mm = min % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}
const minutosDesde = (iso) => Math.max(0, Math.ceil((Date.now() - new Date(iso).getTime()) / 60000));
const consec = (n) => '#' + String(n).padStart(6, '0');
const plural = (n, uno, varios) => `${Number(n).toLocaleString('es-CO')} ${Number(n) === 1 ? uno : varios}`;
function estimarValor(v) {
  const t = S.tarifas[v.tipo_vehiculo];
  if (!t) return { horas: 0, valor: 0 };
  const min = minutosDesde(v.hora_ingreso);
  const horas = Math.max(1, Math.ceil(Math.max(min - (t.minutos_gracia || 0), 0) / 60));
  return { horas, valor: horas * t.valor_hora };
}
const ETIQ_ESTADO = {
  dentro: ['Dentro', 'azul'], pendiente_pago: ['Por cobrar', 'rojo'], pagado: ['Pagado', 'lima'],
  cerrado: ['Salió', ''], cargado_unidad: ['Cargado a unidad', 'ambar'], anulado: ['Anulado', 'rojo'],
};
const chipEstado = (e) => h('span', { class: 'chip ' + (ETIQ_ESTADO[e]?.[1] ?? '') }, ETIQ_ESTADO[e]?.[0] ?? e);

function aviso(texto, tipo = 'ok', ms = 4200) {
  const a = h('div', { class: 'aviso ' + tipo, role: tipo === 'error' ? 'alert' : 'status' }, texto);
  $('#avisos').append(a);
  setTimeout(() => a.remove(), ms);
}

function modal({ titulo, cuerpo, acciones = [], ancho, alCerrar }) {
  const velo = h('div', { class: 'velo', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
  const caja = h('div', { class: 'modal', style: ancho ? { maxWidth: ancho } : null });
  const cuerpoEl = h('div', { class: 'modal-cuerpo' }, cuerpo);
  const pie = h('div', { class: 'modal-pie' }, acciones);
  const cerrar = () => { velo.remove(); document.removeEventListener('keydown', tecla); alCerrar?.(); };
  const tecla = (ev) => { if (ev.key === 'Escape') cerrar(); };
  caja.append(
    h('div', { class: 'modal-cabeza' }, h('h2', {}, titulo), h('button', { class: 'cerrar', 'aria-label': 'Cerrar', onclick: cerrar }, '×')),
    cuerpoEl, pie,
  );
  if (!acciones.length) pie.hidden = true;
  velo.append(caja);
  velo.addEventListener('mousedown', (ev) => { if (ev.target === velo) cerrar(); });
  document.addEventListener('keydown', tecla);
  document.body.append(velo);
  return { cerrar, cuerpo: cuerpoEl, pie, caja };
}

function cajon({ titulo, cuerpo, acciones = [] }) {
  const velo = h('div', { class: 'velo', style: { justifyContent: 'flex-end', padding: 0 } });
  const panel = h('aside', { class: 'cajon', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
  const cerrar = () => { velo.remove(); panel.remove(); document.removeEventListener('keydown', tecla); };
  const tecla = (ev) => { if (ev.key === 'Escape') cerrar(); };
  const cuerpoEl = h('div', { class: 'modal-cuerpo' }, cuerpo);
  const pie = h('div', { class: 'modal-pie' }, acciones);
  if (!acciones.length) pie.hidden = true;
  panel.append(h('div', { class: 'modal-cabeza' }, h('h2', {}, titulo), h('button', { class: 'cerrar', 'aria-label': 'Cerrar', onclick: cerrar }, '×')), cuerpoEl, pie);
  velo.addEventListener('mousedown', (ev) => { if (ev.target === velo) cerrar(); });
  document.addEventListener('keydown', tecla);
  document.body.append(velo, panel);
  return { cerrar, cuerpo: cuerpoEl, pie };
}

async function conBoton(boton, fn) {
  const original = [...boton.childNodes];
  boton.disabled = true;
  boton.replaceChildren(h('span', { class: 'cargando' }), ' Procesando…');
  try { return await fn(); } finally { boton.disabled = false; boton.replaceChildren(...original); }
}

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
class ErrorApp extends Error { constructor(m, estado) { super(m); this.estado = estado; } }
const mensajeError = (e) => e?.message || 'Ocurrió un error';

async function llamar(nombre, cuerpo, esFormulario = false) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new ErrorApp('La sesión terminó. Ingrese de nuevo.', 401);
  const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: {
      apikey: CONFIG.SUPABASE_KEY,
      Authorization: `Bearer ${session.access_token}`,
      ...(esFormulario ? {} : { 'Content-Type': 'application/json' }),
    },
    body: esFormulario ? cuerpo : JSON.stringify(cuerpo ?? {}),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new ErrorApp(d.error || `Error ${r.status}`, r.status);
  return d;
}
function revisar({ data, error }) {
  if (error) throw new ErrorApp(error.message, error.code);
  return data;
}
async function todo(constructor) {
  const salida = [];
  for (let desde = 0; ; desde += 1000) {
    const lote = revisar(await constructor().range(desde, desde + 999));
    salida.push(...lote);
    if (lote.length < 1000) return salida;
  }
}

async function cargarCatalogos() {
  const [cfg, tarifas, unidades] = await Promise.all([
    sb.from('configuracion').select('*').eq('id', 1).single().then(revisar),
    sb.from('tarifas').select('*').lte('vigente_desde', new Date().toISOString()).order('vigente_desde', { ascending: false }).then(revisar),
    todo(() => sb.from('unidades').select('id, codigo, torre, numero, activa').order('id')),
  ]);
  S.cfg = cfg;
  S.tarifas = {};
  for (const t of tarifas) if (!S.tarifas[t.tipo_vehiculo]) S.tarifas[t.tipo_vehiculo] = t;
  S.unidades = unidades.sort((a, b) => (Number(a.torre) - Number(b.torre)) || (Number(a.numero) - Number(b.numero)));
  S.unidadPorCodigo = new Map(unidades.map((u) => [u.codigo, u]));
  S.unidadPorId = new Map(unidades.map((u) => [u.id, u]));
}

// Destino del visitante: torre 1 a 43 y apartamento 101 a 604 (pisos 1 a 6, cuatro por piso).
const ESTRUCTURA = { torres: CONFIG.TORRES, pisos: CONFIG.PISOS, aptos: CONFIG.APTOS_POR_PISO };
const RANGO_APTOS = `101 a ${ESTRUCTURA.pisos}0${ESTRUCTURA.aptos}`;
function revisarTorre(t) {
  if (!t) return null;
  const n = Number(t);
  if (!/^\d{1,2}$/.test(t) || n < 1 || n > ESTRUCTURA.torres) return `La torre debe estar entre 1 y ${ESTRUCTURA.torres}.`;
  return null;
}
function revisarApto(a) {
  if (!a) return null;
  if (!/^\d{1,3}$/.test(a)) return 'Use solo números.';
  const piso = Number(a[0]);
  if (piso < 1 || piso > ESTRUCTURA.pisos) return `El piso va de 1 a ${ESTRUCTURA.pisos} (apartamentos ${RANGO_APTOS}).`;
  if (a.length >= 2 && a[1] !== '0') return `Apartamento no válido: por piso van del 01 al 0${ESTRUCTURA.aptos} (ej.: 101, 604).`;
  if (a.length === 3) {
    const n = Number(a.slice(1));
    if (n < 1 || n > ESTRUCTURA.aptos) return `Apartamento no válido: por piso van del 01 al 0${ESTRUCTURA.aptos} (ej.: 101, 604).`;
  }
  return null;
}
function resolverDestino(torre, apto) {
  if (!torre) return { error: `Escriba la torre de destino (1 a ${ESTRUCTURA.torres}).`, campo: 'torre' };
  const eT = revisarTorre(torre); if (eT) return { error: eT, campo: 'torre' };
  if (!apto) return { error: `Escriba el apartamento (${RANGO_APTOS}).`, campo: 'apto' };
  const eA = revisarApto(apto) ?? (apto.length < 3 ? `El apartamento tiene tres dígitos (${RANGO_APTOS}).` : null);
  if (eA) return { error: eA, campo: 'apto' };
  const codigo = `T${Number(torre)}-${apto}`;
  const u = S.unidadPorCodigo.get(codigo);
  if (!u) return { error: `El apartamento ${codigo} no está en el listado del conjunto.`, campo: 'apto' };
  if (!u.activa) return { error: `El apartamento ${codigo} está inactivo. Consulte a la administración.`, campo: 'apto' };
  return { unidad: u };
}

// ---------------------------------------------------------------------
// Cola sin conexión (IndexedDB)
// ---------------------------------------------------------------------
const Cola = {
  abrir() {
    return new Promise((ok, mal) => {
      const r = indexedDB.open('le1-porteria', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('cola', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
  },
  async op(modo, fn) {
    const db = await this.abrir();
    return new Promise((ok, mal) => {
      const tx = db.transaction('cola', modo);
      const peticion = fn(tx.objectStore('cola'));
      tx.oncomplete = () => ok(peticion?.result);
      tx.onerror = () => mal(tx.error);
    });
  },
  agregar(item) { return this.op('readwrite', (s) => s.add(item)); },
  todos() { return this.op('readonly', (s) => s.getAll()); },
  borrar(id) { return this.op('readwrite', (s) => s.delete(id)); },
  contar() { return this.op('readonly', (s) => s.count()); },
};
let sincronizando = false;
async function sincronizarCola() {
  if (sincronizando || !navigator.onLine || !S.perfil) return;
  sincronizando = true;
  try {
    const items = await Cola.todos();
    for (const it of items) {
      const f = new FormData();
      for (const [k, v] of Object.entries(it.campos)) f.append(k, v);
      if (it.foto) f.append('foto', it.foto, 'foto.jpg');
      try {
        const r = await llamar('registrar-ingreso', f, true);
        await Cola.borrar(it.id);
        aviso(`Ingreso sin conexión enviado: ${it.campos.placa} ${consec(r.ingreso.consecutivo)}`);
      } catch (e) {
        if (e instanceof ErrorApp && e.estado >= 400 && e.estado < 500 && e.estado !== 401) {
          await Cola.borrar(it.id);
          aviso(`No se pudo registrar ${it.campos.placa}: ${e.message}`, 'error', 9000);
        } else break;
      }
    }
  } finally {
    sincronizando = false;
    await actualizarCola();
  }
}
async function actualizarCola() {
  try { S.cola = await Cola.contar(); } catch { S.cola = 0; }
  pintarPie();
}

// ---------------------------------------------------------------------
// Acceso
// ---------------------------------------------------------------------
function vistaAcceso(mensaje) {
  detenerVista();
  const raiz = $('#raiz');
  const error = h('div', { class: 'error-campo', role: 'alert' }, mensaje ?? '');
  const usuario = h('input', { class: 'campo', id: 'usuario', autocomplete: 'username', placeholder: 'Ej.: G-07 o correo', required: true, autocapitalize: 'characters' });
  const clave = h('input', { class: 'campo', id: 'clave', type: 'password', autocomplete: 'current-password', required: true });
  const boton = h('button', { class: 'btn primario grande bloque', type: 'submit' }, 'Ingresar');
  const form = h('form', { class: 'acceso-caja', novalidate: true },
    h('div', { class: 'etiqueta' }, 'Acceso del personal'),
    h('h2', {}, 'Ingrese a la portería digital'),
    h('div', { class: 'grupo' }, h('label', { for: 'usuario', class: 'etiqueta' }, 'Usuario'), usuario),
    h('div', { class: 'grupo' }, h('label', { for: 'clave', class: 'etiqueta' }, 'Clave'), clave),
    h('div', { style: { marginTop: '10px' } }, error),
    boton,
    h('p', { class: 'ayuda', style: { marginTop: '16px' } }, 'Los guardas ingresan con su código. La administración puede usar su código o su correo.'),
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.textContent = '';
    const u = usuario.value.trim();
    if (!u || !clave.value) { error.textContent = 'Escriba su usuario y su clave.'; return; }
    const email = u.includes('@') ? u.toLowerCase() : `${u.toLowerCase()}@${CONFIG.DOMINIO_INTERNO}`;
    await conBoton(boton, async () => {
      const { error: e } = await sb.auth.signInWithPassword({ email, password: clave.value });
      if (e) { error.textContent = /invalid/i.test(e.message) ? 'Usuario o clave incorrectos.' : e.message; return; }
      await iniciarSesion();
    });
  });
  raiz.replaceChildren(h('main', { class: 'acceso' }, heroAcceso(), h('section', { class: 'acceso-form' }, form)));
  usuario.focus();
}

function heroAcceso() {
  return h('section', { class: 'acceso-marca' },
    h('div', {},
      h('div', { class: 'acceso-firma' }, logo(46, 'horizontal'), h('span', { class: 'contexto' }, 'Soacha · CO · Est 2026')),
      h('h1', {}, 'Portería digital ', h('em', {}, 'sin efectivo'), ' y con evidencia sellada'),
      h('p', {}, 'Cada ingreso queda con foto y hora del servidor; cada pago llega directo a la cuenta del conjunto.'),
    ),
    h('div', { class: 'acceso-datos' },
      h('span', {}, 'Conjunto ', h('b', {}, 'La Esperanza 1')),
      h('span', {}, 'Módulo ', h('b', {}, '1 · Acceso y recaudo')),
      h('span', {}, 'Versión ', h('b', {}, CONFIG.VERSION)),
    ),
  );
}

// ---------------------------------------------------------------------
// Política de claves: la clave asignada es temporal (se cambia una sola vez al primer
// ingreso) y luego vence cada N días (90 por defecto). La base de datos y las funciones
// niegan todo mientras la clave esté pendiente; esta pantalla es el único paso posible.
// ---------------------------------------------------------------------
const claveVigente = (p) => Boolean(p?.clave_vence_en) && new Date(p.clave_vence_en) > new Date();
const minimoClave = (rol) => (rol === 'guarda' ? 6 : 8);
function mensajeClave(e) {
  const m = e?.message ?? String(e);
  if (e?.code === 'same_password' || /different from the old/i.test(m)) return 'La nueva clave debe ser distinta de la anterior.';
  if (e?.code === 'weak_password' || /weak|pwned|leaked|known/i.test(m)) return 'Esa clave es muy común o aparece en filtraciones conocidas. Elija otra.';
  return m;
}
async function guardarClaveNueva(rol, nueva, confirma) {
  const minimo = minimoClave(rol);
  if (nueva.length < minimo) throw new Error(`La clave debe tener al menos ${minimo} caracteres.`);
  if (nueva !== confirma) throw new Error('Las claves no coinciden.');
  const { error: e } = await sb.auth.updateUser({ password: nueva });
  if (e) throw new Error(mensajeClave(e));
}

function vistaCambioClave(perfil) {
  detenerVista();
  const primera = !perfil.clave_cambiada_en;
  const dias = perfil.clave_cambiada_en && perfil.clave_vence_en
    ? Math.round((new Date(perfil.clave_vence_en) - new Date(perfil.clave_cambiada_en)) / 86_400_000) : null;
  const minimo = minimoClave(perfil.rol);
  const nueva = h('input', { class: 'campo', type: 'password', id: 'nueva-clave', autocomplete: 'new-password', required: true });
  const confirma = h('input', { class: 'campo', type: 'password', id: 'confirma-clave', autocomplete: 'new-password', required: true });
  const error = h('div', { class: 'error-campo', role: 'alert' });
  const boton = h('button', { class: 'btn primario grande bloque', type: 'submit' }, 'Guardar mi clave');
  const salir = h('button', { class: 'btn fantasma bloque', type: 'button', style: { marginTop: '10px' } }, 'Cerrar sesión');
  salir.onclick = async () => { await sb.auth.signOut(); location.hash = ''; vistaAcceso(); };
  const form = h('form', { class: 'acceso-caja', novalidate: true },
    h('div', { class: 'etiqueta' }, primera ? 'Primer ingreso' : 'Clave vencida'),
    h('h2', {}, primera ? 'Cree su clave personal' : 'Renueve su clave'),
    h('p', { class: 'ayuda', style: { margin: '0 0 18px' } }, primera
      ? `${perfil.nombre}, la clave que le entregaron es temporal. Cámbiela por una que solo usted conozca: se pide una sola vez y después se renueva periódicamente.`
      : `Por seguridad, las claves se renuevan cada ${dias ?? 90} días. La nueva debe ser distinta de la anterior.`),
    h('div', { class: 'grupo' }, h('label', { for: 'nueva-clave', class: 'etiqueta' }, `Nueva clave (mínimo ${minimo})`), nueva),
    h('div', { class: 'grupo' }, h('label', { for: 'confirma-clave', class: 'etiqueta' }, 'Repita la clave'), confirma),
    h('div', { style: { marginTop: '10px' } }, error),
    boton, salir,
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    error.textContent = '';
    await conBoton(boton, async () => {
      try {
        await guardarClaveNueva(perfil.rol, nueva.value, confirma.value);
      } catch (e) { error.textContent = e.message; return; }
      aviso('Clave guardada');
      await iniciarSesion();
    });
  });
  $('#raiz').replaceChildren(h('main', { class: 'acceso' }, heroAcceso(), h('section', { class: 'acceso-form' }, form)));
  nueva.focus();
}

async function iniciarSesion() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return vistaAcceso();
  const { data: perfil } = await sb.from('perfiles').select('id, nombre, codigo, rol, activo, clave_cambiada_en, clave_vence_en').eq('id', user.id).maybeSingle();
  if (!perfil || !perfil.activo) {
    await sb.auth.signOut();
    return vistaAcceso('Su usuario está inactivo o no tiene perfil. Consulte a la administración.');
  }
  S.usuario = user;
  S.perfil = perfil;
  if (!claveVigente(perfil)) return vistaCambioClave(perfil);
  try {
    await cargarCatalogos();
  } catch (e) {
    return vistaAcceso('No se pudo cargar la configuración: ' + mensajeError(e));
  }
  montarApp();
  const diasRestantes = Math.ceil((new Date(perfil.clave_vence_en) - new Date()) / 86_400_000);
  if (diasRestantes <= 7) aviso(`Su clave vence en ${plural(diasRestantes, 'día', 'días')}. Puede cambiarla en Mi cuenta.`, 'ok', 8000);
  await actualizarCola();
  sincronizarCola();
}

// ---------------------------------------------------------------------
// Estructura y navegación
// ---------------------------------------------------------------------
const VISTAS = {
  tablero: { titulo: 'Tablero', icono: 'tablero', roles: ['admin', 'superadmin', 'consejo'], render: vistaTablero },
  ingreso: { titulo: 'Ingreso', icono: 'camara', roles: ['guarda', 'admin', 'superadmin'], render: vistaIngreso },
  dentro: { titulo: 'Dentro', icono: 'lista', roles: ['guarda', 'admin', 'superadmin'], render: vistaDentro },
  turno: { titulo: 'Mi turno', icono: 'reloj', roles: ['guarda'], render: vistaTurno },
  registros: { titulo: 'Registros', icono: 'registros', roles: ['admin', 'superadmin', 'consejo'], render: vistaRegistros },
  conciliacion: { titulo: 'Conciliación', icono: 'balanza', roles: ['admin', 'superadmin', 'consejo'], render: vistaConciliacion },
  ajustes: { titulo: 'Ajustes', icono: 'ajustes', roles: ['admin', 'superadmin'], render: vistaAjustes },
};
const ROL_NOMBRE = { superadmin: 'Superadministrador', admin: 'Administración', consejo: 'Consejo', guarda: 'Guarda' };
const vistasPermitidas = () => Object.entries(VISTAS).filter(([, v]) => v.roles.includes(S.perfil.rol)).map(([k]) => k);
const esAdmin = () => ['admin', 'superadmin'].includes(S.perfil?.rol);

function montarApp() {
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Secciones' });
  const movil = h('nav', { class: 'navegacion-movil', 'aria-label': 'Secciones' });
  for (const clave of vistasPermitidas()) {
    const v = VISTAS[clave];
    const crear = () => h('button', { class: 'tab', 'data-vista': clave, onclick: () => { location.hash = clave; } }, icono(v.icono), h('span', {}, v.titulo));
    tabs.append(crear());
    movil.append(crear());
  }
  const raiz = $('#raiz');
  raiz.replaceChildren(h('div', { class: 'app' },
    h('header', { class: 'barra' },
      h('div', { class: 'marca' }, logo(24), h('span', {}, 'LA ESPERANZA 1')),
      h('div', { class: 'titulo-movil', id: 'titulo-movil' }),
      tabs,
      h('div', { class: 'usuario' },
        h('div', { class: 'quien' }, h('b', {}, S.perfil.nombre), h('span', {}, `${ROL_NOMBRE[S.perfil.rol]} · ${S.perfil.codigo}`)),
        h('button', { class: 'btn fantasma chico', 'aria-label': 'Mi cuenta', onclick: abrirCuenta }, icono('usuario')),
      ),
    ),
    h('main', { class: 'contenido', id: 'contenido' }),
    movil,
    h('footer', { class: 'pie', id: 'pie' }),
  ));
  pintarPie();
  irA(location.hash.slice(1));
}

function pintarPie() {
  const pie = $('#pie');
  if (!pie) return;
  const enLinea = navigator.onLine;
  pie.replaceChildren(
    h('span', { class: 'estado ' + (enLinea ? 'en-linea' : 'sin-red') }, h('span', { class: 'punto' }), enLinea ? 'En línea' : 'Sin conexión'),
    h('span', {}, S.cola ? `Pendientes por enviar: ${S.cola}` : 'Cola vacía'),
    h('span', { class: 'oculto-movil' }, `SP Automatizaciones · v${CONFIG.VERSION}`),
  );
}

function detenerVista() {
  try { S.limpieza?.(); } catch { /* sin acción */ }
  S.limpieza = null;
}

function irA(clave) {
  if (!claveVigente(S.perfil)) return vistaCambioClave(S.perfil);
  const permitidas = vistasPermitidas();
  if (!permitidas.includes(clave)) clave = permitidas[0];
  detenerVista();
  S.vista = clave;
  for (const b of document.querySelectorAll('.tab[data-vista]')) {
    if (b.dataset.vista === clave) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  }
  const t = $('#titulo-movil'); if (t) t.textContent = VISTAS[clave].titulo;
  document.title = `${VISTAS[clave].titulo} · Portería La Esperanza 1`;
  const contenedor = $('#contenido');
  contenedor.replaceChildren();
  const r = VISTAS[clave].render(contenedor);
  if (typeof r === 'function') S.limpieza = r;
  window.scrollTo(0, 0);
}

function cabecera(etiqueta, titulo, ...derecha) {
  return h('div', { class: 'cabecera' },
    h('div', {}, h('div', { class: 'etiqueta' }, etiqueta), h('h1', {}, titulo)),
    h('div', { class: 'fila' }, derecha),
  );
}

function abrirCuenta() {
  const nueva = h('input', { class: 'campo', type: 'password', autocomplete: 'new-password', id: 'nueva' });
  const confirma = h('input', { class: 'campo', type: 'password', autocomplete: 'new-password', id: 'confirma' });
  const error = h('div', { class: 'error-campo' });
  const minimo = minimoClave(S.perfil.rol);
  const guardar = h('button', { class: 'btn primario' }, 'Cambiar clave');
  const m = modal({
    titulo: 'Mi cuenta',
    cuerpo: [
      h('dl', { class: 'dato-lista' },
        h('dt', {}, 'Nombre'), h('dd', {}, S.perfil.nombre),
        h('dt', {}, 'Código'), h('dd', { class: 'mono' }, S.perfil.codigo),
        h('dt', {}, 'Rol'), h('dd', {}, ROL_NOMBRE[S.perfil.rol]),
        h('dt', {}, 'Clave vigente hasta'), h('dd', { class: 'mono' }, fmt.fecha(S.perfil.clave_vence_en)),
      ),
      h('hr', { class: 'sep' }),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta', for: 'nueva' }, `Nueva clave (mínimo ${minimo})`), nueva),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta', for: 'confirma' }, 'Repita la clave'), confirma),
      error,
    ],
    acciones: [
      h('button', { class: 'btn peligro', onclick: async () => { await sb.auth.signOut(); m.cerrar(); location.hash = ''; vistaAcceso(); } }, icono('salir'), 'Cerrar sesión'),
      guardar,
    ],
  });
  guardar.addEventListener('click', () => conBoton(guardar, async () => {
    error.textContent = '';
    try {
      await guardarClaveNueva(S.perfil.rol, nueva.value, confirma.value);
    } catch (e) { error.textContent = e.message; return; }
    const { data: p } = await sb.from('perfiles').select('clave_cambiada_en, clave_vence_en').eq('id', S.perfil.id).single();
    if (p) Object.assign(S.perfil, p);
    aviso(`Clave actualizada. Vigente hasta ${fmt.fecha(S.perfil.clave_vence_en)}.`);
    m.cerrar();
  }));
}

// ---------------------------------------------------------------------
// Cámara
// ---------------------------------------------------------------------
const Camara = {
  flujo: null,
  async iniciar(video) {
    this.detener();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar la cámara desde la aplicación');
    this.flujo = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false,
    });
    video.srcObject = this.flujo;
    await video.play();
  },
  detener() { this.flujo?.getTracks().forEach((t) => t.stop()); this.flujo = null; },
  aJpeg(fuente, ancho, alto) {
    const escala = Math.min(1, 1280 / Math.max(ancho, alto));
    const c = document.createElement('canvas');
    c.width = Math.round(ancho * escala); c.height = Math.round(alto * escala);
    c.getContext('2d').drawImage(fuente, 0, 0, c.width, c.height);
    return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.86));
  },
  capturar(video) { return this.aJpeg(video, video.videoWidth, video.videoHeight); },
  async desdeArchivo(archivo) {
    const bmp = await createImageBitmap(archivo);
    const blob = await this.aJpeg(bmp, bmp.width, bmp.height);
    bmp.close?.();
    return blob;
  },
};

// ---------------------------------------------------------------------
// Vista: registro de ingreso
// ---------------------------------------------------------------------
function vistaIngreso(c) {
  let foto = null;
  let urlFoto = null;
  let tipo = 'carro';
  let tipoManual = false;

  const video = h('video', { playsinline: true, muted: true, autoplay: true });
  const imgCaptura = h('img', { class: 'captura', alt: 'Foto capturada', hidden: true });
  const estadoCam = h('div', { class: 'estado-cam' }, '● CÁMARA EN VIVO');
  const vacioCam = h('div', { class: 'vacio', hidden: true });
  const archivo = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const camara = h('div', { class: 'camara' }, video, imgCaptura,
    h('div', { class: 'marco' }, h('i'), h('i'), h('i'), h('i')), estadoCam, vacioCam, archivo);
  const btnFoto = h('button', { class: 'btn primario grande' }, icono('camara', 20), 'Tomar foto');
  const btnRepetir = h('button', { class: 'btn grande', hidden: true }, icono('recargar', 20), 'Repetir foto');

  const placa = h('input', { class: 'campo placa-campo', id: 'placa', maxlength: '7', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABC123', inputmode: 'text' });
  const bCarro = h('button', { type: 'button', 'aria-pressed': 'true' }, 'Carro');
  const bMoto = h('button', { type: 'button', 'aria-pressed': 'false' }, 'Moto');
  const torre = h('input', { class: 'campo destino-campo', id: 'torre', inputmode: 'numeric', maxlength: '2', autocomplete: 'off', placeholder: `1–${ESTRUCTURA.torres}`, 'aria-describedby': 'destino-estado' });
  const apto = h('input', { class: 'campo destino-campo', id: 'apto', inputmode: 'numeric', maxlength: '3', autocomplete: 'off', placeholder: RANGO_APTOS.replace(' a ', '–'), 'aria-describedby': 'destino-estado' });
  const destinoEstado = h('div', { class: 'destino-estado', id: 'destino-estado', 'aria-live': 'polite' });
  const obs = h('input', { class: 'campo', id: 'obs', maxlength: '200', placeholder: 'Opcional' });
  const error = h('div', { class: 'error-campo', role: 'alert' });
  const registrar = h('button', { class: 'btn primario grande bloque' }, icono('escudo', 20), 'Registrar ingreso');

  function fijarTipo(t, manual = false) {
    tipo = t; if (manual) tipoManual = true;
    bCarro.setAttribute('aria-pressed', String(t === 'carro'));
    bMoto.setAttribute('aria-pressed', String(t === 'moto'));
  }
  bCarro.onclick = () => fijarTipo('carro', true);
  bMoto.onclick = () => fijarTipo('moto', true);

  function sugerirTipo() {
    if (tipoManual) return;
    if (PLACA_MOTO.test(placa.value) && !PLACA_CARRO.test(placa.value)) fijarTipo('moto');
    else if (PLACA_CARRO.test(placa.value)) fijarTipo('carro');
  }
  placa.addEventListener('input', () => {
    const limpio = placa.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
    if (limpio !== placa.value) placa.value = limpio;
    sugerirTipo();
  });

  // Destino: validación mientras se escribe; nunca acepta una torre o un apartamento fuera del conjunto.
  function pintarDestino() {
    const t = torre.value, a = apto.value;
    const eT = revisarTorre(t), eA = revisarApto(a);
    torre.toggleAttribute('aria-invalid', Boolean(eT));
    apto.toggleAttribute('aria-invalid', Boolean(eA));
    if (eT || eA) {
      destinoEstado.className = 'destino-estado error';
      destinoEstado.replaceChildren(h('span', { class: 'chip rojo' }, 'Revisar'), h('span', {}, eT ?? eA));
      return;
    }
    if (t && a.length === 3) {
      const r = resolverDestino(t, a);
      destinoEstado.className = 'destino-estado ' + (r.unidad ? 'ok' : 'error');
      destinoEstado.replaceChildren(...(r.unidad
        ? [h('span', { class: 'chip lima' }, icono('check', 14), r.unidad.codigo), h('span', {}, `Torre ${Number(t)} · apartamento ${a}`)]
        : [h('span', { class: 'chip rojo' }, 'Revisar'), h('span', {}, r.error)]));
      return;
    }
    destinoEstado.className = 'destino-estado';
    destinoEstado.replaceChildren(h('span', { class: 'chip azul' }, 'Visitante'), h('span', { class: 'mudo' }, `Torre 1 a ${ESTRUCTURA.torres} · apartamento ${RANGO_APTOS}`));
  }
  function soloDigitos(campo, max) {
    const limpio = campo.value.replace(/\D/g, '').slice(0, max);
    if (limpio !== campo.value) campo.value = limpio;
  }
  torre.addEventListener('input', () => {
    soloDigitos(torre, 2);
    pintarDestino();
    // Pasa solo al apartamento cuando la torre ya no admite otro dígito (p. ej. 12 o 7).
    const n = Number(torre.value);
    if (!revisarTorre(torre.value) && (torre.value.length === 2 || n * 10 > ESTRUCTURA.torres)) apto.focus();
  });
  apto.addEventListener('input', () => { soloDigitos(apto, 3); pintarDestino(); });
  for (const campo of [placa, torre, apto]) campo.addEventListener('input', () => { error.textContent = ''; });
  placa.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); torre.focus(); } });
  torre.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); apto.focus(); } });
  apto.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); registrar.click(); } });

  async function encender() {
    vacioCam.hidden = true; video.hidden = false; estadoCam.hidden = false;
    try {
      await Camara.iniciar(video);
    } catch (e) {
      video.hidden = true; estadoCam.hidden = true; vacioCam.hidden = false;
      vacioCam.replaceChildren(icono('camara', 40), h('div', {}, 'No fue posible abrir la cámara en vivo.'),
        h('div', { class: 'ayuda' }, mensajeError(e)),
        h('button', { class: 'btn', onclick: () => archivo.click() }, 'Abrir la cámara del dispositivo'));
    }
  }
  function mostrarFoto(blob) {
    foto = blob;
    error.textContent = '';
    if (urlFoto) URL.revokeObjectURL(urlFoto);
    urlFoto = URL.createObjectURL(blob);
    imgCaptura.src = urlFoto; imgCaptura.hidden = false;
    video.hidden = true; estadoCam.textContent = '✓ FOTO LISTA'; estadoCam.hidden = false; vacioCam.hidden = true;
    btnFoto.hidden = true; btnRepetir.hidden = false;
    Camara.detener();
    sugerirPlaca(blob);
  }
  async function sugerirPlaca(blob) {
    if (!navigator.onLine) return;
    try {
      const f = new FormData(); f.append('foto', blob, 'foto.jpg');
      const r = await llamar('leer-placa', f, true);
      if (r.disponible && r.placa && !placa.value) {
        placa.value = r.placa; sugerirTipo();
        aviso(`Placa sugerida: ${r.placa}. Confírmela antes de registrar.`, 'alerta');
      }
    } catch { /* la lectura automática es opcional */ }
  }
  btnFoto.onclick = async () => {
    if (!Camara.flujo || !video.videoWidth) { archivo.click(); return; }
    mostrarFoto(await Camara.capturar(video));
  };
  btnRepetir.onclick = async () => {
    foto = null; imgCaptura.hidden = true; btnFoto.hidden = false; btnRepetir.hidden = true;
    estadoCam.textContent = '● CÁMARA EN VIVO';
    await encender();
  };
  archivo.onchange = async () => {
    const f = archivo.files?.[0]; archivo.value = '';
    if (f) mostrarFoto(await Camara.desdeArchivo(f));
  };

  function reiniciar() {
    placa.value = ''; torre.value = ''; apto.value = ''; obs.value = ''; error.textContent = '';
    tipoManual = false; fijarTipo('carro'); pintarDestino();
    btnRepetir.onclick();
    placa.focus();
  }

  registrar.onclick = () => conBoton(registrar, async () => {
    error.textContent = '';
    const p = placa.value;
    if (!PLACA.test(p)) { error.textContent = 'Escriba una placa válida (5 a 7 letras y números).'; placa.focus(); return; }
    const destino = resolverDestino(torre.value, apto.value);
    if (!destino.unidad) { error.textContent = destino.error; (destino.campo === 'torre' ? torre : apto).focus(); return; }
    if (!foto) { error.textContent = 'Tome la foto del vehículo antes de registrar.'; return; }
    const campos = {
      placa: p, tipo_vehiculo: tipo, unidad_id: String(destino.unidad.id), observacion: obs.value.trim(),
      hora_dispositivo: new Date().toISOString(),
    };
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.append(k, v);
    if (foto) f.append('foto', foto, 'foto.jpg');
    try {
      const r = await llamar('registrar-ingreso', f, true);
      mostrarResultado(r.ingreso, reiniciar);
    } catch (e) {
      if (e instanceof TypeError || !navigator.onLine) {
        campos.observacion = [campos.observacion, `Registrado sin conexión a las ${fmt.horaSeg(campos.hora_dispositivo)}`].filter(Boolean).join(' · ');
        await Cola.agregar({ campos, foto, creado: Date.now() });
        await actualizarCola();
        aviso(`Sin conexión: el ingreso de ${p} quedó guardado y se enviará automáticamente.`, 'alerta', 7000);
        reiniciar();
      } else {
        error.textContent = mensajeError(e);
      }
    }
  });

  c.append(
    cabecera('Portería · registro de ingreso', 'Nuevo ingreso',
      h('span', { class: 'chip' }, `Carro ${cop(S.tarifas.carro?.valor_hora)}/h`),
      h('span', { class: 'chip' }, `Moto ${cop(S.tarifas.moto?.valor_hora)}/h`)),
    h('div', { class: 'ingreso' },
      h('section', {}, camara, h('div', { class: 'camara-acciones' }, btnFoto, btnRepetir)),
      h('section', { class: 'panel relleno' },
        h('div', { class: 'grupo' }, h('label', { class: 'etiqueta', for: 'placa' }, 'Placa'), placa),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Tipo de vehículo'), h('div', { class: 'seg', role: 'group', 'aria-label': 'Tipo de vehículo' }, bCarro, bMoto)),
        h('div', { class: 'grupo' }, h('span', { class: 'etiqueta' }, 'Apartamento de destino'),
          h('div', { class: 'destino' },
            h('label', { class: 'destino-parte', for: 'torre' }, h('span', {}, 'Torre'), torre),
            h('label', { class: 'destino-parte', for: 'apto' }, h('span', {}, 'Apto'), apto)),
          destinoEstado),
        h('div', { class: 'grupo' }, h('label', { class: 'etiqueta', for: 'obs' }, 'Observación'), obs),
        h('div', { style: { marginTop: '10px' } }, error),
        registrar,
        h('p', { class: 'ayuda', style: { marginTop: '12px' } }, 'La hora la fija el servidor y la foto se sella con marca de agua al registrar.'),
      ),
    ),
  );
  pintarDestino();
  encender();
  return () => { Camara.detener(); if (urlFoto) URL.revokeObjectURL(urlFoto); };
}

function mostrarResultado(ing, alNuevo) {
  const img = ing.sellada_url ? h('img', { src: ing.sellada_url, alt: `Evidencia sellada del ingreso ${consec(ing.consecutivo)}` }) : h('div', { class: 'banner ambar' }, ing.error ?? 'El sello de la foto no se generó.');
  const unidadCodigo = S.unidadPorId.get(ing.unidad_id)?.codigo ?? '—';
  const nuevo = h('button', { class: 'btn primario' }, icono('camara'), 'Nuevo ingreso');
  const m = modal({
    titulo: `Ingreso registrado ${consec(ing.consecutivo)}`,
    ancho: '880px',
    cuerpo: h('div', { class: 'resultado' }, img,
      h('div', {},
        h('div', { class: 'fila', style: { marginBottom: '14px' } }, h('span', { class: 'placa-mini' }, ing.placa), h('span', { class: 'chip azul' }, 'Visitante')),
        h('dl', { class: 'dato-lista' },
          h('dt', {}, 'Hora'), h('dd', {}, fmt.completa(ing.hora_ingreso)),
          h('dt', {}, 'Tipo'), h('dd', {}, ing.tipo_vehiculo),
          h('dt', {}, 'Destino'), h('dd', { class: 'mono' }, unidadCodigo),
          h('dt', {}, 'Guarda'), h('dd', { class: 'mono' }, S.perfil.codigo),
          h('dt', {}, 'Huella'), h('dd', { class: 'huella' }, ing.registro_sha256),
        ),
      )),
    acciones: [h('button', { class: 'btn', onclick: () => { m.cerrar(); location.hash = 'dentro'; } }, 'Ver vehículos dentro'), nuevo],
    alCerrar: alNuevo,
  });
  nuevo.onclick = () => m.cerrar();
  nuevo.focus();
}

// ---------------------------------------------------------------------
// Vista: vehículos dentro y salidas por cobrar
// ---------------------------------------------------------------------
function vistaDentro(c) {
  const buscar = h('input', { class: 'campo mono', placeholder: 'Buscar placa…', 'aria-label': 'Buscar placa', autocapitalize: 'characters' });
  const recargar = h('button', { class: 'btn', 'aria-label': 'Actualizar' }, icono('recargar'), 'Actualizar');
  const total = h('span', { class: 'chip azul' }, '…');
  const rejilla = h('div', { class: 'rejilla-tarjetas' });
  const rejillaCobro = h('div', { class: 'rejilla-tarjetas' });
  const subCobro = h('div', { class: 'subtitulo', hidden: true }, h('h2', {}, 'Salidas por cobrar'), h('span', { class: 'chip rojo', id: 'n-cobro' }, '0'));
  let datos = [];

  function tarjeta(v) {
    const min = minutosDesde(v.hora_ingreso);
    const est = v.estado === 'pendiente_pago' ? { valor: v.valor } : estimarValor(v);
    const alerta = v.estado === 'dentro' && min > S.cfg.alerta_permanencia_min;
    const puedeAnular = v.estado === 'dentro' && (esAdmin() || (v.guarda_ingreso_id === S.perfil.id && min <= S.cfg.anulacion_guarda_min));
    return h('article', { class: 'tarjeta' + (alerta ? ' alerta' : '') + (v.estado === 'pendiente_pago' ? ' cobro' : '') },
      h('div', { class: 'tarjeta-cabeza' },
        h('span', { class: 'placa-mini' }, v.placa),
        h('span', { class: 'mono mudo' }, consec(v.consecutivo))),
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, v.tipo_vehiculo),
        v.unidad_codigo ? h('span', { class: 'chip azul' }, v.unidad_codigo) : null,
        alerta ? h('span', { class: 'chip ambar' }, 'Permanencia alta') : null),
      h('div', { class: 'tarjeta-datos' },
        h('div', {}, h('div', { class: 'etiqueta' }, 'Entrada'), h('div', { class: 'v' }, fmt.hora(v.hora_ingreso)), h('div', { class: 'ayuda' }, duracion(min))),
        h('div', {}, h('div', { class: 'etiqueta' }, v.estado === 'pendiente_pago' ? 'Por cobrar' : 'Valor actual'),
          h('div', { class: 'v' }, cop(est.valor)),
          h('div', { class: 'ayuda' }, v.estado === 'pendiente_pago' ? `Salió ${fmt.hora(v.hora_salida)}` : `${est.horas} h × ${cop(S.tarifas[v.tipo_vehiculo]?.valor_hora)}`)),
      ),
      h('div', { class: 'tarjeta-acciones' },
        v.estado === 'pendiente_pago'
          ? h('button', { class: 'btn primario', onclick: () => flujoCobro(v, cargar) }, 'Cobrar')
          : h('button', { class: 'btn primario', onclick: () => flujoSalida(v, cargar) }, 'Registrar salida'),
        v.tiene_foto ? h('button', { class: 'btn chico fantasma', onclick: () => verFoto(v), 'aria-label': `Ver foto de ${v.placa}` }, icono('foto')) : null,
        puedeAnular ? h('button', { class: 'btn chico peligro', onclick: () => anular(v, cargar) }, 'Anular') : null,
      ),
    );
  }
  function pintar() {
    const q = buscar.value.trim().toUpperCase();
    const filtro = (v) => !q || v.placa.includes(q) || (v.unidad_codigo ?? '').includes(q);
    const dentro = datos.filter((v) => v.estado === 'dentro' && filtro(v));
    const cobro = datos.filter((v) => v.estado === 'pendiente_pago' && filtro(v));
    total.textContent = `${datos.filter((v) => v.estado === 'dentro').length} dentro`;
    rejilla.replaceChildren(...(dentro.length ? dentro.map(tarjeta) : [h('div', { class: 'vacio-lista' }, q ? 'Ninguna placa coincide con la búsqueda.' : 'No hay vehículos dentro en este momento.')]));
    subCobro.hidden = !cobro.length;
    const n = $('#n-cobro', subCobro); if (n) n.textContent = String(cobro.length);
    rejillaCobro.replaceChildren(...cobro.map(tarjeta));
  }
  async function cargar() {
    try {
      datos = revisar(await sb.from('v_ingresos')
        .select('id, consecutivo, placa, tipo_vehiculo, unidad_id, unidad_codigo, hora_ingreso, hora_salida, valor, estado, tiene_foto, guarda_ingreso_id')
        .in('estado', ['dentro', 'pendiente_pago']).order('hora_ingreso', { ascending: false }).limit(800));
      pintar();
    } catch (e) { aviso(mensajeError(e), 'error'); }
  }
  buscar.addEventListener('input', pintar);
  recargar.onclick = () => conBoton(recargar, cargar);
  c.append(cabecera('Portería · operación', 'Vehículos dentro', total, buscar, recargar), rejilla, subCobro, rejillaCobro);
  rejilla.append(h('div', { class: 'vacio-lista' }, h('span', { class: 'cargando' })));
  cargar();
  const intervalo = setInterval(cargar, 20000);
  const minuto = setInterval(pintar, 60000);
  return () => { clearInterval(intervalo); clearInterval(minuto); };
}

async function verFoto(v) {
  const cuerpo = h('div', {}, h('div', { class: 'vacio-lista' }, h('span', { class: 'cargando' })));
  const m = modal({ titulo: `Evidencia ${consec(v.consecutivo)} · ${v.placa}`, cuerpo, ancho: '900px' });
  try {
    const r = await llamar('evidencia', { ingreso_id: v.id, tipo: 'sellada' });
    cuerpo.replaceChildren(h('img', { src: r.url, alt: `Evidencia sellada de ${v.placa}`, style: { borderRadius: '8px', width: '100%' } }),
      h('p', { class: 'ayuda', style: { marginTop: '10px' } }, 'Huella de la imagen sellada: ', h('span', { class: 'huella' }, r.sha256)));
  } catch (e) { m.cerrar(); aviso(mensajeError(e), 'error'); }
}

function anular(v, alTerminar) {
  const motivo = h('textarea', { class: 'campo', id: 'motivo', maxlength: '300', placeholder: 'Ej.: placa mal digitada, se registra de nuevo' });
  const error = h('div', { class: 'error-campo' });
  const confirmar = h('button', { class: 'btn peligro' }, 'Anular registro');
  const m = modal({
    titulo: `Anular ${consec(v.consecutivo)} · ${v.placa}`,
    cuerpo: [h('div', { class: 'banner ambar' }, 'El registro no se borra: queda marcado como anulado, con su motivo y su responsable.'),
      h('div', { class: 'grupo', style: { marginTop: '14px' } }, h('label', { class: 'etiqueta', for: 'motivo' }, 'Motivo (mínimo 10 caracteres)'), motivo), error],
    acciones: [h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar'), confirmar],
  });
  confirmar.onclick = () => conBoton(confirmar, async () => {
    error.textContent = '';
    if (motivo.value.trim().length < 10) { error.textContent = 'Explique el motivo con al menos 10 caracteres.'; return; }
    const { error: e } = await sb.from('anulaciones').insert({ ingreso_id: v.id, motivo: motivo.value.trim() });
    if (e) { error.textContent = e.message; return; }
    aviso(`Registro ${consec(v.consecutivo)} anulado`);
    m.cerrar(); alTerminar?.();
  });
}

function flujoSalida(v, alTerminar) {
  const est = estimarValor(v);
  const confirmar = h('button', { class: 'btn primario grande' }, 'Confirmar salida');
  const m = modal({
    titulo: `Salida · ${v.placa}`,
    cuerpo: [
      h('div', { class: 'fila', style: { marginBottom: '16px' } }, h('span', { class: 'placa-mini' }, v.placa), h('span', { class: 'chip' }, v.tipo_vehiculo), v.unidad_codigo ? h('span', { class: 'chip azul' }, v.unidad_codigo) : null),
      h('dl', { class: 'dato-lista' },
        h('dt', {}, 'Entrada'), h('dd', {}, fmt.completa(v.hora_ingreso)),
        h('dt', {}, 'Tiempo'), h('dd', {}, duracion(minutosDesde(v.hora_ingreso))),
        h('dt', {}, 'Valor estimado'), h('dd', { class: 'mono' }, `${cop(est.valor)} · ${est.horas} h`)),
      h('p', { class: 'ayuda', style: { marginTop: '14px' } }, 'El valor definitivo lo calcula el servidor con la hora exacta de salida.'),
    ],
    acciones: [h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar'), confirmar],
  });
  confirmar.onclick = () => conBoton(confirmar, async () => {
    const { data, error } = await sb.from('salidas').insert({ ingreso_id: v.id }).select('valor, horas_cobradas, tarifa_hora, minutos').single();
    if (error) { aviso(error.message, 'error'); return; }
    m.cerrar();
    alTerminar?.();
    if (data.valor === 0) { aviso(`Salida registrada: ${v.placa} (sin cobro)`); return; }
    flujoCobro({ ...v, valor: data.valor, horas_cobradas: data.horas_cobradas, tarifa_hora: data.tarifa_hora, estado: 'pendiente_pago' }, alTerminar);
  });
}

function flujoCobro(v, alTerminar) {
  let sondeo = null; let reloj = null; let pagoActual = null;
  const cuerpo = h('div');
  const m = modal({ titulo: `Cobro · ${v.placa}`, cuerpo, ancho: '640px', alCerrar: () => { clearInterval(sondeo); clearInterval(reloj); alTerminar?.(); } });

  function pantallaInicial() {
    clearInterval(sondeo); clearInterval(reloj);
    const unidadCod = v.unidad_codigo ?? S.unidadPorId.get(v.unidad_id)?.codigo;
    const qrBtn = h('button', { class: 'btn primario grande' }, 'Generar QR de pago');
    const cargoBtn = S.cfg.permitir_cargo_unidad ? h('button', { class: 'btn grande' }, `Cargar a ${unidadCod ?? 'la unidad'}`) : null;
    cuerpo.replaceChildren(
      h('div', { class: 'etiqueta' }, 'Valor a pagar'),
      h('div', { class: 'monto', style: { margin: '6px 0 4px' } }, cop(v.valor)),
      h('div', { class: 'ayuda' }, v.horas_cobradas ? `${v.horas_cobradas} h × ${cop(v.tarifa_hora)} · hora o fracción` : 'Hora o fracción'),
      h('div', { class: 'banner azul', style: { margin: '16px 0' } }, 'El visitante paga desde su celular. El dinero llega directo a la cuenta del conjunto; la portería no recibe efectivo.'),
      h('div', { class: 'fila' }, qrBtn, cargoBtn),
    );
    qrBtn.onclick = () => conBoton(qrBtn, generarQR);
    if (cargoBtn) cargoBtn.onclick = () => pantallaCargo(unidadCod);
  }

  async function generarQR() {
    let r;
    try {
      r = await llamar('crear-cobro', { ingreso_id: v.id, base_url: location.origin + location.pathname.replace(/[^/]*$/, '') });
    } catch (e) { aviso(mensajeError(e), 'error'); return; }
    pagoActual = r.pago;
    const qr = qrcode(0, 'M'); qr.addData(pagoActual.url_pago); qr.make();
    const caja = h('div', { class: 'qr', html: qr.createSvgTag({ cellSize: 6, margin: 0, scalable: true }) });
    const estado = h('div', { class: 'estado-pago', style: { color: 'var(--azul)' } }, h('span', { class: 'punto' }), 'Esperando pago');
    const restante = h('span', { class: 'mono' });
    cuerpo.replaceChildren(
      h('div', { class: 'qr-caja' }, caja,
        h('div', {},
          h('div', { class: 'etiqueta' }, 'Escanee con la app del banco o la cámara'),
          h('div', { class: 'monto', style: { margin: '8px 0' } }, cop(pagoActual.monto)),
          estado,
          h('p', { class: 'ayuda' }, 'Vence en ', restante, ' · Ref. ', h('span', { class: 'mono' }, pagoActual.referencia)),
          pagoActual.proveedor === 'simulado' ? h('div', { class: 'banner ambar', style: { marginTop: '10px' } }, 'Modo de pruebas: el QR abre un pago simulado.') : null,
        )),
    );
    const fin = new Date(pagoActual.expira_en).getTime();
    const tic = () => {
      const s = Math.max(0, Math.round((fin - Date.now()) / 1000));
      restante.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      if (s === 0) { clearInterval(reloj); clearInterval(sondeo); pantallaFallo('El QR venció sin pago.'); }
    };
    tic(); reloj = setInterval(tic, 1000);
    sondeo = setInterval(async () => {
      const { data } = await sb.from('pagos').select('estado, metodo').eq('id', pagoActual.id).single();
      if (!data) return;
      if (data.estado === 'APROBADO') { clearInterval(sondeo); clearInterval(reloj); pantallaExito(data.metodo); }
      else if (['RECHAZADO', 'ERROR', 'ANULADO'].includes(data.estado)) { clearInterval(sondeo); clearInterval(reloj); pantallaFallo(`Pago ${data.estado.toLowerCase()}.`); }
    }, 2500);
  }

  function pantallaExito(metodo) {
    cuerpo.replaceChildren(h('div', { class: 'exito' },
      h('div', { class: 'icono' }, icono('check', 40)),
      h('h3', {}, 'Pago aprobado · salida autorizada'),
      h('p', { class: 'mudo' }, `${cop(pagoActual.monto)} recibidos${metodo ? ' por ' + metodo : ''} · Ref. ${pagoActual.referencia}`),
      h('button', { class: 'btn primario grande', style: { marginTop: '10px' }, onclick: () => m.cerrar() }, 'Listo')));
  }
  function pantallaFallo(texto) {
    cuerpo.replaceChildren(h('div', { class: 'banner rojo' }, texto),
      h('div', { class: 'fila', style: { marginTop: '16px' } },
        h('button', { class: 'btn primario', onclick: (ev) => conBoton(ev.currentTarget, generarQR) }, 'Generar QR nuevo'),
        h('button', { class: 'btn', onclick: pantallaInicial }, 'Volver')));
  }
  function pantallaCargo(unidadCod) {
    const motivo = h('textarea', { class: 'campo', id: 'motivo-cargo', maxlength: '300', placeholder: 'Ej.: el visitante no tiene medio de pago electrónico' });
    const error = h('div', { class: 'error-campo' });
    const ok = h('button', { class: 'btn primario' }, `Cargar ${cop(v.valor)} a ${unidadCod}`);
    cuerpo.replaceChildren(
      h('div', { class: 'banner ambar' }, 'El valor se suma a la cuenta de la unidad visitada y lo cobra la administración. No se recibe efectivo.'),
      h('div', { class: 'grupo', style: { marginTop: '14px' } }, h('label', { class: 'etiqueta', for: 'motivo-cargo' }, 'Motivo'), motivo), error,
      h('div', { class: 'fila', style: { marginTop: '14px' } }, ok, h('button', { class: 'btn', onclick: pantallaInicial }, 'Volver')),
    );
    ok.onclick = () => conBoton(ok, async () => {
      if (motivo.value.trim().length < 5) { error.textContent = 'Escriba el motivo.'; return; }
      const { error: e } = await sb.from('cargos_unidad').insert({ ingreso_id: v.id, motivo: motivo.value.trim() });
      if (e) { error.textContent = e.message; return; }
      aviso(`${cop(v.valor)} cargados a ${unidadCod}`);
      m.cerrar();
    });
  }
  pantallaInicial();
}

// ---------------------------------------------------------------------
// Vista: turno del guarda
// ---------------------------------------------------------------------
function vistaTurno(c) {
  const kpis = h('div', { class: 'kpis' });
  const tabla = h('div');
  c.append(cabecera('Portería · resumen', `Mi turno · ${S.perfil.codigo}`), kpis, h('div', { class: 'subtitulo' }, h('h2', {}, 'Mis registros de hoy')), tabla);
  (async () => {
    const [desde] = rangoDia(hoyLocal());
    const filas = revisar(await sb.from('v_ingresos')
      .select('id, consecutivo, placa, tipo_vehiculo, unidad_codigo, hora_ingreso, estado, valor, pago_monto')
      .eq('guarda_ingreso_id', S.perfil.id).gte('hora_ingreso', desde).order('hora_ingreso', { ascending: false }).limit(200));
    const pagado = filas.filter((f) => f.estado === 'pagado').reduce((a, f) => a + (f.pago_monto ?? 0), 0);
    kpis.replaceChildren(
      kpi('Ingresos registrados', filas.filter((f) => f.estado !== 'anulado').length, 'Hoy, por usted', 'lima'),
      kpi('Siguen dentro', filas.filter((f) => f.estado === 'dentro').length, 'De sus registros'),
      kpi('Recaudo', cop(pagado), 'Directo a la cuenta del conjunto', 'lima'),
      kpi('Anulados', filas.filter((f) => f.estado === 'anulado').length, 'Con motivo registrado', filas.some((f) => f.estado === 'anulado') ? 'ambar' : ''),
    );
    tabla.replaceChildren(tablaIngresos(filas, false));
  })().catch((e) => aviso(mensajeError(e), 'error'));
}

function kpi(etiqueta, valor, detalle, tono = '') {
  return h('div', { class: 'kpi ' + tono }, h('div', { class: 'etiqueta' }, etiqueta), h('div', { class: 'v' }, String(valor)), detalle ? h('div', { class: 'd' }, detalle) : null);
}

function tablaIngresos(filas, clic = true) {
  if (!filas.length) return h('div', { class: 'vacio-lista' }, 'No hay registros para mostrar.');
  return h('div', { class: 'tabla-caja' }, h('table', { class: 'tabla' },
    h('thead', {}, h('tr', {}, ['#', 'Hora', 'Placa', 'Tipo', 'Destino', 'Estado', 'Valor'].map((t, i) => h('th', { class: i === 6 ? 'num' : null }, t)))),
    h('tbody', {}, filas.map((f) => h('tr', { onclick: clic ? () => detalleRegistro(f.id) : null, tabindex: clic ? '0' : null, onkeydown: clic ? (ev) => { if (ev.key === 'Enter') detalleRegistro(f.id); } : null },
      h('td', { class: 'mono mudo' }, consec(f.consecutivo)),
      h('td', { class: 'mono' }, fmt.fechaHora(f.hora_ingreso)),
      h('td', { class: 'placa-celda' }, f.placa),
      h('td', {}, f.tipo_vehiculo),
      h('td', { class: 'mono' }, f.unidad_codigo ?? '—'),
      h('td', {}, chipEstado(f.estado)),
      h('td', { class: 'num' }, f.valor != null ? cop(f.estado === 'pagado' ? (f.pago_monto ?? f.valor) : f.valor) : '—'),
    ))),
  ));
}

// ---------------------------------------------------------------------
// Vista: tablero
// ---------------------------------------------------------------------
function vistaTablero(c) {
  const kpis = h('div', { class: 'kpis' }, h('div', { class: 'vacio-lista' }, h('span', { class: 'cargando' })));
  const grafica = h('div', { class: 'panel relleno' });
  const alertas = h('div', { class: 'panel relleno' });
  const ultimos = h('div');
  const recargar = h('button', { class: 'btn' }, icono('recargar'), 'Actualizar');
  c.append(cabecera('Administración · hoy', S.cfg.nombre_conjunto, recargar), kpis,
    h('div', { class: 'dos-columnas' }, grafica, alertas),
    h('div', { class: 'subtitulo' }, h('h2', {}, 'Últimos movimientos')), ultimos);

  async function cargar() {
    const [desde] = rangoDia(hoyLocal());
    const [r, hoy, criticos] = await Promise.all([
      sb.rpc('resumen_operacion').then(revisar),
      sb.from('v_ingresos').select('id, consecutivo, placa, tipo_vehiculo, unidad_codigo, hora_ingreso, hora_salida, minutos, estado, valor, pago_monto')
        .gte('hora_ingreso', desde).order('hora_ingreso', { ascending: false }).limit(1000).then(revisar),
      sb.from('v_ingresos').select('id, consecutivo, placa, hora_ingreso, estado, tiene_foto, sellado_en')
        .or(`and(estado.eq.dentro,hora_ingreso.lt."${new Date(Date.now() - S.cfg.alerta_permanencia_min * 60000).toISOString()}"),and(tiene_foto.eq.true,sellado_en.is.null)`)
        .order('hora_ingreso').limit(50).then(revisar),
    ]);
    const salidasHoy = hoy.filter((f) => f.minutos != null && f.estado !== 'anulado');
    const promedio = salidasHoy.length ? Math.round(salidasHoy.reduce((a, f) => a + f.minutos, 0) / salidasHoy.length) : null;
    kpis.replaceChildren(
      kpi('Vehículos dentro', r.dentro_total, `${plural(r.dentro_carros, 'carro', 'carros')} · ${plural(r.dentro_motos, 'moto', 'motos')}`, 'lima'),
      kpi('Tiempo promedio', promedio == null ? '—' : duracion(promedio), promedio == null ? 'Sin salidas hoy' : `De ${plural(salidasHoy.length, 'salida', 'salidas')} de hoy`),
      kpi('Ingresos hoy', r.ingresos_hoy, plural(r.salidas_hoy, 'salida', 'salidas')),
      kpi('Recaudo hoy', cop(r.recaudo_hoy), 'Pago electrónico aprobado', 'lima'),
      kpi('Cargos a unidades', cop(r.cargado_hoy), 'Hoy · se cobran en administración', r.cargado_hoy ? 'ambar' : ''),
      kpi('Por cobrar', cop(r.pendiente_total), `${plural(r.pendientes, 'salida', 'salidas')} sin pago`, r.pendientes ? 'rojo' : ''),
      kpi('Alertas', r.alerta_permanencia + r.sin_sello, `${r.alerta_permanencia} permanencia alta · ${r.sin_sello} sin sello`, (r.alerta_permanencia + r.sin_sello) ? 'ambar' : ''),
      kpi('Anulados hoy', r.anulados_hoy, 'Con motivo y responsable', r.anulados_hoy ? 'ambar' : ''),
    );
    // Gráfica de ingresos por hora (hora local)
    const porHora = new Array(24).fill(0);
    for (const f of hoy) if (f.estado !== 'anulado') {
      const hh = Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', hourCycle: 'h23' }).format(new Date(f.hora_ingreso)));
      porHora[hh] += 1;
    }
    const max = Math.max(1, ...porHora);
    const W = 720, H = 220, base = 190, ancho = (W - 40) / 24;
    let barras = '';
    porHora.forEach((n, i) => {
      const alto = Math.round((n / max) * 150);
      const x = 30 + i * ancho;
      barras += `<rect x="${x + 3}" y="${base - alto}" width="${ancho - 6}" height="${alto}" rx="3" fill="${n ? '#C4F82A' : '#2A2F34'}"/>`;
      if (n) barras += `<text x="${x + ancho / 2}" y="${base - alto - 6}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#ECEEE9">${n}</text>`;
      if (i % 3 === 0) barras += `<text x="${x + ancho / 2}" y="${base + 18}" text-anchor="middle" font-family="IBM Plex Mono" font-size="11" fill="#8E959B">${String(i).padStart(2, '0')}h</text>`;
    });
    grafica.replaceChildren(h('div', { class: 'etiqueta' }, 'Ingresos por hora · hoy'), h('h2', { style: { margin: '4px 0 12px' } }, plural(hoy.filter((f) => f.estado !== 'anulado').length, 'ingreso', 'ingresos')),
      h('div', { html: `<svg class="grafica" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ingresos por hora del día"><line x1="30" x2="${W - 10}" y1="${base}" y2="${base}" stroke="#383E44"/>${barras}</svg>` }));
    alertas.replaceChildren(h('div', { class: 'etiqueta' }, 'Requiere atención'), h('h2', { style: { margin: '4px 0 8px' } }, criticos.length ? `${criticos.length} casos` : 'Sin novedades'),
      criticos.length ? h('div', { class: 'lista-simple' }, criticos.slice(0, 8).map((f) => h('div', {},
        h('span', {}, h('span', { class: 'placa-celda mono' }, f.placa), ' ', h('span', { class: 'mudo mono' }, consec(f.consecutivo))),
        f.estado === 'dentro' && f.sellado_en ? h('span', { class: 'chip ambar' }, `Dentro hace ${duracion(minutosDesde(f.hora_ingreso))}`) : h('span', { class: 'chip rojo' }, 'Sin sello')))) :
        h('p', { class: 'mudo' }, 'No hay vehículos con permanencia alta ni registros sin sello.'));
    ultimos.replaceChildren(tablaIngresos(hoy.slice(0, 12)));
  }
  recargar.onclick = () => conBoton(recargar, () => cargar().catch((e) => aviso(mensajeError(e), 'error')));
  cargar().catch((e) => aviso(mensajeError(e), 'error'));
  const t = setInterval(() => cargar().catch(() => {}), 30000);
  return () => clearInterval(t);
}

// ---------------------------------------------------------------------
// Vista: registros (búsqueda y auditoría)
// ---------------------------------------------------------------------
function vistaRegistros(c) {
  const hoy = hoyLocal();
  const desde = h('input', { class: 'campo', type: 'date', value: hoy, 'aria-label': 'Desde' });
  const hasta = h('input', { class: 'campo', type: 'date', value: hoy, 'aria-label': 'Hasta' });
  const placa = h('input', { class: 'campo mono', placeholder: 'Placa', 'aria-label': 'Placa', autocapitalize: 'characters' });
  const estado = h('select', { class: 'campo', 'aria-label': 'Estado' }, h('option', { value: '' }, 'Todos los estados'),
    Object.entries(ETIQ_ESTADO).map(([k, [t]]) => h('option', { value: k }, t)));
  const buscar = h('button', { class: 'btn primario' }, 'Buscar');
  const exportar = h('button', { class: 'btn' }, 'Exportar CSV');
  const resultado = h('div');
  let filas = [];

  async function cargar() {
    const [ini] = rangoDia(desde.value || hoy);
    const [, fin] = rangoDia(hasta.value || hoy);
    let q = sb.from('v_ingresos').select('*').gte('hora_ingreso', ini).lt('hora_ingreso', fin).order('consecutivo', { ascending: false }).limit(500);
    const p = placa.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (p) q = q.ilike('placa', `%${p}%`);
    if (estado.value) q = q.eq('estado', estado.value);
    filas = revisar(await q);
    resultado.replaceChildren(h('p', { class: 'ayuda' }, `${filas.length} registros${filas.length === 500 ? ' (máximo mostrado: 500; acote las fechas)' : ''}`), tablaIngresos(filas));
  }
  buscar.onclick = () => conBoton(buscar, () => cargar().catch((e) => aviso(mensajeError(e), 'error')));
  exportar.onclick = () => descargarCSV(filas, `registros_${desde.value}_${hasta.value}.csv`);
  c.append(cabecera('Auditoría', 'Registros de ingreso y salida', exportar),
    h('div', { class: 'barra-filtro' }, desde, hasta, placa, estado, buscar), resultado);
  cargar().catch((e) => aviso(mensajeError(e), 'error'));
}

function descargarCSV(filas, nombre) {
  if (!filas.length) { aviso('No hay datos para exportar', 'alerta'); return; }
  const cols = ['consecutivo', 'hora_ingreso', 'placa', 'tipo_vehiculo', 'unidad_codigo', 'guarda_ingreso_codigo', 'hora_salida', 'minutos', 'horas_cobradas', 'valor', 'estado', 'pago_estado', 'pago_referencia', 'pago_metodo', 'registro_sha256', 'foto_original_sha256'];
  const celda = (x) => { const s = x == null ? '' : String(x); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = '﻿' + [cols.join(';'), ...filas.map((f) => cols.map((k) => celda(f[k])).join(';'))].join('\n');
  const a = h('a', { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: nombre });
  document.body.append(a); a.click(); a.remove();
}

async function huellaArchivo(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('No se pudo descargar la imagen');
  const buf = await r.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function detalleRegistro(id) {
  const cuerpo = h('div', {}, h('div', { class: 'vacio-lista' }, h('span', { class: 'cargando' })));
  const acciones = [];
  const cj = cajon({ titulo: 'Detalle del registro', cuerpo, acciones });
  try {
    const v = revisar(await sb.from('v_ingresos').select('*').eq('id', id).single());
    const foto = h('div');
    const verificacion = h('div', { style: { marginTop: '10px' } });
    const bloques = [
      h('div', { class: 'fila', style: { marginBottom: '14px' } }, h('span', { class: 'placa-mini' }, v.placa), chipEstado(v.estado), h('span', { class: 'mono mudo' }, consec(v.consecutivo))),
      foto,
      h('dl', { class: 'dato-lista', style: { marginTop: '16px' } },
        h('dt', {}, 'Entrada'), h('dd', {}, fmt.completa(v.hora_ingreso)),
        h('dt', {}, 'Guarda'), h('dd', {}, `${v.guarda_ingreso_codigo} · ${v.guarda_ingreso_nombre}`),
        h('dt', {}, 'Vehículo'), h('dd', {}, `${v.tipo_vehiculo} · visitante`),
        h('dt', {}, 'Destino'), h('dd', { class: 'mono' }, v.unidad_codigo ?? '—'),
        v.hora_salida ? [h('dt', {}, 'Salida'), h('dd', {}, `${fmt.completa(v.hora_salida)} · ${v.guarda_salida_codigo ?? ''}`)] : null,
        v.minutos != null ? [h('dt', {}, 'Tiempo'), h('dd', {}, `${duracion(v.minutos)} · ${v.horas_cobradas} h cobradas`)] : null,
        v.valor != null ? [h('dt', {}, 'Valor'), h('dd', { class: 'mono' }, cop(v.valor))] : null,
        v.pago_estado ? [h('dt', {}, 'Pago'), h('dd', {}, `${v.pago_estado}${v.pago_metodo ? ' · ' + v.pago_metodo : ''} · ${v.pago_referencia}`)] : null,
        v.cargo_en ? [h('dt', {}, 'Cargo'), h('dd', {}, `A ${v.unidad_codigo}: ${v.cargo_motivo}`)] : null,
        v.anulado_en ? [h('dt', {}, 'Anulación'), h('dd', {}, `${fmt.completa(v.anulado_en)} · ${v.anulacion_motivo}`)] : null,
        v.observacion ? [h('dt', {}, 'Observación'), h('dd', {}, v.observacion)] : null,
        h('dt', {}, 'Huella registro'), h('dd', { class: 'huella' }, v.registro_sha256),
        h('dt', {}, 'Huella anterior'), h('dd', { class: 'huella', style: { color: 'var(--mudo)' } }, v.hash_anterior),
        v.foto_original_sha256 ? [h('dt', {}, 'Huella foto'), h('dd', { class: 'huella' }, v.foto_original_sha256)] : null,
      ),
      verificacion,
    ];
    cuerpo.replaceChildren(...bloques);
    if (v.tiene_foto && v.sellado_en) {
      llamar('evidencia', { ingreso_id: v.id, tipo: 'sellada' })
        .then((r) => foto.replaceChildren(h('img', { src: r.url, alt: `Evidencia sellada de ${v.placa}`, style: { borderRadius: '8px', width: '100%' } })))
        .catch((e) => foto.replaceChildren(h('div', { class: 'banner rojo' }, mensajeError(e))));
    } else if (v.tiene_foto) {
      foto.replaceChildren(h('div', { class: 'banner ambar' }, 'Este ingreso tiene foto original pero no tiene sello.'));
    }
    if (v.tiene_foto && S.perfil.rol !== 'guarda') {
      const verificar = h('button', { class: 'btn' }, icono('escudo'), 'Verificar foto original');
      verificar.onclick = () => conBoton(verificar, async () => {
        try {
          const r = await llamar('evidencia', { ingreso_id: v.id, tipo: 'original' });
          const calculada = await huellaArchivo(r.url);
          const ok = calculada === v.foto_original_sha256;
          verificacion.replaceChildren(h('div', { class: 'banner ' + (ok ? 'lima' : 'rojo') },
            ok ? 'La foto original coincide con la huella guardada al registrar: no ha sido alterada.' : 'La foto original NO coincide con su huella. Revise la evidencia.'));
        } catch (e) { verificacion.replaceChildren(h('div', { class: 'banner rojo' }, mensajeError(e))); }
      });
      acciones.push(verificar);
    }
    if (esAdmin() && v.tiene_foto && !v.sellado_en) {
      const resellar = h('button', { class: 'btn' }, 'Generar sello');
      resellar.onclick = () => conBoton(resellar, async () => {
        const f = new FormData(); f.append('accion', 'resellar'); f.append('id', String(v.id));
        try { await llamar('registrar-ingreso', f, true); aviso('Sello generado'); cj.cerrar(); detalleRegistro(id); } catch (e) { aviso(mensajeError(e), 'error'); }
      });
      acciones.push(resellar);
    }
    if (esAdmin() && v.estado !== 'anulado' && v.estado !== 'pagado') {
      acciones.push(h('button', { class: 'btn peligro', onclick: () => { cj.cerrar(); anular(v, () => detalleRegistro(id)); } }, 'Anular'));
    }
    cj.pie.replaceChildren(...acciones);
    cj.pie.hidden = !acciones.length;
  } catch (e) { cuerpo.replaceChildren(h('div', { class: 'banner rojo' }, mensajeError(e))); }
}

// ---------------------------------------------------------------------
// Vista: conciliación
// ---------------------------------------------------------------------
function vistaConciliacion(c) {
  const fecha = h('input', { class: 'campo', type: 'date', value: hoyLocal(), 'aria-label': 'Fecha' });
  const ver = h('button', { class: 'btn primario' }, 'Conciliar');
  const cadena = h('button', { class: 'btn' }, icono('escudo'), 'Verificar cadena de huellas');
  const exportar = h('button', { class: 'btn' }, 'Exportar día');
  const res = h('div');
  const resCadena = h('div', { style: { marginTop: '16px' } });

  async function cargar() {
    const r = revisar(await sb.rpc('conciliacion', { p_fecha: fecha.value }));
    const cuadra = r.diferencia === 0 && r.pendiente === 0;
    res.replaceChildren(
      h('div', { class: 'banner ' + (cuadra ? 'lima' : 'rojo'), style: { marginBottom: '16px' } },
        cuadra ? `El día ${fecha.value} cuadra: todo lo cobrable está pagado o cargado a una unidad.` : `Diferencia de ${cop(r.diferencia)} en el día ${fecha.value}. Revise las novedades.`),
      h('div', { class: 'kpis' },
        kpi('Salidas', r.salidas, `${r.salidas_cobrables} con cobro`),
        kpi('Valor cobrable', cop(r.valor_cobrable), 'Calculado por el servidor'),
        kpi('Pagado', cop(r.pagado), 'Electrónico, aprobado', 'lima'),
        kpi('Cargos a unidades', cop(r.cargado_unidad), 'Por cobrar en administración', r.cargado_unidad ? 'ambar' : ''),
        kpi('Pendiente', cop(r.pendiente), 'Sin pago ni cargo', r.pendiente ? 'rojo' : ''),
        kpi('Diferencia', cop(r.diferencia), 'Meta: $0', r.diferencia ? 'rojo' : 'lima'),
        kpi('Ingresos del día', r.ingresos, `${r.anulaciones} anulaciones · ${r.sin_sello} sin sello`),
      ),
      h('div', { class: 'subtitulo' }, h('h2', {}, 'Novedades'), h('span', { class: 'chip ' + (r.novedades.length ? 'rojo' : 'lima') }, String(r.novedades.length))),
      r.novedades.length ? h('div', { class: 'tabla-caja' }, h('table', { class: 'tabla' },
        h('thead', {}, h('tr', {}, ['#', 'Placa', 'Novedad', 'Valor', 'Pagado', 'Cargado'].map((t, i) => h('th', { class: i > 2 ? 'num' : null }, t)))),
        h('tbody', {}, r.novedades.map((n) => h('tr', {},
          h('td', { class: 'mono' }, consec(n.consecutivo)), h('td', { class: 'placa-celda' }, n.placa),
          h('td', {}, { sin_pago: 'Salida sin pago ni cargo', pago_duplicado: 'Pago duplicado (revisar reembolso)', monto_distinto: 'Monto pagado distinto' }[n.tipo] ?? n.tipo),
          h('td', { class: 'num' }, cop(n.valor)), h('td', { class: 'num' }, cop(n.pagado)), h('td', { class: 'num' }, cop(n.cargado))))))) :
        h('div', { class: 'vacio-lista' }, 'Sin novedades.'),
    );
  }
  ver.onclick = () => conBoton(ver, () => cargar().catch((e) => aviso(mensajeError(e), 'error')));
  cadena.onclick = () => conBoton(cadena, async () => {
    try {
      const r = revisar(await sb.rpc('verificar_cadena', {}));
      resCadena.replaceChildren(h('div', { class: 'banner ' + (r.integra ? 'lima' : 'rojo') },
        r.integra ? `Cadena íntegra: ${r.revisados} registros verificados, ninguno alterado ni faltante.`
          : `Se detectaron ${r.fallas.length} fallas: ${r.fallas.slice(0, 8).map((f) => `${consec(f.consecutivo)} (${f.falla.replace(/_/g, ' ')})`).join(', ')}`));
    } catch (e) { aviso(mensajeError(e), 'error'); }
  });
  exportar.onclick = () => conBoton(exportar, async () => {
    const [ini, fin] = rangoDia(fecha.value);
    const filas = revisar(await sb.from('v_ingresos').select('*').or(`and(hora_salida.gte."${ini}",hora_salida.lt."${fin}"),and(hora_ingreso.gte."${ini}",hora_ingreso.lt."${fin}")`).order('consecutivo').limit(5000));
    descargarCSV(filas, `conciliacion_${fecha.value}.csv`);
  });
  c.append(cabecera('Auditoría · recaudo', 'Conciliación diaria', cadena, exportar), h('div', { class: 'barra-filtro' }, fecha, ver), res, resCadena);
  cargar().catch((e) => aviso(mensajeError(e), 'error'));
}

// ---------------------------------------------------------------------
// Vista: ajustes (administración)
// ---------------------------------------------------------------------
function vistaAjustes(c) {
  const secciones = { general: 'General', tarifas: 'Tarifas', unidades: 'Apartamentos', personal: 'Personal' };
  const zona = h('div');
  const botones = Object.entries(secciones).map(([k, t]) => h('button', { class: 'btn chico', 'data-sec': k, onclick: () => abrir(k) }, t));
  function abrir(k) {
    for (const b of botones) b.classList.toggle('primario', b.dataset.sec === k);
    zona.replaceChildren();
    ({ general: ajustesGeneral, tarifas: ajustesTarifas, unidades: ajustesUnidades, personal: ajustesPersonal })[k](zona);
  }
  c.append(cabecera('Administración', 'Ajustes del sistema'), h('div', { class: 'subtabs' }, botones), zona);
  abrir('general');
}

function ajustesGeneral(z) {
  const cfg = S.cfg;
  const campos = {
    nombre_conjunto: h('input', { class: 'campo', value: cfg.nombre_conjunto, maxlength: '80' }),
    alerta_permanencia_min: h('input', { class: 'campo', type: 'number', min: '30', max: '10080', value: cfg.alerta_permanencia_min }),
    qr_minutos_validez: h('input', { class: 'campo', type: 'number', min: '3', max: '120', value: cfg.qr_minutos_validez }),
    anulacion_guarda_min: h('input', { class: 'campo', type: 'number', min: '0', max: '120', value: cfg.anulacion_guarda_min }),
    retencion_dias_visitantes: h('input', { class: 'campo', type: 'number', min: '30', max: '3650', value: cfg.retencion_dias_visitantes }),
    dias_vigencia_clave: h('input', { class: 'campo', type: 'number', min: '30', max: '365', value: cfg.dias_vigencia_clave }),
    permitir_cargo_unidad: h('select', { class: 'campo' }, h('option', { value: 'true' }, 'Permitido'), h('option', { value: 'false' }, 'No permitido')),
  };
  campos.permitir_cargo_unidad.value = String(cfg.permitir_cargo_unidad);
  const etiquetas = {
    nombre_conjunto: 'Nombre del conjunto', alerta_permanencia_min: 'Alerta de permanencia (minutos)', qr_minutos_validez: 'Vigencia del QR de pago (minutos)',
    anulacion_guarda_min: 'Minutos que tiene el guarda para anular', retencion_dias_visitantes: 'Retención de fotos de visitantes (días)',
    dias_vigencia_clave: 'Vigencia de las claves del personal (días)', permitir_cargo_unidad: 'Cargo a la unidad visitada',
  };
  const guardar = h('button', { class: 'btn primario' }, 'Guardar cambios');
  const error = h('div', { class: 'error-campo' });
  guardar.onclick = () => conBoton(guardar, async () => {
    const cambios = {
      nombre_conjunto: campos.nombre_conjunto.value.trim(),
      alerta_permanencia_min: Number(campos.alerta_permanencia_min.value),
      qr_minutos_validez: Number(campos.qr_minutos_validez.value),
      anulacion_guarda_min: Number(campos.anulacion_guarda_min.value),
      retencion_dias_visitantes: Number(campos.retencion_dias_visitantes.value),
      dias_vigencia_clave: Number(campos.dias_vigencia_clave.value),
      permitir_cargo_unidad: campos.permitir_cargo_unidad.value === 'true',
    };
    const { data, error: e } = await sb.from('configuracion').update(cambios).eq('id', 1).select().single();
    if (e) { error.textContent = e.message; return; }
    S.cfg = data; error.textContent = ''; aviso('Configuración guardada');
  });
  z.append(h('div', { class: 'dos-columnas', style: { marginTop: 0 } },
    h('section', { class: 'panel relleno' }, h('h2', { style: { marginBottom: '14px' } }, 'Operación'),
      Object.entries(campos).map(([k, el]) => h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, etiquetas[k]), el)),
      error, h('div', { style: { marginTop: '14px' } }, guardar)),
    h('div', { class: 'pila' },
      h('section', { class: 'panel relleno' }, h('h2', {}, 'Pasarela de pagos'),
        h('p', {}, 'Modo actual: ', h('span', { class: 'chip ' + (cfg.pagos_modo === 'simulado' ? 'ambar' : 'lima') }, cfg.pagos_modo.replace('_', ' '))),
        h('p', { class: 'mudo' }, 'Para pasar a Wompi se cargan las llaves de la cuenta del conjunto como secretos del servidor (WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET y WOMPI_EVENTS_SECRET) y se cambia el modo. Ese paso lo realiza SP Automatizaciones con el representante legal del conjunto.'),
      ),
      S.perfil.rol === 'superadmin' ? mantenimientoEvidencias() : null,
    ),
  ));
}

function mantenimientoEvidencias() {
  const boton = h('button', { class: 'btn' }, 'Limpiar fotos huérfanas');
  const resultado = h('p', { class: 'ayuda', 'aria-live': 'polite' });
  boton.onclick = () => conBoton(boton, async () => {
    try {
      const r = await llamar('evidencia', { accion: 'limpiar_huerfanas' });
      resultado.textContent = r.borrados ? `${r.borrados} fotos sin registro eliminadas del almacenamiento.` : 'No hay fotos huérfanas.';
    } catch (e) { resultado.textContent = mensajeError(e); }
  });
  return h('section', { class: 'panel relleno' }, h('h2', {}, 'Mantenimiento'),
    h('p', { class: 'mudo' }, 'Borra del almacenamiento las fotos que no pertenecen a ningún registro, por ejemplo después de purgar datos de prueba. Nunca toca la evidencia de un ingreso.'),
    boton, resultado);
}

function ajustesTarifas(z) {
  const lista = h('div');
  const tipo = h('select', { class: 'campo' }, h('option', { value: 'carro' }, 'Carro'), h('option', { value: 'moto' }, 'Moto'));
  const valor = h('input', { class: 'campo mono', type: 'number', min: '0', step: '50', placeholder: 'Valor por hora' });
  const gracia = h('input', { class: 'campo mono', type: 'number', min: '0', max: '59', value: '0' });
  const crear = h('button', { class: 'btn primario' }, 'Publicar tarifa');
  const error = h('div', { class: 'error-campo' });
  async function cargar() {
    const filas = revisar(await sb.from('tarifas').select('*').order('vigente_desde', { ascending: false }).limit(40));
    lista.replaceChildren(h('div', { class: 'tabla-caja' }, h('table', { class: 'tabla', style: { minWidth: '520px' } },
      h('thead', {}, h('tr', {}, ['Tipo', 'Valor / hora', 'Gracia', 'Vigente desde', 'Estado'].map((t) => h('th', {}, t)))),
      h('tbody', {}, filas.map((t) => h('tr', { style: { cursor: 'default' } }, h('td', {}, t.tipo_vehiculo), h('td', { class: 'mono' }, cop(t.valor_hora)), h('td', { class: 'mono' }, `${t.minutos_gracia} min`),
        h('td', { class: 'mono' }, fmt.fechaHora(t.vigente_desde)), h('td', {}, S.tarifas[t.tipo_vehiculo]?.id === t.id ? h('span', { class: 'chip lima' }, 'Vigente') : h('span', { class: 'chip' }, 'Histórica'))))))));
  }
  crear.onclick = () => conBoton(crear, async () => {
    const v = Number(valor.value), g = Number(gracia.value);
    if (!(v >= 0 && v <= 100000)) { error.textContent = 'Valor inválido.'; return; }
    const { error: e } = await sb.from('tarifas').insert({ tipo_vehiculo: tipo.value, valor_hora: v, minutos_gracia: g });
    if (e) { error.textContent = e.message; return; }
    error.textContent = ''; valor.value = ''; aviso('Tarifa publicada; aplica a los ingresos desde ahora');
    await cargarCatalogos(); await cargar();
  });
  z.append(h('div', { class: 'dos-columnas', style: { marginTop: 0 } },
    lista,
    h('section', { class: 'panel relleno' }, h('h2', {}, 'Nueva tarifa'),
      h('p', { class: 'ayuda' }, 'Las tarifas no se editan: se publica una nueva y la anterior queda en el historial. Aplica a los vehículos que ingresen desde ese momento.'),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Tipo'), tipo),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Valor por hora o fracción (COP)'), valor),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Minutos de gracia'), gracia),
      error, crear)));
  cargar().catch((e) => aviso(mensajeError(e), 'error'));
}

function ajustesUnidades(z) {
  let torreSel = 1;
  const buscar = h('input', { class: 'campo mono', placeholder: 'Ir a torre… (ej.: 12)', 'aria-label': 'Ir a una torre', inputmode: 'numeric', maxlength: '8' });
  const resumen = h('p', { class: 'ayuda', style: { margin: '0 0 12px' } });
  const torres = h('div', { class: 'torres', role: 'group', 'aria-label': 'Torres del conjunto' });
  const detalle = h('section', { class: 'panel relleno' });

  function porTorre() {
    const m = new Map();
    for (const u of S.unidades) {
      const t = Number(u.torre);
      if (!m.has(t)) m.set(t, []);
      m.get(t).push(u);
    }
    return m;
  }
  function pintar() {
    const mapa = porTorre();
    const activos = S.unidades.filter((u) => u.activa).length;
    const n = (x) => x.toLocaleString('es-CO');
    resumen.textContent = `${n(S.unidades.length)} apartamentos en ${mapa.size} torres · ${n(activos)} activos · ${n(S.unidades.length - activos)} inactivos`;
    torres.replaceChildren(...[...mapa.keys()].sort((a, b) => a - b).map((t) => {
      const inactivos = mapa.get(t).filter((u) => !u.activa).length;
      return h('button', {
        class: 'torre-btn', 'aria-pressed': String(t === torreSel), title: inactivos ? `${inactivos} inactivos` : `Torre ${t}`,
        onclick: () => { torreSel = t; pintar(); },
      }, String(t), inactivos ? h('span', { class: 'marca-inactivo', 'aria-label': `${inactivos} inactivos` }) : null);
    }));
    const lista = mapa.get(torreSel) ?? [];
    const pisos = [];
    for (let p = ESTRUCTURA.pisos; p >= 1; p--) {
      const fila = lista.filter((u) => Math.floor(Number(u.numero) / 100) === p).sort((a, b) => Number(a.numero) - Number(b.numero));
      pisos.push(h('div', { class: 'piso' },
        h('span', { class: 'piso-etq' }, `Piso ${p}`),
        h('div', { class: 'piso-aptos' }, fila.map((u) => h('button', {
          class: 'apto' + (u.activa ? '' : ' inactivo'), 'aria-pressed': String(u.activa),
          'aria-label': `${u.codigo}: ${u.activa ? 'activo, pulse para inactivar' : 'inactivo, pulse para activar'}`,
          onclick: (ev) => alternar(u, ev.currentTarget),
        }, h('b', {}, u.numero), h('span', {}, u.activa ? 'Activo' : 'Inactivo'))))));
    }
    detalle.replaceChildren(
      h('div', { class: 'fila', style: { justifyContent: 'space-between', marginBottom: '14px' } },
        h('div', {}, h('div', { class: 'etiqueta' }, 'Torre seleccionada'), h('h2', { style: { marginTop: '4px' } }, `Torre ${torreSel}`)),
        h('span', { class: 'chip' }, `${lista.filter((u) => u.activa).length} de ${lista.length} activos`)),
      h('div', { class: 'pisos' }, pisos),
      h('p', { class: 'ayuda', style: { marginTop: '14px' } }, 'Pulse un apartamento para activarlo o inactivarlo. Un apartamento inactivo no se puede elegir como destino en portería.'),
    );
  }
  async function alternar(u, boton) {
    if (boton.disabled) return;
    boton.disabled = true;
    boton.classList.add('ocupado');
    try {
      const { error: e } = await sb.from('unidades').update({ activa: !u.activa }).eq('id', u.id);
      if (e) { aviso(e.message, 'error'); return; }
      await cargarCatalogos();
      aviso(`${u.codigo} ${u.activa ? 'inactivado' : 'activado'}`);
    } catch (e) {
      aviso(mensajeError(e), 'error');
    } finally {
      pintar();
    }
  }
  buscar.addEventListener('input', () => {
    const m = buscar.value.toUpperCase().replace(/\s+/g, '').match(/^T?(\d{1,2})/);
    const t = m ? Number(m[1]) : 0;
    if (t >= 1 && t <= ESTRUCTURA.torres && t !== torreSel) { torreSel = t; pintar(); }
  });
  z.append(h('div', { class: 'unidades-rejilla' },
    h('section', {},
      h('div', { class: 'barra-filtro' }, buscar),
      resumen,
      torres,
      h('p', { class: 'ayuda', style: { marginTop: '14px' } }, `Listado fijo del conjunto: ${ESTRUCTURA.torres} torres × ${ESTRUCTURA.pisos} pisos × ${ESTRUCTURA.aptos} apartamentos (${RANGO_APTOS}). El punto ámbar marca torres con apartamentos inactivos.`)),
    detalle));
  pintar();
}

function ajustesPersonal(z) {
  const lista = h('div');
  const nombre = h('input', { class: 'campo', placeholder: 'Nombre completo', maxlength: '80' });
  const codigo = h('input', { class: 'campo mono', placeholder: 'Ej.: G-12', maxlength: '12', autocapitalize: 'characters' });
  const rol = h('select', { class: 'campo' }, h('option', { value: 'guarda' }, 'Guarda'), h('option', { value: 'consejo' }, 'Consejo (solo lectura)'),
    S.perfil.rol === 'superadmin' ? h('option', { value: 'admin' }, 'Administración') : null);
  const email = h('input', { class: 'campo', type: 'email', placeholder: 'Opcional' });
  const clave = h('input', { class: 'campo', type: 'password', autocomplete: 'new-password', placeholder: 'Guardas: 6 dígitos o más' });
  const crear = h('button', { class: 'btn primario' }, 'Crear usuario');
  const error = h('div', { class: 'error-campo' });
  async function cargar() {
    const r = await llamar('admin-usuarios', { accion: 'listar' });
    const estadoClave = (u) => (!u.clave_vence_en ? h('span', { class: 'chip ambar' }, 'Temporal')
      : new Date(u.clave_vence_en) <= new Date() ? h('span', { class: 'chip rojo' }, 'Vencida')
        : h('span', { class: 'mono', title: 'Vence' }, fmt.fecha(u.clave_vence_en)));
    lista.replaceChildren(h('div', { class: 'tabla-caja' }, h('table', { class: 'tabla', style: { minWidth: '760px' } },
      h('thead', {}, h('tr', {}, ['Código', 'Nombre', 'Rol', 'Último ingreso', 'Clave vence', 'Estado', ''].map((t) => h('th', {}, t)))),
      h('tbody', {}, r.usuarios.map((u) => h('tr', { style: { cursor: 'default' } },
        h('td', { class: 'placa-celda' }, u.codigo), h('td', {}, u.nombre), h('td', {}, ROL_NOMBRE[u.rol]),
        h('td', { class: 'mono' }, u.ultimo_ingreso ? fmt.fechaHora(u.ultimo_ingreso) : '—'),
        h('td', {}, estadoClave(u)),
        h('td', {}, u.activo ? h('span', { class: 'chip lima' }, 'Activo') : h('span', { class: 'chip rojo' }, 'Inactivo')),
        h('td', {}, u.id === S.perfil.id ? h('span', { class: 'mudo' }, 'Usted') : h('div', { class: 'fila' },
          h('button', { class: 'btn chico', onclick: (ev) => conBoton(ev.currentTarget, async () => {
            try { await llamar('admin-usuarios', { accion: 'estado', id: u.id, activo: !u.activo }); aviso(u.activo ? `${u.codigo} desactivado` : `${u.codigo} activado`); await cargar(); } catch (e) { aviso(mensajeError(e), 'error'); }
          }) }, u.activo ? 'Desactivar' : 'Activar'),
          h('button', { class: 'btn chico', onclick: () => cambiarClaveDe(u) }, 'Clave')))))))));
  }
  function cambiarClaveDe(u) {
    const nueva = h('input', { class: 'campo', type: 'password', autocomplete: 'new-password' });
    const err = h('div', { class: 'error-campo' });
    const ok = h('button', { class: 'btn primario' }, 'Asignar clave');
    const m = modal({ titulo: `Clave temporal · ${u.codigo}`, cuerpo: [h('p', { class: 'mudo', style: { marginTop: 0 } }, 'La clave que asigne es temporal: el usuario deberá cambiarla por una propia al ingresar.'), h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Clave temporal'), nueva), err], acciones: [h('button', { class: 'btn', onclick: () => m.cerrar() }, 'Cancelar'), ok] });
    ok.onclick = () => conBoton(ok, async () => {
      try { await llamar('admin-usuarios', { accion: 'clave', id: u.id, clave: nueva.value }); aviso(`Clave temporal asignada a ${u.codigo}`); m.cerrar(); await cargar(); } catch (e) { err.textContent = mensajeError(e); }
    });
  }
  crear.onclick = () => conBoton(crear, async () => {
    error.textContent = '';
    try {
      const r = await llamar('admin-usuarios', { accion: 'crear', nombre: nombre.value.trim(), codigo: codigo.value.trim().toUpperCase(), rol: rol.value, email: email.value.trim() || undefined, clave: clave.value });
      aviso(`Usuario ${r.codigo} creado. En su primer ingreso deberá cambiar la clave temporal.`);
      nombre.value = ''; codigo.value = ''; email.value = ''; clave.value = '';
      await cargar();
    } catch (e) { error.textContent = mensajeError(e); }
  });
  z.append(h('div', { class: 'dos-columnas', style: { marginTop: 0 } }, lista,
    h('section', { class: 'panel relleno' }, h('h2', {}, 'Nuevo usuario'),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Nombre'), nombre),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Código de ingreso'), codigo),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Rol'), rol),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Correo'), email),
      h('div', { class: 'grupo' }, h('label', { class: 'etiqueta' }, 'Clave temporal'), clave),
      error, crear)));
  cargar().catch((e) => aviso(mensajeError(e), 'error'));
}

// ---------------------------------------------------------------------
// Inicio
// ---------------------------------------------------------------------
window.addEventListener('hashchange', () => { if (S.perfil) irA(location.hash.slice(1)); });
window.addEventListener('online', () => { pintarPie(); sincronizarCola(); });
window.addEventListener('offline', pintarPie);
setInterval(sincronizarCola, 30000);
sb.auth.onAuthStateChange((evento) => {
  if (evento === 'SIGNED_OUT') { S.perfil = null; vistaAcceso(); }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) await iniciarSesion(); else vistaAcceso();
})();
