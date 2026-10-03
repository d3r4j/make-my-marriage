# Make My Marriage — Codex Instructions

## Project

Make My Marriage is a wedding-management platform consisting of:

- Angular + TypeScript frontend
- Node.js + Express backend
- MongoDB Atlas
- Cloudflare R2 + CDN for images
- Resend for transactional email
- Google Places API for vendor discovery
- Vercel for initial hosting

The repository is a modular monolith in a single npm-workspaces monorepo.

## Source of Truth

Before making product or architectural decisions, consult the relevant documents:

- `docs/PRD.md` — product requirements
- `docs/SYSTEM_DESIGN.md` — system architecture
- `docs/API_DESIGN.md` — API contracts and endpoint design
- `docs/DATABASE_DESIGN.md` — MongoDB data model

These documents are the primary source of truth.

Do not silently invent, remove, or change product requirements.

If these documents conflict or leave an important architectural/product decision ambiguous, ask the user before proceeding.

## Project Structure

### Frontend

`apps/web` contains the Angular application.

Use:

- `core/` for app-wide infrastructure
- `shared/` for reusable UI and utilities
- `features/` for product capabilities
- public wedding/guest functionality should remain clearly separated from authenticated management functionality

Follow normal Angular conventions.

### Backend

`apps/api` contains the Express modular monolith.

Use:

- `config/` for runtime configuration
- `core/auth/` for authentication infrastructure
- `core/database/` for database infrastructure
- `integrations/` for external provider adapters
- `modules/` for business domains
- `shared/` for cross-cutting technical utilities
- `routes/` for public/private route composition

Keep Mongoose models with their owning domain module.

Do not create a generic global `models/` directory.

Keep public API routes and authenticated management routes clearly separated.

## Architecture Principles

- Keep the backend as a modular monolith.
- Keep business domains under `apps/api/src/modules`.
- Keep external provider SDK details behind integration adapters.
- Prefer simple solutions that satisfy the current requirement.
- Do not introduce abstractions without a meaningful reason.
- Add controller/service/repository/model/schema layers when they provide a useful responsibility; do not create layers mechanically.
- Do not create a `packages/` directory unless there is a demonstrated need for shared code.
- Do not create microservices.

## Security

- Never put secrets in Angular/browser code.
- Never commit real credentials.
- MongoDB, R2, Resend, Google Places and authentication secrets belong only to the backend environment.
- API authorization is the actual security boundary.
- Angular route guards are for navigation/UX, not security.
- Preserve wedding/tenant isolation in every wedding-scoped operation.
- Never log passwords, raw authentication tokens, invitation tokens, or other secrets.
- Validate and authorize requests on the server.

## Approved V1 Scope

Implement only the approved product scope unless the user explicitly approves a change.

Do not introduce:

- microservices
- Kubernetes
- Redis
- Kafka
- RabbitMQ
- complex background-worker infrastructure
- custom streaming infrastructure
- image-processing pipelines
- AI features
- chat/social features
- vendor marketplace
- online vendor payments
- hotels/travel/transportation systems
- complex accounting
- native mobile applications
- drag-and-drop website builder

The V1 product is intentionally a simple, scalable modular monolith.

## Development Workflow

Before significant implementation work:

1. Read the relevant source-of-truth documents.
2. Inspect the existing implementation.
3. Explain important architectural changes before making them.
4. Avoid unrelated refactoring.
5. Preserve existing working behavior.
6. Implement the smallest solution that satisfies the requirement.
7. Run appropriate tests, type checks, and build checks.
8. Report what changed and what checks were run.

Do not rewrite working architecture merely for stylistic preference.

## Coding Style

Follow the existing project conventions.

Use:

- two spaces
- UTF-8
- LF line endings
- final newlines
- Angular conventions for components and tests
- descriptive domain-based names

Use Prettier where configured.

Keep validation, types, and domain-specific logic close to the module that owns them.

## Testing

For Angular changes:

- add tests beside the code they cover
- use `.spec.ts`
- run the appropriate Angular test command

For API changes:

- run TypeScript checks
- run the backend build
- add focused tests when the project's API test infrastructure is established

Do not claim test coverage requirements that have not been defined.

## Git

Do not commit changes unless the user explicitly asks.

Do not push changes unless the user explicitly asks.

Before significant work, inspect the current git status.

After significant work, report the resulting git status and summarize the files changed.

Do not reset, discard, or overwrite unrelated user changes.

## Configuration

Use environment variables for runtime configuration.

Keep:

- `apps/api/.env.example`

updated with required backend environment variable names.

Never commit real credentials.

Never expose backend secrets through Angular environment configuration.

## Communication

When something is ambiguous, ask rather than guessing.

When proposing an architectural change, explain:

- what changes
- why it is needed
- what alternatives were considered
- whether it affects the PRD
- whether it affects the API design
- whether it affects the database design
- whether it affects the system architecture

Do not silently override the approved architecture.