// app.js — SPA routing e logica viste per Gestione Suolo Pubblico PWA

const ANNO_CORRENTE = new Date().getFullYear();

// ─── ROUTER ───────────────────────────────────────────────────────────────────

const ROUTES = {
  '/': renderDashboard,
  '/occupazione': renderOccupazione,
  '/riepilogo': renderRiepilogo,
  '/anagrafica': renderAnagrafica
};

function navigate(path, params = {}) {
  const url = params.anno ? `${path}?anno=${params.anno}` : path;
  history.pushState({ path, params }, '', url);
  renderView(path, params);
}

function renderView(path, params = {}) {
  // Aggiorna sidebar link attivi
  document.querySelectorAll('.sidebar .nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.route === path);
  });
  const fn = ROUTES[path] || renderDashboard;
  fn(params);
}

window.addEventListener('popstate', e => {
  const state = e.state || {};
  renderView(state.path || '/', state.params || {});
});

// ─── UTILS ────────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function main() { return el('main-content'); }

function showToast(message, type = 'success') {
  const container = el('toast-container');
  if (!container) return;
  const colorClass = type === 'danger' ? 'bg-danger'
    : type === 'warning' ? 'bg-warning text-dark'
    : 'bg-success';
  const d = document.createElement('div');
  d.className = `toast align-items-center text-white ${colorClass} border-0 mb-2 show`;
  d.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div></div>`;
  container.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

function formatData(d) {
  if (!d) return '';
  const p = d.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

function badgePagamento(stato) {
  if (stato === 'pagato')    return `<span class="status-badge"><span class="status-dot status-pagato"></span>Pagato</span>`;
  if (stato === 'parziale')  return `<span class="status-badge"><span class="status-dot status-parziale"></span>Parziale</span>`;
  return `<span class="status-badge"><span class="status-dot status-non_pagato"></span>Non Pagato</span>`;
}

function badgePeriodo(o) {
  let s = '';
  if (o.periodo.annuale)   s += `<span class="badge bg-success">Annuale</span> `;
  if (o.periodo.stagionale) s += `<span class="badge bg-warning text-dark">Stagionale</span>`;
  if (o.periodo.dataInizio && o.periodo.dataFine)
    s += `<br><small>${formatData(o.periodo.dataInizio)} - ${formatData(o.periodo.dataFine)}</small>`;
  return s;
}

function annoSelectHTML(anni, selezionato) {
  return anni.map(a =>
    `<option value="${a}" ${a === selezionato ? 'selected' : ''}>${a}</option>`
  ).join('');
}

async function getAnniConCorrente() {
  const anni = await DB.getAnniPresenti();
  if (!anni.includes(ANNO_CORRENTE)) anni.unshift(ANNO_CORRENTE);
  return [...new Set([ANNO_CORRENTE, ...anni])].sort((a, b) => b - a);
}

// Tariffazione per settore
const TARIFFAZIONI = {
  C: [
    { value: 'Rossa Stag',  label: 'Rossa Stagionale' },
    { value: 'Gialla Stag', label: 'Gialla Stagionale' },
    { value: 'Gialla Ann',  label: 'Gialla Annuale' },
    { value: 'Grigia',      label: 'Grigia' }
  ],
  F: [
    { value: 'Rossa Ann',  label: 'Rossa Annuale' },
    { value: 'Gialla Ann', label: 'Gialla Annuale' }
  ]
};

function tariffazioneOptions(settore, selected = '') {
  return (TARIFFAZIONI[settore] || TARIFFAZIONI.C).map(t =>
    `<option value="${t.value}" ${t.value === selected ? 'selected' : ''}>${t.label}</option>`
  ).join('');
}

// ─── AVVISATO TAG WIDGET ─────────────────────────────────────────────────────

function avvRenderTags(prefix, dates) {
  const tagsEl  = el(prefix + 'Tags');
  const inputEl = el(prefix + 'Input');
  if (!tagsEl || !inputEl) return;
  tagsEl.innerHTML = dates.map(d =>
    `<span class="badge bg-info text-dark me-1 mb-1" style="font-size:.9rem;padding:6px 10px;">
      ${formatData(d)}
      <span style="cursor:pointer;font-weight:bold;margin-left:4px;" onclick="avvRimuovi('${prefix}','${d}')">×</span>
    </span>`
  ).join('');
  inputEl.value = dates.join(', ');
}

window.avvAggiungi = function(prefix) {
  const dateEl  = el(prefix + 'Date');
  const inputEl = el(prefix + 'Input');
  if (!dateEl || !dateEl.value) return;
  const dates = inputEl.value.trim()
    ? inputEl.value.split(',').map(d => d.trim()).filter(Boolean) : [];
  if (!dates.includes(dateEl.value)) {
    dates.push(dateEl.value);
    avvRenderTags(prefix, dates);
  }
  dateEl.value = '';
};

window.avvRimuovi = function(prefix, date) {
  const inputEl = el(prefix + 'Input');
  if (!inputEl) return;
  const dates = inputEl.value.split(',').map(d => d.trim()).filter(d => d && d !== date);
  avvRenderTags(prefix, dates);
};

window.avvToggle = function(prefix, value) {
  const section = el(prefix + 'DateSection');
  const btnNo   = el(prefix + 'BtnNo');
  const btnSi   = el(prefix + 'BtnSi');
  if (!section) return;
  if (value) {
    section.style.display = 'block';
    if (btnSi) btnSi.className = 'btn btn-success btn-sm';
    if (btnNo) btnNo.className = 'btn btn-outline-secondary btn-sm';
  } else {
    section.style.display = 'none';
    if (btnNo) btnNo.className = 'btn btn-secondary btn-sm';
    if (btnSi) btnSi.className = 'btn btn-outline-success btn-sm';
    avvRenderTags(prefix, []);
  }
};

window.updateTariffazione = function(select, prefix) {
  const tarEl = el('tariffazione_' + prefix);
  if (!tarEl) return;
  tarEl.innerHTML = tariffazioneOptions(select.value);
};

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

async function renderDashboard() {
  const occupazioni = await DB.getOccupazioniByAnno(ANNO_CORRENTE);
  const totaleStalli    = occupazioni.reduce((s, o) => s + (o.stalli.numero || 0), 0);
  const stalliAnnuali   = occupazioni.filter(o => o.periodo.annuale).reduce((s, o) => s + (o.stalli.numero || 0), 0);
  const stalliStagionali = occupazioni.filter(o => o.periodo.stagionale).reduce((s, o) => s + (o.stalli.numero || 0), 0);
  const pagati    = occupazioni.filter(o => o.pagamento.stato === 'pagato').length;
  const parziali  = occupazioni.filter(o => o.pagamento.stato === 'parziale').length;
  const nonPagati = occupazioni.filter(o => o.pagamento.stato === 'non_pagato').length;

  main().innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Dashboard</h2>
      <span class="badge bg-primary fs-5">Anno ${ANNO_CORRENTE}</span>
    </div>
    <div class="row g-4 mb-4">
      <div class="col-md-4">
        <div class="card kpi-card bg-primary text-white">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 opacity-75">Totale Stalli</h6>
            <h2 class="card-title mb-0">${totaleStalli}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card bg-success text-white">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 opacity-75">Stalli Annuali</h6>
            <h2 class="card-title mb-0">${stalliAnnuali}</h2>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card bg-warning text-dark">
          <div class="card-body">
            <h6 class="card-subtitle mb-2 opacity-75">Stalli Stagionali/Temporanei</h6>
            <h2 class="card-title mb-0">${stalliStagionali}</h2>
          </div>
        </div>
      </div>
    </div>
    <h4 class="mb-3">Stato Pagamenti</h4>
    <div class="row g-4">
      <div class="col-md-4">
        <div class="card kpi-card border-success">
          <div class="card-body text-center">
            <span class="status-badge"><span class="status-dot status-pagato"></span><strong>Pagati</strong></span>
            <h3 class="text-success mb-0 mt-2">${pagati}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card border-warning">
          <div class="card-body text-center">
            <span class="status-badge"><span class="status-dot status-parziale"></span><strong>Parziali</strong></span>
            <h3 class="text-warning mb-0 mt-2">${parziali}</h3>
          </div>
        </div>
      </div>
      <div class="col-md-4">
        <div class="card kpi-card border-danger">
          <div class="card-body text-center">
            <span class="status-badge"><span class="status-dot status-non_pagato"></span><strong>Non Pagati</strong></span>
            <h3 class="text-danger mb-0 mt-2">${nonPagati}</h3>
          </div>
        </div>
      </div>
    </div>`;
}

