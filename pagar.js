// Página pública de pago (la abre el QR del visitante)
import { CONFIG } from './config.js';
// La aplicación no se deja mostrar dentro de otra página (protección contra clickjacking)
if (window.top !== window.self) {
  document.documentElement.innerHTML = '<body style="font-family:sans-serif;padding:24px">Abra la aplicación directamente en su navegador.</body>';
  throw new Error('Aplicación cargada dentro de un marco');
}


const raiz = document.getElementById('pago');
const ref = new URLSearchParams(location.search).get('ref') ?? '';
const cop = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-CO');
const ESTADOS = {
  PENDIENTE: ['Pendiente de pago', 'azul'], APROBADO: ['Pago aprobado', 'lima'], RECHAZADO: ['Pago rechazado', 'rojo'],
  ERROR: ['Error en el pago', 'rojo'], ANULADO: ['Pago anulado', 'rojo'], EXPIRADO: ['Cobro vencido', 'ambar'],
};
let sondeo = null;

function el(tag, props = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const c of hijos.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

async function consultar() {
  const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/pago-publico?ref=${encodeURIComponent(ref)}`, { headers: { apikey: CONFIG.SUPABASE_KEY } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'No se encontró el cobro');
  return d;
}

async function simular(resultado, boton) {
  boton.disabled = true;
  try {
    const r = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/pago-publico`, {
      method: 'POST', headers: { apikey: CONFIG.SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref, resultado, metodo: 'NEQUI' }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'No se pudo procesar');
  } catch (e) {
    alertar(e.message);
  } finally {
    boton.disabled = false;
    await pintar();
  }
}

function alertar(texto) {
  const b = el('div', { class: 'banner rojo', role: 'alert', style: 'margin-top:14px' }, texto);
  raiz.querySelector('.panel')?.append(b);
}

async function pintar() {
  let d;
  try { d = await consultar(); } catch (e) {
    raiz.replaceChildren(el('div', { class: 'panel' }, el('div', { class: 'banner rojo' }, e.message)));
    return;
  }
  const [txt, tono] = ESTADOS[d.estado] ?? [d.estado, ''];
  const final = d.estado !== 'PENDIENTE';
  const vencido = !final && new Date(d.expira_en).getTime() < Date.now();
  const acciones = el('div', { class: 'acciones' });
  if (!final && !vencido && d.simulado) {
    const aprobar = el('button', { class: 'btn primario grande bloque' }, 'Pagar con Nequi (simulado)');
    const rechazar = el('button', { class: 'btn bloque' }, 'Simular rechazo');
    aprobar.addEventListener('click', () => simular('APPROVED', aprobar));
    rechazar.addEventListener('click', () => simular('DECLINED', rechazar));
    acciones.append(el('div', { class: 'banner ambar' }, 'Modo de pruebas: no se realiza ningún cobro real.'), aprobar, rechazar);
  }
  raiz.replaceChildren(
    el('div', { class: 'panel' },
      el('div', { class: 'encabezado' },
        el('div', {}, el('div', { class: 'etiqueta' }, 'Parqueadero de visitantes'), el('div', { style: 'font-weight:600;margin-top:4px' }, d.conjunto)),
        el('span', { class: `chip ${tono}` }, vencido ? 'Cobro vencido' : txt)),
      el('div', { class: 'etiqueta' }, 'Valor a pagar'),
      el('div', { class: 'monto', style: 'margin:6px 0 14px' }, cop(d.monto)),
      el('dl', { class: 'dato-lista' },
        el('dt', {}, 'Vehículo'), el('dd', { class: 'mono' }, `${d.placa} · ${d.tipo_vehiculo ?? ''}`),
        el('dt', {}, 'Referencia'), el('dd', { class: 'mono' }, d.referencia)),
      d.estado === 'APROBADO' ? el('div', { class: 'banner lima', style: 'margin-top:18px' }, 'Pago recibido. Ya puede salir: la portería lo ve en su pantalla.') : null,
      vencido ? el('div', { class: 'banner ambar', style: 'margin-top:18px' }, 'Este cobro venció. Solicite un QR nuevo en portería.') : null,
      acciones),
    el('footer', {}, el('span', {}, 'Pago electrónico operado por'), el('img', { src: 'marca/spa-logo-negativo.svg', alt: 'SP Automatizaciones', width: '101', height: '22' })),
  );
  clearInterval(sondeo);
  if (!final && !vencido) sondeo = setInterval(pintar, 4000);
}

if (!/^LE1-\d{6}-[A-Z0-9]{4,8}$/.test(ref)) {
  raiz.replaceChildren(el('div', { class: 'panel' }, el('div', { class: 'banner rojo' }, 'Enlace de pago inválido.')));
} else {
  pintar();
}
