# Embedding the Will Tool in WordPress (Elementor)

You can embed the Will Form Generator on a WordPress site that uses Elementor in two ways: **iframe (no plugin)** or **shortcode (with the optional plugin)**.

---

## Where to do this (important)

- **Do not use “Saved Templates.”**  
  If you’re in **Elementor → Editor → Saved Templates**, you’re in the template library (reusable blocks like “Reviews Container,” “IMAGE HERO,” etc.). The Will form needs to go on a **real page** that visitors open (e.g. “Make your Will” or “Will Form”).
- **Use a Page.**  
  Go to **Pages** in the left sidebar, then either create a new page for the Will form or open the existing page where you want it to appear.

---

## Step-by-step: embed on a page

1. **Open the page**
   - In the left sidebar, click **Pages**.
   - Either **Add New** (for a new “Will Form” page) or click the title of the page where the form should appear.

2. **Edit with Elementor**
   - On that page, click **Edit with Elementor** (or the Elementor button).  
   - The Elementor editor opens with the page content (not the Saved Templates list).

3. **Add the embed**
   - In the Elementor **left panel**, find the widget search or the **General** category.
   - Drag one of these onto the page:
     - **HTML** – to paste the iframe code (Option A below), or  
     - **Shortcode** – to type `[will_tool]` if you use the plugin (Option B).
   - Drop it where you want the Will form to show (e.g. below the main heading).

4. **Fill the widget**
   - **If you used HTML:** double‑click the HTML widget, then paste the iframe code from Option A (with your Will Tool URL).
   - **If you used Shortcode:** double‑click the Shortcode widget, then type `[will_tool]` (and make sure the plugin is installed and the URL is set under **Settings → Will Tool Embed**).

5. **Save**
   - Click **Update** (or **Publish** for a new page).  
   - View the page on the front of the site to confirm the form loads.

**Summary:** **Pages** → choose or create page → **Edit with Elementor** → add **HTML** or **Shortcode** widget → paste iframe or `[will_tool]` → **Update**.

---

## Prerequisites

1. **App is deployed**  
   The Will Tool must be hosted and reachable (e.g. Vercel, Netlify). You need its URL, e.g.  
   `https://will-tool.vercel.app` or your custom domain.

2. **Embedding is allowed**  
   This repo’s `vercel.json` sets `Content-Security-Policy: frame-ancestors *` so the app can be embedded in iframes. If you host elsewhere, ensure the response does **not** send `X-Frame-Options: DENY` or `SAMEORIGIN`, or add a CSP that allows your WordPress domain (see “Restrict embedding to your domain” below).

---

## Option A: Embed with Elementor (no plugin)

1. In WordPress, edit the page with **Elementor**.
2. Add a widget:
   - **HTML** (under “General”), or  
   - **Shortcode** (if you use the plugin below).
3. **If using the HTML widget**, paste this and replace the URL with your app URL:

**Important for camera:** The app’s identity verification uses the device camera. For “Take photo” to work inside the iframe, the iframe must grant the camera permission with the `allow="camera"` attribute. The app must be served over **HTTPS** (or localhost).

**Standard (respects column width):**
```html
<iframe
  src="https://YOUR-WILL-TOOL-URL.com/"
  width="100%"
  height="800"
  style="min-height: 80vh; border: none; display: block;"
  title="Will Form Generator"
  allow="camera"
></iframe>
```

**Full-width (edge-to-edge):** wrap in a full-bleed container so the iframe spans the whole viewport even inside a boxed section:
```html
<div class="will-tool-embed-fullwidth" style="width: 100vw; position: relative; left: 50%; right: 50%; margin-left: -50vw; margin-right: -50vw;">
  <iframe
    src="https://YOUR-WILL-TOOL-URL.com/"
    width="100%"
    height="800"
    style="min-height: 80vh; border: none;"
    title="Will Form Generator"
    allow="camera"
  ></iframe>
</div>
```

4. **Elementor full width:** To make the embed full width without the snippet above, set the **section** that contains the widget to full width: click the section (blue outline) → **Layout** (or **Advanced**) → **Content Width** → **Full Width**, and optionally **Stretch section** so it has no side padding.
5. Adjust `height` or `min-height` (e.g. `90vh`) if you want the form taller.
6. **Update** the page.

**Solicitor / staff link:** use the same URL with a query, e.g.  
`https://YOUR-WILL-TOOL-URL.com/?solicitor=1` (if your app supports it).

---

## Option B: Use the shortcode plugin (recommended)

The optional plugin adds a shortcode and a settings page so you set the app URL once and reuse it everywhere.

### Install the plugin

1. In this repo, open the folder **`wordpress-plugin/will-tool-embed`**.
2. Zip that folder so the **root** of the zip is `will-tool-embed` (e.g. `will-tool-embed.zip` containing `will-tool-embed/will-tool-embed.php`, etc.).
3. In WordPress: **Plugins → Add New → Upload Plugin** → choose the zip → **Install Now** → **Activate**.

### Set the app URL

1. Go to **Settings → Will Tool Embed**.
2. Enter the full URL of your Will Tool (e.g. `https://will-tool.vercel.app`).
3. Optionally set the iframe height (default `800` or `80vh`).
4. **Save**.

### Add the shortcode in Elementor

1. Edit the page with Elementor.
2. Add a **Shortcode** widget.
3. In the shortcode field, type: **`[will_tool]`**.
4. **Update** the page.

The shortcode outputs the iframe pointing at the URL you saved. You can use `[will_tool]` on any page or post.

---

## Restrict embedding to your domain (optional)

If you want only your WordPress site to embed the app (e.g. `https://aristonesolicitors.co.uk`):

- **Vercel:** In `vercel.json`, change the header to:
  ```json
  "value": "frame-ancestors 'self' https://aristonesolicitors.co.uk https://www.aristonesolicitors.co.uk"
  ```
- **Other hosts:** Set the same `Content-Security-Policy: frame-ancestors ...` in your host’s headers and avoid sending `X-Frame-Options: DENY` or `SAMEORIGIN` for the app.

---

## Checklist

- [ ] Will Tool is deployed and the URL works in a browser (HTTPS required for camera).
- [ ] `vercel.json` (or your host) allows framing (e.g. `frame-ancestors *` or your WP domain).
- [ ] Iframe includes `allow="camera"` so identity verification “Take photo” works inside the embed.
- [ ] In Elementor: HTML widget with iframe **or** Shortcode widget with `[will_tool]`.
- [ ] Iframe height looks good on mobile and desktop (test at 375px, 768px, 1280px).
