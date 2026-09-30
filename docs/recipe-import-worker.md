# The recipe import worker

"Paste → Website" in the Add Recipe page fills the form from a recipe's web page. A browser isn't
allowed to read another site's pages, so the app asks a small program of ours to fetch the page
for it. That program is a **Cloudflare Worker**: [worker/src/index.ts](../worker/src/index.ts).
It costs nothing on Cloudflare's free plan and needs no server, domain or credit card.

The app works without it. Until the worker is set up (step 4 below), the Paste sheet simply offers
text only.

## What happens when someone pastes an address

1. The app sends the address to the worker, with the person's Firebase sign-in.
2. The worker checks who is asking, fetches the page, and sends back only the recipe data in it:
   the page's JSON-LD blocks (a few kB), or for sites that don't use JSON-LD, the page's markup
   without scripts and styles.
3. The app reads the recipe from that ([src/utils/recipeImport.ts](../src/utils/recipeImport.ts))
   and fills the form. The words are always the site's own. Nothing is saved until the person
   checks it and presses Save.
4. The app asks the worker for the recipe's picture, and compresses it like any other photo.

The recipe is read in this order, stopping at the first that has both ingredients and steps:

| How the site states its recipe                               | Example sites                               | Result                                               |
| ------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| JSON-LD (schema.org Recipe)                                  | BBC Good Food, King Arthur, most food blogs | Read as stated                                       |
| Microdata in the page                                        | Ania Gotuje                                 | Read as stated                                       |
| Neither, but lists under "Składniki" / "Przygotowanie" heads | Kwestia Smaku                               | Read from the headings; the app says to check it     |
| None of these                                                | Moje Wypieki, Smitten Kitchen               | "No recipe could be read", and text paste is offered |

## Setting it up (once, about ten minutes)

1. **Make a Cloudflare account** at <https://dash.cloudflare.com/sign-up>. The free plan is
   enough. Turn on two-step sign-in (My Profile → Authentication): whoever holds this account can
   change the worker.
2. **Tell the worker which Firebase project is ours.** `FIREBASE_PROJECT_ID` in
   [worker/wrangler.toml](../worker/wrangler.toml) is the project ID (Firebase console → Project
   settings → Project ID; the same value as the `VITE_FIREBASE_PROJECT_ID` secret). It isn't a
   secret: it's already in the public app.
3. **Let Cloudflare deploy it from GitHub.** In the Cloudflare dashboard: Workers & Pages →
   Create → import the `fatso33/famkit` repository (authorise Cloudflare's GitHub app for that
   one repository only). The application is named `famkit`, which must match `name` in
   `wrangler.toml`. Then, in the application's Settings → Build:
   - Root directory: `worker`
   - Deploy command: `npx wrangler deploy`
   - Build watch paths: `worker/*`, so pushes that only touch the app don't redeploy it

   Cloudflare then builds and deploys the worker on every push to `main` that changes `worker/`.
   Its address is shown on the application's page, like
   `https://famkit.<your-subdomain>.workers.dev`.

   (Deploying by hand also works, with `npx wrangler deploy` in `worker/` after
   `npx wrangler login`, or with a `CLOUDFLARE_API_TOKEN` made from the "Edit Cloudflare Workers"
   template.)

4. **Tell the app where the worker is.** GitHub → the repo → Settings → Secrets and variables →
   Actions → New repository secret: name `VITE_RECIPE_IMPORT_URL`, value the address from step 3
   (no trailing slash). `deploy.yml` already passes it to the build.
5. **Deploy the app** (push to `main`, or run the workflow by hand). The Paste sheet now shows
   **Website | Text**.
6. **Check the locks** (next section), then try a real recipe on your phone.

A later change to the worker goes live with the push that carries it: Cloudflare's build and the
app's GitHub Pages build start together, and either can finish first. For an app change that
needs a new worker, push the worker change on its own first and wait for Cloudflare's build.

## Checking the locks

Replace the address with yours. Each of these must be refused:

```bash
curl -i -X POST https://famkit.YOUR-SUBDOMAIN.workers.dev/page -H "Content-Type: application/json" -d '{"url":"https://example.com/"}'
```