// ─── OCCUPAZIONE ──────────────────────────────────────────────────────────────

async function renderOccupazione({ anno } = {}) {
  anno = parseInt(anno || ANNO_CORRENTE);
  const [occupazioni, ditte, anni] = await Promise.all([
    DB.getOccupazioniByAnno(anno),
    DB.getDitte(),
    getAnniConCorrente()
  ]);

  const righe = occupazioni.length === 0
    ? `<tr><td colspan="8" class="text-center text-muted py-4">Nessuna occupazione per l'anno ${anno}</td></tr>`
    : occupazioni.map(o => `
      <tr>
        <td><strong>${o.ditta.ragioneSociale}</strong><br><small class="text-muted">P.IVA: ${o.ditta.partitaIva}</small></td>
        <td>${o.ditta.ubicazione || ''}, ${o.ditta.civico || ''}</td>
        <td>${o.stalli.numero}</td>
        <td><span class="badge bg-secondary">${o.stalli.settore}</span></td>
        <td>${o.stalli.tariffazione}</td>
        <td>${badgePeriodo(o)}</td>
        <td>${badgePagamento(o.pagamento.stato)}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="apriModificaOccupazione('${o.id}')">Modifica</button>
          <button class="btn btn-sm btn-outline-danger" onclick="confermaEliminaOccupazione('${o.id}')">Elimina</button>
        </td>
      </tr>`).join('');

  main().innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Occupazione Suolo Pubblico</h2>
      <div class="d-flex align-items-center gap-3">
        <label class="mb-0 fw-semibold">Anno:</label>
        <select class="form-select form-select-sm" style="width:120px;" onchange="navigate('/occupazione',{anno:this.value})">
          ${annoSelectHTML(anni, anno)}
        </select>
      </div>
    </div>
    <div class="card">
      <div class="card-header d-flex justify-content-between align-items-center">
        <span>Elenco Occupazioni</span>
        <button class="btn btn-primary btn-sm" onclick="apriAggiuntaOccupazione(${anno})">
          <i class="bi bi-plus-circle"></i> Aggiungi
        </button>
      </div>
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr><th>Ditta</th><th>Ubicazione</th><th>Stalli</th><th>Settore</th><th>Tariffazione</th><th>Periodo</th><th>Stato</th><th>Azioni</th></tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- Modale Aggiungi -->
    <div class="modal fade" id="addOccModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Nuova Occupazione</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="addOccBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-primary" onclick="salvaOccupazione(${anno})">Salva</button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modale Modifica -->
    <div class="modal fade" id="editOccModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Modifica Occupazione</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body" id="editOccBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-primary" id="editOccSaveBtn">Salva</button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modale conferma elimina -->
    <div class="modal fade" id="delOccModal" tabindex="-1">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header py-2"><h6 class="modal-title">Conferma eliminazione</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body py-2"><p class="mb-0">Eliminare questa occupazione?</p></div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-danger btn-sm" id="delOccConfirmBtn">Elimina</button>
          </div>
        </div>
      </div>
    </div>`;

  // Store ditte per uso nei form
  window._ditteCache = ditte;
  window._annoOccupazione = anno;
}

function formOccupazioneHTML(o = {}, prefix = 'add', annoDefault = ANNO_CORRENTE) {
  const d  = o.ditta    || {};
  const st = o.stalli   || { settore: 'C' };
  const pe = o.periodo  || { anno: annoDefault };
  const pg = o.pagamento || { stato: 'pagato' };
  const avvisatoStr = (o.avvisato || []).join(', ');
  const hasAvvisato = (o.avvisato || []).length > 0;

  return `
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h6 class="fw-bold text-primary mb-0">Ditta</h6>
      ${prefix === 'add' ? `<button type="button" class="btn btn-outline-secondary btn-sm" onclick="toggleArchivioSearch()"><i class="bi bi-search"></i> Importa da Archivio</button>` : ''}
    </div>
    ${prefix === 'add' ? `<div id="archivioSearch" class="mb-3 p-3 bg-light rounded" style="display:none;">
      <input type="text" class="form-control" id="searchDittaInput" placeholder="Cerca ragione sociale o P.IVA..." oninput="cercaDitte()">
      <div id="searchDitteResults" class="mt-2"></div>
    </div>` : ''}
    <div class="row g-3 mb-3">
      <div class="col-md-6"><label class="form-label">Ragione Sociale *</label>
        <input type="text" class="form-control" id="${prefix}_ragioneSociale" value="${d.ragioneSociale || ''}" required></div>
      <div class="col-md-3"><label class="form-label">P.IVA *</label>
        <input type="text" class="form-control" id="${prefix}_partitaIva" value="${d.partitaIva || ''}" required></div>
      <div class="col-md-3"><label class="form-label">Codice Univoco</label>
        <input type="text" class="form-control" id="${prefix}_codiceUnivoco" value="${d.codiceUnivoco || ''}"></div>
      <div class="col-md-4"><label class="form-label">Intestazione</label>
        <input type="text" class="form-control" id="${prefix}_intestazione" value="${d.intestazione || ''}"></div>
      <div class="col-md-4"><label class="form-label">Ubicazione *</label>
        <input type="text" class="form-control" id="${prefix}_ubicazione" value="${d.ubicazione || ''}" required></div>
      <div class="col-md-2"><label class="form-label">Civico *</label>
        <input type="text" class="form-control" id="${prefix}_civico" value="${d.civico || ''}" required></div>
      <div class="col-md-2"><label class="form-label">Telefono</label>
        <input type="text" class="form-control" id="${prefix}_telefono" value="${d.telefono || ''}"></div>
    </div>
    <h6 class="fw-bold text-primary mb-3">Stalli</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-3"><label class="form-label">Numero Stalli *</label>
        <input type="number" class="form-control" id="${prefix}_numeroStalli" value="${st.numero || ''}" required></div>
      <div class="col-md-3"><label class="form-label">Settore *</label>
        <select class="form-select" id="${prefix}_settore" onchange="updateTariffazione(this,'${prefix}')">
          <option value="C" ${st.settore === 'C' ? 'selected' : ''}>C</option>
          <option value="F" ${st.settore === 'F' ? 'selected' : ''}>F</option>
        </select></div>
      <div class="col-md-4"><label class="form-label">Tariffazione *</label>
        <select class="form-select" id="tariffazione_${prefix}">
          ${tariffazioneOptions(st.settore || 'C', st.tariffazione)}
        </select></div>
    </div>
    <h6 class="fw-bold text-primary mb-3">Periodo</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-12">
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="checkbox" id="${prefix}_annuale" ${pe.annuale ? 'checked' : ''}>
          <label class="form-check-label">Annuale</label></div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="checkbox" id="${prefix}_stagionale" ${pe.stagionale ? 'checked' : ''}>
          <label class="form-check-label">Stagionale/Temporanea</label></div>
      </div>
      <div class="col-md-3"><label class="form-label">Data Inizio</label>
        <input type="date" class="form-control" id="${prefix}_dataInizio" value="${pe.dataInizio || ''}"></div>
      <div class="col-md-3"><label class="form-label">Data Fine</label>
        <input type="date" class="form-control" id="${prefix}_dataFine" value="${pe.dataFine || ''}"></div>
      <div class="col-md-3"><label class="form-label">Anno</label>
        <input type="number" class="form-control" id="${prefix}_annoPeriodo" value="${pe.anno || annoDefault}"></div>
    </div>
    <h6 class="fw-bold text-primary mb-3">Pagamento</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-12">
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="${prefix}_pagamento" value="pagato" id="${prefix}_pag_pagato" ${pg.stato === 'pagato' ? 'checked' : ''}>
          <label class="form-check-label" for="${prefix}_pag_pagato"><span class="status-dot status-pagato"></span> Pagato</label></div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="${prefix}_pagamento" value="parziale" id="${prefix}_pag_parziale" ${pg.stato === 'parziale' ? 'checked' : ''}>
          <label class="form-check-label" for="${prefix}_pag_parziale"><span class="status-dot status-parziale"></span> Parziale</label></div>
        <div class="form-check form-check-inline">
          <input class="form-check-input" type="radio" name="${prefix}_pagamento" value="non_pagato" id="${prefix}_pag_non" ${pg.stato === 'non_pagato' || !pg.stato ? 'checked' : ''}>
          <label class="form-check-label" for="${prefix}_pag_non"><span class="status-dot status-non_pagato"></span> Non Pagato</label></div>
      </div>
    </div>
    <h6 class="fw-bold text-primary mb-3">Avvisato</h6>
    <div class="row g-3 mb-3">
      <div class="col-md-12">
        <label class="form-label d-block mb-2">Date Avvisi</label>
        <input type="date" class="form-control mb-2" id="${prefix}avvisatoDate" style="max-width:260px;" onchange="avvAggiungi('${prefix}avvisato')">
        <div id="${prefix}avvisatoTags" class="d-flex flex-wrap gap-1 mb-1"></div>
        <input type="hidden" id="${prefix}avvisatoInput" value="${avvisatoStr}">
      </div>
    </div>
    <div class="row g-3">
      <div class="col-md-12"><label class="form-label">Note</label>
        <textarea class="form-control" id="${prefix}_note" rows="2">${o.note || ''}</textarea></div>
    </div>`;
}

function leggiOccupazioneDaForm(prefix, anno) {
  function val(id) { const e = el(id); return e ? e.value.trim() : ''; }
  function checked(id) { const e = el(id); return e ? e.checked : false; }
  function radio(name) {
    const r = document.querySelector(`input[name="${name}"]:checked`);
    return r ? r.value : 'non_pagato';
  }
  const avvStr = val(prefix + 'avvisatoInput');
  const avvisato = avvStr ? avvStr.split(',').map(d => d.trim()).filter(Boolean) : [];

  return {
    ditta: {
      ragioneSociale: val(prefix + '_ragioneSociale'),
      partitaIva:     val(prefix + '_partitaIva'),
      codiceUnivoco:  val(prefix + '_codiceUnivoco'),
      intestazione:   val(prefix + '_intestazione'),
      ubicazione:     val(prefix + '_ubicazione'),
      civico:         val(prefix + '_civico'),
      telefono:       val(prefix + '_telefono')
    },
    stalli: {
      numero:       parseInt(val(prefix + '_numeroStalli')) || 0,
      settore:      val(prefix + '_settore'),
      tariffazione: val('tariffazione_' + prefix)
    },
    periodo: {
      annuale:    checked(prefix + '_annuale'),
      stagionale: checked(prefix + '_stagionale'),
      dataInizio: val(prefix + '_dataInizio') || null,
      dataFine:   val(prefix + '_dataFine') || null,
      anno:       parseInt(val(prefix + '_annoPeriodo')) || anno
    },
    pagamento: { stato: radio(prefix + '_pagamento') },
    avvisato,
    note: val(prefix + '_note')
  };
}

window.apriAggiuntaOccupazione = function(anno) {
  el('addOccBody').innerHTML = formOccupazioneHTML({}, 'add', anno || ANNO_CORRENTE);
  // Inizializza tags avvisato
  avvRenderTags('addavvisato', []);
  new bootstrap.Modal(el('addOccModal')).show();
};

window.salvaOccupazione = async function(anno) {
  const occ = leggiOccupazioneDaForm('add', anno);
  if (!occ.ditta.ragioneSociale || !occ.ditta.partitaIva || !occ.ditta.ubicazione || !occ.ditta.civico) {
    showToast('Compilare tutti i campi obbligatori (*)', 'warning'); return;
  }
  await DB.addOccupazione(occ);
  bootstrap.Modal.getInstance(el('addOccModal')).hide();
  showToast('Occupazione aggiunta');
  renderOccupazione({ anno });
};

window.apriModificaOccupazione = async function(id) {
  const o = await DB.getOccupazione(id);
  if (!o) return;
  el('editOccBody').innerHTML = formOccupazioneHTML(o, 'edit', ANNO_CORRENTE);
  // Ripristina tags avvisato
  const avv = (o.avvisato || []);
  avvRenderTags('editavvisato', avv);
  el('editOccSaveBtn').onclick = () => aggiornaOccupazione(id, o.periodo.anno || ANNO_CORRENTE);
  new bootstrap.Modal(el('editOccModal')).show();
};

window.aggiornaOccupazione = async function(id, anno) {
  const occ = leggiOccupazioneDaForm('edit', anno);
  if (!occ.ditta.ragioneSociale || !occ.ditta.partitaIva) {
    showToast('Compilare tutti i campi obbligatori (*)', 'warning'); return;
  }
  await DB.updateOccupazione(id, occ);
  bootstrap.Modal.getInstance(el('editOccModal')).hide();
  showToast('Occupazione aggiornata');
  renderOccupazione({ anno: window._annoOccupazione });
};

window.confermaEliminaOccupazione = function(id) {
  el('delOccConfirmBtn').onclick = async () => {
    await DB.deleteOccupazione(id);
    bootstrap.Modal.getInstance(el('delOccModal')).hide();
    showToast('Occupazione eliminata');
    renderOccupazione({ anno: window._annoOccupazione });
  };
  new bootstrap.Modal(el('delOccModal')).show();
};

window.toggleArchivioSearch = function() {
  const s = el('archivioSearch');
  if (s) s.style.display = s.style.display === 'none' ? 'block' : 'none';
};

window.cercaDitte = async function() {
  const q = el('searchDittaInput').value;
  const res = el('searchDitteResults');
  if (q.length < 2) { res.innerHTML = ''; return; }
  const ditte = await DB.searchDitte(q);
  if (ditte.length === 0) { res.innerHTML = '<small class="text-muted">Nessuna ditta trovata</small>'; return; }
  res.innerHTML = ditte.map(d =>
    `<div class="p-2 border-bottom" style="cursor:pointer;" onclick="fillDittaForm('${d.id}')">
      <strong>${d.ragioneSociale}</strong> - ${d.partitaIva}
    </div>`
  ).join('');
};

window.fillDittaForm = function(id) {
  const d = (window._ditteCache || []).find(x => x.id === id);
  if (!d) return;
  ['ragioneSociale','partitaIva','codiceUnivoco','intestazione','ubicazione','civico','telefono'].forEach(k => {
    const e = el('add_' + k);
    if (e) e.value = d[k] || '';
  });
  el('searchDitteResults').innerHTML = '';
  el('archivioSearch').style.display = 'none';
};

// ─── RIEPILOGO ────────────────────────────────────────────────────────────────

async function renderRiepilogo({ anno, search, settore, periodo, pagamento, tariffazione } = {}) {
  anno = parseInt(anno || ANNO_CORRENTE);
  const anni = await getAnniConCorrente();
  let occupazioni = await DB.getOccupazioniByAnno(anno);

  if (search)       occupazioni = occupazioni.filter(o => (o.ditta.ragioneSociale || '').toLowerCase().includes(search.toLowerCase()));
  if (settore)      occupazioni = occupazioni.filter(o => o.stalli.settore === settore);
  if (periodo === 'annuale')    occupazioni = occupazioni.filter(o => o.periodo.annuale);
  if (periodo === 'stagionale') occupazioni = occupazioni.filter(o => o.periodo.stagionale);
  if (pagamento)    occupazioni = occupazioni.filter(o => o.pagamento.stato === pagamento);
  if (tariffazione) occupazioni = occupazioni.filter(o => o.stalli.tariffazione === tariffazione);

  const righe = occupazioni.length === 0
    ? `<tr><td colspan="9" class="text-center text-muted py-4">Nessun risultato</td></tr>`
    : occupazioni.map(o => `
      <tr>
        <td><strong>${o.ditta.ragioneSociale}</strong><br><small class="text-muted">P.IVA: ${o.ditta.partitaIva}</small></td>
        <td>${o.ditta.ubicazione || ''}, ${o.ditta.civico || ''}</td>
        <td>${o.stalli.numero}</td>
        <td><span class="badge bg-secondary">${o.stalli.settore}</span></td>
        <td>${o.stalli.tariffazione}</td>
        <td>${badgePeriodo(o)}</td>
        <td>${badgePagamento(o.pagamento.stato)}</td>
        <td>${(o.avvisato && o.avvisato.length > 0)
          ? `<span class="badge bg-info">${o.avvisato.length} avvisi</span>
             <button class="btn btn-sm btn-link p-0" onclick="toggleAvvisi('${o.id}')">Mostra</button>
             <div id="avvisi${o.id}" class="d-none mt-1 small text-muted">${o.avvisato.map(formatData).join(', ')}</div>`
          : '<span class="text-muted">-</span>'}</td>
        <td><small>${o.note || '-'}</small></td>
      </tr>`).join('');

  main().innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Riepilogo</h2>
      <div class="d-flex align-items-center gap-3">
        <select class="form-select form-select-sm" style="width:120px;" onchange="navigate('/riepilogo',{anno:this.value})">
          ${annoSelectHTML(anni, anno)}
        </select>
        <button class="btn btn-danger btn-sm" onclick="esportaPDF(${anno})">
          <i class="bi bi-file-pdf"></i> Esporta PDF
        </button>
      </div>
    </div>
    <div class="card mb-4">
      <div class="card-header"><h6 class="mb-0">Filtri Avanzati</h6></div>
      <div class="card-body">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label">Ragione Sociale</label>
            <input type="text" class="form-control" id="f_search" placeholder="Cerca..." value="${search || ''}">
          </div>
          <div class="col-md-2">
            <label class="form-label">Settore</label>
            <select class="form-select" id="f_settore">
              <option value="">Tutti</option>
              <option value="C" ${settore === 'C' ? 'selected' : ''}>C</option>
              <option value="F" ${settore === 'F' ? 'selected' : ''}>F</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Periodo</label>
            <select class="form-select" id="f_periodo">
              <option value="">Tutti</option>
              <option value="annuale" ${periodo === 'annuale' ? 'selected' : ''}>Annuale</option>
              <option value="stagionale" ${periodo === 'stagionale' ? 'selected' : ''}>Stagionale</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Pagamento</label>
            <select class="form-select" id="f_pagamento">
              <option value="">Tutti</option>
              <option value="pagato" ${pagamento === 'pagato' ? 'selected' : ''}>Pagato</option>
              <option value="parziale" ${pagamento === 'parziale' ? 'selected' : ''}>Parziale</option>
              <option value="non_pagato" ${pagamento === 'non_pagato' ? 'selected' : ''}>Non Pagato</option>
            </select>
          </div>
          <div class="col-md-2">
            <label class="form-label">Tariffazione</label>
            <select class="form-select" id="f_tariffazione">
              <option value="">Tutti</option>
              <option value="Rossa Stag" ${tariffazione === 'Rossa Stag' ? 'selected' : ''}>Rossa Stagionale</option>
              <option value="Gialla Stag" ${tariffazione === 'Gialla Stag' ? 'selected' : ''}>Gialla Stagionale</option>
              <option value="Gialla Ann" ${tariffazione === 'Gialla Ann' ? 'selected' : ''}>Gialla Annuale</option>
              <option value="Grigia" ${tariffazione === 'Grigia' ? 'selected' : ''}>Grigia</option>
              <option value="Rossa Ann" ${tariffazione === 'Rossa Ann' ? 'selected' : ''}>Rossa Annuale</option>
            </select>
          </div>
          <div class="col-md-1 d-flex align-items-end">
            <button class="btn btn-primary w-100" onclick="applicaFiltriRiepilogo(${anno})">Filtra</button>
          </div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr><th>Ditta</th><th>Ubicazione</th><th>Stalli</th><th>Settore</th><th>Tariffazione</th><th>Periodo</th><th>Pagamento</th><th>Avvisi</th><th>Note</th></tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
        </div>
      </div>
    </div>`;

  window._annoRiepilogo = anno;
}

