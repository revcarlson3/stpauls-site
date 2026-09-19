# St. Paul's Site

Barebones mobile-first public site foundation with a separately routed editor area.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Native HTML5 drag-and-drop for the editor prototype (no editor dependency yet)
- PostgreSQL + Prisma for the CMS foundation
- NextAuth credentials sessions with role claims
- SMTP-backed member-aware account registration
- Per-user authenticator, email-code, and SMS-code MFA with recovery codes and trusted devices
- Configurable security groups and permissions

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The public site is at `/`; the editor prototype is at `/admin/editor`.

To prepare the CMS database, copy `.env.example` to `.env`, set the required values, then run:

```bash
npm run deployment:check
npm run db:generate
npm run db:push
```

`db:push` is appropriate for this early prototype. Use reviewed Prisma migrations before production data is introduced.

Security groups are stored in `SecurityGroup` and `GroupPermission`. The seed command creates `Visitor`, `Editor`, and `Administrator` groups with explicit permissions:

```bash
npm run groups:seed
```

Users can be assigned to groups from the Users administration screen. Server-side writes use group permission checks rather than trusting client-side switches. The existing `role` field remains for compatibility and session display, but is not used for authorization.

Site Settings includes a Modules block for users with `MANAGE_MODULES`. It stores enabled modules in `SecuritySettings`; enabled modules add admin navigation entries only for authenticated users whose security groups grant the corresponding permission. Membership currently has a protected placeholder route at `/admin/membership`; the other catalog entries are skeletons for future work.

The membership foundation uses separate family and individual records, configurable family roles and member types, soft lifecycle states (`ACTIVE`, `INACTIVE`, `DECEASED`, and `REMOVED`), custom-field definitions, private document metadata, authored notes, and preference-aware membership messaging. Select members in the directory and choose **Message selected** to open the email/SMS composer. Messaging stores an auditable stub until an SMTP or SMS provider adapter is enabled; recipients are checked server-side against their opt-in preferences. After applying the schema, seed the initial reference data with `npm run membership:seed`.

The Membership landing page includes a responsive directory preview with partial first/last-name search, member-type filtering, and selected individual/family details. For local visual data, apply the schema and reference seed, then run `npm run membership:seed-demo`; this creates five clearly fake example families and ten example members and can be run repeatedly without duplicating them.

Login protection limits an account to five failed password attempts within a 15-minute window, followed by a 15-minute temporary lockout. A successful login clears the failed-attempt counter. Password recovery remains available for locked accounts.

Set `NEXTAUTH_SECRET` to a long random value and set `NEXTAUTH_URL` to the deployed HTTPS URL. After adding `passwordHash` or MFA fields to the schema, run `npm run db:push` again. Users must be provisioned through a controlled administrative process; this scaffold intentionally provides no default credentials or public registration.

Registration is now available at `/register`. It is not open until SMTP variables and `CHURCH_REGISTRATION_CODE` are configured. A blank/incorrect code creates an unlinked viewer account; a valid code links an exact, currently unassigned `MemberProfile` match. Verification tokens are stored hashed and expire after 24 hours; the verification link leads to password setup before sign-in is available.

The first administrator can be provisioned once from the runtime terminal without putting credentials in source control:

```bash
USER_EMAIL=admin@example.org USER_NAME="Site Admin" USER_ROLE=admin USER_PASSWORD="use-a-long-temporary-password" npm run user:create
```

On Windows PowerShell, set the variables for the command with `$env:USER_EMAIL=...` syntax. Remove the password from the environment after the command completes. Once signed in, only an administrator can create additional users through `POST /api/users`; public registration is intentionally disabled.

If an administrator cannot sign in, reset the password and clear any temporary lockout from the runtime terminal without using the admin UI:

```bash
USER_EMAIL=admin@example.org USER_PASSWORD="use-a-new-temporary-password" npm run user:reset-password
```

This command uses the configured `DATABASE_URL`, increments the session version, and reports whether the account is active. If it reports no user, the deployed process is connected to a different database than expected.

Available checks:

```bash
npm run lint
npm run build
```

## Current module status

