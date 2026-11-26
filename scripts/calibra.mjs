// Ritaratura mensile del modello meteo (eseguita da GitHub Actions il 2 di ogni mese, o a mano).
// Stessa procedura della taratura iniziale del 25/11/2026:
//   scarto = livello misurato a Porto Garibaldi − marea astronomica
//   scarto ≈ C · [1, pressione, gradiente di pressione, sforzo del vento su 3 punti e 4 finestre]   (minimi quadrati)
//   parte residua proiettata in avanti con 3 coefficienti per ogni ora d'anticipo (decadimento + sessa di ~22 h)
// Dati: livelli Arpae dal 2024 (stesso zero), meteo ERA5 (Open-Meteo archive). Ultimi 120 giorni tenuti fuori per la prova.
// Il peso tra modello e Adriac si ritara quando l'archivio (data/adriac, data/meteo) ha almeno 20 emissioni.
// Il nuovo modello sostituisce il vecchio solo se nella prova non sbaglia di più.
import { readFile, writeFile, readdir, appendFile } from 'node:fs/promises';

const H = 3600e3;
const get = async (url, tries = 3) => { for (let i = 0; i < tries; i++) { try { const r = await fetch(url); if (r.ok) return r.json(); } catch (e) {} await new Promise(r => setTimeout(r, 3000)); } throw new Error('fallita ' + url); };

// marea astronomica: la stessa funzione dell'app, letta da index.html
const src = await readFile('index.html', 'utf8');
const astro = new Function(src.slice(src.indexOf('const ASTRO = {'), src.indexOf('function astroSeries')) + '; return astro;')();
const old = JSON.parse(await readFile('data/model.json', 'utf8'));
const POINTS = old.points, WIN = old.windows;

// 1) livelli orari Porto Garibaldi dal 2024
const OBS = new Map();
const now = Date.now();
for (let y = 2024; ; y++) {
  let stop = false;
  for (let m = 0; m < 12; m++) {
    const s = Date.UTC(y, m, 1), e = Date.UTC(y, m + 1, 1); if (s > now) { stop = true; break; }
    const w = encodeURIComponent(JSON.stringify({ station_id: '14387', reftime: { $gte: new Date(s).toUTCString(), $lt: new Date(e).toUTCString() } }));
    for (let page = 1; page <= 4; page++) {
      const j = await get(`https://apps.arpae.it/REST/meteo_opendata_stazioni_livello_del_mare_istantaneo?where=${w}&sort=reftime&max_results=5000&page=${page}`);
      for (const i of (j._items || [])) { if (i.value == null) continue; const t = new Date(i.reftime).getTime(); if (t % H === 0) OBS.set(t, +i.value); }
      if (!j._links || !j._links.next) break;
    }
  }
  if (stop) break;
}
console.log('ore di livello:', OBS.size);

// 2) meteo ERA5 sui tre punti
const end = new Date(now - 6 * 86400e3).toISOString().slice(0, 10);
const mj = await get(`https://archive-api.open-meteo.com/v1/archive?latitude=${POINTS.map(p => p[0]).join(',')}&longitude=${POINTS.map(p => p[1]).join(',')}&start_date=2023-12-28&end_date=${end}&hourly=pressure_msl,wind_speed_10m,wind_direction_10m&timezone=UTC&wind_speed_unit=ms`);
const toMap = h => { const m = new Map(); h.time.forEach((ts, i) => { const P = h.pressure_msl[i], s = h.wind_speed_10m[i], d = h.wind_direction_10m[i]; if (P == null || s == null || d == null) return; const to = (d + 180) * Math.PI / 180; m.set(Date.parse(ts + 'Z'), { P, su: s * s * Math.sin(to), sv: s * s * Math.cos(to) }); }); return m; };
const ERA = (Array.isArray(mj) ? mj : [mj]).map(p => toMap(p.hourly));

function feats(t, met) {
  const f = [1]; let pg = 0; for (let k = 0; k <= 3; k++) { const x = met[0].get(t - k * H); if (!x) return null; pg += x.P; } f.push(-(pg / 4 - 1013) / 100);
  let gr = 0; for (let k = 0; k < 12; k++) { const a = met[2].get(t - k * H), b = met[0].get(t - k * H); if (!a || !b) return null; gr += a.P - b.P; } f.push(gr / 12 / 100);
  for (let p = 0; p < 3; p++) for (const [w0, w1] of WIN) { let su = 0, sv = 0, c = 0; for (let k = w0; k < w1; k++) { const x = met[p].get(t - k * H); if (!x) return null; su += x.su; sv += x.sv; c++; } f.push(su / c / 100, sv / c / 100); }
  return f;
}
function solve(A, b) { const n = b.length; A = A.map(r => r.slice()); b = b.slice();
  for (let i = 0; i < n; i++) { let mx = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]]; [b[i], b[mx]] = [b[mx], b[i]];
    for (let r = 0; r < n; r++) { if (r === i) continue; const q = A[r][i] / A[i][i]; for (let c = i; c < n; c++) A[r][c] -= q * A[i][c]; b[r] -= q * b[i]; } }
  return b.map((v, i) => v / A[i][i]); }

