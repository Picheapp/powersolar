/* ============================================================
   Power Solar — landing de la promoción
   ------------------------------------------------------------
   CONFIGURACIÓN: cambia estos valores y listo.
   ============================================================ */
const CONFIG = {
  // Número de WhatsApp (solo dígitos, con 1 de EE. UU./PR).
  whatsapp: "17875252996",

  // Email que recibe cada cliente CON la foto de su factura (gratis, vía FormSubmit.co).
  // Ej. "edwin@correo.com". La primera vez llega un email de FormSubmit para
  // activar: hay que darle "Activate". Si lo dejas vacío, el formulario envía
  // los datos al WhatsApp de Edwin (la factura se adjunta en el chat).
  leadEmail: "emartell.powersolar1@outlook.com",

  // Fecha y hora en que termina la promoción (hora de Puerto Rico).
  promoEnds: "2026-11-30T23:59:59-04:00",
};

const PUEBLOS = ["Adjuntas","Aguada","Aguadilla","Aguas Buenas","Aibonito","Añasco","Arecibo","Arroyo","Barceloneta","Barranquitas","Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina","Cataño","Cayey","Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado","Fajardo","Florida","Guánica","Guayama","Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros","Humacao","Isabela","Jayuya","Juana Díaz","Juncos","Lajas","Lares","Las Marías","Las Piedras","Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca","Morovis","Naguabo","Naranjito","Orocovis","Patillas","Peñuelas","Ponce","Quebradillas","Rincón","Río Grande","Sabana Grande","Salinas","San Germán","San Juan","San Lorenzo","San Sebastián","Santa Isabel","Toa Alta","Toa Baja","Trujillo Alto","Utuado","Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa","Yauco"];

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ----- Año en el footer ----- */
  $$(".js-year").forEach((el) => (el.textContent = new Date().getFullYear()));

  /* ----- Lista de pueblos ----- */
  $$(".js-pueblos").forEach((sel) => {
    PUEBLOS.forEach((p) => sel.add(new Option(p, p)));
  });

  /* ----- Cuenta regresiva ----- */
  const end = new Date(CONFIG.promoEnds).getTime();
  const pad = (n) => String(n).padStart(2, "0");
  function tick() {
    let diff = Math.max(0, end - Date.now());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const m = Math.floor(diff / 6e4); diff -= m * 6e4;
    const s = Math.floor(diff / 1e3);
    $$(".js-countdown").forEach((box) => {
      box.querySelector('[data-u="d"]').textContent = pad(d);
      box.querySelector('[data-u="h"]').textContent = pad(h);
      box.querySelector('[data-u="m"]').textContent = pad(m);
      box.querySelector('[data-u="s"]').textContent = pad(s);
    });
    const inline = end > Date.now() ? `${d}d ${pad(h)}h ${pad(m)}m` : "finalizada";
    $$(".js-countdown-inline").forEach((el) => (el.textContent = inline));
  }
  tick(); setInterval(tick, 1000);

  /* ----- Calculadora ----- */
  const range = $(".js-pago");
  if (range) {
    const upd = () => {
      const v = +range.value;
      const half = v / 2;
      $(".js-pago-val").textContent = v;
      $(".js-mitad").textContent = Number.isInteger(half) ? half : half.toFixed(2);
      $(".js-ahorro").textContent = Math.round(half * 6).toLocaleString("en-US");
      range.style.setProperty("--p", ((v - range.min) / (range.max - range.min)) * 100 + "%");
    };
    range.addEventListener("input", upd); upd();
  }

  /* ----- Animaciones al hacer scroll ----- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$(".reveal").forEach((el) => io.observe(el));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-in"));
  }

  /* ----- Barra fija en celular: aparece al pasar el hero ----- */
  const bar = $(".mobilebar"); const hero = $(".hero");
  if (bar && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => bar.classList.toggle("is-visible", !e.isIntersecting), { threshold: 0.05 }).observe(hero);
  }

  /* ----- Datos de campaña (UTM) para saber de qué anuncio llega cada cliente ----- */
  const params = new URLSearchParams(location.search);
  const campaign = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "gclid"]
    .filter((k) => params.get(k)).map((k) => `${k}=${params.get(k)}`).join(" | ");

  /* ----- Formulario en 2 pasos ----- */
  const form = $(".js-lead-form");
  if (!form) return;
  const steps = $$(".lead-form__step", form);
  const dots = $$(".steps span", form);
  const show = (i) => {
    steps.forEach((s, k) => s.classList.toggle("is-active", k === i));
    dots.forEach((d, k) => d.classList.toggle("is-on", k <= i));
  };

  $(".js-next", form).addEventListener("click", () => {
    const need = ["dueno", "factura", "interes"];
    const missing = need.filter((n) => !form.querySelector(`input[name="${n}"]:checked`));
    $(".js-err-1", form).textContent = missing.length ? "Selecciona una opción en cada pregunta." : "";
    if (!missing.length) { show(1); setTimeout(() => form.nombre.focus({ preventScroll: true }), 50); track("FormStep2"); }
  });
  $(".js-back", form).addEventListener("click", () => show(0));
  form.addEventListener("change", (e) => { if (e.target.classList) e.target.classList.remove("is-invalid"); });

  // Formato de teléfono (787) 000-0000
  form.telefono.addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
    e.target.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d;
  });

  /* ----- Subir factura ----- */
  const fileIn = $(".js-file", form);
  fileIn.addEventListener("change", () => {
    const f = fileIn.files[0];
    const box = fileIn.closest(".upload__box");
    if (f && f.size > 10 * 1024 * 1024) {
      fileIn.value = ""; box.classList.remove("has-file");
      $(".js-file-text", form).textContent = "El archivo es muy grande (máx. 10 MB)";
      return;
    }
    box.classList.toggle("has-file", !!f);
    $(".js-file-text", form).textContent = f ? `✓ ${f.name}` : "Toca para subir una foto o PDF";
  });

  /* ----- Aviso si escoge solo placas ----- */
  form.addEventListener("change", (e) => {
    if (e.target.name === "interes") $(".js-hint-placas", form).hidden = e.target.value !== "Solo placas solares";
  });

  /* ----- Vista previa editable del mensaje de WhatsApp ----- */
  const waMsg = $(".js-wa-msg", form);
  if (waMsg) {
    const syncWa = () => { $(".js-wa-done", form).href = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(waMsg.value)}`; };
    waMsg.addEventListener("input", syncWa);
  }

  /* ----- Pantalla de éxito ----- */
  function showDone(name, waUrl, msgHtml) {
    steps.forEach((s) => s.classList.remove("is-active"));
    $(".steps", form).hidden = true;
    $(".lead-form__head", form).hidden = true;
    $(".js-done-name", form).textContent = name || "gracias";
    if (waUrl) $(".js-wa-done", form).href = waUrl;
    const m = waUrl && (waUrl.split("?text=")[1] || "");
    if (m) {
      $(".js-wa-msg", form).value = decodeURIComponent(m);
      $(".js-wa-preview", form).hidden = false;
    }
    if (msgHtml) $(".js-done-msg", form).innerHTML = msgHtml;
    $(".lead-form__done", form).hidden = false;
  }
  // Regreso desde FormSubmit (?gracias=1)
  if (params.get("gracias")) {
    let name = "", wa = null; try { name = sessionStorage.getItem("ps_name") || ""; wa = sessionStorage.getItem("ps_wa"); } catch (_) {}
    showDone(name, wa, "Recibimos tu información. Edwin te contactará pronto. Revisa el mensaje y <b>envíaselo por WhatsApp</b> para atenderte más rápido:");
    track("Lead");
    setTimeout(() => $("#formulario").scrollIntoView({ block: "center" }), 300);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $(".js-err-2", form);
    if (form._honey.value) return; // spam
    const bad = [];
    if (form.nombre.value.trim().length < 2) bad.push(form.nombre);
    if (form.telefono.value.replace(/\D/g, "").length !== 10) bad.push(form.telefono);
    if (!form.pueblo.value) bad.push(form.pueblo);
    if (!form.consentimiento.checked) bad.push(form.consentimiento);
    bad.forEach((el) => el.classList.add("is-invalid"));
    if (bad.length) {
      err.textContent = form.telefono.classList.contains("is-invalid") && bad.length === 1
        ? "Escribe un teléfono de 10 dígitos." : "Completa los campos marcados.";
      bad[0].focus(); return;
    }
    err.textContent = "";

    const hasFile = !!(fileIn.files && fileIn.files[0]);
    const data = {
      nombre: form.nombre.value.trim(),
      telefono: form.telefono.value,
      pueblo: form.pueblo.value,
      dueno: form.dueno.value,
      factura: form.factura.value,
      interes: form.interes.value,
    };
    const msg =
      `Hola Edwin, quiero orientación de Power Solar.\n` +
      `• Nombre: ${data.nombre}\n• Teléfono: ${data.telefono}\n• Pueblo: ${data.pueblo}\n` +
      `• Dueño(a) de casa: ${data.dueno}\n• Factura de luz: ${data.factura}\n• Interés: ${data.interes}` +
      (hasFile ? `\n• Te envío la foto de mi factura aquí.` : "");
    const waUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
    const btn = $(".js-submit", form);
    btn.disabled = true; btn.textContent = "Enviando…";
    track("Lead");

    if (CONFIG.leadEmail) {
      // Envío por email con la factura adjunta (FormSubmit.co)
      try { sessionStorage.setItem("ps_name", data.nombre.split(" ")[0]); sessionStorage.setItem("ps_wa", waUrl); } catch (_) {}
      const add = (n, v) => { const i = document.createElement("input"); i.type = "hidden"; i.name = n; i.value = v; form.appendChild(i); };
      add("_subject", `Nuevo cliente Power Solar: ${data.nombre} (${data.pueblo})`);
      add("_template", "table");
      add("_captcha", "false");
      add("_next", `${location.origin}${location.pathname}?gracias=1#formulario`);
      add("campaña", campaign || "directo");
      add("fecha", new Date().toLocaleString("es-PR", { timeZone: "America/Puerto_Rico" }));
      form.action = `https://formsubmit.co/${CONFIG.leadEmail}`;
      form.method = "POST";
      form.enctype = "multipart/form-data";
      HTMLFormElement.prototype.submit.call(form);
      return;
    }

    // Sin email configurado: enviar por WhatsApp
    window.open(waUrl, "_blank", "noopener");
    showDone(data.nombre.split(" ")[0], waUrl, hasFile
      ? "Se abrió WhatsApp con tus datos. <b>Adjunta la foto de tu factura en el chat</b> y envíale el mensaje a Edwin. Si no se abrió, toca aquí:"
      : null);
  });

  /* ----- Medición (Meta Pixel / Google) si los instalas ----- */
  function track(name) {
    try {
      if (window.fbq) window.fbq("track", name === "Lead" ? "Lead" : "CustomizeProduct");
      if (window.gtag) window.gtag("event", name === "Lead" ? "generate_lead" : name);
    } catch (_) {}
  }
})();
