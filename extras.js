/* extras.js - Mejoras añadidas (no modifica el código existente). Se puede quitar borrando la línea <script src="extras.js"> */
(() => {
'use strict';
const LS = { g: k => { try { return localStorage.getItem(k); } catch { return null; } }, s: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const Q = new URLSearchParams(location.search), DEBUG = Q.has('debug'), T0 = Date.now();
let skew = 0;
// Sincroniza con la hora del servidor (si hay conexión) para que el reloj del teléfono no falle a medianoche
fetch(location.pathname, { method: 'HEAD', cache: 'no-store' }).then(r => { const d = r.headers.get('date'); if (d) skew = Date.parse(d) - Date.now(); }).catch(() => {});
const now = () => Date.now() + skew;
const target = () => { try { return window.getCountdownTarget().getTime(); } catch {} const n = new Date(); return new Date(n.getFullYear() + 1, 0, 1).getTime(); };
const YEAR = () => new Date(target()).getFullYear();
const pad = n => String(n).padStart(2, '0');
const fmt = ms => { const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400); return (d ? d + 'd ' : '') + pad(Math.floor(s % 86400 / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };

/* ---------- Zonas horarias ---------- */
const ZONES = [['Pacific/Kiritimati', 'Kiritimati (Kiribati)'], ['Pacific/Auckland', 'Nueva Zelanda'], ['Australia/Sydney', 'Sídney'], ['Asia/Tokyo', 'Tokio'], ['Asia/Shanghai', 'China'], ['Asia/Kolkata', 'India'], ['Asia/Dubai', 'Dubái'], ['Europe/Moscow', 'Moscú'], ['Europe/Madrid', 'España'], ['Europe/London', 'Reino Unido'], ['America/Sao_Paulo', 'Brasil'], ['America/Argentina/Buenos_Aires', 'Argentina'], ['America/New_York', 'Nueva York'], ['America/Mexico_City', 'Ciudad de México'], ['America/Hermosillo', 'Sonora'], ['America/Los_Angeles', 'Los Ángeles'], ['Pacific/Honolulu', 'Hawái']];
function off(z, t) {
  const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: z, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t)).forEach(x => p[x.type] = +x.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(t / 1000) * 1000;
}
function midnight(z, y) { const g = Date.UTC(y, 0, 1); let i = g - off(z, g); i = g - off(z, i); return i; }

/* ---------- Interfaz ---------- */
const css = document.createElement('style');
css.textContent = `.xt-fab{position:fixed;left:16px;bottom:16px;z-index:9000;width:48px;height:48px;border-radius:50%;border:1px solid var(--glass-border,#d4af3755);background:var(--navy-mid,#101c40);color:var(--gold,#d4af37);font-size:20px;cursor:pointer;box-shadow:0 8px 24px #0006}
.xt-ov{position:fixed;inset:0;z-index:9500;background:#000a;display:none;align-items:center;justify-content:center;padding:12px}.xt-ov.on{display:flex}
.xt-box{width:100%;max-width:440px;max-height:90vh;overflow:auto;background:var(--navy,#0a1230);color:var(--ivory,#f7f4ec);border:1px solid var(--glass-border,#d4af3755);border-radius:18px;padding:18px;font-family:Jost,sans-serif}
.xt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.xt-tabs button,.xt-btn{border:1px solid var(--glass-border,#d4af3755);background:transparent;color:inherit;border-radius:20px;padding:6px 12px;cursor:pointer;font:inherit}
.xt-tabs button.on,.xt-btn{background:var(--gold,#d4af37);color:#050a1a;font-weight:600}.xt-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #ffffff14;font-size:15px}
.xt-box input[type=text],.xt-box textarea{width:100%;margin:6px 0;padding:8px;border-radius:8px;border:1px solid var(--glass-border,#d4af3755);background:#0003;color:inherit;font:inherit}
.xt-big{position:fixed;inset:0;z-index:9800;display:none;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(circle,#101c40,#050a1a);color:#e8cd7a;font-family:'Cormorant Garamond',serif;text-align:center}
.xt-big.on{display:flex}.xt-big b{font-size:min(40vw,320px);line-height:1}.xt-big span{font-size:min(10vw,64px)}`;
document.head.appendChild(css);
const el = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.firstElementChild; };
const fab = el('<button class="xt-fab" aria-label="Extras: mundo, tarjeta, resumen" title="Extras">✦</button>');
const ov = el(`<div class="xt-ov" role="dialog" aria-modal="true" aria-label="Extras"><div class="xt-box"><div style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0">✦ Extras</h3><button class="xt-btn" data-x="close" aria-label="Cerrar">✕</button></div>
<div class="xt-tabs" role="tablist"><button data-t="world" class="on">Mundo</button><button data-t="card">Tarjeta</button><button data-t="sum">Resumen</button><button data-t="cal">Recordatorio</button></div><div id="xtBody"></div>
<label style="display:block;margin-top:12px;font-size:14px"><input type="checkbox" id="xtAuto"> Modo medianoche automático (cuenta final a pantalla completa)</label></div></div>`);
const big = el('<div class="xt-big" role="alert" aria-live="assertive"><b></b><span></span></div>');
document.body.append(fab, ov, big);
const $ = (s, r = document) => r.querySelector(s), body = $('#xtBody');
let tab = 'world', timer = null;

function render() {
  clearInterval(timer);
  if (tab === 'world') {
    const y = YEAR(), rows = ZONES.map(([z, n]) => [n, midnight(z, y)]).sort((a, b) => a[1] - b[1]);
    body.innerHTML = rows.map(() => '<div class="xt-row"><span></span><span></span></div>').join('');
    const upd = () => rows.forEach(([n, t], i) => { const r = body.children[i], d = t - now(); r.children[0].textContent = n; r.children[1].textContent = d <= 0 ? '🎆 ¡Ya es ' + y + '!' : fmt(d); });
    upd(); timer = setInterval(upd, 1000);
  } else if (tab === 'card') {
    body.innerHTML = `<input type="text" id="xtN" maxlength="30" placeholder="Nombre" value="${(Q.get('nombre') || '').replace(/[<>"&]/g, '')}"><textarea id="xtM" rows="3" maxlength="140" placeholder="Tu mensaje">Que este año nuevo traiga salud, paz y mucha alegría.</textarea><canvas id="xtC" width="1080" height="1080" style="width:100%;border-radius:10px"></canvas><div style="display:flex;gap:8px;margin-top:8px"><button class="xt-btn" id="xtS">Compartir</button><button class="xt-btn" id="xtD">Descargar</button></div>`;
    const draw = () => {
      const c = $('#xtC'), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#050a1a'); gr.addColorStop(1, '#101c40');
      g.fillStyle = gr; g.fillRect(0, 0, 1080, 1080); g.strokeStyle = '#d4af37'; g.lineWidth = 6; g.strokeRect(40, 40, 1000, 1000);
      g.textAlign = 'center'; g.fillStyle = '#e8cd7a'; g.font = '600 130px "Cormorant Garamond",serif'; g.fillText('¡Feliz ' + YEAR() + '!', 540, 360);
      g.fillStyle = '#f7f4ec'; g.font = '70px "Cormorant Garamond",serif'; g.fillText($('#xtN').value, 540, 480);
      g.font = '46px Jost,sans-serif'; let l = '', y = 640; for (const w of $('#xtM').value.split(' ')) { if (g.measureText(l + w).width > 820) { g.fillText(l, 540, y); y += 62; l = ''; } l += w + ' '; } g.fillText(l, 540, y);
      g.fillStyle = '#d4af37'; g.font = '90px serif'; g.fillText('✦', 540, 960);
    };
    const blob = () => new Promise(r => $('#xtC').toBlob(r, 'image/png'));
    body.oninput = draw; draw();
    $('#xtD').onclick = async () => { const a = document.createElement('a'); a.href = URL.createObjectURL(await blob()); a.download = 'feliz-' + YEAR() + '.png'; a.click(); };
    $('#xtS').onclick = async () => { const f = new File([await blob()], 'feliz.png', { type: 'image/png' }); if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: '¡Feliz ' + YEAR() + '!' }).catch(() => {}); else $('#xtD').click(); };
  } else if (tab === 'sum') {
    const t = target(), s = new Date(YEAR() - 1, 0, 1).getTime(), n = Math.min(now(), t), pc = (n - s) / (t - s) * 100;
    const rows = [['Año', YEAR() - 1], ['Días transcurridos', Math.floor((n - s) / 864e5)], ['Semanas transcurridas', Math.floor((n - s) / 6048e5)], ['Horas transcurridas', Math.floor((n - s) / 36e5).toLocaleString()], ['Avance del año', pc.toFixed(1) + '%'], ['Días que faltan', Math.max(0, Math.ceil((t - n) / 864e5))]];
    body.innerHTML = rows.map(r => `<div class="xt-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('') + `<div style="height:10px;background:#fff2;border-radius:6px;margin-top:12px"><div style="height:100%;width:${pc}%;background:var(--gold,#d4af37);border-radius:6px"></div></div>`;
  } else {
    body.innerHTML = '<p>Descarga un recordatorio para tu calendario con aviso 10 minutos antes de la medianoche.</p><button class="xt-btn" id="xtI">Añadir al calendario (.ics)</button>';
    $('#xtI').onclick = () => {
      const y = YEAR(), ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cuenta Regresiva//ES', 'BEGIN:VEVENT', 'UID:newyear' + y + '@cuenta-regresiva', 'DTSTAMP:' + new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z', 'DTSTART:' + y + '0101T000000', 'DTEND:' + y + '0101T003000', 'SUMMARY:🎆 ¡Feliz Año Nuevo ' + y + '!', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'ACTION:DISPLAY', 'DESCRIPTION:Faltan 10 minutos para el Año Nuevo', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'año-nuevo-' + y + '.ics'; a.click();
    };
  }
}
const open = () => { ov.classList.add('on'); render(); $('[data-x=close]', ov).focus(); }, close = () => { ov.classList.remove('on'); clearInterval(timer); fab.focus(); };
fab.onclick = open;
ov.onclick = e => { const b = e.target.closest('button'); if (e.target === ov || (b && b.dataset.x === 'close')) return close(); if (b && b.dataset.t) { tab = b.dataset.t; ov.querySelectorAll('[data-t]').forEach(x => x.classList.toggle('on', x === b)); render(); } };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ov.classList.contains('on')) close(); });
const auto = $('#xtAuto'); auto.checked = LS.g('xt_auto') !== '0'; auto.onchange = () => LS.s('xt_auto', auto.checked ? '1' : '0');
if (Q.get('xt') === 'world') open();

/* ---------- Modo medianoche (últimos 10 s) + ?debug=1 ---------- */
let last = null, wl = null, shown = false;
setInterval(() => {
  const left = DEBUG ? T0 + 15000 - Date.now() : target() - now();
  if (left <= 60000 && left > -9000 && !wl && navigator.wakeLock) navigator.wakeLock.request('screen').then(w => wl = w).catch(() => {});
  if (!auto.checked) return;
  if (left > 0 && left <= 10000) { const n = Math.ceil(left / 1000); big.classList.add('on'); shown = true; big.children[0].textContent = n; big.children[1].textContent = ''; if (n !== last) { last = n; try { navigator.vibrate && navigator.vibrate(60); } catch {} } }
  else if (left <= 0 && left > -8000 && shown) { big.classList.add('on'); big.children[0].textContent = '🎆'; big.children[1].textContent = '¡Feliz ' + (DEBUG ? YEAR() : new Date(now()).getFullYear()) + '!'; try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 400]); } catch {} }
  else if (big.classList.contains('on')) { big.classList.remove('on'); shown = false; }
}, 250);
big.onclick = () => big.classList.remove('on');
if (DEBUG) console.info('[extras] debug: el modo medianoche se activará en 5 s');
})();