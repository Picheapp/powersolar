/* ============================================================
   Power Solar — rastreo de visitas (páginas vistas, clics,
   scroll, secciones vistas, tiempo en página, videos, formulario).
   Envía a la URL de js/config.js. Sin URL: guarda en este navegador.
   No guarda datos personales: solo un número de visitante al azar.
   ============================================================ */
(() => {
  const CFG = window.PS_CONFIG || {};
  const EP = CFG.crmEndpoint || "";
  const LOCAL_KEY = "ps_local_events";
  if (/^\/?admin/.test(location.pathname.split("/").pop())) return; // no medir el panel

  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const store = (() => { try { return window.localStorage; } catch (_) { return null; } })();
  const sess = (() => { try { return window.sessionStorage; } catch (_) { return null; } })();
  const get = (s, k) => { try { return s && s.getItem(k); } catch (_) { return null; } };
  const set = (s, k, v) => { try { s && s.setItem(k, v); } catch (_) {} };

  if (get(store, "ps_notrack") === "1") { window.PSTrack = { event() {}, lead() { return Promise.resolve(); } }; return; }

  let visitor = get(store, "ps_vid"); if (!visitor) { visitor = rid(); set(store, "ps_vid", visitor); }
  let session = get(sess, "ps_sid"); if (!session) { session = rid(); set(sess, "ps_sid", session); }

  const params = new URLSearchParams(location.search);
  const fuente = (() => {
    const src = params.get("utm_source") || (params.get("fbclid") ? "facebook" : params.get("gclid") ? "google-ads" : "");
    if (src) { const v = [src, params.get("utm_campaign")].filter(Boolean).join(" / "); set(sess, "ps_src", v); return v; }
    const saved = get(sess, "ps_src"); if (saved) return saved;
    let r = ""; try { r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; } catch (_) {}
    const v = !r || r === location.hostname ? "directo"
      : /facebook|fb\.|instagram/.test(r) ? "facebook" : /google/.test(r) ? "google" : /whatsapp|wa\.me/.test(r) ? "whatsapp" : r;
    set(sess, "ps_src", v); return v;
  })();
  const ua = navigator.userAgent;
  const dispositivo = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "celular" : "computadora";
  const pagina = location.pathname.split("/").pop() || "index.html";

  let queue = [];
  function push(tipo, extra = {}) {
    const ev = Object.assign({
      ts: new Date().toISOString(), tipo, visitante: visitor, sesion: session, pagina,
      ref: document.referrer ? document.referrer.slice(0, 200) : "", fuente, dispositivo,
    }, extra);
    queue.push(ev);
    if (!EP) {
      try {
        const arr = JSON.parse(get(store, LOCAL_KEY) || "[]"); arr.push(ev);
        set(store, LOCAL_KEY, JSON.stringify(arr.slice(-3000)));
      } catch (_) {}
    }
    if (queue.length >= 15) flush();
  }
  function flush(beacon) {
    if (!queue.length) return;
    const batch = queue.splice(0, 50);
    if (!EP) return;
    const body = JSON.stringify({ action: "track", events: batch });
    if (beacon && navigator.sendBeacon && navigator.sendBeacon(EP, new Blob([body], { type: "text/plain" }))) return;
    fetch(EP, { method: "POST", body, headers: { "Content-Type": "text/plain;charset=utf-8" }, keepalive: true, mode: "no-cors" }).catch(() => {});
  }
  setInterval(flush, 8000);

  /* Página vista */
  push("pageview", { etiqueta: document.title.slice(0, 120) });

  /* Clics: elemento + posición relativa en la página (para el mapa de calor) */
  const labelOf = (el) => {
    const t = el.closest("a,button,label,summary,input,select,video,[data-track]") || el;
    const name = t.getAttribute("data-track") || t.getAttribute("aria-label") || (t.innerText || t.value || t.alt || "").trim() || t.tagName.toLowerCase();
    const href = t.getAttribute && t.getAttribute("href");
    return (name.replace(/\s+/g, " ").slice(0, 60) + (href && !href.startsWith("#") ? ` → ${href.replace(/\?.*/, "").slice(0, 60)}` : "")).trim();
  };
  document.addEventListener("click", (e) => {
    const de = document.documentElement;
    const x = Math.round((e.pageX / de.scrollWidth) * 1000) / 10;
    const y = Math.round((e.pageY / de.scrollHeight) * 1000) / 10;
    const t = e.target.closest("a,button,summary,label,[data-track]");
    let tipo = "click";
    if (t && t.matches("a[href^='tel:']")) tipo = "llamada";
    else if (t && t.matches("a[href*='wa.me']")) tipo = "whatsapp";
    push(tipo, { etiqueta: labelOf(e.target), x, y });
  }, { capture: true, passive: true });

  /* Scroll: 25 / 50 / 75 / 100 % */
  const marks = [25, 50, 75, 100]; const hit = new Set();
  let maxPct = 0;
  const onScroll = () => {
    const de = document.documentElement;
    const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / de.scrollHeight) * 100));
    maxPct = Math.max(maxPct, pct);
    marks.forEach((m) => { if (pct >= m - 1 && !hit.has(m)) { hit.add(m); push("scroll", { valor: m, etiqueta: `${m}%` }); } });
  };
  addEventListener("scroll", () => requestAnimationFrame(onScroll), { passive: true });

  /* Secciones vistas */
  if ("IntersectionObserver" in window) {
    const seen = new Set();
    const name = (s) => s.id || (s.className.split(" ")[0]) || "seccion";
    const io = new IntersectionObserver((ents) => ents.forEach((en) => {
      if (en.isIntersecting && !seen.has(en.target)) { seen.add(en.target); push("seccion", { etiqueta: name(en.target) }); io.unobserve(en.target); }
    }), { threshold: 0.4 });
    addEventListener("DOMContentLoaded", () => document.querySelectorAll("main section, footer").forEach((s) => io.observe(s)));
  }

  /* Videos */
  document.addEventListener("play", (e) => {
    if (e.target.tagName === "VIDEO") push("video", { etiqueta: (e.target.currentSrc || "").split("/").pop() || "video" });
  }, true);

  /* Formulario: empezó a llenar */
  let started = false;
  document.addEventListener("focusin", (e) => {
    if (!started && e.target.closest && e.target.closest(".js-lead-form")) { started = true; push("form_inicio", { etiqueta: "Empezó el formulario" }); }
  });

  /* Tiempo en página (activo) + salida */
  let active = 0, last = Date.now(), visible = !document.hidden;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (visible) active += Date.now() - last;
      visible = false;
      push("salida", { valor: Math.round(active / 1000), etiqueta: `scroll ${maxPct}%` });
      flush(true);
    } else { visible = true; last = Date.now(); }
  });
  addEventListener("pagehide", () => flush(true));

  /* API pública */
  window.PSTrack = {
    event: (tipo, extra) => push(tipo, extra || {}),
    lead(data) {
      push("lead", { etiqueta: data.interes || "Formulario" });
      flush();
      const lead = Object.assign({}, data, { fuente: "web", campana: fuente, visitante: visitor });
      if (!EP) {
        try {
          const arr = JSON.parse(get(store, "ps_local_leads") || "[]");
          const now = new Date().toISOString();
          arr.push(Object.assign({ id: "L" + rid(), creado: now, actualizado: now, etapa: "nuevo",
            historial: JSON.stringify([{ t: now, a: "Llegó por la web" }]) }, lead));
          set(store, "ps_local_leads", JSON.stringify(arr));
        } catch (_) {}
        return Promise.resolve();
      }
      return fetch(EP, { method: "POST", body: JSON.stringify({ action: "lead", lead }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }, keepalive: true, mode: "no-cors" }).catch(() => {});
    },
  };
})();
