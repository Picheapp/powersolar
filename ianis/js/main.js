/* ============================================================
   Ianis Delimar Martell · Power Solar — landing de la promoción
   CONFIGURACIÓN: cambia estos valores y listo.
   ============================================================ */
const CONFIG = {
  // WhatsApp de Ianis (solo dígitos, con 1 de EE. UU./PR).
  whatsapp: "17873674582",

  // (Opcional) Email que recibe una copia de cada cliente (gratis, vía FormSubmit.co).
  // La primera vez llega un email de FormSubmit para activar: toca "Activate Form".
  // Si se deja vacío, el formulario envía los datos solo por WhatsApp.
  leadEmail: "",

  // Fin de la promoción (hora de Puerto Rico).
  promoEnds: "2026-11-30T23:59:59-04:00",
};

const PUEBLOS = ["Adjuntas","Aguada","Aguadilla","Aguas Buenas","Aibonito","Añasco","Arecibo","Arroyo","Barceloneta","Barranquitas","Bayamón","Cabo Rojo","Caguas","Camuy","Canóvanas","Carolina","Cataño","Cayey","Ceiba","Ciales","Cidra","Coamo","Comerío","Corozal","Culebra","Dorado","Fajardo","Florida","Guánica","Guayama","Guayanilla","Guaynabo","Gurabo","Hatillo","Hormigueros","Humacao","Isabela","Jayuya","Juana Díaz","Juncos","Lajas","Lares","Las Marías","Las Piedras","Loíza","Luquillo","Manatí","Maricao","Maunabo","Mayagüez","Moca","Morovis","Naguabo","Naranjito","Orocovis","Patillas","Peñuelas","Ponce","Quebradillas","Rincón","Río Grande","Sabana Grande","Salinas","San Germán","San Juan","San Lorenzo","San Sebastián","Santa Isabel","Toa Alta","Toa Baja","Trujillo Alto","Utuado","Vega Alta","Vega Baja","Vieques","Villalba","Yabucoa","Yauco"];

(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  $$(".js-year").forEach((el) => (el.textContent = new Date().getFullYear()));
  $$(".js-pueblos").forEach((sel) => PUEBLOS.forEach((p) => sel.add(new Option(p, p))));

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
      const v = +range.value, half = v / 2;
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

  /* ----- Barra fija en celular ----- */
  const bar = $(".mobilebar"), hero = $(".hero");
  if (bar && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => bar.classList.toggle("is-visible", !e.isIntersecting), { threshold: 0.05 }).observe(hero);
  }

  /* ----- Campaña (UTM) ----- */
  const params = new URLSearchParams(location.search);
  const campaign = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "fbclid", "gclid"]
    .filter((k) => params.get(k)).map((k) => `${k}=${params.get(k)}`).join(" | ");

  /* ----- Formulario rápido (1 paso) ----- */
  const form = $(".js-lead-form");
  if (!form) return;
  form.addEventListener("input", (e) => e.target.classList && e.target.classList.remove("is-invalid"));
  form.addEventListener("change", (e) => e.target.classList && e.target.classList.remove("is-invalid"));

  form.telefono.addEventListener("input", (e) => {
    const d = e.target.value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
    e.target.value = d.length > 6 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d.length > 3 ? `(${d.slice(0, 3)}) ${d.slice(3)}` : d;
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (form._honey.value) return; // spam
    const err = $(".js-err", form);
    const bad = [];
    if (form.nombre.value.trim().length < 2) bad.push(form.nombre);
    if (form.telefono.value.replace(/\D/g, "").length !== 10) bad.push(form.telefono);
    if (!form.pueblo.value) bad.push(form.pueblo);
    const facturaSel = form.querySelector('input[name="factura"]:checked');
    if (!form.consentimiento.checked) bad.push(form.consentimiento);
    bad.forEach((el) => el.classList.add("is-invalid"));
    if (bad.length || !facturaSel) {
      err.textContent = !bad.length ? "Selecciona cuánto pagas de luz."
        : bad.length === 1 && bad[0] === form.telefono ? "Escribe un teléfono de 10 dígitos." : "Completa los campos marcados.";
      (bad[0] || form.querySelector('input[name="factura"]')).focus();
      return;
    }
    err.textContent = "";

    const data = {
      nombre: form.nombre.value.trim(),
      telefono: form.telefono.value,
      pueblo: form.pueblo.value,
      factura: facturaSel.value,
    };
    const msg =
      `Hola Ianis, quiero orientación de la promoción de Power Solar.\n` +
      `• Nombre: ${data.nombre}\n• Teléfono: ${data.telefono}\n• Pueblo: ${data.pueblo}\n• Pago de luz: ${data.factura}`;
    const waUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

    // Abrir WhatsApp de inmediato (dentro del clic, para que el navegador no lo bloquee)
    window.open(waUrl, "_blank", "noopener");

    // Copia por email (opcional)
    if (CONFIG.leadEmail) {
      const fd = new FormData();
      Object.entries(data).forEach(([k, v]) => fd.append(k, v));
      fd.append("_subject", `Nuevo cliente (Ianis · Power Solar): ${data.nombre} (${data.pueblo})`);
      fd.append("_template", "table"); fd.append("_captcha", "false");
      fd.append("campaña", campaign || "directo");
      fd.append("fecha", new Date().toLocaleString("es-PR", { timeZone: "America/Puerto_Rico" }));
      fetch(`https://formsubmit.co/ajax/${CONFIG.leadEmail}`, { method: "POST", body: fd, headers: { Accept: "application/json" } }).catch(() => {});
    }

    try {
      if (window.fbq) window.fbq("track", "Lead");
      if (window.gtag) window.gtag("event", "generate_lead");
    } catch (_) {}

    $(".lead-form__step", form).classList.remove("is-active");
    $(".lead-form__head", form).hidden = true;
    $(".js-done-name", form).textContent = data.nombre.split(" ")[0];
    $(".js-wa-done", form).href = waUrl;
    $(".lead-form__done", form).hidden = false;
  });
})();
