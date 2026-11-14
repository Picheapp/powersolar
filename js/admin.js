/* ============================================================
   Power Solar — Panel admin: CRM (Kanban), clientes y estadísticas.
   Datos: Google Apps Script (js/config.js → crmEndpoint).
   Sin endpoint: modo prueba con los datos de este navegador.
   ============================================================ */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const EP = (window.PS_CONFIG || {}).crmEndpoint || "";
  const TZ = "America/Puerto_Rico";

  const STAGES = [
    { id: "nuevo", name: "Nuevo" },
    { id: "contactado", name: "Contactado" },
    { id: "cita", name: "Cita / Visita" },
    { id: "propuesta", name: "Propuesta" },
    { id: "ganado", name: "Ganado" },
    { id: "perdido", name: "Perdido" },
  ];
  const stageName = (id) => (STAGES.find((s) => s.id === id) || STAGES[0]).name;
  const stageVar = (id) => `var(--st-${STAGES.some((s) => s.id === id) ? id : "nuevo"})`;

  /* ---------- utilidades ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
    del(k) { try { localStorage.removeItem(k); } catch (_) {} },
    raw(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    rawSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (_) {} },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const money = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
  const num = (v) => { const n = parseFloat(String(v || "").replace(/[^0-9.]/g, "")); return isNaN(n) ? 0 : n; };
  const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  const todayKey = () => dayKey(Date.now());
  const hourOf = (d) => +new Date(d).toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }) % 24;
  const ago = (d) => {
    const m = Math.floor((Date.now() - new Date(d).getTime()) / 6e4);
    if (m < 1) return "ahora"; if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60); if (h < 24) return `${h} h`;
    const dd = Math.floor(h / 24); return dd < 30 ? `${dd} d` : `${Math.floor(dd / 30)} mes`;
  };
  const dateLong = (d) => new Date(d).toLocaleString("es-PR", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const phoneDigits = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? "1" + d : d; };
  const parseHist = (h) => { try { const a = JSON.parse(h || "[]"); return Array.isArray(a) ? a : []; } catch (_) { return []; } };

  function toast(msg) {
    const t = $(".js-toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2600);
  }

  /* ---------- tema ---------- */
  const applyTheme = (v) => { if (v) document.documentElement.setAttribute("data-theme", v); else document.documentElement.removeAttribute("data-theme"); };
  applyTheme(ls.get("ps_admin_theme", ""));

  /* ---------- API ---------- */
  let KEY = ss.get("ps_admin_key") || ls.raw("ps_admin_key") || "";
  const api = {
    async load(days) {
      const r = await fetch(`${EP}?action=data&days=${days}&key=${encodeURIComponent(KEY)}`, { cache: "no-store" });
      return r.json();
    },
    async post(payload) {
      const r = await fetch(EP, { method: "POST", body: JSON.stringify(Object.assign({ key: KEY }, payload)), headers: { "Content-Type": "text/plain;charset=utf-8" } });
      return r.json();
    },
  };
  /* ---------- estado ---------- */
  const state = { leads: [], events: [], days: 30, view: "resumen", search: "", filterInt: "", sort: { k: "creado", dir: -1 }, heatDev: "celular", loadedAt: null };

  /* ---------- login ---------- */
  if (!EP) {
    // Falta conectar Google Sheets: no se puede entrar todavía
    $(".js-local-note").hidden = false;
    $$(".js-login-form input, .js-login-form button").forEach((el) => (el.disabled = true));
  }
  $(".js-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target; const err = $(".js-login-err");
    KEY = f.key.value.trim(); err.textContent = "";
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Entrando…";
    const ok = await refresh(true).catch(() => false);
    btn.disabled = false; btn.textContent = "Entrar";
    if (!ok) { err.textContent = "Clave incorrecta o no hay conexión con Google Sheets."; return; }
    ss.set("ps_admin_key", KEY);
    if (f.remember.checked) ls.rawSet("ps_admin_key", KEY); else ls.rawSet("ps_admin_key", null);
    if (ls.raw("ps_notrack") == null) ls.rawSet("ps_notrack", "1"); // no contar al dueño
    enterApp();
  });
  $(".js-logout").addEventListener("click", () => { ss.del("ps_admin_key"); ls.rawSet("ps_admin_key", null); KEY = ""; location.reload(); });

  function enterApp() {
    $(".js-login").hidden = true; $(".js-app").hidden = false;
    const mode = $(".js-mode");
    mode.textContent = "En vivo";
    $(".js-conn").innerHTML = `Conectado a Google Sheets. Endpoint: <code>${esc(EP.replace(/^(https:\/\/[^/]+\/macros\/s\/.{6}).*(.{6}\/exec)$/, "$1…$2"))}</code>`;
    $(".js-notrack").checked = ls.raw("ps_notrack") === "1";
    $(".js-theme").value = ls.get("ps_admin_theme", "");
    const saved = ss.get("ps_admin_view"); if (saved) go(saved);
    render();
    setInterval(() => { if (!document.hidden && $(".js-drawer").hidden) refresh(true); }, 120000);
  }

  async function refresh(silentFail) {
    const btn = $(".js-refresh"); btn.disabled = true;
    try {
      const j = await api.load(state.days);
      if (!j || !j.ok) { if (!silentFail) toast(j && j.error === "auth" ? "Sesión expirada: vuelve a entrar" : "No se pudo cargar"); return false; }
      state.leads = (j.leads || []).map((l) => Object.assign({}, l, { etapa: l.etapa || "nuevo" }));
      state.events = j.events || [];
      state.loadedAt = new Date();
      $(".js-updated").textContent = "Actualizado " + state.loadedAt.toLocaleTimeString("es-PR", { hour: "numeric", minute: "2-digit" });
      if (!$(".js-app").hidden) render();
      return true;
    } catch (e) {
      console.warn(e); if (!silentFail) toast("Error de conexión"); return false;
    } finally { btn.disabled = false; }
  }

  /* ---------- navegación ---------- */
  const TITLES = { resumen: "Resumen", kanban: "Embudo de ventas", lista: "Clientes", stats: "Estadísticas de la página", ajustes: "Ajustes" };
  function go(v) {
    if (!TITLES[v]) return;
    state.view = v; ss.set("ps_admin_view", v);
    $$(".side__nav button").forEach((b) => b.classList.toggle("is-on", b.dataset.view === v));
    $$(".view").forEach((s) => s.classList.toggle("is-on", s.dataset.view === v));
    $(".js-title").textContent = TITLES[v];
    $(".js-range").hidden = v === "kanban" || v === "ajustes";
    render();
  }
  $$(".side__nav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $$(".js-range button").forEach((b) => b.addEventListener("click", () => {
    $$(".js-range button").forEach((x) => x.classList.toggle("is-on", x === b));
    state.days = +b.dataset.days; refresh();
  }));
  $(".js-refresh").addEventListener("click", () => refresh().then((ok) => ok && toast("Datos actualizados")));

  /* ---------- cálculos ---------- */
  const inRange = (d) => new Date(d).getTime() >= Date.now() - state.days * 864e5;
  function dayList() {
    const out = []; const n = Math.max(1, state.days);
    for (let i = n - 1; i >= 0; i--) out.push(dayKey(Date.now() - i * 864e5));
    return out;
  }
  function countBy(arr, fn) {
    const m = new Map();
    arr.forEach((x) => { const k = fn(x); if (k == null || k === "") return; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  function uniq(arr, fn) { return new Set(arr.map(fn)).size; }
  function metrics(evs, leads) {
    const pv = evs.filter((e) => e.tipo === "pageview");
    const visitors = uniq(pv, (e) => e.visitante);
    const sessions = uniq(pv, (e) => e.sesion);
    const exits = evs.filter((e) => e.tipo === "salida" && +e.valor > 0 && +e.valor < 3600);
    const avgTime = exits.length ? exits.reduce((a, e) => a + +e.valor, 0) / exits.length : 0;
    const ACT = ["click", "whatsapp", "llamada", "form_inicio", "video", "lead"];
    const bySess = new Map(); pv.forEach((e) => bySess.set(e.sesion, 0));
    evs.forEach((e) => { if (bySess.has(e.sesion) && ACT.includes(e.tipo)) bySess.set(e.sesion, bySess.get(e.sesion) + 1); });
    const bounces = [...bySess.values()].filter((n) => n === 0).length;
    return {
      pageviews: pv.length, visitors, sessions, avgTime,
      bounce: pct(bounces, bySess.size),
      leads: leads.length,
      conv: pct(leads.filter((l) => (l.fuente || "web") === "web").length, visitors),
      wa: evs.filter((e) => e.tipo === "whatsapp").length,
      calls: evs.filter((e) => e.tipo === "llamada").length,
      clicks: evs.filter((e) => ["click", "whatsapp", "llamada"].includes(e.tipo)).length,
    };
  }

  /* ---------- render ---------- */
  function render() {
    const v = state.view;
    const newCount = state.leads.filter((l) => l.etapa === "nuevo").length;
    const b = $(".js-badge-new"); b.hidden = !newCount; b.textContent = newCount;
    if (v === "resumen") renderResumen();
    if (v === "kanban") renderKanban();
    if (v === "lista") renderTable();
    if (v === "stats") renderStats();
  }

  function kpiHTML(items) {
    return items.map((k) => `<div class="card kpi"><div class="kpi__label">${esc(k.l)}</div><div class="kpi__val num">${k.v}</div>${k.d ? `<div class="kpi__delta">${k.d}</div>` : ""}</div>`).join("");
  }
  const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);

  function renderResumen() {
    const leadsR = state.leads.filter((l) => inRange(l.creado));
    const m = metrics(state.events, leadsR);
    const open = state.leads.filter((l) => !["ganado", "perdido"].includes(l.etapa));
    const won = state.leads.filter((l) => l.etapa === "ganado");
    $(".js-kpis").innerHTML = kpiHTML([
      { l: "Visitas", v: fmt(m.pageviews), d: `${fmt(m.visitors)} visitantes únicos` },
      { l: "Clientes nuevos", v: fmt(m.leads), d: `${m.conv}% de los visitantes` },
      { l: "Clics a WhatsApp", v: fmt(m.wa), d: `${fmt(m.calls)} toques a llamar` },
      { l: "Tiempo en página", v: secs(m.avgTime), d: `${m.bounce}% se van sin interactuar` },
      { l: "En proceso", v: fmt(open.length), d: `${money(open.reduce((a, l) => a + num(l.valor), 0))} estimado` },
      { l: "Ganados", v: fmt(won.length), d: `${money(won.reduce((a, l) => a + num(l.valor), 0))} total` },
    ]);
    const days = dayList();
    const pvBy = Object.fromEntries(countBy(state.events.filter((e) => e.tipo === "pageview"), (e) => dayKey(e.ts)));
    const ldBy = Object.fromEntries(countBy(leadsR, (l) => dayKey(l.creado)));
    lineChart($(".js-ch-visits"), days.map((d) => ({ k: d, v: pvBy[d] || 0 })), "visitas");
    columnChart($(".js-ch-leads"), days.map((d) => ({ k: d, v: ldBy[d] || 0 })), "clientes");

    // Seguimientos
    const t = todayKey();
    const due = state.leads.filter((l) => l.proximo && String(l.proximo).slice(0, 10) <= t && !["ganado", "perdido"].includes(l.etapa))
      .sort((a, b) => String(a.proximo).localeCompare(String(b.proximo)));
    const fresh = state.leads.filter((l) => l.etapa === "nuevo").sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    const list = [...due.map((l) => ({ l, tag: String(l.proximo).slice(0, 10) < t ? '<span class="chip chip--late">Vencido</span>' : '<span class="chip chip--due">Hoy</span>' })),
      ...fresh.filter((l) => !due.includes(l)).slice(0, 6).map((l) => ({ l, tag: '<span class="chip">Sin contactar</span>' }))];
    $(".js-followups").innerHTML = list.length ? `<div class="hbars">${list.slice(0, 10).map(({ l, tag }) => `
      <div class="hbar" style="grid-template-columns:1fr auto auto;cursor:pointer" data-open="${esc(l.id)}">
        <span class="hbar__name"><b>${esc(l.nombre || "Sin nombre")}</b> <span style="color:var(--muted)">· ${esc(l.pueblo || "")} · ${ago(l.creado)}</span></span>
        ${tag}
        <a class="btn btn--sm btn--wa" href="https://wa.me/${phoneDigits(l.telefono)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">WhatsApp</a>
      </div>`).join("")}</div>` : '<div class="empty">Nada pendiente. 🎉</div>';

    // Embudo de ventas
    const byStage = STAGES.map((s) => ({ s, n: state.leads.filter((l) => l.etapa === s.id).length, v: state.leads.filter((l) => l.etapa === s.id).reduce((a, l) => a + num(l.valor), 0) }));
    const max = Math.max(1, ...byStage.map((x) => x.n));
    $(".js-pipeline").innerHTML = `<div class="hbars">${byStage.map(({ s, n, v }) => `
      <div class="hbar" data-tip="<b>${n}</b> en ${esc(s.name)} · ${money(v)}">
        <span class="hbar__name stage-tag" style="--c:${stageVar(s.id)}">${esc(s.name)}</span>
        <div class="hbar__track"><div class="hbar__fill" style="width:${(n / max) * 100}%;background:${stageVar(s.id)}"></div></div>
        <span class="hbar__val">${n}</span>
      </div>`).join("")}</div>`;
  }

  /* ---------- Kanban ---------- */
  function filteredLeads(q) {
    q = (q || "").toLowerCase().trim();
    return state.leads.filter((l) => {
      if (state.filterInt && l.interes !== state.filterInt) return false;
      if (!q) return true;
      return [l.nombre, l.telefono, l.pueblo, l.email, l.notas, l.interes].some((x) => String(x || "").toLowerCase().includes(q));
    });
  }
  function renderKanban() {
    const leads = filteredLeads(state.search);
    const t = todayKey();
    $(".js-kanban").innerHTML = STAGES.map((s) => {
      const items = leads.filter((l) => l.etapa === s.id).sort((a, b) => String(b.actualizado || b.creado).localeCompare(String(a.actualizado || a.creado)));
      const sum = items.reduce((a, l) => a + num(l.valor), 0);
      return `<div class="col" data-stage="${s.id}" style="--c:${stageVar(s.id)}">
        <div class="col__head"><b>${s.name}</b><span class="col__count">${items.length}</span>${sum ? `<span class="col__sum">${money(sum)}</span>` : ""}</div>
        <div class="col__body">${items.map((l) => cardHTML(l, t)).join("") || '<div class="empty" style="padding:10px 0">Arrastra aquí</div>'}</div>
      </div>`;
    }).join("");
  }
  function cardHTML(l, t) {
    const p = l.proximo ? String(l.proximo).slice(0, 10) : "";
    const due = p && !["ganado", "perdido"].includes(l.etapa) ? (p < t ? `<span class="chip chip--late">Vencido ${p.slice(5)}</span>` : p === t ? '<span class="chip chip--due">Hoy</span>' : `<span class="chip">📅 ${p.slice(5)}</span>`) : "";
    const ph = phoneDigits(l.telefono);
    return `<div class="lcard" data-id="${esc(l.id)}" tabindex="0">
      <div class="lcard__top"><span class="lcard__name">${esc(l.nombre || "Sin nombre")}</span><span class="lcard__age">${ago(l.creado)}</span></div>
      <div class="lcard__meta">${esc([l.pueblo, l.factura].filter(Boolean).join(" · "))}</div>
      <div class="lcard__tags">
        ${l.interes ? `<span class="chip">${esc(l.interes.replace("Placas solares + batería", "Placas + batería").replace("Quiero que me orienten", "Orientación"))}</span>` : ""}
        ${num(l.valor) ? `<span class="chip chip--val">${money(num(l.valor))}</span>` : ""}
        ${due}
        ${l.fuente && l.fuente !== "web" ? `<span class="chip">${esc(l.fuente)}</span>` : ""}
      </div>
      ${ph ? `<div class="lcard__act"><a href="tel:+${ph}" data-noopen>Llamar</a><a href="https://wa.me/${ph}" target="_blank" rel="noopener" data-noopen>WhatsApp</a></div>` : ""}
    </div>`;
  }
  $(".js-search").addEventListener("input", (e) => { state.search = e.target.value; renderKanban(); });
  $(".js-filter-int").addEventListener("change", (e) => { state.filterInt = e.target.value; renderKanban(); });

  // Arrastrar y soltar (mouse + táctil) con Pointer Events
  (() => {
    const board = $(".js-kanban");
    let drag = null;
    board.addEventListener("pointerdown", (e) => {
      const card = e.target.closest(".lcard");
      if (!card || e.target.closest("[data-noopen]") || e.button > 0) return;
      drag = { card, id: card.dataset.id, x: e.clientX, y: e.clientY, started: false, timer: null, pointerType: e.pointerType };
      if (e.pointerType !== "mouse") {
        // En táctil: mantener presionado 250ms para arrastrar (si no, es scroll)
        drag.timer = setTimeout(() => { if (drag) { start(e); if (navigator.vibrate) navigator.vibrate(15); } }, 250);
      }
    });
    function start(e) {
      drag.started = true;
      const r = drag.card.getBoundingClientRect();
      const g = drag.card.cloneNode(true); g.classList.add("ghost"); g.style.width = r.width + "px";
      drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
      document.body.appendChild(g); drag.ghost = g;
      drag.card.classList.add("is-dragging");
      try { drag.card.setPointerCapture(e.pointerId); } catch (_) {}
      move(e);
    }
    function move(e) {
      drag.ghost.style.left = e.clientX - drag.dx + "px"; drag.ghost.style.top = e.clientY - drag.dy + "px";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const col = el && el.closest(".col");
      $$(".col", board).forEach((c) => c.classList.toggle("is-over", c === col));
      drag.over = col;
      // auto-scroll horizontal
      const br = board.getBoundingClientRect();
      if (e.clientX > br.right - 40) board.scrollLeft += 12; else if (e.clientX < br.left + 40) board.scrollLeft -= 12;
    }
    document.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.started) {
        const far = Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6;
        if (far && drag.pointerType === "mouse") start(e);
        else if (far) { clearTimeout(drag.timer); drag = null; }
        return;
      }
      e.preventDefault(); move(e);
    }, { passive: false });
    document.addEventListener("touchmove", (e) => { if (drag && drag.started) e.preventDefault(); }, { passive: false });
    const end = (e) => {
      if (!drag) return;
      clearTimeout(drag.timer);
      const d = drag; drag = null;
      if (!d.started) { if (e.type === "pointerup") openLead(d.id); return; }
      d.ghost.remove(); d.card.classList.remove("is-dragging");
      $$(".col", board).forEach((c) => c.classList.remove("is-over"));
      if (d.over && d.over.dataset.stage) moveStage(d.id, d.over.dataset.stage);
    };
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    board.addEventListener("keydown", (e) => { const c = e.target.closest(".lcard"); if (c && e.key === "Enter") openLead(c.dataset.id); });
  })();

  async function moveStage(id, etapa) {
    const l = state.leads.find((x) => x.id === id);
    if (!l || l.etapa === etapa) return;
    const hist = parseHist(l.historial);
    hist.unshift({ t: new Date().toISOString(), a: `Movido a ${stageName(etapa)}` });
    const fields = { etapa, historial: JSON.stringify(hist) };
    Object.assign(l, fields, { actualizado: new Date().toISOString() });
    render();
    toast(`${l.nombre || "Cliente"} → ${stageName(etapa)}`);
    const r = await api.post({ action: "updateLead", id, fields }).catch(() => null);
    if (!r || !r.ok) toast("No se guardó el cambio. Revisa la conexión.");
  }

  /* ---------- Tabla ---------- */
  const COLS = [
    { k: "creado", n: "Fecha", f: (l) => l.creado ? new Date(l.creado).toLocaleDateString("es-PR", { timeZone: TZ, day: "numeric", month: "short" }) : "" },
    { k: "nombre", n: "Nombre", f: (l) => `<b>${esc(l.nombre)}</b>` },
    { k: "telefono", n: "Teléfono", f: (l) => esc(l.telefono) },
    { k: "pueblo", n: "Pueblo", f: (l) => esc(l.pueblo) },
    { k: "interes", n: "Interés", f: (l) => esc(l.interes) },
    { k: "factura", n: "Factura", f: (l) => esc(l.factura) },
    { k: "etapa", n: "Etapa", f: (l) => `<span class="stage-tag" style="--c:${stageVar(l.etapa)}">${stageName(l.etapa)}</span>` },
    { k: "valor", n: "Valor", r: true, f: (l) => num(l.valor) ? money(num(l.valor)) : "" },
    { k: "proximo", n: "Seguimiento", f: (l) => esc(String(l.proximo || "").slice(0, 10)) },
    { k: "campana", n: "Fuente", f: (l) => esc(l.campana || l.fuente) },
  ];
  function renderTable() {
    const q = $(".js-search2").value;
    const { k, dir } = state.sort;
    const rows = filteredLeads(q).sort((a, b) => {
      const A = k === "valor" ? num(a[k]) : String(a[k] || ""); const B = k === "valor" ? num(b[k]) : String(b[k] || "");
      return (A > B ? 1 : A < B ? -1 : 0) * dir;
    });
    $(".js-table").innerHTML = `<thead><tr>${COLS.map((c) => `<th data-k="${c.k}" class="${c.r ? "r" : ""}">${c.n}${k === c.k ? (dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((l) => `<tr data-open="${esc(l.id)}">${COLS.map((c) => `<td class="${c.r ? "r num" : ""}">${c.f(l)}</td>`).join("")}</tr>`).join("") ||
      `<tr><td colspan="${COLS.length}" class="empty">Todavía no hay clientes.</td></tr>`}</tbody>`;
  }
  $(".js-table").addEventListener("click", (e) => {
    const th = e.target.closest("th"); if (!th) return;
    state.sort = { k: th.dataset.k, dir: state.sort.k === th.dataset.k ? -state.sort.dir : 1 }; renderTable();
  });
  $(".js-search2").addEventListener("input", renderTable);
  document.addEventListener("click", (e) => {
    const o = e.target.closest("[data-open]");
    if (o && !e.target.closest("a")) openLead(o.dataset.open);
  });

  /* ---------- Detalle / edición ---------- */
  let current = null;
  const form = $(".js-d-form");
  function openLead(id) {
    const l = id ? state.leads.find((x) => x.id === id) : null;
    if (id && !l) return;
    current = l ? Object.assign({}, l) : { id: null, etapa: "nuevo", historial: "[]" };
    $(".js-d-title").textContent = l ? l.nombre || "Cliente" : "Nuevo cliente";
    ["nombre", "telefono", "email", "pueblo", "interes", "factura", "dueno", "valor", "notas"].forEach((k) => { if (form[k]) form[k].value = current[k] == null ? "" : current[k]; });
    form.proximo.value = current.proximo ? String(current.proximo).slice(0, 10) : "";
    drawStagePick(); drawHist();
    const ph = phoneDigits(current.telefono);
    $(".js-d-quick").innerHTML = l && ph ? `<a class="btn btn--sm" href="tel:+${ph}">📞 Llamar</a><a class="btn btn--sm btn--wa" href="https://wa.me/${ph}?text=${encodeURIComponent(`Hola ${(l.nombre || "").split(" ")[0]}, te saluda Edwin de Power Solar.`)}" target="_blank" rel="noopener">WhatsApp</a>${l.email ? `<a class="btn btn--sm" href="mailto:${esc(l.email)}">Email</a>` : ""}` : "";
    $(".js-d-meta").textContent = l ? `Creado ${dateLong(l.creado)} · ${l.fuente || "web"}${l.campana ? " · " + l.campana : ""}` : "";
    $(".js-d-del").hidden = !l;
    $(".js-d-saving").textContent = "";
    $(".js-scrim").hidden = false; $(".js-drawer").hidden = false;
    setTimeout(() => (l ? $(".js-d-close") : form.nombre).focus(), 30);
  }
  function drawStagePick() {
    $(".js-d-stage").innerHTML = STAGES.map((s) => `<button type="button" data-st="${s.id}" style="--c:${stageVar(s.id)}" class="${current.etapa === s.id ? "is-on" : ""}">${s.name}</button>`).join("");
  }
  function drawHist() {
    const h = parseHist(current.historial);
    $(".js-d-hist").innerHTML = h.map((x) => `<li><time>${dateLong(x.t)}</time>${esc(x.a)}</li>`).join("") || '<li style="color:var(--muted)">Sin actividad todavía</li>';
  }
  function addHist(a) { const h = parseHist(current.historial); h.unshift({ t: new Date().toISOString(), a }); current.historial = JSON.stringify(h); drawHist(); }
  $(".js-d-stage").addEventListener("click", (e) => {
    const b = e.target.closest("[data-st]"); if (!b || current.etapa === b.dataset.st) return;
    current.etapa = b.dataset.st; addHist(`Movido a ${stageName(current.etapa)}`); drawStagePick();
  });
  $(".js-d-addnote").addEventListener("click", () => { const i = $(".js-d-note"); if (i.value.trim()) { addHist(i.value.trim()); i.value = ""; } });
  $(".js-d-note").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $(".js-d-addnote").click(); } });
  function closeDrawer() { $(".js-scrim").hidden = true; $(".js-drawer").hidden = true; current = null; }
  $(".js-d-close").addEventListener("click", closeDrawer);
  $(".js-scrim").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && current) closeDrawer(); });

  $(".js-d-save").addEventListener("click", async () => {
    if (!form.nombre.value.trim()) { form.nombre.focus(); form.nombre.reportValidity(); return; }
    const fields = { etapa: current.etapa, historial: current.historial, proximo: form.proximo.value };
    ["nombre", "telefono", "email", "pueblo", "interes", "factura", "dueno", "valor", "notas"].forEach((k) => (fields[k] = form[k].value.trim()));
    const btn = $(".js-d-save"); btn.disabled = true; $(".js-d-saving").textContent = "Guardando…";
    try {
      if (current.id) {
        const r = await api.post({ action: "updateLead", id: current.id, fields });
        if (!r.ok) throw new Error(r.error);
        Object.assign(state.leads.find((x) => x.id === current.id), fields, { actualizado: new Date().toISOString() });
      } else {
        const h = parseHist(fields.historial); h.push({ t: new Date().toISOString(), a: "Creado manualmente" }); fields.historial = JSON.stringify(h);
        const r = await api.post({ action: "addLead", lead: fields });
        if (!r.ok) throw new Error(r.error);
        state.leads.push(Object.assign({}, r.lead, fields, { id: r.lead.id }));
      }
      closeDrawer(); render(); toast("Guardado");
    } catch (e) { $(".js-d-saving").textContent = "No se pudo guardar"; console.warn(e); }
    finally { btn.disabled = false; }
  });
  $(".js-d-del").addEventListener("click", async () => {
    if (!current || !current.id || !confirm(`¿Eliminar a ${current.nombre || "este cliente"}? No se puede deshacer.`)) return;
    const id = current.id;
    const r = await api.post({ action: "deleteLead", id }).catch(() => null);
    if (!r || !r.ok) { toast("No se pudo eliminar"); return; }
    state.leads = state.leads.filter((l) => l.id !== id); closeDrawer(); render(); toast("Eliminado");
  });
  $$(".js-add").forEach((b) => b.addEventListener("click", () => openLead(null)));

  /* ---------- Estadísticas ---------- */
  function hbars(el, items, opts = {}) {
    if (!items.length) { el.innerHTML = '<div class="empty">Sin datos en este periodo</div>'; return; }
    const max = Math.max(1, ...items.map((x) => x[1]));
    const total = opts.total || items.reduce((a, x) => a + x[1], 0);
    el.innerHTML = `<div class="hbars">${items.slice(0, opts.limit || 8).map(([k, v]) => `
      <div class="hbar" data-tip="${esc(k)}: <b>${fmt(v)}</b>${opts.noPct ? "" : ` (${pct(v, total)}%)`}">
        <span class="hbar__name" title="${esc(k)}">${esc(k)}</span>
        <div class="hbar__track"><div class="hbar__fill" style="width:${(v / max) * 100}%"></div></div>
        <span class="hbar__val">${opts.asPct ? Math.min(100, pct(v, total)) + "%" : fmt(v)}</span>
      </div>`).join("")}</div>`;
  }
  const SECTION_NAMES = { "hero": "Inicio + formulario", "video-top": "Video principal", "oferta": "La oferta", "compare": "La oferta", "ahorro": "Calculadora de ahorro", "calc": "Calculadora de ahorro", "video-sec": "Videos", "bill": "Factura de luz", "equipos": "Equipos", "gear": "Equipos", "how": "Cómo funciona", "checklist": "Qué incluye", "advisor": "Asesor (Edwin)", "preguntas": "Preguntas", "faq": "Preguntas", "final": "Llamado final", "footer": "Pie de página" };

  function renderStats() {
    const evs = state.events;
    const leadsR = state.leads.filter((l) => inRange(l.creado));
    const m = metrics(evs, leadsR);
    $(".js-kpis2").innerHTML = kpiHTML([
      { l: "Páginas vistas", v: fmt(m.pageviews), d: `${fmt(m.sessions)} sesiones` },
      { l: "Visitantes únicos", v: fmt(m.visitors) },
      { l: "Clics totales", v: fmt(m.clicks), d: m.sessions ? `${(m.clicks / m.sessions).toFixed(1)} por sesión` : "" },
      { l: "Tiempo promedio", v: secs(m.avgTime) },
      { l: "Conversión", v: m.conv + "%", d: "visitantes → formulario" },
    ]);

    // Embudo
    const pvV = new Set(evs.filter((e) => e.tipo === "pageview").map((e) => e.visitante));
    const vis = (pred) => new Set(evs.filter(pred).map((e) => e.visitante));
    const steps = [
      ["Visitaron", pvV.size],
      ["Bajaron a la mitad", vis((e) => e.tipo === "scroll" && +e.valor >= 50).size],
      ["Empezaron el formulario", vis((e) => e.tipo === "form_inicio").size],
      ["Pasaron al paso 2", vis((e) => e.tipo === "form_paso2").size],
      ["Enviaron (cliente)", vis((e) => e.tipo === "lead").size],
    ];
    const top = Math.max(1, steps[0][1]);
    $(".js-funnel").innerHTML = `<div class="funnel">${steps.map(([n, v], i) => `
      <div class="funnel__row" data-tip="${esc(n)}: <b>${fmt(v)}</b> · ${pct(v, top)}% del total${i ? ` · ${pct(v, steps[i - 1][1])}% del paso anterior` : ""}">
        <span>${n}</span><div><div class="funnel__bar" style="width:${(v / top) * 100}%"></div></div>
        <span class="funnel__val">${fmt(v)}<small>${pct(v, top)}%</small></span>
      </div>`).join("")}</div>`;

    const pv = evs.filter((e) => e.tipo === "pageview");
    const firstBySess = new Map(); pv.forEach((e) => { if (!firstBySess.has(e.visitante)) firstBySess.set(e.visitante, e); });
    const firsts = [...firstBySess.values()];
    hbars($(".js-sources"), countBy(firsts, (e) => e.fuente || "directo"));
    hbars($(".js-devices"), countBy(firsts, (e) => e.dispositivo || "otro"), { asPct: true });
    hbars($(".js-clicks"), countBy(evs.filter((e) => ["click", "whatsapp", "llamada"].includes(e.tipo)), (e) => e.etiqueta || "(sin nombre)"), { limit: 10 });

    const sessCount = Math.max(1, uniq(pv, (e) => e.sesion));
    const scrollBy = [25, 50, 75, 100].map((p) => [`${p}% de la página`, uniq(evs.filter((e) => e.tipo === "scroll" && +e.valor === p), (e) => e.sesion)]);
    hbars($(".js-scroll"), scrollBy, { total: sessCount, asPct: true });

    const secOrder = Object.keys(SECTION_NAMES);
    const secs2 = new Map();
    evs.filter((e) => e.tipo === "seccion").forEach((e) => {
      const n = SECTION_NAMES[e.etiqueta] || e.etiqueta; const k = n + "|" + e.sesion;
      if (!secs2.has(k)) secs2.set(k, n);
    });
    const secCounts = countBy([...secs2.values()], (n) => n).sort((a, b) => {
      const ia = secOrder.findIndex((k) => SECTION_NAMES[k] === a[0]); const ib = secOrder.findIndex((k) => SECTION_NAMES[k] === b[0]);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    hbars($(".js-sections"), secCounts, { total: sessCount, asPct: true, limit: 14 });

    const hours = Array.from({ length: 24 }, (_, h) => ({ k: h, v: 0 }));
    pv.forEach((e) => hours[hourOf(e.ts)].v++);
    columnChart($(".js-hours"), hours, "visitas", (k) => (k % 6 === 0 ? (k === 0 ? "12a" : k === 12 ? "12p" : k > 12 ? `${k - 12}p` : `${k}a`) : ""), (k) => `${k % 12 || 12}:00 ${k < 12 ? "am" : "pm"}`);
    hbars($(".js-videos"), countBy(evs.filter((e) => e.tipo === "video"), (e) => e.etiqueta), { noPct: true });
    hbars($(".js-pueblos"), countBy(leadsR, (l) => l.pueblo), { limit: 10 });
    drawHeat();
  }

  $$(".js-heat-dev button").forEach((b) => b.addEventListener("click", () => {
    $$(".js-heat-dev button").forEach((x) => x.classList.toggle("is-on", x === b)); state.heatDev = b.dataset.dev; drawHeat();
  }));
  function drawHeat() {
    const cv = $(".js-heat canvas"); const ctx = cv.getContext("2d");
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const dev = state.heatDev;
    const pts = state.events.filter((e) => ["click", "whatsapp", "llamada"].includes(e.tipo) && e.x !== "" && e.y !== "" && e.x != null &&
      (dev === "celular" ? e.dispositivo !== "computadora" : e.dispositivo === "computadora"));
    // guías de 25%
    const css = getComputedStyle(document.documentElement);
    ctx.strokeStyle = css.getPropertyValue("--line"); ctx.lineWidth = 1;
    [0.25, 0.5, 0.75].forEach((f) => { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
    const rgb = css.getPropertyValue("--heat").trim();
    const r = 16;
    const a = Math.max(0.04, Math.min(0.35, 12 / Math.sqrt(pts.length || 1) * 0.1));
    pts.forEach((e) => {
      const x = (+e.x / 100) * W, y = (+e.y / 100) * H;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    const wrap = $(".js-heat");
    $$(".heat__lbl", wrap).forEach((n) => n.remove());
    [["25%", .25], ["50%", .5], ["75%", .75]].forEach(([t, f]) => { const s = document.createElement("span"); s.className = "heat__lbl"; s.style.top = f * 100 + "%"; s.textContent = t; wrap.appendChild(s); });
    // Por zona
    const zones = [["Arriba (0–25%)", 0, 25], ["Medio-alto (25–50%)", 25, 50], ["Medio-bajo (50–75%)", 50, 75], ["Abajo (75–100%)", 75, 101]]
      .map(([n, a, b]) => [n, pts.filter((e) => +e.y >= a && +e.y < b).length]);
    const leg = $(".js-heat-legend");
    leg.innerHTML = `<p class="sub" style="margin:0 0 10px">${fmt(pts.length)} clics de ${dev}. Más color = más toques en esa zona.</p>`;
    const box = document.createElement("div"); leg.appendChild(box);
    hbars(box, zones, { total: pts.length || 1, asPct: true });
    const tops = document.createElement("div"); tops.style.marginTop = "16px";
    tops.innerHTML = '<p class="sub" style="margin:0 0 8px"><b>Más tocado en ' + dev + "</b></p>";
    const tb = document.createElement("div"); tops.appendChild(tb); leg.appendChild(tops);
    hbars(tb, countBy(pts, (e) => e.etiqueta), { limit: 6 });
  }

  /* ---------- Gráficas SVG (una sola serie, con tooltip) ---------- */
  const shortDay = (k) => { const [, m, d] = String(k).split("-"); return `${+d}/${+m}`; };
  const longDay = (k) => new Date(k + "T12:00:00").toLocaleDateString("es-PR", { weekday: "short", day: "numeric", month: "short" });
  function axisTicks(max) {
    const nice = max <= 4 ? Math.max(1, max) : Math.ceil(max / 4 / Math.pow(10, Math.floor(Math.log10(max / 4)))) * Math.pow(10, Math.floor(Math.log10(max / 4))) * 4;
    const step = nice / 4;
    return { top: nice, ticks: [0, 1, 2, 3, 4].map((i) => +(i * step).toFixed(2)).filter((v, i, a) => a.indexOf(v) === i && v <= nice) };
  }
  function frame(el, data, label, xLab, tipLab) {
    const W = Math.max(280, el.clientWidth || 500), H = 200, L = 34, R = 8, T = 10, B = 24;
    const max = Math.max(...data.map((d) => d.v), 0);
    const { top, ticks } = axisTicks(max || 1);
    const y = (v) => T + (H - T - B) * (1 - v / top);
    const n = data.length; const bw = (W - L - R) / n;
    const lab = xLab || ((k, i) => (n <= 8 || i % Math.ceil(n / 6) === 0 ? shortDay(k) : ""));
    const tipL = tipLab || longDay;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">`;
    ticks.forEach((t) => { s += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
    data.forEach((d, i) => { const t = lab(d.k, i); if (t) s += `<text x="${L + bw * i + bw / 2}" y="${H - 6}" text-anchor="middle">${t}</text>`; });
    return { W, H, L, R, T, B, y, bw, n, s, tipL, max };
  }
  function columnChart(el, data, label, xLab, tipLab) {
    const f = frame(el, data, label, xLab, tipLab);
    if (!f.max) { el.innerHTML = '<div class="empty">Sin datos en este periodo</div>'; return; }
    let s = f.s; const gap = Math.min(4, f.bw * 0.25); const w = Math.max(1, f.bw - gap);
    data.forEach((d, i) => {
      const x = f.L + f.bw * i + gap / 2; const yy = f.y(d.v); const h = f.y(0) - yy;
      const tip = `${esc(f.tipL(d.k))}: <b>${fmt(d.v)}</b> ${label}`;
      if (h > 0) {
        const rr = Math.min(4, w / 2, h);
        s += `<path class="bar" d="M${x},${f.y(0)} V${yy + rr} Q${x},${yy} ${x + rr},${yy} H${x + w - rr} Q${x + w},${yy} ${x + w},${yy + rr} V${f.y(0)} Z"/>`;
      }
      s += `<rect class="hit" x="${f.L + f.bw * i}" y="${f.T}" width="${f.bw}" height="${f.H - f.T - f.B}" data-tip="${tip}"/>`;
    });
    el.innerHTML = s + "</svg>";
  }
  function lineChart(el, data, label) {
    const f = frame(el, data, label);
    if (!f.max) { el.innerHTML = '<div class="empty">Sin datos en este periodo</div>'; return; }
    const x = (i) => f.L + f.bw * i + f.bw / 2;
    const pts = data.map((d, i) => `${x(i).toFixed(1)},${f.y(d.v).toFixed(1)}`);
    let s = f.s;
    if (data.length === 1) s += `<circle class="dot" cx="${x(0)}" cy="${f.y(data[0].v)}" r="5"/>`;
    else s += `<path class="area" d="M${x(0)},${f.y(0)} L${pts.join(" L")} L${x(data.length - 1)},${f.y(0)} Z"/><path class="line" d="M${pts.join(" L")}"/>`;
    s += `<line class="cross js-cross" x1="0" x2="0" y1="${f.T}" y2="${f.y(0)}" visibility="hidden"/><circle class="dot js-cdot" r="5" visibility="hidden"/>`;
    data.forEach((d, i) => { s += `<rect class="hit" x="${f.L + f.bw * i}" y="${f.T}" width="${f.bw}" height="${f.H - f.T - f.B}" data-tip="${esc(f.tipL(d.k))}: <b>${fmt(d.v)}</b> ${label}" data-cx="${x(i)}" data-cy="${f.y(d.v)}"/>`; });
    el.innerHTML = s + "</svg>";
  }

  /* ---------- tooltip compartido ---------- */
  const tip = $(".js-tip");
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) { tip.hidden = true; return; }
    tip.innerHTML = t.getAttribute("data-tip"); tip.hidden = false;
    const svg = t.ownerSVGElement;
    if (svg && t.dataset.cx) {
      const c = $(".js-cross", svg), d = $(".js-cdot", svg);
      c.setAttribute("x1", t.dataset.cx); c.setAttribute("x2", t.dataset.cx); c.setAttribute("visibility", "visible");
      d.setAttribute("cx", t.dataset.cx); d.setAttribute("cy", t.dataset.cy); d.setAttribute("visibility", "visible");
    }
  });
  document.addEventListener("pointermove", (e) => {
    if (tip.hidden) return;
    tip.style.left = Math.min(innerWidth - 90, Math.max(90, e.clientX)) + "px"; tip.style.top = e.clientY + "px";
  });
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest("[data-tip]");
    if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) {
      tip.hidden = true;
      const svg = t.ownerSVGElement;
      if (svg) $$(".js-cross,.js-cdot", svg).forEach((n) => n.setAttribute("visibility", "hidden"));
    }
  });

  /* ---------- Ajustes / exportar ---------- */
  $(".js-notrack").addEventListener("change", (e) => { ls.rawSet("ps_notrack", e.target.checked ? "1" : "0"); toast(e.target.checked ? "Tus visitas no se contarán" : "Tus visitas se contarán"); });
  $(".js-theme").addEventListener("change", (e) => { ls.set("ps_admin_theme", e.target.value); applyTheme(e.target.value); render(); });
  function csv(rows, cols) {
    const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
  }
  function download(name, text) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  $$(".js-export").forEach((b) => b.addEventListener("click", () => download(`clientes-power-solar-${todayKey()}.csv`,
    csv(state.leads.map((l) => Object.assign({}, l, { etapa: stageName(l.etapa) })), ["creado", "nombre", "telefono", "email", "pueblo", "dueno", "factura", "interes", "etapa", "valor", "proximo", "notas", "fuente", "campana"]))));
  $(".js-export-ev").addEventListener("click", () => download(`eventos-power-solar-${todayKey()}.csv`,
    csv(state.events, ["ts", "tipo", "visitante", "sesion", "pagina", "fuente", "dispositivo", "etiqueta", "x", "y", "valor", "ref"])));

  /* ---------- datalist de pueblos ---------- */
  ["Adjuntas","Aguada","Aguadilla","Aguas Buenas","Aibonito","Añasco","Arecibo","Arroyo","Barceloneta","Barranquitas","Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina","Cataño","Cayey","Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado","Fajardo","Florida","Guánica","Guayama","Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros","Humacao","Isabela","Jayuya","Juana Díaz","Juncos","Lajas","Lares","Las Marías","Las Piedras","Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca","Morovis","Naguabo","Naranjito","Orocovis","Patillas","Peñuelas","Ponce","Quebradillas","Rincón","Río Grande","Sabana Grande","Salinas","San Germán","San Juan","San Lorenzo","San Sebastián","Santa Isabel","Toa Alta","Toa Baja","Trujillo Alto","Utuado","Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa","Yauco"]
    .forEach((p) => $("#pueblos-list").appendChild(new Option(p)));

  let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(() => { if (state.view === "resumen" || state.view === "stats") render(); }, 200); });

  /* ---------- arranque: sesión guardada ---------- */
  if (KEY && EP) {
    refresh(true).then((ok) => { if (ok) enterApp(); else { ss.del("ps_admin_key"); } });
  }
})();
