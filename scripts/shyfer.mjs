// Livelli Shyfer nella Sacca di Goro letti dai colori delle mappe (fasce di 0,2 m), ora per ora.
// Stessi punti e stesso metodo dell'app: colore più frequente in un quadrato di 25 px attorno al punto,
// confrontato con i colori della legenda. "mare" = mediana di una griglia di punti di mare aperto a sud della Sacca.
import { decodePNG } from './png.mjs';

export const PUNTI = { Goro: [660, 350], Gorino: [1110, 640], Bocca: [1050, 1150] };

export async function leggiCorsa(rec, getBytes, inflate) {
  const legend = rec.legenda.map(l => { const m = l.nome.match(/^(-?[\d.]+)-(-?[\d.]+)$/); return m ? { lo: +m[1], c: [1, 3, 5].map(i => parseInt(l.colore.slice(i, i + 2), 16)) } : null; }).filter(Boolean);
  const maps = rec.mappe.map(m => ({ t: m.data_validita, file: m.mappa.file.file })).sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const out = { ore: [], mare: [], Bocca: [], Gorino: [], Goro: [] };
  let seaPts = null;
  for (const m of maps) {
    const png = await decodePNG(await getBytes(m.file), inflate);
    const bin = (px, py) => {
      const cnt = new Map();
      for (let dy = -12; dy <= 12; dy += 3) for (let dx = -12; dx <= 12; dx += 3) {
        const x = px + dx, y = py + dy; if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
        const c = png.rgba(x, y); if (c[3] < 128) continue; const k = c[0] + ',' + c[1] + ',' + c[2]; cnt.set(k, (cnt.get(k) || 0) + 1);
      }
      let best = null, bn = 0; for (const [k, n] of cnt) if (n > bn) { best = k; bn = n; }
      if (!best) return null;
      const c = best.split(',').map(Number); let lo = null, bd = 1e9;
      for (const l of legend) { const d = (l.c[0] - c[0]) ** 2 + (l.c[1] - c[1]) ** 2 + (l.c[2] - c[2]) ** 2; if (d < bd) { bd = d; lo = l.lo; } }
      return bd < 900 ? lo : null;
    };
    if (!seaPts) { seaPts = []; for (let y = 1250; y <= 1620; y += 60) for (let x = 200; x <= 2050; x += 150) if (x < png.width && y < png.height && png.rgba(x, y)[3] >= 128) seaPts.push([x, y]); }
    const sea = seaPts.map(([x, y]) => bin(x, y)).filter(v => v != null).sort((a, b) => a - b);
    out.ore.push(m.t);
    out.mare.push(sea.length ? sea[Math.floor(sea.length / 2)] : null);
    for (const k in PUNTI) out[k].push(bin(...PUNTI[k]));
  }
  return out;
}

// Ritardo dei passaggi di fascia di un punto rispetto al mare (minuti), separato per acqua che sale e che scende.
export function ritardi(corse, punto = 'Goro', ore = 24) {
  const su = [], giu = [];
  for (const c of corse) {
    const T = c.ore.slice(0, ore).map(t => Date.parse(t));
    const cross = s => { const r = []; for (let i = 1; i < T.length; i++) { const a = s[i - 1], b = s[i]; if (a == null || b == null || a === b) continue; const up = b > a; for (let e = Math.min(a, b) + 0.1; e < Math.max(a, b); e += 0.2) r.push({ t: (T[i] + T[i - 1]) / 2, e: +e.toFixed(2), up }); } return r; };
    const cm = cross(c.mare.slice(0, ore)), cp = cross(c[punto].slice(0, ore));
    for (const x of cp) { const m = cm.filter(y => y.e === x.e && y.up === x.up).sort((p, q) => Math.abs(p.t - x.t) - Math.abs(q.t - x.t))[0]; if (m && Math.abs(m.t - x.t) <= 3 * 3600e3) (x.up ? su : giu).push((x.t - m.t) / 60e3); }
  }
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  return { up: avg(su), down: avg(giu), nUp: su.length, nDown: giu.length };
}