window.applicaFiltriRiepilogo = function(anno) {
  renderRiepilogo({
    anno,
    search:       el('f_search')?.value,
    settore:      el('f_settore')?.value,
    periodo:      el('f_periodo')?.value,
    pagamento:    el('f_pagamento')?.value,
    tariffazione: el('f_tariffazione')?.value
  });
};

window.toggleAvvisi = function(id) {
  const e = el('avvisi' + id);
  if (e) e.classList.toggle('d-none');
};

window.esportaPDF = async function(anno) {
  if (!window.generaPDFRiepilogo) { showToast('Libreria PDF non caricata', 'danger'); return; }
  const occupazioni = await DB.getOccupazioniByAnno(anno);
  await window.generaPDFRiepilogo(anno, occupazioni);
};

// ─── ANAGRAFICA ───────────────────────────────────────────────────────────────

async function renderAnagrafica() {
  const ditte = await DB.getDitte();

  const righe = ditte.length === 0
    ? `<tr><td colspan="7" class="text-center text-muted py-4">Nessuna ditta in archivio</td></tr>`
    : ditte.map(d => `
      <tr>
        <td><strong>${d.ragioneSociale}</strong></td>
        <td>${d.partitaIva}</td>
        <td>${d.codiceUnivoco || '-'}</td>
        <td>${d.intestazione || '-'}</td>
        <td>${d.ubicazione || ''}, ${d.civico || ''}</td>
        <td>${d.telefono || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary me-1" onclick="apriModificaDitta('${d.id}')">Modifica</button>
          <button class="btn btn-sm btn-outline-danger" onclick="confermaEliminaDitta('${d.id}')">Elimina</button>
        </td>
      </tr>`).join('');

  main().innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-4">
      <h2 class="mb-0">Anagrafica Ditte</h2>
      <button class="btn btn-primary btn-sm" onclick="apriAggiuntaDitta()">
        <i class="bi bi-plus-circle"></i> Aggiungi Ditta
      </button>
    </div>
    <div class="card">
      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-hover mb-0">
            <thead class="table-light">
              <tr><th>Ragione Sociale</th><th>P.IVA</th><th>Cod. Univoco</th><th>Intestazione</th><th>Ubicazione</th><th>Telefono</th><th>Azioni</th></tr>
            </thead>
            <tbody>${righe}</tbody>
          </table>
        </div>
      </div>
    </div>
    <!-- Modale Aggiungi -->
    <div class="modal fade" id="addDittaModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Nuova Ditta</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body">${formDittaHTML('addD')}</div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-primary" onclick="salvaDitta()">Salva</button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modale Modifica -->
    <div class="modal fade" id="editDittaModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Modifica Ditta</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body" id="editDittaBody"></div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-primary" id="editDittaSaveBtn">Salva</button>
          </div>
        </div>
      </div>
    </div>
    <!-- Modale Elimina -->
    <div class="modal fade" id="delDittaModal" tabindex="-1">
      <div class="modal-dialog modal-sm modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header py-2"><h6 class="modal-title">Conferma eliminazione</h6>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body py-2"><p class="mb-0">Eliminare questa ditta dall'archivio?</p></div>
          <div class="modal-footer py-2">
            <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annulla</button>
            <button type="button" class="btn btn-danger btn-sm" id="delDittaConfirmBtn">Elimina</button>
          </div>
        </div>
      </div>
    </div>`;
}

function formDittaHTML(prefix, d = {}) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><label class="form-label">Ragione Sociale *</label>
        <input type="text" class="form-control" id="${prefix}_ragioneSociale" value="${d.ragioneSociale || ''}" required></div>
      <div class="col-md-3"><label class="form-label">P.IVA *</label>
        <input type="text" class="form-control" id="${prefix}_partitaIva" value="${d.partitaIva || ''}" required></div>
      <div class="col-md-3"><label class="form-label">Codice Univoco</label>
        <input type="text" class="form-control" id="${prefix}_codiceUnivoco" value="${d.codiceUnivoco || ''}"></div>
      <div class="col-md-6"><label class="form-label">Intestazione</label>
        <input type="text" class="form-control" id="${prefix}_intestazione" value="${d.intestazione || ''}"></div>
      <div class="col-md-4"><label class="form-label">Ubicazione *</label>
        <input type="text" class="form-control" id="${prefix}_ubicazione" value="${d.ubicazione || ''}" required></div>
      <div class="col-md-2"><label class="form-label">Civico *</label>
        <input type="text" class="form-control" id="${prefix}_civico" value="${d.civico || ''}" required></div>
      <div class="col-md-4"><label class="form-label">Telefono</label>
        <input type="text" class="form-control" id="${prefix}_telefono" value="${d.telefono || ''}"></div>
    </div>`;
}

