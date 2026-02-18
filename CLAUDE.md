# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vanilla JavaScript todo app with Supabase backend, deployed on Cloudflare Pages. All UI strings are in Chinese (Simplified). No build tools or bundler — ES modules imported directly from CDN (`https://esm.sh/`).

## Commands

```bash
# Local development (HTTP server required for ES modules)
python -m http.server 8080
# or: npx serve .

# Run all tests
python test_refactor.py

# Run a single test class or test
python -m unittest test_refactor.TestJSModules
python -m unittest test_refactor.TestJSModules.test_app_imports_all_modules

# Deploy to Cloudflare Pages (production)
npx wrangler pages deploy . --project-name todo-app-frontend --branch main --commit-dirty=true
```

## Architecture

### Frontend Modules (`js/`)

All modules use ES imports. `app.js` is the entry point that wires everything together.

```
app.js          → entry point, binds DOM events, calls init()
├── auth.js     → login/register/password reset/logout, manages in-memory user state
├── todos.js    → CRUD, realtime subscription (postgres_changes), DOM rendering
├── dragdrop.js → desktop (HTML5 API) + touch drag-and-drop reordering
├── imageUpload.js → image preview + upload to Supabase Storage 'todo-images' bucket
└── supabase.js → singleton client (imports config.js for URL + anon key)
```

`config.js` sets `SUPABASE_URL = window.location.origin` — all API calls go through the same-origin Pages Functions proxy.

### Proxy Layer (China Accessibility)

`pages.dev` is accessible from China; `supabase.co` and `workers.dev` are not. The proxy makes the app work in both regions.

- **Active:** `functions/[[path]].js` — Cloudflare Pages Function catch-all proxy
- **Route config:** `_routes.json` captures `/auth/*`, `/rest/*`, `/storage/*`, `/realtime/*`
- **Legacy:** `worker/worker.js` — standalone Cloudflare Worker (no longer used)

The Pages Function selectively forwards only required headers (`authorization`, `apikey`, `content-type`, etc.) to avoid Cloudflare Error 1016 when proxying to another Cloudflare-fronted domain.

### Data Model — `todos` table

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | gen_random_uuid() |
| user_id | uuid | FK to auth.users, all queries scoped by this |
| text | text | Todo content |
| status | text | 未开始/进行中/已完成/暂停 |
| priority | text | P0/P1/P2/P3 |
| sort_order | integer | Drag-drop ordering |
| image_url | text | Attachment from Storage |
| source_text | text | Optional source attribution |
| created_at | timestamptz | now() |

## Conventions

- No `package.json` or node_modules — CDN imports only
- XSS prevention via `escapeHtml()` in `todos.js` for all user text rendering
- `app.js` centralizes event binding; `imageUpload.js` self-binds its own events
- `window.showImageModal` is exposed globally for inline `onclick` handlers in todo HTML
- Auth flow: `onAuthStateChange` listener routes to login, app, or password reset views
- Realtime: Supabase channel subscription filtered by `user_id`, any change triggers full `loadTodos()`
