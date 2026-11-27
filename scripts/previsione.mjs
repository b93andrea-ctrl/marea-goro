// La previsione dell'app, calcolata qui con lo stesso codice (letto da index.html) e salvata nell'archivio,
// così si può misurare quanto sbaglia: combinata, solo nostro modello, solo Adriac corretta, ora per ora fino a +72 h.

const H = 3600e3;

// motore: il blocco di index.html dalla marea astronomica fino al grafico (funzioni pure, senza pagina)
export function caricaMotore(src) {
  const a = src.indexOf('/* ---------- marea astronomica'), b = src.indexOf('/* ---------- chart ----------');
  if (a < 0 || b < 0) throw new Error('blocco della previsione non trovato in index.html');
  return new Function(src.slice(a, b) + '; return { astro, nowcast, correctedForecast, ourForecast, blendAdriac, fuseForecast, interp, setModel: m => { MODEL = m; } };')();
}

export async function calcolaPrevisione({ src, model, get, now = Date.now() }) {
  const E = caricaMotore(src); E.setModel(model);
  // livelli Porto Garibaldi delle ultime 30 ore
  const since = new Date(now - 30 * H).toUTCString();
  const w = encodeURIComponent(JSON.stringify({ station_id: '14387', reftime: { $gte: since } }));
  const oj = await get(`https://apps.arpae.it/REST/meteo_opendata_stazioni_livello_del_mare_istantaneo?where=${w}&sort=reftime&max_results=400`);
  let obs = (oj._items || []).filter(i => i.value != null).map(i => ({ t: Date.parse(i.reftime), v: +i.value })).filter(p => p.t <= now);
  // Porto Garibaldi fermo: Cervia + scarto, come nell'app (mezz'ore di almeno 20 minuti fa)
  let cervia = 0;
  const lastPG = obs.length ? obs[obs.length - 1].t : null;
  if (lastPG && now - lastPG > 50 * 60e3) {
    const off = model.cervia && typeof model.cervia.offset === 'number' ? model.cervia.offset : 0.01;
    const romeWall = t => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(t)); const g = k => +p.find(x => x.type === k).value; return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute')); };
    const H30 = 1800e3, first = Math.max(Math.ceil((lastPG + 1) / H30) * H30, Math.floor((now - 14 * H) / H30) * H30);
    for (let t = Math.floor((now - 20 * 60e3) / H30) * H30; t >= first; t -= H30) {
      try {
        const j = await get(`https://allertameteo.regione.emilia-romagna.it/o/api/allerta/get-sensor-values-no-time?variabile=${encodeURIComponent('254,0,0/101,-,-,-/B22037')}&time=${romeWall(t)}&o=previsione`);
        const r = (j || []).find(x => x.idstazione === '53155' && x.value != null); if (r) { obs.push({ t, v: +r.value + off }); cervia++; }
      } catch (e) { }
    }
    obs.sort((p, q) => p.t - q.t);
  }
  if (!obs.length) throw new Error('nessuna lettura');
  // emissioni Adriac
  const fj = await get('https://apps.arpae.it/REST/meteo_mareogrammi?sort=-_id&max_results=1');
  const st = fj._items[0].stazioni['Porto Garibaldi'];
  const keys = Object.keys(st.previsioni).sort();
  const conv = arr => arr.map(p => ({ t: Date.parse(p[0]), v: p[1] }));
  const emissions = keys.map(k => ({ t0: Date.parse(k), series: conv(st.previsioni[k]) }));
  const fc = { latest: emissions[emissions.length - 1].series, prev: emissions.length > 1 ? emissions[emissions.length - 2].series : [], emissions };
  // meteo ECMWF sui tre punti del modello (come fetchMet nell'app)
  const P = model.points;
  const mj = await get(`https://api.open-meteo.com/v1/forecast?latitude=${P.map(p => p[0]).join(',')}&longitude=${P.map(p => p[1]).join(',')}&hourly=pressure_msl,wind_speed_10m,wind_direction_10m&models=ecmwf_ifs025&past_days=3&forecast_days=4&timezone=UTC&wind_speed_unit=ms`);
  const met = (Array.isArray(mj) ? mj : [mj]).map(p => { const h = p.hourly; return h.time.map((ts, i) => [Date.parse(ts + 'Z'), h.pressure_msl[i], h.wind_speed_10m[i], h.wind_direction_10m[i]]).filter(r => r[1] != null && r[2] != null && r[3] != null); });
  // stessa sequenza di render()
  const adr = E.blendAdriac(obs, fc, now);
  const nc = E.nowcast(obs, adr.series, now);
  const cfA = E.correctedForecast(obs, { latest: adr.series, prev: fc.prev }, now, nc);
  let ours = null; try { ours = E.ourForecast(obs, met, now); } catch (e) { }
  const fused = E.fuseForecast(ours, adr, cfA, now);
  const fusa = fused ? fused.series : cfA ? cfA.series : null;
  // ore intere da adesso a +72 h
  const t0 = Math.ceil(now / H) * H, ore = [], col = { fusa: [], nostro: [], adriac: [] };
  const r3 = v => v == null ? null : Math.round(v * 1000) / 1000;
  for (let t = t0; t <= t0 + 72 * H; t += H) {
    ore.push(new Date(t).toISOString().slice(0, 13) + ':00Z');
    col.fusa.push(r3(fusa ? E.interp(fusa, t) : null));
    col.nostro.push(r3(ours ? E.interp(ours.series, t) : null));
    col.adriac.push(r3(cfA ? E.interp(cfA.series, t) : E.interp(adr.series, t)));
  }
  return {
    emessa: new Date(now).toISOString(), ultima_lettura: new Date(lastPG).toISOString(), letture_cervia: cervia,
    modello: model.version || 1, peso_adriac: fused ? Math.round(fused.wA * 100) / 100 : null,
    pesi_emissioni: adr.weights ? Object.fromEntries(keys.map((k, i) => [k.slice(0, 10), Math.round(adr.weights[i] * 100) / 100])) : null,
    ore, ...col
  };
}