const rows = []; for (const [t, o] of OBS) { const f = feats(t, ERA); if (f) rows.push({ t, r: o - astro(t), f }); }
rows.sort((a, b) => a.t - b.t);
const split = rows[rows.length - 1].t - 120 * 86400e3;
const train = rows.filter(x => x.t < split), test = rows.filter(x => x.t >= split);
// coefficienti meteo (ridge leggero)
const p = rows[0].f.length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
for (const { f, r } of train) for (let i = 0; i < p; i++) { b[i] += f[i] * r; for (let j = 0; j < p; j++) A[i][j] += f[i] * f[j]; }
for (let i = 1; i < p; i++) A[i][i] += 1e-4 * train.length;
const C = solve(A, b);

// persistenza dello scarto residuo per ogni ora d'anticipo
function persFor(Cc) {
  const E = new Map(rows.map(x => [x.t, x.r - x.f.reduce((s, v, i) => s + v * Cc[i], 0)]));
  const P = [[1, 0, 0]];
  for (let L = 1; L <= 72; L++) {
    const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], v = [0, 0, 0];
    for (const x of train) { const y = E.get(x.t + L * H), e0 = E.get(x.t), e6 = E.get(x.t - 6 * H), e12 = E.get(x.t - 12 * H); if (y == null || e6 == null || e12 == null || x.t + L * H >= split) continue;
      const f = [e0, e0 - e6, e12]; for (let i = 0; i < 3; i++) { v[i] += f[i] * y; for (let j = 0; j < 3; j++) M[i][j] += f[i] * f[j]; } }
    P.push(solve(M, v).map(q => +q.toFixed(4)));
  }
  return { P, E };
}
const { P: PERS } = persFor(C);

// prova sugli ultimi 120 giorni: errore medio a vari anticipi, nuovo contro vecchio modello (meteo ERA5)
function score(Cc, Pp) {
  const E = new Map(rows.map(x => [x.t, x.r - x.f.reduce((s, v, i) => s + v * Cc[i], 0)]));
  const out = {};
  for (const L of [1, 3, 6, 12, 24, 48]) { let s = 0, n = 0;
    for (const x of test) { if (x.t % (3 * H)) continue; const y = E.get(x.t + L * H), e6 = E.get(x.t - 6 * H), e12 = E.get(x.t - 12 * H), e0 = E.get(x.t); if (y == null || e6 == null || e12 == null) continue;
      const c = Pp[L]; s += Math.abs(y - (c[0] * e0 + c[1] * (e0 - e6) + c[2] * e12)); n++; }
    out[L] = n ? +(s / n * 100).toFixed(1) : null; }
  return out;
}
const sNew = score(C, PERS), sOld = score(old.C, old.PERS);
const astroOnly = +(test.reduce((s, x) => s + Math.abs(x.r), 0) / test.length * 100).toFixed(1);
console.log('prova ultimi 120 giorni (cm):', { nuovo: sNew, vecchio: sOld, astronomica_sola: astroOnly });

// 3) peso tra modello e Adriac, dall'archivio (servono almeno 20 emissioni con la previsione meteo dello stesso giorno)
let blend = old.blend, blendNote = 'peso invariato (archivio ancora corto)';
try {
  const files = (await readdir('data/adriac')).filter(f => f.endsWith('.json')).sort();
  const errs = {}; for (let w = 0; w <= 10; w++) errs[w] = { s: 0, n: 0 };
  let used = 0;
  for (const f of files) {
    const d = f.slice(0, 10); let met;
    try { met = JSON.parse(await readFile(`data/meteo/${d}.json`, 'utf8')); } catch (e) { continue; }
    const em = JSON.parse(await readFile(`data/adriac/${f}`, 'utf8'));
    const ser = em.stazioni['Porto Garibaldi']; if (!ser) continue;
    const T = Date.parse(em.emissione); const EM = new Map(ser.map(q => [Date.parse(q[0]), q[1]]));
    const fut = met.punti.map(pt => toMap(pt.hourly));
    const mix = [0, 1, 2].map(i => ({ get: t => (t <= T ? ERA[i].get(t) : fut[i].get(t)) }));
    const m = t => { const f = feats(t, mix); return f ? f.reduce((s, v, i) => s + v * C[i], 0) : null; };
    const eAt = t => { const o = OBS.get(t), mm = m(t); return o == null || mm == null ? null : o - astro(t) - mm; };
    const e0 = eAt(T), e6 = eAt(T - 6 * H) ?? e0, e12 = eAt(T - 12 * H) ?? 0; if (e0 == null) continue;
    used++;
    for (let L = 1; L <= 48; L++) { const t = T + L * H, o = OBS.get(t), a = EM.get(t), mm = m(t); if (o == null || a == null || mm == null) continue;
      const c = PERS[L]; const ours = astro(t) + mm + c[0] * e0 + c[1] * (e0 - e6) + c[2] * e12;
      for (let w = 0; w <= 10; w++) { errs[w].s += Math.abs(o - (w / 10 * ours + (1 - w / 10) * a)); errs[w].n++; } }
  }
  if (used >= 20) { let best = 7; for (let w = 0; w <= 10; w++) if (errs[w].n && errs[w].s / errs[w].n < errs[best].s / errs[best].n) best = w;
    blend = best / 10; blendNote = `peso modello ${blend} su ${used} emissioni archiviate (errore medio ${(errs[best].s / errs[best].n * 100).toFixed(1)} cm, solo Adriac ${(errs[0].s / errs[0].n * 100).toFixed(1)} cm)`; }
} catch (e) { blendNote = 'peso invariato: ' + e.message; }
console.log(blendNote);

