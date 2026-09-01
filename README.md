# St. Paul's Site

Barebones mobile-first public site foundation with a separately routed editor area.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Native HTML5 drag-and-drop for the editor prototype (no editor dependency yet)
- PostgreSQL + Prisma for the CMS foundation
- NextAuth credentials sessions with role claims
- SMTP-backed member-aware account registration
- Configurable security groups and permissions

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public site is at `/`; the editor prototype is at `/admin/editor`.

To prepare the CMS database, copy `.env.example` to `.env`, set `DATABASE_URL`, then run:

```bash
npm run db:generate
npm run db:push
```

`db:push` is appropriate for this early prototype. Use reviewed Prisma migrations before production data is introduced.

Security groups are stored in `SecurityGroup` and `GroupPermission`. The seed command creates `Visitor`, `Editor`, and `Administrator` groups with explicit permissions:

```bash
npm run groups:seed
```

Users will be assigned to a group as the administration UI is added. Server-side writes use permission checks rather than trusting client-side switches. The existing `role` field remains during this transition and should not be treated as the long-term permission source.

Set `NEXTAUTH_SECRET` to a long random value and set `NEXTAUTH_URL` to the deployed HTTPS URL. After adding `passwordHash` to the schema, run `npm run db:push` again. Users must be provisioned through a controlled administrative process; this scaffold intentionally provides no default credentials or public registration.

Registration is now available at `/register`. It is not open until SMTP variables and `CHURCH_REGISTRATION_CODE` are configured. A blank/incorrect code creates an unlinked viewer account; a valid code links an exact, currently unassigned `MemberProfile` match. Verification tokens are stored hashed and expire after 24 hours; the verification link leads to password setup before sign-in is available.

The first administrator can be provisioned once from the runtime terminal without putting credentials in source control:

```bash
USER_EMAIL=admin@example.org USER_NAME="Site Admin" USER_ROLE=admin USER_PASSWORD="use-a-long-temporary-password" npm run user:create
```

On Windows PowerShell, set the variables for the command with `$env:USER_EMAIL=...` syntax. Remove the password from the environment after the command completes. Once signed in, only an administrator can create additional users through `POST /api/users`; public registration is intentionally disabled.

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
- `lib/auth-options.ts`, `app/api/auth`, `middleware.ts`, and `app/admin/login` implement the server-side session boundary. Admin routes redirect to sign-in, and page/menu writes still enforce role checks server-side.
- `prisma/schema.prisma` defines PostgreSQL persistence for users, pages, page revisions, menus, and nested menu items.
- `lib/content.ts` provides server-side page/menu CRUD and requires `editor` or `admin` authorization for each operation.
- `lib/blocks.ts` is the shared block catalog for the page builder; it keeps the initial block types and their responsive defaults in one place.
- `lib/site.ts` holds the displayed revision. Every `npm run build` increments its final build component automatically, so a deployed build can be identified from the public header.
- `components/page-renderer.tsx` and `app/(public)/[slug]/page.tsx` provide the first published-page path: only pages with `PUBLISHED` status are rendered publicly, while unknown/unpublished slugs return 404.
- `app/api/pages` exposes protected GET/POST/PATCH endpoints for validated page drafts; unauthenticated requests return `401` until the real session provider is connected.
- Page drafts accept an optional `menuId`, validated server-side so a page can use the global menu by default or an explicitly assigned per-page menu.
- `app/api/menus` exposes protected menu listing/creation endpoints; the Prisma menu model supports global menus and per-page assignment through `Page.menuId`, with nested ordered items.
- `app/admin/editor/editor-canvas.tsx` is a client-side prototype using a responsive 12-column grid. Blocks can be reordered and moved between columns with native drag-and-drop.

The public and admin interfaces share typography, color tokens, buttons, cards, and spacing, while keeping distinct navigation and information architecture.

## Security boundaries

Authentication is intentionally **not implemented**. `lib/auth.ts` exposes `getCurrentUser()` and `requireRole()` as the integration seam for a real server-side session provider. The current placeholder returns no user and `requireRole()` throws when called, so it cannot be mistaken for production authentication. Do not add credentials or treat client-side editor state as authorization.

The database service is server-only. Never expose `DATABASE_URL` to the browser (`NEXT_PUBLIC_` variables are public). The current page/menu service is intentionally unusable until a real authenticated session provider is connected.

Before deploying an editor:

1. Add a server-side identity/session provider (for example, an OIDC provider) and implement `getCurrentUser()`.
2. Enforce `requireRole("editor")` or `requireRole("admin")` in every server action/API handler and protect the `/admin` boundary with middleware or server redirects.
3. Validate and sanitize persisted block content on the server, add CSRF/session protections, and audit publishing actions.

## Next steps

- Connect a server-side identity provider so page CRUD and publishing can be used from the admin UI.
- Replace native drag-and-drop with accessible pointer/keyboard interactions if the editor grows.
- Add real preview/publish workflows, autosave, media uploads, and audit history.
- Add unit and end-to-end coverage alongside the persistence/auth implementation.
