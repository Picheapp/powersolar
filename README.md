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
img/                Logo, fotos, favicon, imagen para compartir
video/              Comercial y video del Powerwall 3
```

## 1. Configurar el formulario (5 minutos)

Abre `js/main.js`. Arriba verás:

```js
const CONFIG = {
  whatsapp: "17875252996",
  formEndpoint: "",
  promoEnds: "2026-11-30T23:59:59-04:00",
};
```

- **Sin configurar nada:** cuando alguien llena el formulario, se abre WhatsApp
  con todos sus datos listos para enviarle a Edwin.
- **Para recibir cada cliente por email también:** crea una cuenta gratis en
  https://formspree.io → *New form* → copia el enlace (`https://formspree.io/f/xxxxxxx`)
  y pégalo en `formEndpoint`. Formspree te envía cada formulario al email y
  puedes exportarlos a Excel.

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

## Después del 30 de noviembre

La cuenta regresiva llega a cero sola. Para una nueva oferta, cambia los textos
de la promoción en `index.html` y la fecha `promoEnds` en `js/main.js`.