// 3b) scarto del mareografo di riserva (Cervia) rispetto a Porto Garibaldi, dall'archivio data/mareo (servono 7 giorni)
let cervia = old.cervia || { offset: 0.01, note: 'confronto iniziale 19-26/11/2026: 311 mezz\'ore, errore medio 4,3 cm' }, cerviaNote = 'scarto Cervia invariato';
try {
  const files = (await readdir('data/mareo')).filter(f => f.endsWith('.json')).sort().slice(-90);
  const d = [];
  for (const f of files) { const j = JSON.parse(await readFile(`data/mareo/${f}`, 'utf8')); for (const r of j.righe) if (r[1] != null && r[2] != null) d.push(r[1] - r[2]); }
  if (files.length >= 7 && d.length >= 200) {
    const s = d.slice().sort((a, b) => a - b), med = s[Math.floor(s.length / 2)];
    const mae = d.reduce((a, x) => a + Math.abs(x - med), 0) / d.length;
    cervia = { offset: +med.toFixed(3), mae: +mae.toFixed(3), n: d.length, giorni: files.length, fitted: new Date().toISOString().slice(0, 10) };
    cerviaNote = `scarto Cervia ${(med * 100).toFixed(1)} cm su ${files.length} giorni (errore medio ${(mae * 100).toFixed(1)} cm)`;
  } else cerviaNote = `scarto Cervia invariato (archivio di ${files.length} giorni)`;
} catch (e) { cerviaNote = 'scarto Cervia invariato: ' + e.message; }
console.log(cerviaNote);

// 3c) ritardo della Sacca (porto di Goro) rispetto al mare, da salita e discesa, dalle corse Shyfer archiviate
//     (prime 24 ore di ogni corsa, così ogni giorno conta una volta); servono almeno 10 corse
let sacca = old.sacca || { up: 5, down: 35, note: 'corsa Shyfer del 26/11/2026' }, saccaNote = 'ritardi Sacca invariati';
try {
  const { ritardi } = await import('./shyfer.mjs');
  const files = (await readdir('data/shyfer')).filter(f => f.endsWith('.json')).sort().slice(-120);
  const corse = []; for (const f of files) corse.push(JSON.parse(await readFile(`data/shyfer/${f}`, 'utf8')));
  const r = ritardi(corse, 'Goro', 24);
  if (corse.length >= 10 && r.nUp >= 30 && r.nDown >= 30) {
    const clamp = v => Math.max(0, Math.min(120, Math.round(v)));
    sacca = { up: clamp(r.up), down: clamp(r.down), nUp: r.nUp, nDown: r.nDown, corse: corse.length, fitted: new Date().toISOString().slice(0, 10) };
    saccaNote = `ritardi Sacca +${sacca.up} min in salita, +${sacca.down} in discesa (${corse.length} corse Shyfer)`;
  } else saccaNote = `ritardi Sacca invariati (archivio di ${corse.length} corse Shyfer)`;
} catch (e) { saccaNote = 'ritardi Sacca invariati: ' + e.message; }
console.log(saccaNote);

// 4) salvo solo se il nuovo modello non è peggiore del vecchio (tolleranza 0,3 cm a +24 h); lo scarto di Cervia si aggiorna comunque
const today = new Date().toISOString().slice(0, 10);
const better = sNew[24] != null && (sOld[24] == null || sNew[24] <= sOld[24] + 0.3);
const line = `${today} · nuovo +1h ${sNew[1]} +6h ${sNew[6]} +24h ${sNew[24]} +48h ${sNew[48]} cm · vecchio +24h ${sOld[24]} cm · astronomica ${astroOnly} cm · ${blendNote} · ${cerviaNote} · ${saccaNote} · ${better ? 'AGGIORNATO' : 'tenuto il vecchio'}\n`;
await appendFile('data/calibrazione.log', line);
if (better) {
  const model = { ...old, version: (old.version || 1) + 1, fitted: today, train: `2024-01-01/${new Date(split).toISOString().slice(0, 10)} (meteo ERA5)`, test: `ultimi 120 giorni: MAE ${sNew[1]} cm a +1 h, ${sNew[6]} a +6 h, ${sNew[24]} a +24 h, ${sNew[48]} a +48 h (astronomica sola ${astroOnly})`,
    C: C.map(v => +v.toFixed(5)), PERS, blend, cervia, sacca };
  await writeFile('data/model.json', JSON.stringify(model));
} else {
  await writeFile('data/model.json', JSON.stringify({ ...old, cervia, sacca }));
}
console.log(line);