→ `403 {"error":"forbidden"}`: not called from our app's address.

```bash
curl -i -X POST https://famkit.YOUR-SUBDOMAIN.workers.dev/page -H "Origin: https://fatso33.github.io" -H "Content-Type: application/json" -d '{"url":"https://example.com/"}'
```

→ `401 {"error":"signed-out"}`: no family sign-in.

```bash
curl -i -X POST https://famkit.YOUR-SUBDOMAIN.workers.dev/page -H "Origin: https://fatso33.github.io" -H "Authorization: Bearer made.up.token" -H "Content-Type: application/json" -d '{"url":"https://example.com/"}'
```

→ `401 {"error":"signed-out"}`: a forged sign-in.

## How it's hardened

The danger with a program like this is an **open proxy**: something anyone can use to fetch
anything, from Cloudflare's address, at our expense. Everything below is there to prevent that.

**Who may call it**

- **Family only.** Every request must carry a Firebase sign-in token. The worker verifies Google's
  signature on it (RS256, against Google's published keys), that it was issued for our project,
  that it's in date, and that the email is verified. It then asks Firestore, _as that person_,
  for their `family_members` entry. Our existing security rules answer, so the worker holds no
  database key and no secret at all. Not on the list: `403`.
- **Our app's address only.** Requests from any other site's pages are refused before anything
  runs (`ALLOWED_ORIGINS`). This is a second lock, not the main one: a program that isn't a
  browser can claim any address, which is why the sign-in is the real check.
- **Rate limited.** 20 requests a minute per person (Cloudflare's rate limiter, in
  `wrangler.toml`), and Cloudflare's free plan caps the whole worker at 100,000 requests a day, so
  it can't run up a bill.
- **POST with JSON only, two paths only** (`/page`, `/image`). A request body over 4 kB is refused.

**What it will fetch**

- **Public `https` pages by name only.** No `http`, no odd ports, no IP addresses in any spelling
  (`127.0.0.1`, `2130706433`, `[::1]`), no `localhost`, `.local`, `.internal` and the like, no
  addresses with a username or password in them, and never itself. This stops it being pointed at
  private machines.
- **Redirects are followed by hand**, five at most, and each hop is checked like the first, so a
  page can't bounce the worker somewhere it wouldn't go directly.
- **It sends nothing of ours**: no cookies, no sign-in, no referrer. The sign-in token goes to
  Google and nowhere else.
- **Size and time caps.** Pages up to 3 MB, pictures up to 8 MB, 12 seconds each. A page must be
  HTML. A picture must be JPEG, PNG, WebP, AVIF or GIF: never SVG, which can carry scripts.

**What it sends back, and keeps**

- A page comes back as recipe data only, never as a working web page. Replies are marked
  `no-store` and `nosniff`.
- It stores nothing, and logging is off (`[observability] enabled = false`), so the addresses the
  family imports aren't recorded anywhere.
- Old versions aren't reachable at preview addresses (`preview_urls = false`).

**In the app**

- Everything the worker returns is treated as untrusted: read field by field, and any markup is
  parsed in a detached document that runs and loads nothing, then used only as text. It is never
  put on the page as HTML.
- The picture goes through the same compression as every other photo, which re-draws it, so only
  pixels are kept.

### Two things to leave alone

- **Don't add `http://localhost:3000` to `ALLOWED_ORIGINS`.** Any program on any computer can
  serve a page from localhost. Local development has no Firebase anyway, so it couldn't sign in.
- **Don't add a "skip the sign-in" switch for testing.** The worker's checks are tested without
  one: `src/test/importWorker.test.ts` covers the address rules, the token check and the page
  extraction, and `npx wrangler dev` runs it locally for the refusal checks above.

### What it can't promise

- A family member can use it to fetch any public web page. That's what it's for.
- Some sites refuse automated visitors (Allrecipes and Serious Eats do). The app then says the
  site wouldn't share the page and offers text paste. The worker says honestly what it is
  (`FamilyKitchen/1.0`) rather than pretending to be a browser.
- Sites change. If a site the family uses stops importing, the tests in
  `src/test/recipeImport.test.ts` are the place to add its shape.
