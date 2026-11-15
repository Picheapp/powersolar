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
js/config.js        Dirección de la base de datos del CRM (/api/crm)
js/track.js         Medición de visitas, clics, scroll y secciones
admin.html          Panel admin (CRM Kanban + estadísticas) — js/admin.js, css/admin.css
api/crm.js          Base de datos del CRM (función de Vercel + Vercel Blob privado)
package.json        Dependencia de Vercel Blob
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

### Base de datos (Vercel)

Todo vive en el mismo proyecto de Vercel, sin servicios extra:

- `api/crm.js` es la función que guarda visitas y clientes en **Vercel Blob privado**
  (Vercel → Storage → `powersolar-crm`). Nadie puede leer los datos sin la clave.
- **Clave del panel:** variable `ADMIN_KEY` en Vercel → Settings → Environment Variables.
  Para cambiarla: edita el valor y vuelve a desplegar (Deployments → ⋯ → Redeploy).
- `js/config.js` apunta a `/api/crm`. Si lo dejas vacío, la página deja de medir.
- Para no gastar el límite gratis de Vercel, la página manda **un solo envío por visita**
  (al salir) y el panel junta las visitas de cada día en un solo archivo.
- Revisa el uso en Vercel → Usage → Blob. Si algún día pasa del límite gratis, los
  formularios siguen llegando por email y WhatsApp.

## Después del 30 de noviembre

La cuenta regresiva llega a cero sola. Para una nueva oferta, cambia los textos
de la promoción en `index.html` y la fecha `promoEnds` en `js/main.js`.
