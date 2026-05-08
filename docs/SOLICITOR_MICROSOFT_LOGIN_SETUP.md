# Solicitor Microsoft login: what goes where (Supabase + Entra)

This doc is for **administrators** who wire **Microsoft 365** sign-in into the Will Tool. It explains **exactly** which values from **Microsoft Entra (Azure AD)** go into **Supabase**, and what usually breaks when staff see **“Unable to exchange external code”** on phone or Mac.

**This is not something wrong with the staff member’s phone.** If the server rejects the login, every device fails the same way until the configuration is fixed.

---

## 1. Two consoles you use

| Console | Link | What you do there |
|--------|------|-------------------|
| **Supabase** (Will tool project) | [Supabase Dashboard](https://supabase.com/dashboard) → project **Will tool** | Turn on **Azure** provider, paste Client ID + **secret Value**, set tenant URL, configure **Redirect URLs** |
| **Microsoft Entra** | [Entra admin center](https://entra.microsoft.com) → **Identity** → **Applications** → **App registrations** | Create **client secrets**, set **redirect URI** for Supabase callback, **API permissions** + **admin consent** |

Official Supabase reference: [Login with Azure (Microsoft)](https://supabase.com/docs/guides/auth/social-login/auth-azure).

---

## 2. Do not use “Third-Party Auth” for Microsoft login

In Supabase: **Authentication** has a section called **Third-Party Auth** (JWT issuers like Clerk/Auth0).

**Microsoft (Azure) login is not configured there.**

**Correct path in Supabase:**

1. Open your project (e.g. `proyrepqqpzerloyydlk`).
2. **Authentication** → **Sign In / Providers** (or **Providers**).
3. Find **Azure** and open it.

Direct-style URL (your project ref may differ):

`https://supabase.com/dashboard/project/proyrepqqpzerloyydlk/auth/providers?provider=Azure`

---

## 3. The Entra app (“Will Tool Supabase sign-in”)

You should have **one** Entra **App registration** used for staff sign-in (display name might be “Will Tool Supabase sign-in” or similar).

From **Entra** → that app → **Overview**, you need:

| Label in Entra Overview | Example shape | Used for |
|--------------------------|---------------|----------|
| **Application (client) ID** | `036e8cd1-4a49-4f04-8dd5-d22bbd2858c2` | Copy into Supabase **Application (client) ID** |
| **Directory (tenant) ID** | `4a7639e3-abcb-4e0b-be6b-ca8e7af07f5e` | Build Supabase **Azure Tenant URL** (below) |

**Important:** The Client ID must match **exactly**. A single wrong character (e.g. `4104` vs `4f04`) breaks login.

---

## 4. Client secret: Value vs Secret ID (this confuses almost everyone)

In Entra → your app → **Certificates & secrets** → **Client secrets**:

When you click **New client secret**, Microsoft shows **two** things:

| What Microsoft calls it | Looks like | Where it goes |
|-------------------------|------------|---------------|
| **Value** | Long random **string** (often ~40 characters, not formatted as `xxxxxxxx-xxxx-...`) | **Supabase → Azure provider → Secret Value** (the only secret field Supabase needs) |
| **Secret ID** | A **GUID** like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` | **Do not paste into Supabase.** It is only an internal reference. |

Microsoft error **AADSTS7000215** (“invalid client secret”) commonly means Supabase has:

- The **Secret ID** instead of the **Value**, or  
- An **expired** secret’s old Value, or  
- A **typo / truncated** Value.

You **cannot** see the secret **Value** again after you leave the page. If you lost it: create a **new** secret in Entra, copy the **Value** once, paste into Supabase, **Save**.

---

## 5. Exact field map: Entra → Supabase Azure modal

Supabase **Authentication** → **Providers** → **Azure**:

| Supabase field | What to enter |
|----------------|---------------|
| **Azure enabled** | On |
| **Application (client) ID** | Entra **Overview** → **Application (client) ID** (exact copy) |
| **Secret Value** | Entra **Certificates & secrets** → **client secret Value** (not Secret ID), current and not expired |
| **Azure Tenant URL** | `https://login.microsoftonline.com/` followed by Entra **Directory (tenant) ID**. Example:<br>`https://login.microsoftonline.com/4a7639e3-abcb-4e0b-be6b-ca8e7af07f5e` |
| **Callback URL (for OAuth)** | **Read-only.** Supabase shows something like:<br>`https://proyrepqqpzerloyydlk.supabase.co/auth/v1/callback`<br>You **copy this into Entra**, you do **not** invent it. |

Then click **Save** in Supabase.

---

## 6. Exact place in Entra: redirect URI for Supabase

Entra → your app → **Authentication**.

Under **Web** → **Redirect URIs**, you must include **exactly** (replace with your project if different):

```
https://proyrepqqpzerloyydlk.supabase.co/auth/v1/callback
```

Platform should include **Web** (not SPA-only for this brokered flow — see Supabase docs if you only have SPA).

**Save**.

---

## 7. Supabase: allow your live website to receive users after login

**Authentication** → **URL Configuration** → **Redirect URLs**.

Add every URL staff use to open the solicitor login page, including:

```
https://mvp-tool-will-form-generator-chi.vercel.app/celista-login
```

The Will Tool uses **`/celista-login`** for Microsoft’s return redirect (not `/solicitor/login`). If your firm uses a **custom domain**, add that host too, same path:

```
https://will.yourfirm.co.uk/celista-login
```

**Site URL** is often your primary public URL; **Redirect URLs** is the important list for OAuth returns.

---

## 8. API permissions and consent (Entra)

Entra → your app → **API permissions**.

- You need delegated permissions typical for OpenID sign-in (**openid**, **email**, **profile**, **offline_access**, etc.). Match the [Supabase Azure guide](https://supabase.com/docs/guides/auth/social-login/auth-azure).
- Press **Grant admin consent** for your organisation when offered.

Separate **Application** permissions (e.g. **Mail.Send**) are for backend mail functions; they don’t replace the delegated sign-in permissions.

---

## 9. How to prove it works (before telling staff “try again”)

1. Open a **private / incognito** window.  
2. Go to: `https://mvp-tool-will-form-generator-chi.vercel.app/celista-login` (or your real URL).  
3. Sign in with **Microsoft 365** (firm account).  
4. In Supabase → **Logs** → **Auth**, find the attempt time.  
   - **Good:** no `invalid_client` / **7000215**.  
   - **Bad:** still `Invalid client secret` → repeat section 4 (new secret + paste **Value** + Save).

Staff can use **Emergency owner sign-in** on the same page until Microsoft works.

---

## 10. “Clear browser data” in the Will Tool (optional)

On the login page there is **Clear saved browser data & reload sign-in page**. In the solicitor portal menu there is **Clear browser data & reload**.

**What it does:** signs out locally, clears tokens and site storage **on that device**, keeps light/dark theme, reloads `/celista-login`.

**What it does not fix:** wrong or expired **Entra secret** saved in Supabase (section 4). That always needs a dashboard fix first.

---

## 11. Why Mac seemed fine but phone failed

Common explanations:

1. **Different sign-in methods:** Password / emergency sign-in works even when **Microsoft OAuth** is broken.  
2. **Old session on Mac:** Already logged in so no fresh token exchange.  
3. **Same root cause:** once the secret is wrong, **any** browser that completes Microsoft OAuth hits the failure.

Always test Microsoft in **Incognito** after fixing secrets.

---

## 12. Other Entra banners (less common)

If Entra shows a warning like **multitenant apps and unverified publishers**, some users may be blocked until **admin consent** or **publisher verification** is sorted. That is separate from **7000215**, but worth fixing if OAuth works for admins and not all staff.

---

## 13. Quick checklist

- [ ] Supabase Azure provider: Client ID matches Entra Overview **exactly**  
- [ ] Secret in Supabase is **Value**, not Secret ID; not expired  
- [ ] Tenant URL uses correct **Directory (tenant) ID**  
- [ ] Entra Web redirect URI includes **`https://<project-ref>.supabase.co/auth/v1/callback`**  
- [ ] Supabase Redirect URLs include **`https://your-site/celista-login`**  
- [ ] Admin consent granted on Graph permissions  
- [ ] Confirmed via Incognito + Supabase Auth logs  

---

## 14. Links (bookmark these)

| What | URL |
|------|-----|
| Supabase Dashboard | https://supabase.com/dashboard |
| Supabase Azure auth doc | https://supabase.com/docs/guides/auth/social-login/auth-azure |
| Microsoft Entra admin | https://entra.microsoft.com |
| App registrations | https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade |
| Error 7000215 (invalid secret) reference | https://login.microsoftonline.com/error?code=7000215 |

---

*Last aligned with repo behaviour: solicitor login path `SOLICITOR_LOGIN_PATH` = `/celista-login` (see `src/lib/auth.js`).*
