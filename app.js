// app.js — SPA routing e logica viste per Gestione Suolo Pubblico PWA

const ANNO_CORRENTE = new Date().getFullYear();
const APP_VERSION = '2.0';

// ─── ROUTER ──────────────────────────────────────────────────────────────────

const ROUTES = {
  '/': renderDashboard,
  '/occupazione': renderOccupazione,
  '/riepilogo': renderRiepilogo,
  '/anagrafica': renderAnagrafica
};

function navigate(path, params = {}) {
  const qs = new URLSearchParams({ _route: path, ...params }).toString();
  history.pushState({ path, params }, '', '?' + qs);
  renderView(path, params);
}

function renderView(path, params) {
  params = params || {};
  document.querySelectorAll('#sidebar .nav-link').forEach(function(a) {
    a.classList.toggle('active', a.dataset.route === path);
  });
  var fn = ROUTES[path] || renderDashboard;
  fn(params);
}

window.addEventListener('popstate', function(e) {
  var state = e.state || {};
  renderView(state.path || '/', state.params || {});
});

// ─── UTILS ────────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function main() { return el('main-content'); }

function showToast(message, type) {
  type = type || 'success';
  var container = el('toast-container');
  if (!container) return;
  var colorClass = type === 'danger' ? 'bg-danger'
    : type === 'warning' ? 'bg-warning text-dark'
    : 'bg-success';
  var d = document.createElement('div');
  d.className = 'toast align-items-center text-white ' + colorClass + ' border-0 mb-2 show';
  d.innerHTML = '<div class="d-flex"><div class="toast-body">' + message + '</div></div>';
  container.appendChild(d);
  setTimeout(function() { d.remove(); }, 3500);
}

function formatData(d) {
  if (!d) return '';
  var p = d.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : d;
}

function badgePagamento(stato) {
  if (stato === 'pagato')
    return '<span class="status-badge"><span class="status-dot status-pagato"></span>Pagato</span>';
  if (stato === 'parziale')
    return '<span class="status-badge"><span class="status-dot status-parziale"></span>Parziale</span>';
  return '<span class="status-badge"><span class="status-dot status-non_pagato"></span>Non Pagato</span>';
}

function badgePeriodo(o) {
  var s = '';
  if (o.periodo.annuale)    s += '<span class="badge bg-success">Annuale</span> ';
  if (o.periodo.stagionale) s += '<span class="badge bg-warning text-dark">Stagionale</span>';
  if (o.periodo.dataInizio && o.periodo.dataFine)
    s += '<br><small>' + formatData(o.periodo.dataInizio) + ' - ' + formatData(o.periodo.dataFine) + '</small>';
  return s;
}

function annoSelectHTML(anni, selezionato) {
  return anni.map(function(a) {
    return '<option value="' + a + '"' + (a === selezionato ? ' selected' : '') + '>' + a + '</option>';
  }).join('');
}

async function getAnniConCorrente() {
  var anni = await DB.getAnniPresenti();
  if (!anni.includes(ANNO_CORRENTE)) anni.unshift(ANNO_CORRENTE);
  var set = [ANNO_CORRENTE].concat(anni);
  return [...new Set(set)].sort(function(a,b){ return b-a; });
}

