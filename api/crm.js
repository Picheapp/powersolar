/* ============================================================
   Power Solar — base de datos del CRM y estadísticas (Vercel).
   Guarda en Vercel Blob (privado). Variables en Vercel:
     BLOB_READ_WRITE_TOKEN  (la crea Vercel al conectar el Blob)
     ADMIN_KEY              (clave para entrar al panel)
   Visitas y formularios se guardan sin clave; leer/editar requiere la clave.
   ============================================================ */
import { put, list, get, del } from "@vercel/blob";

const ACCESS = { access: "private" };
const TZ = "America/Puerto_Rico";
const LEAD_FIELDS = ["nombre", "telefono", "email", "pueblo", "dueno", "factura", "interes", "etapa", "valor",
  "proximo", "notas", "fuente", "campana", "visitante", "historial"];
const EVENT_FIELDS = ["ts", "tipo", "visitante", "sesion", "pagina", "ref", "fuente", "dispositivo", "etiqueta", "x", "y", "valor"];

const clip = (v, n = 300) => String(v == null ? "" : v).slice(0, n);
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

function authed(key) {
  const real = process.env.ADMIN_KEY;
  if (!real || typeof key !== "string" || key.length !== real.length) return false;
  let diff = 0; for (let i = 0; i < real.length; i++) diff |= real.charCodeAt(i) ^ key.charCodeAt(i);
  return diff === 0;
}

async function readJSON(pathname) {
  const r = await get(pathname, { ...ACCESS, useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
const writeJSON = (pathname, data) => put(pathname, JSON.stringify(data), {
  ...ACCESS, addRandomSuffix: false, allowOverwrite: true, contentType: "application/json",
});
async function listAll(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : null; } while (cursor);
  return out;
}
async function inBatches(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "string") { try { return JSON.parse(b); } catch { return {}; } }
  if (Buffer.isBuffer(b)) { try { return JSON.parse(b.toString("utf8")); } catch { return {}; } }
  return b;
}

/* ---------- Lectura de eventos con compactación por día ---------- */
async function loadEvents(days) {
  const today = dayKey(Date.now());
  const wanted = new Set(); for (let i = 0; i < days; i++) wanted.add(dayKey(Date.now() - i * 864e5));
  const [pieces, compact] = await Promise.all([listAll("ev/"), listAll("evd/")]);
  const byDay = new Map();
  pieces.forEach((b) => { const d = b.pathname.split("/")[1]; if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(b); });
  const compactDays = new Map(compact.map((b) => [b.pathname.slice(4, 14), b]));
  const events = []; const loaded = new Set();

  // Días pasados con piezas sueltas: unir en un solo archivo por día y borrar las piezas
  for (const [d, blobs] of byDay) {
    if (d === today) continue;
    const parts = await inBatches(blobs, 25, (b) => readJSON(b.pathname).catch(() => null));
    const prev = compactDays.has(d) ? (await readJSON(`evd/${d}.json`).catch(() => null)) || [] : [];
    const merged = prev.concat(...parts.filter(Array.isArray));
    await writeJSON(`evd/${d}.json`, merged);
    await del(blobs.map((b) => b.url));
    compactDays.set(d, true);
    if (wanted.has(d)) { events.push(...merged); loaded.add(d); }
    byDay.delete(d);
  }
  // Días compactados ya existentes
  const toRead = [...compactDays.keys()].filter((d) => wanted.has(d) && d !== today && !loaded.has(d));
  (await inBatches(toRead, 15, (d) => readJSON(`evd/${d}.json`).catch(() => []))).forEach((a) => Array.isArray(a) && events.push(...a));
  // Hoy (piezas sueltas)
  if (byDay.has(today) && wanted.has(today)) {
    (await inBatches(byDay.get(today), 25, (b) => readJSON(b.pathname).catch(() => null))).forEach((a) => Array.isArray(a) && events.push(...a));
  }
  return events;
}

async function loadLeads() {
  const blobs = await listAll("leads/");
  return (await inBatches(blobs, 25, (b) => readJSON(b.pathname).catch(() => null))).filter(Boolean);
}

function cleanLead(src, base) {
  const l = Object.assign({}, base);
  LEAD_FIELDS.forEach((k) => { if (src[k] !== undefined) l[k] = clip(src[k], k === "notas" || k === "historial" ? 20000 : 300); });
  return l;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      if (req.query.action === "ping") return res.status(200).json({ ok: true });
      if (!authed(req.headers["x-admin-key"])) return res.status(200).json({ ok: false, error: "auth" });
      const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
      const [leads, events] = await Promise.all([loadLeads(), loadEvents(days)]);
      return res.status(200).json({ ok: true, leads, events });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const body = parseBody(req);
    const now = new Date().toISOString();

    if (body.action === "track") {
      const evs = (Array.isArray(body.events) ? body.events : []).slice(0, 200).map((e) => {
        const o = {}; EVENT_FIELDS.forEach((k) => { o[k] = clip(e[k], 300); });
        const t = Date.parse(o.ts); o.ts = new Date(isNaN(t) || Math.abs(t - Date.now()) > 864e5 ? Date.now() : t).toISOString();
        return o;
      });
      if (evs.length) await put(`ev/${dayKey(Date.now())}/${rid()}.json`, JSON.stringify(evs), { ...ACCESS, addRandomSuffix: false, contentType: "application/json" });
      return res.status(200).json({ ok: true, n: evs.length });
    }

    if (body.action === "lead") {
      const id = "L" + rid();
      const lead = cleanLead(body.lead || {}, {});
      Object.assign(lead, { id, creado: now, actualizado: now, etapa: "nuevo", fuente: "web",
        historial: JSON.stringify([{ t: now, a: "Llegó por la web" }]) });
      await writeJSON(`leads/${id}.json`, lead);
      return res.status(200).json({ ok: true });
    }

    if (!authed(body.key)) return res.status(200).json({ ok: false, error: "auth" });

    if (body.action === "addLead") {
      const id = "L" + rid();
      const lead = cleanLead(body.lead || {}, { etapa: "nuevo", fuente: "manual" });
      Object.assign(lead, { id, creado: now, actualizado: now });
      if (!lead.historial) lead.historial = JSON.stringify([{ t: now, a: "Creado manualmente" }]);
      await writeJSON(`leads/${id}.json`, lead);
      return res.status(200).json({ ok: true, lead });
    }
    const id = String(body.id || "").replace(/[^A-Za-z0-9]/g, "");
    if (!id) return res.status(200).json({ ok: false, error: "id" });
    if (body.action === "updateLead") {
      const cur = await readJSON(`leads/${id}.json`);
      if (!cur) return res.status(200).json({ ok: false, error: "notfound" });
      const next = cleanLead(body.fields || {}, cur);
      next.actualizado = now;
      await writeJSON(`leads/${id}.json`, next);
      return res.status(200).json({ ok: true });
    }
    if (body.action === "deleteLead") {
      const found = await list({ prefix: `leads/${id}.json`, limit: 1 });
      if (found.blobs.length) await del(found.blobs.map((b) => b.url));
      return res.status(200).json({ ok: true });
    }
    return res.status(200).json({ ok: false, error: "action" });
  } catch (err) {
    console.error("crm error:", err);
    return res.status(500).json({ ok: false, error: "server" });
  }
}
