// Archivio giornaliero (eseguito da GitHub Actions): salva l'ultima emissione Adriac e la previsione meteo ECMWF
// del giorno, così si può misurare nel tempo quanto sbagliano e ritarare il modello (scripts/calibra.mjs).
// Arpae conserva solo le ultime tre emissioni: senza questo archivio andrebbero perse.
import { mkdir, writeFile, access } from 'node:fs/promises';

const STAZIONI = ['Porto Garibaldi', 'Cervia', 'Cattolica', 'Venezia'];
const exists = p => access(p).then(() => true, () => false);
const get = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };

await mkdir('data/adriac', { recursive: true });
await mkdir('data/meteo', { recursive: true });

// 1) emissioni Adriac: salvo ogni emissione non ancora in archivio
const j = await get('https://apps.arpae.it/REST/meteo_mareogrammi?sort=-_id&max_results=1');
const it = j._items[0];
const keys = Object.keys(it.stazioni['Porto Garibaldi'].previsioni).sort();
for (const k of keys) {
  const file = `data/adriac/${k.slice(0, 10)}.json`;
  if (await exists(file)) continue;
  const out = { emissione: k, salvato: new Date().toISOString(), stazioni: {} };
  for (const s of STAZIONI) { const st = it.stazioni[s]; if (st && st.previsioni[k]) out.stazioni[s] = st.previsioni[k]; }
  await writeFile(file, JSON.stringify(out));
  console.log('salvata emissione', k);
}

// 2) previsione meteo ECMWF sui tre punti del modello, emessa oggi, per i prossimi 4 giorni
const oggi = new Date().toISOString().slice(0, 10);
const mf = `data/meteo/${oggi}.json`;
if (!(await exists(mf))) {
  const m = await get('https://api.open-meteo.com/v1/forecast?latitude=44.79,43.5,41.8&longitude=12.40,14.5,16.8&hourly=pressure_msl,wind_speed_10m,wind_direction_10m&models=ecmwf_ifs025&forecast_days=4&timezone=UTC&wind_speed_unit=ms');
  const arr = Array.isArray(m) ? m : [m];
  await writeFile(mf, JSON.stringify({ emesso: new Date().toISOString(), punti: arr.map(p => ({ lat: p.latitude, lon: p.longitude, hourly: p.hourly })) }));
  console.log('salvata previsione meteo', oggi);
}
