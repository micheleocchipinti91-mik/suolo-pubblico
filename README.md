# Gestione Suolo Pubblico — PWA per iPad

App web progressiva (PWA) per la gestione delle occupazioni di suolo pubblico — ATM Spa.

> Versione ottimizzata per iPad. Funziona offline, installabile dalla schermata Home di Safari.

## 🚀 Deploy su GitHub Pages (gratuito)

1. Crea un repository su GitHub (es. `suolo-pubblico-pwa`)
2. Carica tutti i file di questa cartella (tranne `CLAUDE.md`)
3. Vai su **Settings → Pages → Source: Deploy from branch → main → / (root)**
4. GitHub assegna automaticamente un URL HTTPS, es: `https://tuonome.github.io/suolo-pubblico-pwa/`
5. Sull'iPad, apri quell'URL in Safari
6. Tocca **Condividi** → **Aggiungi a schermata Home**

L'app appare come icona, si apre full-screen e funziona **offline**.

## 📁 Struttura file

```
index.html          — SPA principale (unica pagina)
app.js              — Routing e logica viste (Dashboard, Occupazione, Riepilogo, Anagrafica)
db.js               — Storage locale con IndexedDB
pdf.js              — Generazione PDF con jsPDF
sw.js               — Service Worker (cache offline)
manifest.json       — Configurazione PWA (icone, colori, orientamento)
style.css           — Stili ottimizzati per iPad
logo.png            — Logo ATM Spa
icons/
  icon-192.png
  icon-512.png
  apple-touch-icon.png   ← icona 180×180 per "Aggiungi a schermata Home"
```

## 📱 Funzionalità

- **Dashboard** — KPI anno corrente: stalli totali, annuali, stagionali, stato pagamenti
- **Occupazione Suolo** — elenco per anno, aggiungi/modifica/elimina con tutti i campi originali (settore, tariffazione, periodo, pagamento, avvisi, note)
- **Riepilogo** — tabella filtrata per ragione sociale, settore, periodo, pagamento, tariffazione + export PDF
- **Anagrafica Ditte** — archivio ditte con CRUD completo; importabile nei form occupazione
- **Export/Import JSON** — backup e ripristino dati (utile per migrazione dal database originale)

## 🔄 Migrazione dati dal PC

Il database dell'app desktop è `database_suolo_pubblico.json` nella cartella originale.
Per importarlo nella PWA:

1. Apri la PWA su iPad
2. Tocca il menu **Dati → Importa backup JSON**
3. Seleziona il file `database_suolo_pubblico.json`
4. I dati vengono caricati in IndexedDB e sono disponibili offline

## 🛠 Sviluppo locale

Non è richiesto Node.js. Basta un server HTTP statico:

```bash
# Con Python (preinstallato su Mac/Linux):
python3 -m http.server 8080

# Con Node.js:
npx serve .
```

Poi apri `http://localhost:8080` nel browser.

> ⚠️ Il Service Worker richiede HTTPS o localhost. Per testare su iPad usa GitHub Pages o ngrok.

## 📌 Note tecniche

- **Storage**: IndexedDB (persiste nel browser, fino a ~50MB su Safari)
- **PDF**: jsPDF + jspdf-autotable (generazione lato client, nessun server)
- **Offline**: Service Worker con strategia Cache First
- **Icone**: generare da `logo.png` con [realfavicongenerator.net](https://realfavicongenerator.net)
