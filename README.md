# St. Paul's Site

Barebones mobile-first public site foundation with a separately routed editor area.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Native HTML5 drag-and-drop for the editor prototype (no editor dependency yet)

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public site is at `/`; the editor prototype is at `/admin/editor`.

Available checks:

```bash
npm run lint
npm run build
```

## Architecture

- `app/(public)` contains the public route boundary and public layout.
- `app/admin` contains the admin route boundary, admin navigation, and editor experience.
- `components/ui` contains shared design-system primitives used by both boundaries.
- `lib/auth.ts` defines the authorization seam and `viewer`/`editor`/`admin` role model.
- `app/admin/editor/editor-canvas.tsx` is a client-side prototype using a responsive 12-column grid. Blocks can be reordered and moved between columns with native drag-and-drop.

The public and admin interfaces share typography, color tokens, buttons, cards, and spacing, while keeping distinct navigation and information architecture.

## Security boundaries

Authentication is intentionally **not implemented**. `lib/auth.ts` exposes `getCurrentUser()` and `requireRole()` as the integration seam for a real server-side session provider. The current placeholder returns no user and `requireRole()` throws when called, so it cannot be mistaken for production authentication. Do not add credentials or treat client-side editor state as authorization.

Before deploying an editor:

1. Add a server-side identity/session provider (for example, an OIDC provider) and implement `getCurrentUser()`.
2. Enforce `requireRole("editor")` or `requireRole("admin")` in every server action/API handler and protect the `/admin` boundary with middleware or server redirects.
3. Validate and sanitize persisted block content on the server, add CSRF/session protections, and audit publishing actions.

## Next steps

- Persist pages, drafts, block schemas, and ordering in a database/CMS.
- Replace native drag-and-drop with accessible pointer/keyboard interactions if the editor grows.
- Add real preview/publish workflows, autosave, media uploads, and audit history.
- Add unit and end-to-end coverage alongside the persistence/auth implementation.