function leggiDittaDaForm(prefix) {
  function val(id) { const e = el(id); return e ? e.value.trim() : ''; }
  return {
    ragioneSociale: val(prefix + '_ragioneSociale'),
    partitaIva:     val(prefix + '_partitaIva'),
    codiceUnivoco:  val(prefix + '_codiceUnivoco'),
    intestazione:   val(prefix + '_intestazione'),
    ubicazione:     val(prefix + '_ubicazione'),
    civico:         val(prefix + '_civico'),
    telefono:       val(prefix + '_telefono')
  };
}

window.apriAggiuntaDitta = function() {
  new bootstrap.Modal(el('addDittaModal')).show();
};

window.salvaDitta = async function() {
  const d = leggiDittaDaForm('addD');
  if (!d.ragioneSociale || !d.partitaIva || !d.ubicazione || !d.civico) {
    showToast('Compilare tutti i campi obbligatori (*)', 'warning'); return;
  }
  await DB.addDitta(d);
  bootstrap.Modal.getInstance(el('addDittaModal')).hide();
  showToast('Ditta aggiunta');
  renderAnagrafica();
};

window.apriModificaDitta = async function(id) {
  const d = await DB.getDitta(id);
  if (!d) return;
  el('editDittaBody').innerHTML = formDittaHTML('editD', d);
  el('editDittaSaveBtn').onclick = () => aggiornaDitta(id);
  new bootstrap.Modal(el('editDittaModal')).show();
};

