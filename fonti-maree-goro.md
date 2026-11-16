# Fonti maree Goro / Porto Garibaldi — risultati ispezione (16 nov 2026)

Tutte le fonti sotto sono state verificate nel browser il 16/11/2026. Orari in UTC salvo indicato.

## 1. Previsione livello mare (Adriac) — Arpae/ItaliaMeteo  ✅ JSON, CORS aperto

- URL: `https://apps.arpae.it/REST/meteo_mareogrammi?sort=-_id&max_results=1`
- Struttura: `_items[0].stazioni["Porto Garibaldi"].previsioni` = oggetto `{ "<data emissione>": [[ "<orario UTC>", <livello m> ], ...] }`
- Tre emissioni (ieri l'altro, ieri, oggi), ognuna 216 punti a passo 20 min = 72 ore.
- Emissione del giorno disponibile circa alle 07:10 UTC (`_created`), aggiornata nel pomeriggio.
- Stazioni: Ancona, Bari, Cervia, Cattolica, Ortona, Porto Corsini, Porto Garibaldi, San Benedetto d.T., Trieste, Venezia, Vieste.
- Soglie regionali allertamento costa ER: 0,70 m (giallo) e 0,80 m (rosso).
- Header `Access-Control-Allow-Origin: *` → leggibile anche direttamente da una PWA senza server intermedio.
- È la fonte del widget che ItaliaMeteo incorpora via iframe (`https://apps.arpae.it/widgets/meteo-mareogrammi/?mappa=1&iml=1`).

## 2. Osservato livello mare Porto Garibaldi — Arpae open data  ✅ JSON, 10 min, CORS aperto

- URL: `https://apps.arpae.it/REST/meteo_opendata_stazioni_livello_del_mare_istantaneo?where={"reftime":{"$gte":"<data RFC1123>"}}&sort=-reftime&max_results=500`
- Record: `{ station_id, reftime, value }` (value in metri).
- Stazioni che pubblicano: `14387` Porto Garibaldi (sensore radar/galleggiante) e `14422` Porto Garibaldi Encoder. Entrambe a 44.6767 N, 12.2494 E, serie dal 19/01/2017.
- Cadenza 10 min, ritardo pubblicazione ~20 min.
- Anagrafica stazione: `https://apps.arpae.it/REST/meteo_opendata_stazioni/<id>`
- Collezione gemella `meteo_marefe/14387` (variabili `livello_mare_igm_radar`, `livello_mare_igm_galleggiante`, temperatura aria) a passo 30 min, 31 giorni di storico, ma l'ultimo slot spesso ancora `null`: usare come backup.

## 3. Livello mare osservato — allertameteo.regione.emilia-romagna.it  ✅ JSON, CORS aperto

- URL: `https://allertameteo.regione.emilia-romagna.it/o/api/allerta/get-sensor-values-no-time?variabile=254,0,0/101,-,-,-/B22037&time=<epoch ms>`
- Risposta: Porto Garibaldi (14387), Cervia Porto (53155), Cattolica Porto (53156) con `value` in metri (sensore a pressione), passo 30 min. Se `time` non cade su uno slot pubblicato `value` è `null`: usare l'ultima mezz'ora intera.
- Utile come conferma del punto 2 e per Cervia/Cattolica.

## 4. Stato allerta protezione civile  ✅ JSON documentato, CORS aperto

- Guida ufficiale: `https://allertameteo.regione.emilia-romagna.it/sviluppatori`
- URL: `https://allertameteo.regione.emilia-romagna.it/o/get-stato-allerta` (param. opzionale `data=YYYY-MM-DD HH:mm`)
- Per zona: `mareggiate`, `stato_mare`, `vento`, ... con valori `green|yellow|orange|red|null`. Le zone costiere (unica con mareggiate ≠ null) sono **D2** e **B2**. Costa ferrarese = D2 (da confermare sulla mappa zone al primo utilizzo), costa romagnola = B2.
- Anche `titolo`, `link` al PDF, `dataInizio`, `dataFine`, `descrizionemeteo`.
- Alternativa XML CAP: `/o/xmlcap`. Feed RSS: `/o/compila-allerta-portlet/feed?feed=allerte-bollettini`.

## 5. Previsione livello mare dentro la Sacca di Goro — modello Shyfer (Arpae)  🟡 solo immagini PNG orarie

- URL: `https://apps.arpae.it/REST/meteo_mappe_mare_previsione_livello_mare_sacca_shyfer?sort=-_id&max_results=1`
- `_items[0].mappe[]` = una PNG per ogni ora di validità (`data_validita`), file in `https://apps.arpae.it/REST/media/<id>` (`mappa.file.file` dà `/media/<id>`: va prefissato con `/REST`, senza prefisso risponde 404). Bounds 12.24–12.42 E, 44.76–44.86 N. Legenda a colori in `legenda[]` (fasce da −0,9 a +1,3 m).
- Mostrabile nell'app come immagine/animazione; nessun valore numerico puntuale.
- Esistono anche `..._podelta_shyfer` (Delta del Po) ed `..._er_shyfer`.

## 6. Stazioni Daphne dentro la Sacca — Arpae `meteo_marefe`  🟡 niente livello

- `https://apps.arpae.it/REST/meteo_marefe` (12 stazioni). Nella Sacca: Gorino 2 (53144), Manufatto (14385), Punta Volano (53143), Bocca Scanno (53145), Po di Goro (53159), Bellocchio (14379), Logonovo (14384).
- Variabili: ossigeno, pH, salinità, temperatura acqua (e `profondita_misura` su Bocca Scanno). **Nessuna variabile di livello mare.** Dati a 30 min, 31 giorni di storico.
- Utili come extra (salinità/temperatura in Sacca), non per la marea.

## 7. Faro di Goro  ❌ nessun feed pubblico trovato

- Cercato in `meteo_opendata_stazioni` (regex goro|faro|volano|scanno|gorino|bellocchio|garibaldi): nessuna stazione con livello mare oltre Porto Garibaldi. Volano (2980) ha solo vento/pressione/pioggia.
- Il mareografo esiste (citato nei report mensili Daphne) ma non è esposto su apps.arpae.it né su allertameteo. Resta da chiedere a Daphne (Cesenatico) o COPEGO.

## 8. ISPRA mareografico.it (Ravenna / Porto Corsini)  🟡 scraping fragile

- La mappa interattiva (`/it/mappa-interattiva.html`) carica un JS generato ogni 30 min: `https://www.mareografico.it/FILE/TEMP/_jS1_YYYYMMDDHHMM.map` (es. `_jS1_202611161630.map`), con array `Da` = per stazione `[nome, livello m, T acqua, T aria, ..., pressione, dir vento, vel vento, ...]`. Ravenna il 16/11 16:30 = 0,275 m.
- Il nome file va ricavato dall'HTML della pagina a ogni giro. Nessuna API documentata. Riferimento altimetrico diverso da Arpae: non confrontare al centimetro.

## 9. Marea astronomica  ✅ calcolata in locale

- Serie oraria Porto Garibaldi (14387) da `meteo_opendata_stazioni_livello_del_mare_istantaneo` con `where={"station_id":"14387","_id":{"$regex":"00$"},"reftime":{"$gte":"<data>"}}` (il regex sull'`_id` seleziona gli orari a minuto 00), `max_results=5000` per pagina, `page=1,2`.
- Fit ai minimi quadratici di 29 costituenti con correzioni nodali (f,u da N = 125,0445° − 0,0529539°·giorni da J2000), fase riferita a T0 = 2026-01-01 00:00 UTC. Un anno (15/11/2025 – 16/11/2026, 8783 ore valide).
- Primo fit su un anno (15/11/2025 – 16/11/2026): Z0 = 0,103 m; M2 0,179, K1 0,158, S2 0,105, Sa 0,069, Ssa 0,041; residuo 0,137 m RMS.
- Fit definitivo su tre anni (01/01/2024 – 16/11/2026, 24.949 ore, tutte sullo zero RGC2023): Z0 = 0,104 m; M2 0,181, K1 0,163, S2 0,106, P1 0,056, O1 0,050, Sa 0,035, K2 0,032, N2 0,031, Mm 0,023, Ssa 0,009; residuo 0,136 m RMS su segnale 0,247 m std. Le componenti annuale/semiannuale su un anno solo erano sovrastimate del doppio. Un fit su quattro anni (dal 2022) dà Z0 = 0,121: i dati pre-2024 sono su un altro zero, non mescolarli. Costanti con A < 3 mm scartate (19 tenute), incorporate in `app/index.html`.
- `meteo_mareogrammi` conserva solo gli ultimi 3 documenti (3 emissioni): per test a ritroso lunghi bisogna salvarsi le emissioni giorno per giorno.
- Verifica 16/11: contro Adriac 48 h → corr 0,93, sd 6 cm, offset +12 cm (sovralzo meteo del momento). Contro osservato 24 h → corr 0,81, sd 9,6 cm.

## Note trasversali

- Tutti gli endpoint `apps.arpae.it/REST/*` sono Eve/MongoDB: supportano `where`, `sort`, `max_results`, `projection`, `page`.
- Riferimento altimetrico Arpae: RGC2023 dal 01/01/2024 (offset Porto Garibaldi −8,1 cm rispetto al precedente).
- Frequenza di polling consigliata: 10–15 min per osservati, 1 ora per previsioni e allerte.
