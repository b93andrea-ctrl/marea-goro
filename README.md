# Marea Goro — app personale per la marea a Porto Garibaldi / Sacca di Goro

Pagina web installabile sul telefono (PWA). Legge direttamente i dati pubblici di Arpae Emilia-Romagna e di Allerta Meteo ER, senza server intermedio.

## Cosa mostra

1. **Grafico marea** (prima schermata): osservato Porto Garibaldi delle ultime 24 h, previsione Adriac per le prossime 48 h, emissione del giorno prima in trasparenza, soglie regionali 0,70 e 0,80 m, linea "adesso", orari delle prossime alte e basse.
2. **Livello attuale stimato**: Arpae pubblica ogni lettura con 20 minuti di ritardo, quindi l'app prolunga l'ultima lettura seguendo la forma della previsione Adriac (scostamento = media pesata delle letture degli ultimi 30 minuti, perché il radar ha un rumore di 2-4 cm per lettura, più metà della sua tendenza rispetto alla mezz'ora precedente). Si ricalibra da sola a ogni nuova lettura. Sotto, in chiaro, l'ultima lettura ufficiale con la sua ora. Primo controllo 16/11 18:00: stima 0,07 m, reale 0,10 m, sola previsione −0,01 m.
3. **Prossime alte e basse** previste (estremi della curva Adriac, filtrati sotto gli 8 cm di dislivello).
4. **Scostamento meteo**: osservato meno previsione allo stesso istante.
5. Massimi e minimi delle ultime 24 h osservate e delle prossime 48 h previste.
6. **Allerta protezione civile** per la costa ferrarese (zona D2) con link al PDF.
7. Altri mareografi della costa (Cervia, Cattolica, più Porto Garibaldi come riscontro) e temperatura/salinità nelle stazioni della Sacca.
8. **Marea astronomica**: curva punteggiata sul grafico e calendario di 7 giorni (alte/basse con orario e livello) navigabile a settimane, per qualsiasi data. Calcolata nell'app da 19 costanti armoniche di Porto Garibaldi stimate il 16/11/2026 su tre anni di dati orari Arpae (01/01/2024 – 16/11/2026, tutti sullo zero RGC2023): M2 18,1 cm, K1 16,3, S2 10,6, P1 5,6, O1 5,0, Sa 3,5, …, con correzioni nodali. Residuo non spiegato 13,6 cm RMS (è la parte meteo). Verifica su 8 giorni di alte/basse misurate: ritardo medio 4 minuti, entro 20 minuti nei giorni calmi.
9. **Previsione Adriac corretta**: l'errore della previsione misurato sulle ultime 6 ore viene applicato alle ore successive con decadimento di 4 ore. Test a ritroso (14-15 nov, maltempo): errore a +1 h da 16 a 6 cm, a +3 h da 15 a 12 cm, invariato oltre +6 h. Le alte/basse previste e i massimi/minimi 48 h usano la curva corretta; la Adriac grezza resta visibile punteggiata.
10. **Cursore sul grafico**: tocca o trascina il dito sul grafico e un'etichetta mostra ora e livello in quel punto (misurato, stima, previsto o astronomico a seconda del tratto). Si toglie toccando l'etichetta; resta al suo posto agli aggiornamenti.
11. **Sacca di Goro · modello Shyfer e stima** (scheda chiusa, si apre toccandola): mappa oraria del modello Shyfer (SHYFEM fatto girare da Arpae, 72 ore, colori a scatti di 0,2 m) con cursore per scorrere le ore e i punti Goro, Gorino, Bocca segnati; sotto, per l'ora scelta, il livello Shyfer letto dai pixel della mappa nei tre punti e la "stima Goro" ricavata dalla nostra curva di Porto Garibaldi (misurato + previsione corretta) spostata avanti di 45 minuti, il ritardo visto nelle mappe del 18/11/2026. Una riga dice se le due fonti concordano. La mappa si scarica solo a scheda aperta.
12. **Mappa del vento in movimento** (scheda chiusa, sotto Scostamento meteo): mappa animata di Windy.com (embed ufficiale, modello ECMWF) centrata sulla Sacca con zoom 10, pulsanti per vento, raffiche, onde, pressione, pioggia; la barra in basso scorre le ore. L'iframe si carica solo quando la scheda viene aperta (pesa qualche MB).
13. **Vento e pressione** nella scheda Scostamento meteo: anemometro di Porto Garibaldi (10 m) e barometro di Guagnino/Comacchio con tendenza a 3 ore, dallo stesso servizio dei mareografi di allertameteo; una riga spiega se il vento tende ad alzare o abbassare il mare.
14. **Orari di pesca · 7 giorni** (in fondo): per ogni giorno le finestre in cui il livello sta tra due soglie regolabili (predefinite −20 e +20 cm, salvate sul telefono), da 1 h prima dell'alba a 1 h dopo il tramonto (alba/tramonto da Open-Meteo); finestre sotto le 2 ore scartate. Livello: quello stimato dentro la Sacca, cioè la curva di Porto Garibaldi spostata avanti di 45 minuti (fino a ~48 h misurato, stima, Adriac corretta; oltre la marea astronomica, giorni marcati "solo astronomica"). Per ogni finestra: durata, intervallo di livello, vento e raffiche massimi con direzione, pioggia; blu = buona (vento < 20, raffiche < 30 km/h, pioggia < 1 mm), oro = può dare fastidio, rosso = sconsigliata (vento ≥ 30 o raffiche ≥ 45); avviso se vento da mare ≥ 15 km/h. Meteo 7 giorni da Open-Meteo sul punto in mare davanti a Goro (~7 KB), riusato per un'ora.

Aggiornamento automatico ogni 10 minuti e quando riapri l'app (non più di una volta al minuto). Se la rete manca, mostra l'ultimo set di dati salvato. Per aggiornamento: 7 richieste (Arpae livello e previsione, allerta, allertameteo livello/vento/direzione/pressione in un solo giro); le stazioni della Sacca si chiedono una volta l'ora, la tendenza della pressione viene dalle letture salvate sul telefono, il modello Shyfer e la mappa Windy si scaricano solo aprendo le rispettive schede.

## File

- `app/index.html` — tutta l'app (HTML, CSS, JS, nessuna dipendenza esterna)
- `app/manifest.webmanifest`, `app/sw.js`, `app/icon-192.png`, `app/icon-512.png` — quanto serve per installarla come app; `app/logo-wave.png` è il ritaglio dell'onda del logo usato nell'intestazione (240 px)
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
- Il Porto Garibaldi di allertameteo è lo stesso mareografo dell'open data Arpae (valori identici): la scheda "Mareografi costa" serve per Cervia e Cattolica. Il parametro `time` di allertameteo è l'ora italiana scritta come UTC: fino al 23/11/2026 l'app lo passava in UTC vero e mostrava letture di un'ora prima; corretto.
- Verifica del 23/11/2026 su 7 giorni: stima "adesso" (a +20 min) errore medio 2,9 cm contro 4,0 della sola ultima lettura e 11,7 della sola Adriac; previsione corretta a +1 h 8,6 cm contro 12,3 della Adriac grezza, oltre +2 h nessun vantaggio. Nei giorni di maltempo 22-23/11 Adriac ha sbagliato i massimi di 20 cm (0,81 reale contro 0,61 previsto il 22; 0,67 contro 0,86 il 23).
- Zona di allerta D2 = costa ferrarese: verificare alla prima allerta costiera reale che la zona corrisponda.
