# Marea Goro — app personale per la marea a Porto Garibaldi / Sacca di Goro

Pagina web installabile sul telefono (PWA). Legge direttamente i dati pubblici di Arpae Emilia-Romagna e di Allerta Meteo ER, senza server intermedio.

## Cosa mostra

1. **Grafico marea** (prima schermata): osservato Porto Garibaldi delle ultime 24 h, previsione Adriac per le prossime 48 h, emissione del giorno prima in trasparenza, soglie regionali 0,70 e 0,80 m, linea "adesso", orari delle prossime alte e basse.
2. **Livello attuale stimato**: Arpae pubblica ogni lettura con 20 minuti di ritardo, quindi l'app prolunga l'ultima lettura seguendo la forma della previsione Adriac (scostamento agganciato all'ultima lettura più metà della sua tendenza nei 30 minuti precedenti). Si ricalibra da sola a ogni nuova lettura. Sotto, in chiaro, l'ultima lettura ufficiale con la sua ora. Primo controllo 16/11 18:00: stima 0,07 m, reale 0,10 m, sola previsione −0,01 m.
3. **Prossime alte e basse** previste (estremi della curva Adriac, filtrati sotto gli 8 cm di dislivello).
4. **Scostamento meteo**: osservato meno previsione allo stesso istante.
5. Massimi e minimi delle ultime 24 h osservate e delle prossime 48 h previste.
6. **Allerta protezione civile** per la costa ferrarese (zona D2) con link al PDF.
7. Altri mareografi (Cervia, Cattolica) e temperatura/salinità nelle stazioni della Sacca.
8. **Marea astronomica**: curva punteggiata sul grafico e calendario di 7 giorni (alte/basse con orario e livello) navigabile a settimane, per qualsiasi data. Calcolata nell'app da 19 costanti armoniche di Porto Garibaldi stimate il 16/11/2026 su tre anni di dati orari Arpae (01/01/2024 – 16/11/2026, tutti sullo zero RGC2023): M2 18,1 cm, K1 16,3, S2 10,6, P1 5,6, O1 5,0, Sa 3,5, …, con correzioni nodali. Residuo non spiegato 13,6 cm RMS (è la parte meteo). Verifica su 8 giorni di alte/basse misurate: ritardo medio 4 minuti, entro 20 minuti nei giorni calmi.
9. **Previsione Adriac corretta**: l'errore della previsione misurato sulle ultime 6 ore viene applicato alle ore successive con decadimento di 4 ore. Test a ritroso (14-15 nov, maltempo): errore a +1 h da 16 a 6 cm, a +3 h da 15 a 12 cm, invariato oltre +6 h. Le alte/basse previste e i massimi/minimi 48 h usano la curva corretta; la Adriac grezza resta visibile punteggiata.

Aggiornamento automatico ogni 10 minuti e quando riapri l'app. Se la rete manca, mostra l'ultimo set di dati salvato.

## File

- `app/index.html` — tutta l'app (HTML, CSS, JS, nessuna dipendenza esterna)
- `app/manifest.webmanifest`, `app/sw.js`, `app/icon.svg`, `app/icon-192.png` — quanto serve per installarla come app
- `serve.ps1` + `.claude/launch.json` — server locale di prova su http://localhost:8765/
- `fonti-maree-goro.md` — tutte le fonti dati verificate, con gli indirizzi esatti

## Come metterla sul telefono

L'installazione come app richiede HTTPS. Due strade gratuite:

**A. GitHub Pages** (consigliata, aggiornamenti facili)
1. Crea un repository, carica il contenuto della cartella `app/` nella radice.
2. Settings → Pages → Source: branch `main`, cartella `/ (root)`.
3. Apri `https://<utente>.github.io/<repo>/` su Chrome Android → menu ⋮ → "Installa app" / "Aggiungi a schermata Home".

**B. Netlify Drop** (zero configurazione)
1. Vai su https://app.netlify.com/drop e trascina la cartella `app/`.
2. Apri l'indirizzo che ti dà e installa come sopra.

Per provarla subito sul PC senza pubblicarla: esegui `serve.ps1` e apri http://localhost:8765/ (su localhost l'installazione funziona anche senza HTTPS).

## Limiti noti

- **Faro di Goro**: Arpae non pubblica il suo mareografo in nessun feed aperto. Il riferimento è Porto Garibaldi; dentro la Sacca la marea arriva in ritardo di decine di minuti.
- **Marea astronomica**: stimata su tre anni (dal 2024, cambio di zero Arpae). Non usare dati precedenti al 2024 senza correggere lo zero (−8,1 cm). Le costanti stanno in `app/index.html` (oggetto `ASTRO`); la procedura è in `fonti-maree-goro.md`.
- **Correzione della previsione**: tarata su un campione piccolo (Arpae conserva solo le ultime tre emissioni Adriac); da riverificare dopo qualche settimana salvando le emissioni giorno per giorno.
- I due sensori di Porto Garibaldi (radar/galleggiante nell'open data, pressione su allertameteo) differiscono di qualche centimetro: l'app li mostra entrambi con la loro etichetta.
- Zona di allerta D2 = costa ferrarese: verificare alla prima allerta costiera reale che la zona corrisponda.