The Events and Scheduling module is functionally complete for the current release scope. It includes event CRUD, recurring events, attendance, reports, dashboards, volunteer groups, rotations, overrides, notifications, tenant-scoped data access, and permission enforcement. Public event registration is intentionally deferred until the public beta.

The current production-hardening baseline includes tenant authorization checks, normalized API authentication/permission responses, private member-document lifecycle controls, media cleanup safeguards, a database-backed `/api/health` readiness endpoint, and a user-safe application error boundary. The full automated suite currently passes 19 test files and 91 tests.

The following items are intentionally deferred:

- Public event registration for the public beta.
- Online giving completion until the provider API keys and webhook configuration are available.
- Member-center scheduling and giving-history integrations until their shared module data is ready.
- Scheduled report delivery until a persistent queue/worker system exists.
- Broad code deduplication and remaining image-rendering lint cleanup until tenant administration is complete.

The next planned implementation scope is tenant administration and tenant-level functionality. Do not commit, push, or deploy local changes unless explicitly requested.

For a Node deployment such as 1Panel, install the supported Node 22 LTS runtime, copy `.env.example` to `.env`, set `DATABASE_URL`, `NEXTAUTH_URL`, and a unique `NEXTAUTH_SECRET` of at least 32 characters, then run `npm install`, `npm run deployment:check`, `npm run db:generate`, and `npm run db:push` when the database schema changes. Run `npm run build` followed by `npm start`. The start script binds Next.js to `0.0.0.0` and honors the `PORT` environment variable (use the same port in the reverse proxy). Configure HTTPS at the reverse proxy and schedule encrypted PostgreSQL backups before accepting production data. Node 25 is not the supported deployment baseline.

Annual grade advancement is safe to run from a host scheduler:

```bash
npm run membership:advance-grades
```

The command records the school year and refuses duplicate runs, so it can be scheduled once near the start of each school year. Scheduled email/SMS delivery still requires a persistent queue worker; do not use a web request or short-lived cron process to send a large audience directly.

To enable Media Library AI image generation, create an API key at Pollinations.AI and set `POLLINATIONS_API_KEY` in the server environment. The default provider endpoint is `https://gen.pollinations.ai/image` and model is `flux`; set `POLLINATIONS_API_URL` or `POLLINATIONS_MODEL` to override them. The key is server-only and must not be prefixed with `NEXT_PUBLIC_`.

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
- Page blocks accept optional menu or menu-location assignments, validated server-side; menus render only in blocks with an explicit assignment.
- `app/api/menus` exposes protected menu listing/creation endpoints; the Prisma menu model supports global menus and per-page assignment through `Page.menuId`, with nested ordered items.
- `app/admin/users` provides protected user administration: administrators can create accounts, search users, update profile credentials, assign security groups, reset passwords, and delete accounts while the server prevents self-deletion or self-group changes.
- `app/admin/editor/editor-canvas.tsx` is a client-side prototype using a responsive 12-column grid. Blocks can be reordered and moved between columns with native drag-and-drop.

The public and admin interfaces share typography, color tokens, buttons, cards, and spacing, while keeping distinct navigation and information architecture.

## Security boundaries

Authentication and authorization use server-side NextAuth credentials sessions, security-group permissions, MFA options, login protection, and protected admin/API boundaries. Never treat client-side controls as authorization; membership, page, menu, media, user, and settings writes enforce permissions on the server.

The database service is server-only. Never expose `DATABASE_URL` or provider credentials to the browser (`NEXT_PUBLIC_` variables are public). Keep `.env` and production secrets outside source control, use HTTPS for the deployed `NEXTAUTH_URL`, and rotate `NEXTAUTH_SECRET` only with a planned session invalidation.

Before accepting production data, verify that PostgreSQL backups can be restored, mail/SMS provider credentials and sender identities are verified, MFA settings are configured for administrators, and the reverse proxy forwards HTTPS and the application port correctly.

## Next steps

- Complete tenant administration, tenant provisioning, module enablement, invitations, and tenant-level platform controls.
- Connect a server-side identity provider so page CRUD and publishing can be used from the admin UI.
- Replace native drag-and-drop with accessible pointer/keyboard interactions if the editor grows.
- Add real preview/publish workflows, autosave, media uploads, and audit history.
- Add unit and end-to-end coverage alongside the persistence/auth implementation.
