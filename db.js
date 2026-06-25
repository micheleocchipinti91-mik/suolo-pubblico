// db.js — IndexedDB wrapper per Gestione Suolo Pubblico ATM Spa
// Sostituisce database.js (Node/fs) con storage client-side

const DB_NAME = 'suoloPubblicoATM';
const DB_VERSION = 1;

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('ditte')) {
        db.createObjectStore('ditte', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('occupazioni')) {
        const os = db.createObjectStore('occupazioni', { keyPath: 'id' });
        os.createIndex('anno', 'periodo.anno', { unique: false });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = e => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function promisify(req) {
  return new Promise((res, rej) => {
    req.onsuccess = e => res(e.target.result);
    req.onerror = e => rej(e.target.error);
  });
}

// ─── DITTE ────────────────────────────────────────────────────────────────────

async function getDitte() {
  const store = await tx('ditte');
  return promisify(store.getAll());
}

async function getDitta(id) {
  const store = await tx('ditte');
  return promisify(store.get(id));
}

async function addDitta(ditta) {
  ditta.id = Date.now().toString();
  const store = await tx('ditte', 'readwrite');
  await promisify(store.put(ditta));
  return ditta;
}

async function updateDitta(id, ditta) {
  ditta.id = id;
  const store = await tx('ditte', 'readwrite');
  await promisify(store.put(ditta));
  return ditta;
}

async function deleteDitta(id) {
  const store = await tx('ditte', 'readwrite');
  return promisify(store.delete(id));
}

async function searchDitte(q) {
  const ditte = await getDitte();
  if (!q) return ditte;
  const lower = q.toLowerCase();
  return ditte.filter(d =>
    (d.ragioneSociale || '').toLowerCase().includes(lower) ||
    (d.nomeAttivita   || '').toLowerCase().includes(lower) ||
    (d.intestazione   || '').toLowerCase().includes(lower) ||
    (d.partitaIva     || '').toLowerCase().includes(lower)
  );
}

// ─── OCCUPAZIONI ──────────────────────────────────────────────────────────────

async function getOccupazioni() {
  const store = await tx('occupazioni');
  return promisify(store.getAll());
}

async function getOccupazione(id) {
  const store = await tx('occupazioni');
  return promisify(store.get(id));
}

async function getOccupazioniByAnno(anno) {
  const all = await getOccupazioni();
  return all.filter(o => o.periodo && o.periodo.anno === parseInt(anno));
}

async function getAnniPresenti() {
  const all = await getOccupazioni();
  const anni = [...new Set(all.map(o => o.periodo && o.periodo.anno).filter(Boolean))];
  return anni.sort((a, b) => b - a);
}

async function addOccupazione(occ) {
  occ.id = Date.now().toString();
  const store = await tx('occupazioni', 'readwrite');
  await promisify(store.put(occ));
  return occ;
}

async function updateOccupazione(id, occ) {
  occ.id = id;
  const store = await tx('occupazioni', 'readwrite');
  await promisify(store.put(occ));
  return occ;
}

async function deleteOccupazione(id) {
  const store = await tx('occupazioni', 'readwrite');
  return promisify(store.delete(id));
}

// ─── BACKUP / RESTORE ─────────────────────────────────────────────────────────

async function exportData() {
  const [ditte, occupazioni] = await Promise.all([getDitte(), getOccupazioni()]);
  return { ditte, occupazioni };
}

async function importData(jsonStr) {
  const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;

  const db = await openDB();

  // Svuota e reimporta ditte
  await new Promise((res, rej) => {
    const t = db.transaction('ditte', 'readwrite');
    t.objectStore('ditte').clear();
    t.oncomplete = res;
    t.onerror = rej;
  });
  for (const d of (data.ditte || [])) {
    const store = await tx('ditte', 'readwrite');
    await promisify(store.put(d));
  }

  // Svuota e reimporta occupazioni
  await new Promise((res, rej) => {
    const t = db.transaction('occupazioni', 'readwrite');
    t.objectStore('occupazioni').clear();
    t.oncomplete = res;
    t.onerror = rej;
  });
  for (const o of (data.occupazioni || [])) {
    const store = await tx('occupazioni', 'readwrite');
    await promisify(store.put(o));
  }

  return true;
}

// Esporta tutte le funzioni globalmente
window.DB = {
  getDitte, getDitta, addDitta, updateDitta, deleteDitta, searchDitte,
  getOccupazioni, getOccupazione, getOccupazioniByAnno, getAnniPresenti,
  addOccupazione, updateOccupazione, deleteOccupazione,
  exportData, importData
};