var TARIFFAZIONI = {
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

function tariffazioneOptions(settore, selected) {
  selected = selected || '';
  var list = TARIFFAZIONI[settore] || TARIFFAZIONI.C;
  return list.map(function(t) {
    return '<option value="' + t.value + '"' + (t.value === selected ? ' selected' : '') + '>' + t.label + '</option>';
  }).join('');
}

// ─── AVVISATO TAG WIDGET ──────────────────────────────────────────────────────

function avvRenderTags(prefix, dates) {
  var tagsEl  = el(prefix + 'Tags');
  var inputEl = el(prefix + 'Input');
  if (!tagsEl || !inputEl) return;
  tagsEl.innerHTML = dates.map(function(d) {
    return '<span class="badge bg-info text-dark me-1 mb-1" style="font-size:.9rem;padding:6px 10px;">'
      + formatData(d)
      + '<span style="cursor:pointer;font-weight:bold;margin-left:4px;" onclick="avvRimuovi(\'' + prefix + '\',\'' + d + '\')">x</span>'
      + '</span>';
  }).join('');
  inputEl.value = dates.join(', ');
}

window.avvAggiungi = function(prefix) {
  var dateEl  = el(prefix + 'Date');
  var inputEl = el(prefix + 'Input');
  if (!dateEl || !dateEl.value) return;
  var dates = inputEl.value.trim()
    ? inputEl.value.split(',').map(function(d){ return d.trim(); }).filter(Boolean) : [];
  if (!dates.includes(dateEl.value)) {
    dates.push(dateEl.value);
    avvRenderTags(prefix, dates);
  }
  dateEl.value = '';
};

window.avvRimuovi = function(prefix, date) {
  var inputEl = el(prefix + 'Input');
  if (!inputEl) return;
  var dates = inputEl.value.split(',').map(function(d){ return d.trim(); }).filter(function(d){ return d && d !== date; });
  avvRenderTags(prefix, dates);
};

window.updateTariffazione = function(select, prefix) {
  var tarEl = el('tariffazione_' + prefix);
  if (!tarEl) return;
  tarEl.innerHTML = tariffazioneOptions(select.value);
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

async function renderDashboard(params) {
  params = params || {};
  var anni = await getAnniConCorrente();
  var anno = parseInt(params.anno || ANNO_CORRENTE);

  var occupazioni = await DB.getOccupazioniByAnno(anno);
  var totaleStalli     = occupazioni.reduce(function(s,o){ return s + (o.stalli.numero || 0); }, 0);
  var stalliAnnuali    = occupazioni.filter(function(o){ return o.periodo.annuale; }).reduce(function(s,o){ return s + (o.stalli.numero || 0); }, 0);
  var stalliStagionali = occupazioni.filter(function(o){ return o.periodo.stagionale; }).reduce(function(s,o){ return s + (o.stalli.numero || 0); }, 0);
  var pagati    = occupazioni.filter(function(o){ return o.pagamento.stato === 'pagato'; }).length;
  var parziali  = occupazioni.filter(function(o){ return o.pagamento.stato === 'parziale'; }).length;
  var nonPagati = occupazioni.filter(function(o){ return o.pagamento.stato === 'non_pagato'; }).length;

  main().innerHTML = ''
    + '<div class="d-flex justify-content-between align-items-center mb-4">'
    + '  <h2 class="mb-0">Dashboard <small class="text-muted fs-6">v' + APP_VERSION + '</small></h2>'
    + '  <div class="d-flex align-items-center gap-3">'
    + '    <label class="mb-0 fw-semibold">Anno:</label>'
    + '    <select class="form-select form-select-sm" style="width:120px;" onchange="navigate(\'/\',{anno:this.value})">'
    +      annoSelectHTML(anni, anno)
    + '    </select>'
    + '  </div>'
    + '</div>'
    + '<div class="row g-4 mb-4">'
    + '  <div class="col-md-4"><div class="card kpi-card bg-primary text-white"><div class="card-body">'
    + '    <h6 class="card-subtitle mb-2 opacity-75">Totale Stalli</h6><h2 class="card-title mb-0">' + totaleStalli + '</h2>'
    + '  </div></div></div>'
    + '  <div class="col-md-4"><div class="card kpi-card bg-success text-white"><div class="card-body">'
    + '    <h6 class="card-subtitle mb-2 opacity-75">Stalli Annuali</h6><h2 class="card-title mb-0">' + stalliAnnuali + '</h2>'
    + '  </div></div></div>'
    + '  <div class="col-md-4"><div class="card kpi-card bg-warning text-dark"><div class="card-body">'
    + '    <h6 class="card-subtitle mb-2 opacity-75">Stalli Stagionali/Temporanei</h6><h2 class="card-title mb-0">' + stalliStagionali + '</h2>'
    + '  </div></div></div>'
    + '</div>'
    + '<h4 class="mb-3">Stato Pagamenti</h4>'
    + '<div class="row g-4">'
    + '  <div class="col-md-4"><div class="card kpi-card border-success"><div class="card-body text-center">'
    + '    <span class="status-badge"><span class="status-dot status-pagato"></span><strong>Pagati</strong></span>'
    + '    <h3 class="text-success mb-0 mt-2">' + pagati + '</h3></div></div></div>'
    + '  <div class="col-md-4"><div class="card kpi-card border-warning"><div class="card-body text-center">'
    + '    <span class="status-badge"><span class="status-dot status-parziale"></span><strong>Parziali</strong></span>'
    + '    <h3 class="text-warning mb-0 mt-2">' + parziali + '</h3></div></div></div>'
    + '  <div class="col-md-4"><div class="card kpi-card border-danger"><div class="card-body text-center">'
    + '    <span class="status-badge"><span class="status-dot status-non_pagato"></span><strong>Non Pagati</strong></span>'
    + '    <h3 class="text-danger mb-0 mt-2">' + nonPagati + '</h3></div></div></div>'
    + '</div>';
}

// ─── OCCUPAZIONE ─────────────────────────────────────────────────────────────

async function renderOccupazione(params) {
  params = params || {};
  var anno   = parseInt(params.anno || ANNO_CORRENTE);
  var search = params.search || '';

  var results = await Promise.all([
    DB.getOccupazioniByAnno(anno),
    DB.getDitte(),
    getAnniConCorrente()
  ]);
  var occupazioni = results[0];
  var ditte = results[1];
  var anni  = results[2];

  if (search) {
    var q = search.toLowerCase();
    occupazioni = occupazioni.filter(function(o) {
      return (o.ditta.ragioneSociale || '').toLowerCase().indexOf(q) >= 0
          || (o.ditta.intestazione   || '').toLowerCase().indexOf(q) >= 0
          || (o.ditta.nomeAttivita   || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  var searchBtn = search
    ? '<button class="btn btn-outline-secondary" onclick="renderOccupazione({anno:' + anno + '})"><i class="bi bi-x"></i></button>'
    : '';
  var countNote = search
    ? ' &mdash; <small class="text-muted">' + occupazioni.length + ' risultati</small>'
    : '';

  var righe = occupazioni.length === 0
    ? '<tr><td colspan="8" class="text-center text-muted py-4">Nessuna occupazione per l\'anno ' + anno + '</td></tr>'
    : occupazioni.map(function(o) {
        return '<tr>'
          + '<td>'
          + (function(d){
              var int_ = d.intestazione || '';
              var rs   = d.ragioneSociale || '';
              var piva = d.partitaIva || '';
              return '<strong>' + (int_ || rs || '-') + '</strong>'
                + (int_ && rs ? '<br>' + rs : '')
                + '<br><small class="text-muted">P.IVA: ' + piva + '</small>';
            })(o.ditta || {})
          + '</td>'
          + '<td>' + ((o.ditta || {}).ubicazione || '') + ', ' + ((o.ditta || {}).civico || '') + '</td>'
          + '<td>' + o.stalli.numero + '</td>'
          + '<td><span class="badge bg-secondary">' + o.stalli.settore + '</span></td>'
          + '<td>' + o.stalli.tariffazione + '</td>'
          + '<td>' + badgePeriodo(o) + '</td>'
          + '<td>' + badgePagamento(o.pagamento.stato) + '</td>'
          + '<td>'
          + '<button class="btn btn-sm btn-outline-primary me-1" onclick="apriModificaOccupazione(\'' + o.id + '\')">Modifica</button>'
          + '<button class="btn btn-sm btn-outline-danger" onclick="confermaEliminaOccupazione(\'' + o.id + '\')">Elimina</button>'
          + '</td></tr>';
      }).join('');

  main().innerHTML = ''
    + '<div class="d-flex justify-content-between align-items-center mb-4">'
    + '  <h2 class="mb-0">Occupazione Suolo Pubblico</h2>'
    + '  <div class="d-flex align-items-center gap-3">'
    + '    <label class="mb-0 fw-semibold">Anno:</label>'
    + '    <select class="form-select form-select-sm" style="width:120px;" onchange="navigate(\'/occupazione\',{anno:this.value})">'
    +      annoSelectHTML(anni, anno)
    + '    </select>'
    + '  </div>'
    + '</div>'
    + '<div class="mb-3">'
    + '  <div class="input-group">'
    + '    <span class="input-group-text"><i class="bi bi-search"></i></span>'
    + '    <input type="text" class="form-control" id="occ_search"'
    + '           placeholder="Cerca per intestazione, ragione sociale, nome attivita..."'
    + '           value="' + (search || '') + '"'
    + '           oninput="renderOccupazione({anno:' + anno + ', search:this.value})">'
    +    searchBtn
    + '  </div>'
    + '</div>'
    + '<div class="card">'
    + '  <div class="card-header d-flex justify-content-between align-items-center">'
    + '    <span>Elenco Occupazioni' + countNote + '</span>'
    + '    <button class="btn btn-primary btn-sm" onclick="apriAggiuntaOccupazione(' + anno + ')">'
    + '      <i class="bi bi-plus-circle"></i> Aggiungi suolo pubblico'
    + '    </button>'
    + '  </div>'
    + '  <div class="card-body p-0">'
    + '    <div class="table-responsive">'
    + '      <table class="table table-hover mb-0">'
    + '        <thead class="table-light"><tr>'
    + '          <th>Ditta</th><th>Ubicazione</th><th>Stalli</th><th>Settore</th><th>Tariffazione</th><th>Periodo</th><th>Stato</th><th>Azioni</th>'
    + '        </tr></thead>'
    + '        <tbody>' + righe + '</tbody>'
    + '      </table>'
    + '    </div>'
    + '  </div>'
    + '</div>'
    + '<div class="modal fade" id="addOccModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">'
    + '  <div class="modal-header"><h5 class="modal-title">Nuova Occupazione</h5>'
    + '  <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '  <div class="modal-body" id="addOccBody"></div>'
    + '  <div class="modal-footer">'
    + '    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>'
    + '    <button type="button" class="btn btn-primary" onclick="salvaOccupazione(' + anno + ')">Salva</button>'
    + '  </div></div></div></div>'
    + '<div class="modal fade" id="editOccModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">'
    + '  <div class="modal-header"><h5 class="modal-title">Modifica Occupazione</h5>'
    + '  <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '  <div class="modal-body" id="editOccBody"></div>'
    + '  <div class="modal-footer">'
    + '    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>'
    + '    <button type="button" class="btn btn-primary" id="editOccSaveBtn">Salva</button>'
    + '  </div></div></div></div>'
    + '<div class="modal fade" id="delOccModal" tabindex="-1"><div class="modal-dialog modal-sm modal-dialog-centered"><div class="modal-content">'
    + '  <div class="modal-header py-2"><h6 class="modal-title">Conferma eliminazione</h6>'
    + '  <button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '  <div class="modal-body py-2"><p class="mb-0">Eliminare questa occupazione?</p></div>'
    + '  <div class="modal-footer py-2">'
    + '    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annulla</button>'
    + '    <button type="button" class="btn btn-danger btn-sm" id="delOccConfirmBtn">Elimina</button>'
    + '  </div></div></div></div>';

  window._ditteCache = ditte;
  window._annoOccupazione = anno;
}

// ─── FORM OCCUPAZIONE ─────────────────────────────────────────────────────────

function formOccupazioneHTML(o, prefix, annoDefault) {
  o = o || {};
  prefix = prefix || 'add';
  annoDefault = annoDefault || ANNO_CORRENTE;
  var d  = o.ditta    || {};
  var st = o.stalli   || { settore: 'C' };
  var pe = o.periodo  || { anno: annoDefault };
  var pg = o.pagamento || { stato: 'pagato' };
  var avvisatoStr = (o.avvisato || []).join(', ');

  var archivioBtn = (prefix === 'add')
    ? '<button type="button" class="btn btn-outline-secondary btn-sm" onclick="toggleArchivioSearch()"><i class="bi bi-search"></i> Importa da Archivio</button>'
    : '';
  var archivioDiv = (prefix === 'add')
    ? '<div id="archivioSearch" class="mb-3 p-3 bg-light rounded" style="display:none;">'
      + '<input type="text" class="form-control" id="searchDittaInput" placeholder="Cerca ragione sociale, intestazione o P.IVA..." oninput="cercaDitte()">'
      + '<div id="searchDitteResults" class="mt-2"></div>'
      + '</div>'
    : '';

  return ''
    + '<div class="d-flex justify-content-between align-items-center mb-3">'
    + '  <h6 class="fw-bold text-primary mb-0">Ditta</h6>' + archivioBtn
    + '</div>'
    + archivioDiv
    + '<div class="row g-3 mb-3">'
    + '<div class="col-md-6"><label class="form-label">Ragione Sociale</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_ragioneSociale" value="' + (d.ragioneSociale || '') + '"></div>'
    + '<div class="col-md-3"><label class="form-label">P.IVA</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_partitaIva" value="' + (d.partitaIva || '') + '"></div>'
    + '<div class="col-md-3"><label class="form-label">Codice Univoco</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_codiceUnivoco" value="' + (d.codiceUnivoco || '') + '"></div>'
    + '<div class="col-md-6"><label class="form-label">Nome Attivita</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_nomeAttivita" value="' + (d.nomeAttivita || '') + '" placeholder="Nome commerciale"></div>'
    + '<div class="col-md-4"><label class="form-label">Intestazione</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_intestazione" value="' + (d.intestazione || '') + '"></div>'
    + '<div class="col-md-4"><label class="form-label">Ubicazione</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_ubicazione" value="' + (d.ubicazione || '') + '"></div>'
    + '<div class="col-md-2"><label class="form-label">Civico</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_civico" value="' + (d.civico || '') + '"></div>'
    + '<div class="col-md-2"><label class="form-label">Telefono</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_telefono" value="' + (d.telefono || '') + '"></div>'
    + '</div>'
    + '<h6 class="fw-bold text-primary mb-3">Stalli</h6>'
    + '<div class="row g-3 mb-3">'
    + '<div class="col-md-3"><label class="form-label">Numero Stalli</label>'
    + '<input type="number" class="form-control" id="' + prefix + '_numeroStalli" value="' + (st.numero || '') + '"></div>'
    + '<div class="col-md-3"><label class="form-label">Settore</label>'
    + '<select class="form-select" id="' + prefix + '_settore" onchange="updateTariffazione(this,\'' + prefix + '\')">'
    + '<option value="C"' + (st.settore === 'C' ? ' selected' : '') + '>C</option>'
    + '<option value="F"' + (st.settore === 'F' ? ' selected' : '') + '>F</option>'
    + '</select></div>'
    + '<div class="col-md-4"><label class="form-label">Tariffazione</label>'
    + '<select class="form-select" id="tariffazione_' + prefix + '">'
    + tariffazioneOptions(st.settore || 'C', st.tariffazione)
    + '</select></div>'
    + '</div>'
    + '<h6 class="fw-bold text-primary mb-3">Periodo</h6>'
    + '<div class="row g-3 mb-3">'
    + '<div class="col-md-12">'
    + '<div class="form-check form-check-inline">'
    + '<input class="form-check-input" type="checkbox" id="' + prefix + '_annuale"' + (pe.annuale ? ' checked' : '') + '>'
    + '<label class="form-check-label">Annuale</label></div>'
    + '<div class="form-check form-check-inline">'
    + '<input class="form-check-input" type="checkbox" id="' + prefix + '_stagionale"' + (pe.stagionale ? ' checked' : '') + '>'
    + '<label class="form-check-label">Stagionale/Temporanea</label></div>'
    + '</div>'
    + '<div class="col-md-3"><label class="form-label">Data Inizio</label>'
    + '<input type="date" class="form-control" id="' + prefix + '_dataInizio" value="' + (pe.dataInizio || '') + '"></div>'
    + '<div class="col-md-3"><label class="form-label">Data Fine</label>'
    + '<input type="date" class="form-control" id="' + prefix + '_dataFine" value="' + (pe.dataFine || '') + '"></div>'
    + '<div class="col-md-3"><label class="form-label">Anno</label>'
    + '<input type="number" class="form-control" id="' + prefix + '_annoPeriodo" value="' + (pe.anno || annoDefault) + '"></div>'
    + '</div>'
    + '<h6 class="fw-bold text-primary mb-3">Pagamento</h6>'
    + '<div class="row g-3 mb-3"><div class="col-md-12">'
    + '<div class="form-check form-check-inline">'
    + '<input class="form-check-input" type="radio" name="' + prefix + '_pagamento" value="pagato" id="' + prefix + '_pag_pagato"' + (pg.stato === 'pagato' ? ' checked' : '') + '>'
    + '<label class="form-check-label" for="' + prefix + '_pag_pagato"><span class="status-dot status-pagato"></span> Pagato</label></div>'
    + '<div class="form-check form-check-inline">'
    + '<input class="form-check-input" type="radio" name="' + prefix + '_pagamento" value="parziale" id="' + prefix + '_pag_parziale"' + (pg.stato === 'parziale' ? ' checked' : '') + '>'
    + '<label class="form-check-label" for="' + prefix + '_pag_parziale"><span class="status-dot status-parziale"></span> Parziale</label></div>'
    + '<div class="form-check form-check-inline">'
    + '<input class="form-check-input" type="radio" name="' + prefix + '_pagamento" value="non_pagato" id="' + prefix + '_pag_non"' + ((!pg.stato || pg.stato === 'non_pagato') ? ' checked' : '') + '>'
    + '<label class="form-check-label" for="' + prefix + '_pag_non"><span class="status-dot status-non_pagato"></span> Non Pagato</label></div>'
    + '</div></div>'
    + '<h6 class="fw-bold text-primary mb-3">Avvisato</h6>'
    + '<div class="row g-3 mb-3"><div class="col-md-12">'
    + '<label class="form-label d-block mb-2">Date Avvisi</label>'
    + '<input type="date" class="form-control mb-2" id="' + prefix + 'avvisatoDate" style="max-width:260px;" onchange="avvAggiungi(\'' + prefix + 'avvisato\')">'
    + '<div id="' + prefix + 'avvisatoTags" class="d-flex flex-wrap gap-1 mb-1"></div>'
    + '<input type="hidden" id="' + prefix + 'avvisatoInput" value="' + avvisatoStr + '">'
    + '</div></div>'
    + '<div class="row g-3"><div class="col-md-12"><label class="form-label">Note</label>'
    + '<textarea class="form-control" id="' + prefix + '_note" rows="2">' + (o.note || '') + '</textarea>'
    + '</div></div>';
}

function leggiOccupazioneDaForm(prefix, anno) {
  function val(id) { var e = el(id); return e ? e.value.trim() : ''; }
  function chk(id) { var e = el(id); return e ? e.checked : false; }
  function radio(name) {
    var r = document.querySelector('input[name="' + name + '"]:checked');
    return r ? r.value : 'non_pagato';
  }
  var avvStr = val(prefix + 'avvisatoInput');
  var avvisato = avvStr ? avvStr.split(',').map(function(d){ return d.trim(); }).filter(Boolean) : [];
  return {
    ditta: {
      ragioneSociale: val(prefix + '_ragioneSociale'),
      partitaIva:     val(prefix + '_partitaIva'),
      codiceUnivoco:  val(prefix + '_codiceUnivoco'),
      nomeAttivita:   val(prefix + '_nomeAttivita'),
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
      annuale:    chk(prefix + '_annuale'),
      stagionale: chk(prefix + '_stagionale'),
      dataInizio: val(prefix + '_dataInizio') || null,
      dataFine:   val(prefix + '_dataFine') || null,
      anno:       parseInt(val(prefix + '_annoPeriodo')) || anno
    },
    pagamento: { stato: radio(prefix + '_pagamento') },
    avvisato: avvisato,
    note: val(prefix + '_note')
  };
}

window.apriAggiuntaOccupazione = function(anno) {
  el('addOccBody').innerHTML = formOccupazioneHTML({}, 'add', anno || ANNO_CORRENTE);
  avvRenderTags('addavvisato', []);
  new bootstrap.Modal(el('addOccModal')).show();
};

window.salvaOccupazione = async function(anno) {
  var occ = leggiOccupazioneDaForm('add', anno);
  await DB.addOccupazione(occ);
  bootstrap.Modal.getInstance(el('addOccModal')).hide();
  showToast('Occupazione aggiunta');
  renderOccupazione({ anno: anno });
};

window.apriModificaOccupazione = async function(id) {
  var o = await DB.getOccupazione(id);
  if (!o) return;
  el('editOccBody').innerHTML = formOccupazioneHTML(o, 'edit', ANNO_CORRENTE);
  avvRenderTags('editavvisato', o.avvisato || []);
  el('editOccSaveBtn').onclick = function() { aggiornaOccupazione(id, o.periodo.anno || ANNO_CORRENTE); };
  new bootstrap.Modal(el('editOccModal')).show();
};

window.aggiornaOccupazione = async function(id, anno) {
  var occ = leggiOccupazioneDaForm('edit', anno);
  await DB.updateOccupazione(id, occ);
  bootstrap.Modal.getInstance(el('editOccModal')).hide();
  showToast('Occupazione aggiornata');
  renderOccupazione({ anno: window._annoOccupazione });
};

window.confermaEliminaOccupazione = function(id) {
  el('delOccConfirmBtn').onclick = async function() {
    await DB.deleteOccupazione(id);
    bootstrap.Modal.getInstance(el('delOccModal')).hide();
    showToast('Occupazione eliminata');
    renderOccupazione({ anno: window._annoOccupazione });
  };
  new bootstrap.Modal(el('delOccModal')).show();
};

window.toggleArchivioSearch = function() {
  var s = el('archivioSearch');
  if (s) s.style.display = s.style.display === 'none' ? 'block' : 'none';
};

window.cercaDitte = async function() {
  var q = el('searchDittaInput').value;
  var res = el('searchDitteResults');
  if (q.length < 2) { res.innerHTML = ''; return; }
  var ditte = await DB.searchDitte(q);
  ditte = ditte.filter(function(d) { return (d.stato || 'in_attivita') !== 'cessata'; });
  if (ditte.length === 0) { res.innerHTML = '<small class="text-muted">Nessuna ditta trovata</small>'; return; }
  res.innerHTML = ditte.map(function(d) {
    return '<div class="p-2 border-bottom" style="cursor:pointer;" onclick="fillDittaForm(\'' + d.id + '\')">'
      + '<strong>' + d.ragioneSociale + '</strong>'
      + (d.intestazione ? ' &mdash; ' + d.intestazione : '')
      + ' <small class="text-muted">' + d.partitaIva + '</small>'
      + '</div>';
  }).join('');
};

window.fillDittaForm = function(id) {
  var ditte = window._ditteCache || [];
  var d = null;
  for (var i = 0; i < ditte.length; i++) { if (ditte[i].id === id) { d = ditte[i]; break; } }
  if (!d) return;
  ['ragioneSociale','partitaIva','codiceUnivoco','nomeAttivita','intestazione','ubicazione','civico','telefono'].forEach(function(k) {
    var e = el('add_' + k);
    if (e) e.value = d[k] || '';
  });
  var res = el('searchDitteResults');
  if (res) res.innerHTML = '';
  var arc = el('archivioSearch');
  if (arc) arc.style.display = 'none';
};

// ─── RIEPILOGO ────────────────────────────────────────────────────────────────

async function renderRiepilogo(params) {
  params = params || {};
  var anno        = parseInt(params.anno || ANNO_CORRENTE);
  var search      = params.search      || '';
  var settore     = params.settore     || '';
  var periodo     = params.periodo     || '';
  var pagamento   = params.pagamento   || '';
  var tariffazione= params.tariffazione|| '';

  var anni = await getAnniConCorrente();
  var occupazioni = await DB.getOccupazioniByAnno(anno);

  if (search) {
    var q = search.toLowerCase();
    occupazioni = occupazioni.filter(function(o) {
      return (o.ditta.ragioneSociale || '').toLowerCase().indexOf(q) >= 0
          || (o.ditta.intestazione   || '').toLowerCase().indexOf(q) >= 0
          || (o.ditta.nomeAttivita   || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  if (settore)      occupazioni = occupazioni.filter(function(o){ return o.stalli.settore === settore; });
  if (periodo === 'annuale')    occupazioni = occupazioni.filter(function(o){ return o.periodo.annuale; });
  if (periodo === 'stagionale') occupazioni = occupazioni.filter(function(o){ return o.periodo.stagionale; });
  if (pagamento)    occupazioni = occupazioni.filter(function(o){ return o.pagamento.stato === pagamento; });
  if (tariffazione) occupazioni = occupazioni.filter(function(o){ return o.stalli.tariffazione === tariffazione; });

  var righe = occupazioni.length === 0
    ? '<tr><td colspan="9" class="text-center text-muted py-4">Nessun risultato</td></tr>'
    : occupazioni.map(function(o) {
        var avvCell;
        if (o.avvisato && o.avvisato.length > 0) {
          avvCell = '<span class="badge bg-info">' + o.avvisato.length + ' avvisi</span>'
            + '<button class="btn btn-sm btn-link p-0" onclick="toggleAvvisi(\'' + o.id + '\')">Mostra</button>'
            + '<div id="avvisi' + o.id + '" class="d-none mt-1 small text-muted">' + o.avvisato.map(formatData).join(', ') + '</div>';
        } else {
          avvCell = '<span class="text-muted">-</span>';
        }
        return '<tr>'
          + '<td>'
          + '<strong>' + (o.ditta.intestazione || '-') + '</strong>'
          + '<br>' + (o.ditta.ragioneSociale || '')
          + '<br><small class="text-muted">P.IVA: ' + (o.ditta.partitaIva || '') + '</small>'
          + '</td>'
          + '<td>' + (o.ditta.ubicazione || '') + ', ' + (o.ditta.civico || '') + '</td>'
          + '<td>' + o.stalli.numero + '</td>'
          + '<td><span class="badge bg-secondary">' + o.stalli.settore + '</span></td>'
          + '<td>' + o.stalli.tariffazione + '</td>'
          + '<td>' + badgePeriodo(o) + '</td>'
          + '<td>' + badgePagamento(o.pagamento.stato) + '</td>'
          + '<td>' + avvCell + '</td>'
          + '<td><small>' + (o.note || '-') + '</small></td>'
          + '</tr>';
      }).join('');

  var selC = settore === 'C' ? ' selected' : '';
  var selF = settore === 'F' ? ' selected' : '';
  var selAnn  = periodo === 'annuale' ? ' selected' : '';
  var selStag = periodo === 'stagionale' ? ' selected' : '';
  var selPag  = function(v) { return pagamento === v ? ' selected' : ''; };
  var selTar  = function(v) { return tariffazione === v ? ' selected' : ''; };

  main().innerHTML = ''
    + '<div class="d-flex justify-content-between align-items-center mb-4">'
    + '  <h2 class="mb-0">Riepilogo</h2>'
    + '  <select class="form-select form-select-sm" style="width:120px;" onchange="navigate(\'/riepilogo\',{anno:this.value})">'
    +    annoSelectHTML(anni, anno)
    + '  </select>'
    + '</div>'
    + '<div class="card mb-4"><div class="card-header"><h6 class="mb-0">Filtri Avanzati</h6></div>'
    + '<div class="card-body"><div class="row g-3">'
    + '<div class="col-12 col-md-4"><label class="form-label">Ditta / Intestazione / Nome Attivita</label>'
    + '<input type="text" class="form-control" id="f_search" placeholder="Cerca..." value="' + search + '"></div>'
    + '<div class="col-6 col-md-2"><label class="form-label">Settore</label>'
    + '<select class="form-select" id="f_settore"><option value="">Tutti</option>'
    + '<option value="C"' + selC + '>C</option><option value="F"' + selF + '>F</option></select></div>'
    + '<div class="col-6 col-md-2"><label class="form-label">Periodo</label>'
    + '<select class="form-select" id="f_periodo"><option value="">Tutti</option>'
    + '<option value="annuale"' + selAnn + '>Annuale</option>'
    + '<option value="stagionale"' + selStag + '>Stagionale</option></select></div>'
    + '<div class="col-6 col-md-2"><label class="form-label">Pagamento</label>'
    + '<select class="form-select" id="f_pagamento"><option value="">Tutti</option>'
    + '<option value="pagato"' + selPag('pagato') + '>Pagato</option>'
    + '<option value="parziale"' + selPag('parziale') + '>Parziale</option>'
    + '<option value="non_pagato"' + selPag('non_pagato') + '>Non Pagato</option></select></div>'
    + '<div class="col-6 col-md-2"><label class="form-label">Tariffazione</label>'
    + '<select class="form-select" id="f_tariffazione"><option value="">Tutti</option>'
    + '<option value="Rossa Stag"' + selTar('Rossa Stag') + '>Rossa Stagionale</option>'
    + '<option value="Gialla Stag"' + selTar('Gialla Stag') + '>Gialla Stagionale</option>'
    + '<option value="Gialla Ann"' + selTar('Gialla Ann') + '>Gialla Annuale</option>'
    + '<option value="Grigia"' + selTar('Grigia') + '>Grigia</option>'
    + '<option value="Rossa Ann"' + selTar('Rossa Ann') + '>Rossa Annuale</option>'
    + '</select></div>'
    + '</div>'
    + '<div class="mt-3">'
    + '<button class="btn btn-primary px-4" onclick="applicaFiltriRiepilogo(' + anno + ')">'
    + '<i class="bi bi-search me-1"></i>Filtra</button>'
    + '</div>'
    + '</div></div>'
    + '<div class="card"><div class="card-body p-0"><div class="table-responsive">'
    + '<table class="table table-hover mb-0">'
    + '<thead class="table-light"><tr>'
    + '<th>Ditta</th><th>Ubicazione</th><th>Stalli</th><th>Settore</th><th>Tariffazione</th>'
    + '<th>Periodo</th><th>Pagamento</th><th>Avvisi</th><th>Note</th>'
    + '</tr></thead>'
    + '<tbody>' + righe + '</tbody>'
    + '</table></div></div></div>';

  window._annoRiepilogo = anno;
}

window.applicaFiltriRiepilogo = function(anno) {
  renderRiepilogo({
    anno:         anno,
    search:       el('f_search') ? el('f_search').value : '',
    settore:      el('f_settore') ? el('f_settore').value : '',
    periodo:      el('f_periodo') ? el('f_periodo').value : '',
    pagamento:    el('f_pagamento') ? el('f_pagamento').value : '',
    tariffazione: el('f_tariffazione') ? el('f_tariffazione').value : ''
  });
};

window.toggleAvvisi = function(id) {
  var e = el('avvisi' + id);
  if (e) e.classList.toggle('d-none');
};

// ─── ANAGRAFICA ───────────────────────────────────────────────────────────────

async function renderAnagrafica(params) {
  params = params || {};
  var search = params.search || '';
  var stato  = params.stato  || 'in_attivita';
  var ditte  = await DB.getDitte();

  // filtro stato
  if (stato !== 'tutte') {
    ditte = ditte.filter(function(d) { return (d.stato || 'in_attivita') === stato; });
  }

  if (search) {
    var q = search.toLowerCase();
    ditte = ditte.filter(function(d) {
      return (d.ragioneSociale || '').toLowerCase().indexOf(q) >= 0
          || (d.intestazione   || '').toLowerCase().indexOf(q) >= 0
          || (d.nomeAttivita   || '').toLowerCase().indexOf(q) >= 0;
    });
  }

  var searchBtn = search
    ? '<button class="btn btn-outline-secondary" onclick="renderAnagrafica()"><i class="bi bi-x"></i></button>'
    : '';

  var righe = ditte.length === 0
    ? '<tr><td colspan="8" class="text-center text-muted py-4">Nessuna ditta in archivio</td></tr>'
    : ditte.map(function(d) {
        var isCessata = d.stato === 'cessata';
        var rowStyle = isCessata ? ' style="color:#aaa;"' : '';
        var badge = isCessata ? ' <span class="badge bg-secondary ms-1" style="font-size:.7rem;">Cessata</span>' : '';
        return '<tr' + rowStyle + '>'
          + '<td><strong>' + (d.ragioneSociale || '') + '</strong>' + badge + '</td>'
          + '<td>' + (d.partitaIva || '') + '</td>'
          + '<td>' + (d.codiceUnivoco || '-') + '</td>'
          + '<td>' + (d.intestazione || '-') + '</td>'
          + '<td>' + (d.ubicazione || '') + ', ' + (d.civico || '') + '</td>'
          + '<td>' + (d.telefono || '-') + '</td>'
          + '<td>'
          + '<button class="btn btn-sm btn-outline-primary me-1" onclick="apriModificaDitta(\'' + d.id + '\')">Modifica</button>'
          + '<button class="btn btn-sm btn-outline-danger" onclick="confermaEliminaDitta(\'' + d.id + '\')">Elimina</button>'
          + '</td></tr>';
      }).join('');

  main().innerHTML = ''
    + '<div class="d-flex justify-content-between align-items-center mb-4">'
    + '  <h2 class="mb-0">Anagrafica Ditte</h2>'
    + '  <button class="btn btn-primary btn-sm" onclick="apriAggiuntaDitta()">'
    + '    <i class="bi bi-plus-circle"></i> Aggiungi Ditta'
    + '  </button>'
    + '</div>'
    + '<div class="mb-3"><div class="row g-2 align-items-center">'
    + '<div class="col"><div class="input-group">'
    + '<span class="input-group-text"><i class="bi bi-search"></i></span>'
    + '<input type="text" class="form-control" id="ana_search"'
    + '       placeholder="Cerca per ragione sociale, intestazione, nome attivita..."'
    + '       value="' + search + '"'
    + '       oninput="renderAnagrafica({search:this.value, stato:\'' + stato + '\'})">'  
    + searchBtn
    + '</div></div>'
    + '<div class="col-auto"><label class="me-1 fw-semibold">Stato:</label>'
    + '<select class="form-select form-select-sm d-inline-block" style="width:140px;" onchange="renderAnagrafica({search:\'' + search.replace(/\'/g,\'\\\'\'') + '\', stato:this.value})">'
    + '<option value="in_attivita"' + (stato === 'in_attivita' ? ' selected' : '') + '>In attività</option>'
    + '<option value="tutte"'      + (stato === 'tutte'       ? ' selected' : '') + '>Tutte</option>'
    + '<option value="cessata"'    + (stato === 'cessata'     ? ' selected' : '') + '>Cessata</option>'
    + '</select></div>'
    + '</div></div>'
    + '<div class="card"><div class="card-body p-0"><div class="table-responsive">'
    + '<table class="table table-hover mb-0">'
    + '<thead class="table-light"><tr>'
    + '<th>Ragione Sociale</th><th>P.IVA</th><th>Cod. Univoco</th>'
    + '<th>Intestazione</th><th>Ubicazione</th><th>Telefono</th><th>Azioni</th>'
    + '</tr></thead>'
    + '<tbody>' + righe + '</tbody>'
    + '</table></div></div></div>'
    + '<div class="modal fade" id="addDittaModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">'
    + '<div class="modal-header"><h5 class="modal-title">Nuova Ditta</h5>'
    + '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '<div class="modal-body">' + formDittaHTML('addD') + '</div>'
    + '<div class="modal-footer">'
    + '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>'
    + '<button type="button" class="btn btn-primary" onclick="salvaDitta()">Salva</button>'
    + '</div></div></div></div>'
    + '<div class="modal fade" id="editDittaModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">'
    + '<div class="modal-header"><h5 class="modal-title">Modifica Ditta</h5>'
    + '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '<div class="modal-body" id="editDittaBody"></div>'
    + '<div class="modal-footer">'
    + '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Annulla</button>'
    + '<button type="button" class="btn btn-primary" id="editDittaSaveBtn">Salva</button>'
    + '</div></div></div></div>'
    + '<div class="modal fade" id="delDittaModal" tabindex="-1"><div class="modal-dialog modal-sm modal-dialog-centered"><div class="modal-content">'
    + '<div class="modal-header py-2"><h6 class="modal-title">Conferma eliminazione</h6>'
    + '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>'
    + '<div class="modal-body py-2"><p class="mb-0">Eliminare questa ditta?</p></div>'
    + '<div class="modal-footer py-2">'
    + '<button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Annulla</button>'
    + '<button type="button" class="btn btn-danger btn-sm" id="delDittaConfirmBtn">Elimina</button>'
    + '</div></div></div></div>';
}

// ─── FORM DITTA ───────────────────────────────────────────────────────────────

function formDittaHTML(prefix, d) {
  d = d || {};
  return ''
    + '<div class="row g-3">'
    + '<div class="col-md-6"><label class="form-label">Ragione Sociale *</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_ragioneSociale" value="' + (d.ragioneSociale || '') + '" required></div>'
    + '<div class="col-md-3"><label class="form-label">P.IVA *</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_partitaIva" value="' + (d.partitaIva || '') + '" required></div>'
    + '<div class="col-md-3"><label class="form-label">Codice Univoco</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_codiceUnivoco" value="' + (d.codiceUnivoco || '') + '"></div>'
    + '<div class="col-md-6"><label class="form-label">Nome Attivita</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_nomeAttivita" value="' + (d.nomeAttivita || '') + '" placeholder="Nome commerciale / attivita"></div>'
    + '<div class="col-12"><label class="form-label fw-semibold">Stato attività</label><br>'
    + '<input type="radio" class="btn-check" name="' + prefix + '_stato" id="' + prefix + '_stato_attiva" value="in_attivita"' + ((!d.stato || d.stato === 'in_attivita') ? ' checked' : '') + '>'
    + '<label class="btn btn-outline-success btn-sm me-2" for="' + prefix + '_stato_attiva">In attività</label>'
    + '<input type="radio" class="btn-check" name="' + prefix + '_stato" id="' + prefix + '_stato_cessata" value="cessata"' + (d.stato === 'cessata' ? ' checked' : '') + '>'
    + '<label class="btn btn-outline-secondary btn-sm" for="' + prefix + '_stato_cessata">Cessata</label>'
    + '</div>'
    + '<div class="col-md-6"><label class="form-label">Intestazione</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_intestazione" value="' + (d.intestazione || '') + '"></div>'
    + '<div class="col-md-4"><label class="form-label">Ubicazione *</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_ubicazione" value="' + (d.ubicazione || '') + '" required></div>'
    + '<div class="col-md-2"><label class="form-label">Civico *</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_civico" value="' + (d.civico || '') + '" required></div>'
    + '<div class="col-md-4"><label class="form-label">Telefono</label>'
    + '<input type="text" class="form-control" id="' + prefix + '_telefono" value="' + (d.telefono || '') + '"></div>'
    + '</div>';
}

function leggiDittaDaForm(prefix) {
  function val(id) { var e = el(id); return e ? e.value.trim() : ''; }
  function radio2(name) {
    var r2 = document.querySelector('input[name="' + name + '"]:checked');
    return r2 ? r2.value : 'in_attivita';
  }
  return {
    ragioneSociale: val(prefix + '_ragioneSociale'),
    partitaIva:     val(prefix + '_partitaIva'),
    codiceUnivoco:  val(prefix + '_codiceUnivoco'),
    nomeAttivita:   val(prefix + '_nomeAttivita'),
    intestazione:   val(prefix + '_intestazione'),
    ubicazione:     val(prefix + '_ubicazione'),
    civico:         val(prefix + '_civico'),
    telefono:       val(prefix + '_telefono'),
    stato:          radio2(prefix + '_stato')
  };
}

window.apriAggiuntaDitta = function() {
  new bootstrap.Modal(el('addDittaModal')).show();
};

window.salvaDitta = async function() {
  var d = leggiDittaDaForm('addD');
  if (!d.ragioneSociale || !d.partitaIva) {
    showToast('Compilare Ragione Sociale e P.IVA', 'warning'); return;
  }
  await DB.addDitta(d);
  bootstrap.Modal.getInstance(el('addDittaModal')).hide();
  showToast('Ditta aggiunta');
  renderAnagrafica();
};

window.apriModificaDitta = async function(id) {
  var d = await DB.getDitta(id);
  if (!d) return;
  el('editDittaBody').innerHTML = formDittaHTML('editD', d);
  el('editDittaSaveBtn').onclick = function() { aggiornaDitta(id); };
  new bootstrap.Modal(el('editDittaModal')).show();
};

window.aggiornaDitta = async function(id) {
  var d = leggiDittaDaForm('editD');
  if (!d.ragioneSociale || !d.partitaIva) {
    showToast('Compilare Ragione Sociale e P.IVA', 'warning'); return;
  }
  await DB.updateDitta(id, d);
  bootstrap.Modal.getInstance(el('editDittaModal')).hide();
  showToast('Ditta aggiornata');
  renderAnagrafica();
};

window.confermaEliminaDitta = function(id) {
  el('delDittaConfirmBtn').onclick = async function() {
    await DB.deleteDitta(id);
    bootstrap.Modal.getInstance(el('delDittaModal')).hide();
    showToast('Ditta eliminata');
    renderAnagrafica();
  };
  new bootstrap.Modal(el('delDittaModal')).show();
};

// ─── BACKUP / RIPRISTINO ─────────────────────────────────────────────────────

window.esportaDati = async function() {
  var data = await DB.exportData();
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'backup_suolo_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  showToast('Backup esportato');
};

window.importaDati = async function(file) {
  try {
    var text = await file.text();
    await DB.importData(text);
    showToast('Dati importati con successo!');
    renderDashboard();
  } catch(e) {
    showToast('Errore importazione: ' + e.message, 'danger');
  }
};

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  var importInput = el('importFileInput');
  if (importInput) {
    importInput.addEventListener('change', function(e) {
      var f = e.target.files[0];
      if (f) window.importaDati(f);
    });
  }

  var params = Object.fromEntries(new URLSearchParams(window.location.search));
  var routePath = params._route || '/';
  delete params._route;
  renderView(routePath, params);
});

// Esponi globalmente
window.navigate          = navigate;
window.renderOccupazione = renderOccupazione;
window.renderAnagrafica  = renderAnagrafica;
