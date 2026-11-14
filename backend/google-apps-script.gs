/**
 * Power Solar — Backend gratis del CRM y estadísticas (Google Apps Script + Google Sheets)
 * -----------------------------------------------------------------------------
 * Instalación (5 minutos, ver README sección "Panel admin"):
 *  1. Crea una Hoja de cálculo de Google nueva (ej. "Power Solar CRM").
 *  2. Menú Extensiones → Apps Script. Borra lo que haya y pega TODO este archivo.
 *  3. Ícono de engranaje (Configuración del proyecto) → Propiedades de la secuencia de comandos
 *     → Agregar propiedad:  ADMIN_KEY = (una clave larga que solo tú sepas).
 *  4. Implementar → Nueva implementación → Tipo: Aplicación web
 *       Ejecutar como: Yo   |   Quién tiene acceso: Cualquier persona
 *     → Implementar → autoriza → copia la URL que termina en /exec.
 *  5. Pega esa URL en js/config.js  →  crmEndpoint: "https://script.google.com/macros/s/.../exec"
 *
 * La clave ADMIN_KEY nunca va en el sitio web: solo la escribes al entrar al panel.
 * Las visitas y clientes nuevos se guardan sin clave; leer o editar requiere la clave.
 */

var SHEET_LEADS = 'Leads';
var SHEET_EVENTS = 'Eventos';
var LEAD_COLS = ['id', 'creado', 'actualizado', 'nombre', 'telefono', 'email', 'pueblo', 'dueno', 'factura',
  'interes', 'etapa', 'valor', 'proximo', 'notas', 'fuente', 'campana', 'visitante', 'historial'];
var EVENT_COLS = ['ts', 'tipo', 'visitante', 'sesion', 'pagina', 'ref', 'fuente', 'dispositivo', 'etiqueta', 'x', 'y', 'valor'];

function sheet_(name, cols) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(cols); sh.setFrozenRows(1); }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function authed_(key) {
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!real && key === real;
}

function clip_(v, n) { return String(v == null ? '' : v).slice(0, n || 500); }

function rows_(sh, cols) {
  var vals = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < vals.length; i++) {
    var o = {};
    for (var c = 0; c < cols.length; c++) o[cols[c]] = vals[i][c] instanceof Date ? vals[i][c].toISOString() : vals[i][c];
    out.push(o);
  }
  return out;
}

/* ---------- Lectura (panel admin) ---------- */
function doGet(e) {
  var p = e.parameter || {};
  if (p.action === 'ping') return json_({ ok: true });
  if (!authed_(p.key)) return json_({ ok: false, error: 'auth' });
  var days = Math.min(+p.days || 30, 365);
  var since = Date.now() - days * 864e5;
  var leads = rows_(sheet_(SHEET_LEADS, LEAD_COLS), LEAD_COLS);
  var events = rows_(sheet_(SHEET_EVENTS, EVENT_COLS), EVENT_COLS).filter(function (ev) {
    return new Date(ev.ts).getTime() >= since;
  });
  return json_({ ok: true, leads: leads, events: events });
}

/* ---------- Escritura ---------- */
function doPost(e) {
  var body = {};
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'json' }); }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (body.action === 'track') return track_(body.events || []);
    if (body.action === 'lead') return newLead_(body.lead || {}, false);
    if (!authed_(body.key)) return json_({ ok: false, error: 'auth' });
    if (body.action === 'addLead') return newLead_(body.lead || {}, true);
    if (body.action === 'updateLead') return updateLead_(body.id, body.fields || {});
    if (body.action === 'deleteLead') return deleteLead_(body.id);
    return json_({ ok: false, error: 'action' });
  } finally { lock.releaseLock(); }
}

function track_(events) {
  var sh = sheet_(SHEET_EVENTS, EVENT_COLS);
  var rows = events.slice(0, 50).map(function (ev) {
    return EVENT_COLS.map(function (c) { return c === 'ts' ? new Date(ev.ts || Date.now()) : clip_(ev[c], 300); });
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, EVENT_COLS.length).setValues(rows);
  return json_({ ok: true, n: rows.length });
}

function newLead_(l, admin) {
  var sh = sheet_(SHEET_LEADS, LEAD_COLS);
  var now = new Date().toISOString();
  var id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var lead = {
    id: id, creado: now, actualizado: now, etapa: admin && l.etapa ? l.etapa : 'nuevo',
    fuente: admin ? (l.fuente || 'manual') : (l.fuente || 'web'),
    historial: JSON.stringify([{ t: now, a: admin ? 'Creado manualmente' : 'Llegó por la web' }])
  };
  ['nombre', 'telefono', 'email', 'pueblo', 'dueno', 'factura', 'interes', 'valor', 'proximo', 'notas', 'campana', 'visitante']
    .forEach(function (k) { lead[k] = clip_(l[k], k === 'notas' ? 5000 : 300); });
  sh.appendRow(LEAD_COLS.map(function (c) { return lead[c] == null ? '' : lead[c]; }));
  return json_({ ok: true, lead: lead });
}

function findRow_(sh, id) {
  var ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (var i = 1; i < ids.length; i++) if (ids[i][0] === id) return i + 1;
  return -1;
}

function updateLead_(id, fields) {
  var sh = sheet_(SHEET_LEADS, LEAD_COLS);
  var r = findRow_(sh, id);
  if (r < 0) return json_({ ok: false, error: 'notfound' });
  var row = sh.getRange(r, 1, 1, LEAD_COLS.length).getValues()[0];
  Object.keys(fields).forEach(function (k) {
    var c = LEAD_COLS.indexOf(k);
    if (c > 2) row[c] = clip_(fields[k], k === 'notas' || k === 'historial' ? 20000 : 300);
  });
  row[2] = new Date().toISOString();
  sh.getRange(r, 1, 1, LEAD_COLS.length).setValues([row]);
  return json_({ ok: true });
}

function deleteLead_(id) {
  var sh = sheet_(SHEET_LEADS, LEAD_COLS);
  var r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
  return json_({ ok: true });
}
