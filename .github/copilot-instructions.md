# Copilot Instructions

## Architecture

This is a **vanilla JavaScript** todo app (no framework, no bundler) with Supabase as the backend. The UI language is **Chinese (Simplified)** — all user-facing strings, status values, and error messages must remain in Chinese.

### Frontend (`js/`)

ES modules loaded via `<script type="module">` in `index.html`. Dependencies (Supabase SDK) are imported from `https://esm.sh/` — there is no `package.json` or `node_modules`.

- `config.js` — Supabase URL and anon key. URL is set to `window.location.origin` (same-origin proxy).
- `supabase.js` — initializes and exports the Supabase client singleton.
- `auth.js` — authentication (login, register, password reset) and UI state toggling. Exports `currentUser` getter/setter used by other modules.
- `todos.js` — CRUD operations against the `todos` table, realtime subscription via `postgres_changes`, and DOM rendering. Owns the in-memory `todos` array.
- `dragdrop.js` — drag-and-drop reordering (desktop + touch). Updates `sort_order` in Supabase.
- `imageUpload.js` — image attachment upload to Supabase Storage bucket `todo-images`. Exposes `showImageModal` on `window` for inline `onclick` handlers.
- `app.js` — entry point. Runs `init()`, binds all DOM event listeners.

### Proxy layer

Two proxy implementations exist for routing Supabase API calls through the same origin (needed for China access):

- `functions/[[path]].js` — **Cloudflare Pages Function** (catch-all route). This is the active proxy when deployed to Cloudflare Pages. Selectively forwards only relevant headers to avoid Cloudflare Error 1016.
- `worker/worker.js` — **Cloudflare Worker** (standalone). Alternative deployment option.
- `_routes.json` — tells Cloudflare Pages to route `/auth/*`, `/rest/*`, `/storage/*`, `/realtime/*` through the Pages Function.

### Data model

The `todos` table has columns: `id` (uuid), `user_id` (uuid), `text`, `status` (未开始/进行中/已完成/暂停), `priority` (P0-P3), `sort_order` (integer), `image_url`, `source_text`, `created_at`. All queries are scoped by `user_id`.

## Local development

```bash
# Serve with any static HTTP server (ES modules require HTTP, not file://)
python -m http.server 8080
# or
npx serve .
```

No build step. No install step.

## Testing

### Structural tests (Python)

```bash
python test_refactor.py
python -m unittest test_refactor.TestJSModules                          # single class
python -m unittest test_refactor.TestJSModules.test_app_imports_all_modules  # single test
```

These validate file existence, correct imports/exports, and HTML integrity — not runtime behavior.

### E2E tests (Playwright)

```bash
npm test                            # run all Playwright tests (auto-starts local server)
npx playwright test tests/app.spec.js  # single file
npx playwright test -g "login"      # by test name grep
npm run test:ui                     # interactive UI mode
```

Playwright config is in `playwright.config.js`. Tests live in `tests/`. The web server (`npx serve .`) starts automatically on port 8080.

## Deploying the worker proxy

```bash
cd worker
wrangler deploy
```

## Conventions

- **No build tools or package manager** — do not add `package.json`, webpack, etc.
- **ES module imports** use CDN URLs (e.g., `https://esm.sh/@supabase/supabase-js@2`), not bare specifiers.
- **DOM manipulation is direct** — `getElementById`, `innerHTML`, `addEventListener`. No virtual DOM.
- **Status and priority values are Chinese strings** stored directly in Supabase (e.g., `'未开始'`, `'P0'`).
- **Module boundary**: each `js/` file exports specific functions; `app.js` is the only file that binds DOM events (except `imageUpload.js` which binds its own via `setupImageUploadEvents()`).
- **XSS prevention**: `escapeHtml()` in `todos.js` is used when rendering user-provided text into the DOM.
