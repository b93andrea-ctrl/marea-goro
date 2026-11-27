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

// 3) mareografi Porto Garibaldi, Cervia e Cattolica ogni 30 minuti (allertameteo tiene solo una settimana):
//    servono a ritarare lo scarto di Cervia, il mareografo di riserva quando Porto Garibaldi è fermo.
//    Il parametro time di allertameteo è l'ora italiana scritta come se fosse UTC.
try {
  await mkdir('data/mareo', { recursive: true });
  const IDS = { pg: '14387', cervia: '53155', cattolica: '53156' };
  const romeWall = t => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)); const g = k => +p.find(x => x.type === k).value; return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')); };
  const url = t => `https://allertameteo.regione.emilia-romagna.it/o/api/allerta/get-sensor-values-no-time?variabile=${encodeURIComponent('254,0,0/101,-,-,-/B22037')}&time=${romeWall(t)}&o=archivio`;
  const today0 = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate());
  for (let back = 6; back >= 1; back--) {
    const d0 = today0 - back * 86400e3, file = `data/mareo/${new Date(d0).toISOString().slice(0, 10)}.json`;
    if (await exists(file)) continue;
    const slots = Array.from({ length: 48 }, (_, i) => d0 + i * 1800e3);
    const rows = [];
    for (let i = 0; i < slots.length; i += 8) {
      const part = await Promise.all(slots.slice(i, i + 8).map(t => get(url(t)).then(j => {
        const v = id => { const r = (j || []).find(x => x.idstazione === id); return r && r.value != null ? +r.value : null; };
        return [new Date(t).toISOString(), v(IDS.pg), v(IDS.cervia), v(IDS.cattolica)];
      }).catch(() => [new Date(t).toISOString(), null, null, null])));
      rows.push(...part);
    }
    if (rows.filter(r => r[2] != null).length < 10) { console.log('mareografi', file, 'senza dati'); continue; }
    await writeFile(file, JSON.stringify({ colonne: ['ora UTC', 'Porto Garibaldi', 'Cervia', 'Cattolica'], righe: rows }));
    console.log('salvati mareografi', file);
  }
} catch (e) { console.log('mareografi non salvati:', e.message); }

// 4) livelli Shyfer nella Sacca (mare aperto, Bocca, Gorino, porto di Goro), ora per ora, dell'ultima corsa:
//    Arpae tiene solo l'ultima. Servono a ritarare il ritardo della Sacca quando l'acqua sale e quando scende.
try {
  await mkdir('data/shyfer', { recursive: true });
  const { inflateSync } = await import('node:zlib');
  const { leggiCorsa } = await import('./shyfer.mjs');
  const sj = await get('https://apps.arpae.it/REST/meteo_mappe_mare_previsione_livello_mare_sacca_shyfer?sort=-_id&max_results=1');
  const rec = sj._items[0];
  const first = rec.mappe.map(m => m.data_validita).sort()[0];
  const file = `data/shyfer/${first.slice(0, 10)}.json`;
  if (!(await exists(file))) {
    const getBytes = async f => { const r = await fetch('https://apps.arpae.it/REST' + f); if (!r.ok) throw new Error(r.status + ' ' + f); return new Uint8Array(await r.arrayBuffer()); };
    const out = await leggiCorsa(rec, getBytes, z => inflateSync(z));
    await writeFile(file, JSON.stringify({ corsa: rec._created, ...out }));
    console.log('salvata corsa Shyfer', file);
  }
} catch (e) { console.log('Shyfer non salvato:', e.message); }

// 5) la previsione dell'app in questo momento (combinata, nostro modello, Adriac corretta), per misurarne l'errore
try {
  const { readFile } = await import('node:fs/promises');
  const { calcolaPrevisione } = await import('./previsione.mjs');
  await mkdir('data/previsioni', { recursive: true });
  const src = await readFile('index.html', 'utf8');
  const model = JSON.parse(await readFile('data/model.json', 'utf8'));
  const prev = await calcolaPrevisione({ src, model, get });
  const file = `data/previsioni/${prev.emessa.slice(0, 13).replace(':', '')}.json`;
  if (!(await exists(file))) { await writeFile(file, JSON.stringify(prev)); console.log('salvata previsione dell\'app', file, '· peso Adriac', prev.peso_adriac); }
} catch (e) { console.log('previsione non salvata:', e.message); }
