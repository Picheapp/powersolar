# Power Solar — Landing de la promoción "Mitad del pago"

Página de ventas para captar clientes de la promoción de noviembre 2026
(Power Solar paga el 50% de la mensualidad del sistema solar con batería por 6 meses).
Es un sitio estático (HTML + CSS + JS): no necesita servidor ni base de datos.

## Archivos

```
index.html          Página principal
privacidad.html     Aviso de privacidad (enlazado desde el formulario)
css/styles.css      Diseño
js/main.js          Formulario, cuenta regresiva, calculadora  ← aquí está la CONFIGURACIÓN
js/config.js        URL de la base de datos del CRM (Google Sheets)
js/track.js         Medición de visitas, clics, scroll y secciones
admin.html          Panel admin (CRM Kanban + estadísticas) — js/admin.js, css/admin.css
backend/            Código para Google Apps Script (base de datos gratis)
img/                Logo, fotos, favicon, imagen para compartir
video/              Comercial y video del Powerwall 3
```

## 1. Configurar el formulario (5 minutos)

Abre `js/main.js`. Arriba verás:

```js
const CONFIG = {
  whatsapp: "17875252996",
  leadEmail: "",
  promoEnds: "2026-11-30T23:59:59-04:00",
};
```

El formulario pregunta si es dueño de la casa, cuánto paga de luz, qué le interesa
(**placas + batería**, **solo placas** u orientación) y deja **subir la foto o PDF de la factura de luz**.

- **Sin configurar nada:** al enviar, se abre WhatsApp con todos los datos listos para Edwin.
  Si el cliente subió su factura, la página le pide adjuntarla en el chat.
- **Para recibir cada cliente por email con la factura adjunta (gratis):** escribe el email en
  `leadEmail` (ej. `"edwin@correo.com"`), sube el cambio y llena el formulario una vez de prueba.
  Llegará un email de **FormSubmit** para activar: toca **Activate Form**. Desde ahí, cada cliente
  llega al email con sus respuestas y la factura adjunta (máximo 10 MB).

## 2. Subir a GitHub y publicar gratis (GitHub Pages)

1. Entra a https://github.com → **New repository** → nombre: `powersolar` → *Public* → **Create**.
2. Toca **uploading an existing file** y arrastra **todo el contenido** de esta carpeta
   (no la carpeta, lo que está adentro: `index.html`, `css`, `js`, `img`, `video`...). **Commit changes**.
3. Ve a **Settings → Pages** → *Source:* `Deploy from a branch` → *Branch:* `main` / `(root)` → **Save**.
4. En 1–2 minutos tu página estará en `https://TU-USUARIO.github.io/powersolar/`.

## 3. Conectar tu dominio

1. Compra el dominio (ej. en Namecheap, GoDaddy, Porkbun o Cloudflare).
2. En GitHub: **Settings → Pages → Custom domain** → escribe tu dominio (ej. `powersolarpr.com`) → **Save**.
   GitHub crea solo el archivo `CNAME`.
3. En el panel DNS de donde compraste el dominio, crea estos récords:

| Tipo  | Nombre | Valor |
|-------|--------|-------|
| A     | @      | 185.199.108.153 |
| A     | @      | 185.199.109.153 |
| A     | @      | 185.199.110.153 |
| A     | @      | 185.199.111.153 |
| CNAME | www    | TU-USUARIO.github.io |

4. Espera a que conecte (de minutos a unas horas) y marca **Enforce HTTPS** en GitHub Pages.
5. Cambia la imagen para compartir en `index.html` a la dirección completa:
   `<meta property="og:image" content="https://TU-DOMINIO.com/img/og-power-solar.jpg">`

## 4. Medir los anuncios (opcional)

- **Meta Pixel (Facebook/Instagram):** pega el código del pixel antes de `</head>` en `index.html`.
  La página ya envía el evento `Lead` cuando alguien completa el formulario.
- **Google Analytics / Ads:** pega la etiqueta `gtag.js` antes de `</head>`. Se envía `generate_lead`.
- Usa enlaces con UTM en tus anuncios (ej. `?utm_source=facebook&utm_campaign=noviembre`):
  el formulario guarda de qué campaña vino cada cliente.

## 5. Panel admin (CRM de clientes + estadísticas)

**Acceso escondido:** en el pie de la página, el puntito **·** justo después de “© 2026 Power Solar”
abre `admin.html` (también puedes entrar directo a `tu-dominio.com/admin.html`). No sale en Google.

Qué tiene:
- **Resumen:** visitas, clientes nuevos, clics a WhatsApp y llamadas, tiempo en página, dinero en proceso y ganado,
  seguimientos vencidos / para hoy.
- **Ventas (Kanban):** columnas *Nuevo → Contactado → Cita/Visita → Propuesta → Ganado / Perdido*.
  Arrastra las tarjetas (en celular: mantén presionado y arrastra, o abre la tarjeta y toca la etapa).
  Cada cliente tiene botones de llamar y WhatsApp, valor estimado, fecha de seguimiento, notas e historial.
- **Clientes:** tabla con búsqueda, orden por columna y **exportar a CSV** (Excel).
- **Estadísticas:** embudo de la página (visita → bajó a la mitad → empezó formulario → paso 2 → envió),
  de dónde llegan (Facebook, Google, WhatsApp, UTM), dispositivos, lo más clicado, hasta dónde bajan (scroll),
  secciones vistas, hora del día, videos reproducidos, pueblos y **mapa de clics**.

### Conectar la base de datos gratis (Google Sheets) — 5 minutos

Hasta que lo conectes, el panel muestra “Falta conectar la base de datos” y la página no mide
nada. Los clientes siguen llegando por email (FormSubmit) y WhatsApp como siempre.

1. Crea una hoja nueva en https://sheets.new (ej. “Power Solar CRM”).
2. Menú **Extensiones → Apps Script**. Borra todo y pega el contenido de `backend/google-apps-script.gs`. Guarda.
3. **Configuración del proyecto** (engranaje) → **Propiedades de la secuencia de comandos** → *Agregar*:
   nombre `ADMIN_KEY`, valor = tu clave secreta (larga). Esa es la clave para entrar al panel.
4. **Implementar → Nueva implementación** → tipo **Aplicación web** →
   *Ejecutar como:* **Yo** · *Quién tiene acceso:* **Cualquier persona** → **Implementar** → autoriza.
5. Copia la URL que termina en `/exec` y pégala en `js/config.js`:
   ```js
   window.PS_CONFIG = { crmEndpoint: "https://script.google.com/macros/s/XXXX/exec" };
   ```
6. Sube el cambio. Listo: cada visita y cada cliente del formulario se guarda en las pestañas
   **Leads** y **Eventos** de tu hoja, y el panel los muestra.

Notas:
- La clave nunca está en el sitio; se valida en Google. Si cambias el código del script, usa
  **Implementar → Administrar implementaciones → Editar → Nueva versión** para que la URL siga igual.
- Al entrar al panel, ese navegador deja de contarse como visita (se puede cambiar en *Ajustes*).
- El rastreo no guarda nombres ni datos personales de los visitantes: solo un número al azar por visitante.

## Después del 30 de noviembre

La cuenta regresiva llega a cero sola. Para una nueva oferta, cambia los textos
de la promoción en `index.html` y la fecha `promoEnds` en `js/main.js`.
