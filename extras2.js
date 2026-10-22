/* extras2.js - Pantalla "Hoy", voz, modo ahorro y atajos. Añadido; no modifica el código existente. */
(() => {
'use strict';
const LS = { g: k => { try { return localStorage.getItem(k); } catch { return null; } }, s: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const Q = new URLSearchParams(location.search), DEBUG = Q.has('debug'), T0 = Date.now();
const $ = (s, r = document) => r.querySelector(s), el = h => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
const target = () => { try { return window.getCountdownTarget().getTime(); } catch {} const n = new Date(); return new Date(n.getFullYear() + 1, 0, 1).getTime(); };

/* ---------- Modo ahorro: batería baja / conexión lenta → menos cuadros por segundo y sin partículas ---------- */
let mode = LS.g('xt_saver') || 'auto', bat = null, on = false, seq = 1e9;
const rAF = window.requestAnimationFrame.bind(window), cAF = window.cancelAnimationFrame.bind(window), tm = new Map();
window.requestAnimationFrame = cb => { if (!on) return rAF(cb); const id = ++seq; tm.set(id, setTimeout(() => { tm.delete(id); rAF(cb); }, 45)); return id; };
window.cancelAnimationFrame = id => { if (tm.has(id)) { clearTimeout(tm.get(id)); tm.delete(id); } else cAF(id); };
const slow = () => { const c = navigator.connection; return !!c && (c.saveData || /[23]g/.test(c.effectiveType || '')); };
function evalSaver() {
  on = mode === 'on' || (mode === 'auto' && (slow() || (bat && bat.level <= 0.2 && !bat.charging) || matchMedia('(prefers-reduced-data: reduce)').matches));
  document.documentElement.toggleAttribute('data-saver', on);
  const p = $('#particles'); if (p) p.style.opacity = on ? '0' : '';
  const t = $('#xhT'); if (t) t.textContent = on ? 'Ahorro activo: animaciones reducidas.' : 'Animaciones completas.';
}
try { navigator.getBattery && navigator.getBattery().then(b => { bat = b; ['levelchange', 'chargingchange'].forEach(e => b.addEventListener(e, evalSaver)); evalSaver(); }); } catch {}
try { navigator.connection && navigator.connection.addEventListener('change', evalSaver); } catch {}
evalSaver();

/* ---------- Voz: lee la cuenta final ---------- */
let voice = LS.g('xt_voice') === '1', lastN = null, said0 = false;
const say = t => { try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'es-MX'; u.rate = 0.95; speechSynthesis.speak(u); } catch {} };
setInterval(() => {
  if (!voice) return;
  const left = DEBUG ? T0 + 15000 - Date.now() : target() - Date.now();
  if (left > 0 && left <= 10000) { const n = Math.ceil(left / 1000); if (n !== lastN) { lastN = n; say(String(n)); } }
  else if (left <= 0 && left > -8000 && !said0 && lastN !== null) { said0 = true; say('¡Feliz Año Nuevo ' + (DEBUG ? new Date(target()).getFullYear() : new Date().getFullYear()) + '!'); }
}, 250);

/* ---------- Panel "Hoy" ---------- */
const EV = [['🎄 Navidad', 12, 25], ['👑 Día de Reyes', 1, 6], ['💝 San Valentín', 2, 14], ['🌸 Inicio de primavera', 3, 20], ['☀️ Inicio de verano', 6, 21]];
const FR = ['Cada día es una página en blanco: escribe algo que valga la pena leer.', 'Empieza donde estás, con lo que tienes, hoy.', 'Los grandes cambios nacen de pequeños hábitos repetidos.', 'Hoy es un buen día para intentarlo una vez más.', 'La constancia vence al talento cuando el talento no es constante.', 'Agradecer lo de ayer hace más ligero lo de mañana.', 'Un paso pequeño hoy vale más que un plan perfecto mañana.', 'Cuida tu energía: es el recurso que no se compra.', 'Rodéate de quien te recuerde lo mejor de ti.', 'Descansar también es avanzar.', 'Lo que hoy cuesta, mañana se agradece.', 'Sonreír es la forma más barata de mejorar el día.', 'Tus metas no caducan, pero tampoco esperan para siempre.', 'Aprende algo nuevo hoy, aunque sea pequeño.', 'Que este año te conozcan por lo que hiciste, no por lo que pospusiste.'];
const fab = el('<button class="xt-fab" id="xhFab" style="left:72px" aria-label="Hoy: próximos eventos y ajustes" title="Hoy">☀</button>');
const ov = el(`<div class="xt-ov" role="dialog" aria-modal="true" aria-label="Hoy"><div class="xt-box"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">☀ Hoy</h3><button class="xt-btn" data-c aria-label="Cerrar">✕</button></div><div id="xhB"></div>
<h4 style="margin:14px 0 4px">Ajustes</h4><label style="display:block;font-size:14px"><input type="checkbox" id="xhV"> Leer la cuenta final en voz alta</label>
<label style="display:block;font-size:14px;margin-top:6px">Modo ahorro <select id="xhS" style="background:transparent;color:inherit;border:1px solid var(--glass-border,#d4af3755);border-radius:6px;padding:3px"><option value="auto">Automático</option><option value="on">Activado</option><option value="off">Desactivado</option></select></label><small id="xhT" style="opacity:.8"></small></div></div>`);
document.body.append(fab, ov);

function render() {
  const n = new Date(), y = n.getFullYear(), td = new Date(y, n.getMonth(), n.getDate()), s = new Date(y, 0, 1), tot = Math.round((new Date(y + 1, 0, 1) - s) / 864e5), day = Math.round((td - s) / 864e5) + 1;
  const nxt = (m, d) => { let t = new Date(y, m - 1, d); if (t < td) t = new Date(y + 1, m - 1, d); return Math.round((t - td) / 864e5); };
  const ev = EV.map(([nm, m, d]) => [nm, nxt(m, d)]), bd = LS.g('xt_bday');
  if (bd && /^\d\d-\d\d$/.test(bd)) ev.push(['🎂 Mi cumpleaños', nxt(+bd.slice(0, 2), +bd.slice(3))]);
  ev.sort((a, b) => a[1] - b[1]);
  $('#xhB').innerHTML = `<p style="font-size:18px;margin:10px 0 4px">${y} en marcha: día <b>${day}</b> de ${tot}</p><div style="height:10px;background:#fff2;border-radius:6px"><div style="height:100%;width:${day / tot * 100}%;background:var(--gold,#d4af37);border-radius:6px"></div></div>
  <h4 style="margin:14px 0 4px">Próximos eventos</h4>` + ev.slice(0, 4).map(e => `<div class="xt-row"><span>${e[0]}</span><b>${e[1] === 0 ? '¡Hoy!' : e[1] === 1 ? 'mañana' : e[1] + ' días'}</b></div>`).join('') +
  `<label style="display:block;font-size:14px;margin-top:8px">🎂 Mi cumpleaños <input type="date" id="xhD" value="${bd ? y + '-' + bd : ''}" style="background:transparent;color:inherit;border:1px solid var(--glass-border,#d4af3755);border-radius:6px;padding:3px"></label>
  <h4 style="margin:14px 0 4px">Frase del día</h4><p style="font-style:italic;margin:0">“${FR[(day - 1) % FR.length]}”</p>`;
  $('#xhD').onchange = e => { if (e.target.value) LS.s('xt_bday', e.target.value.slice(5)); render(); };
}
const open = () => { render(); $('#xhV').checked = voice; $('#xhS').value = mode; evalSaver(); ov.classList.add('on'); $('[data-c]', ov).focus(); }, close = () => { ov.classList.remove('on'); fab.focus(); };
fab.onclick = open;
ov.onclick = e => { if (e.target === ov || e.target.closest('[data-c]')) close(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
$('#xhV').onchange = e => { voice = e.target.checked; LS.s('xt_voice', voice ? '1' : '0'); if (voice) say('Voz activada'); else try { speechSynthesis.cancel(); } catch {} };
$('#xhS').onchange = e => { mode = e.target.value; LS.s('xt_saver', mode); evalSaver(); };

/* ---------- Atajos del ícono (?xt=hoy | sum | world) y apertura automática en enero ---------- */
const xt = Q.get('xt'), ex = () => $('.xt-fab:not(#xhFab)');
if (xt === 'hoy') open();
if (xt === 'sum') setTimeout(() => { const f = ex(); if (f) { f.click(); const t = $('[data-t=sum]'); if (t) t.click(); } }, 300);
const today = new Date().toDateString();
if (!xt && new Date().getMonth() === 0 && LS.g('xt_hoy') !== today && !DEBUG) setTimeout(() => { LS.s('xt_hoy', today); open(); }, 2000);
})();