window.aggiornaDitta = async function(id) {
  const d = leggiDittaDaForm('editD');
  if (!d.ragioneSociale || !d.partitaIva) {
    showToast('Compilare tutti i campi obbligatori (*)', 'warning'); return;
  }
  await DB.updateDitta(id, d);
  bootstrap.Modal.getInstance(el('editDittaModal')).hide();
  showToast('Ditta aggiornata');
  renderAnagrafica();
};

window.confermaEliminaDitta = function(id) {
  el('delDittaConfirmBtn').onclick = async () => {
    await DB.deleteDitta(id);
    bootstrap.Modal.getInstance(el('delDittaModal')).hide();
    showToast('Ditta eliminata');
    renderAnagrafica();
  };
  new bootstrap.Modal(el('delDittaModal')).show();
};

// ─── BACKUP / RIPRISTINO ──────────────────────────────────────────────────────

window.esportaDati = async function() {
  const data = await DB.exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `backup_suolo_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  showToast('Backup esportato');
};

window.importaDati = async function(file) {
  try {
    const text = await file.text();
    await DB.importData(text);
    showToast('Dati importati con successo!');
    renderDashboard();
  } catch(e) {
    showToast('Errore importazione: ' + e.message, 'danger');
  }
};

// ─── SIDEBAR MOBILE ───────────────────────────────────────────────────────────

function setupSidebar() {
  const btn = el('sidebarToggle');
  const sidebar = el('sidebar');
  const overlay = el('sidebar-overlay');
  if (!btn || !sidebar) return;
  btn.addEventListener('click', () => {
    sidebar.classList.toggle('show');
    if (overlay) overlay.classList.toggle('show');
  });
  if (overlay) overlay.addEventListener('click', () => {
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
  });
  // Chiudi sidebar al clic di un link
  sidebar.querySelectorAll('.nav-link').forEach(a => {
    a.addEventListener('click', () => {
      sidebar.classList.remove('show');
      if (overlay) overlay.classList.remove('show');
    });
  });
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  // Sidebar mobile
  setupSidebar();

  // Import file handler
  const importInput = el('importFileInput');
  if (importInput) {
    importInput.addEventListener('change', e => {
      const f = e.target.files[0];
      if (f) importaDati(f);
    });
  }

  // Routing iniziale
  const path = window.location.pathname.replace(/\/index\.html$/, '') || '/';
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  history.replaceState({ path, params }, '', window.location.href);
  renderView(path, params);
});

window.navigate = navigate;
