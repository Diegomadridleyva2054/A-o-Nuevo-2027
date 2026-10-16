const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

const D = 864e5, H = 36e5, M = 6e4;
const MILES = [[30*D,'Faltan 30 días'],[7*D,'Falta 1 semana'],[3*D,'Faltan 3 días'],[D,'¡Falta 1 día!'],[12*H,'Faltan 12 horas'],[6*H,'Faltan 6 horas'],[3*H,'Faltan 3 horas'],[H,'¡Falta 1 hora!'],[30*M,'Faltan 30 minutos'],[10*M,'¡Faltan 10 minutos!'],[5*M,'¡Faltan 5 minutos!'],[M,'¡Falta 1 minuto!']];

// Envía un mensaje "data" (la app lo muestra en sw.js). Si se pasa id, lo anota en `sent` para no repetirlo.
async function send(d, id, key, title, body) {
  try {
    await admin.messaging().send({ token: d.id, data: { title, body, tag: key }, webpush: { headers: { Urgency: 'high', TTL: '600' } } });
    if (id) await d.ref.update({ sent: admin.firestore.FieldValue.arrayUnion(id) });
  } catch (e) {
    if (/not-registered|invalid-registration/.test(e.code || '')) await d.ref.delete(); // token caducado
  }
}

// Cada minuto revisa los dispositivos registrados (colección "tokens") y envía lo que toque
exports.tick = onSchedule('every 1 minutes', async () => {
  const now = Date.now();
  const snap = await db.collection('tokens').where('target', '>', now - 10 * M).get();
  const jobs = [];
  for (const d of snap.docs) {
    const t = d.get('target'), Y = d.get('year'), rem = t - now, sent = d.get('sent') || [], pr = d.get('prefs') || {};
    if (pr.nt_miles !== false) for (const [ms, txt] of MILES) {
      const win = Math.max(Math.min(ms * 0.1, 6 * H), 90e3); // margen para no perder avisos si hay retraso
      if (rem > 0 && rem <= ms && rem > ms - win && !sent.includes('m' + ms)) jobs.push(send(d, 'm' + ms, 'nt_miles', '✨ Año Nuevo ' + Y, txt + ' para recibir el ' + Y));
    }
    if (pr.nt_mid !== false && rem <= 0 && rem > -5 * M && !sent.includes('mid')) jobs.push(send(d, 'mid', 'nt_mid', '🎉 ¡Feliz Año Nuevo ' + Y + '!', 'Llegó el momento. ¡Que este año sea increíble!'));
  }
  await Promise.all(jobs);
});

// Foto nueva en la galería: avisa a todos menos a quien la subió
exports.newPhoto = onDocumentCreated('photos/{id}', async e => {
  const p = e.data.data(), snap = await db.collection('tokens').get();
  await Promise.all(snap.docs
    .filter(d => d.get('prefs.nt_photo') !== false && d.get('uid') !== p.owner)
    .map(d => send(d, null, 'nt_photo', '📸 Nueva foto en la galería', p.desc || 'Alguien subió una foto')));
});