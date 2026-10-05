# Make My Marriage — System Design & Architecture v1.0

**Version:** 1.0  
**Status:** Approved Architecture Baseline  
**Purpose:** V1 personal-wedding release with a clean path toward future commercial scale

---

## Architecture Stack

```text
USER DEVICES
     |
     v
Angular application on Vercel
     | HTTPS / REST
     v
Node.js + Express modular monolith
     |
     +---- MongoDB Atlas
     +---- Cloudflare R2 (images)
     +---- Cloudflare CDN (image delivery)
     +---- Resend (transactional email)
     +---- Google Places API (vendor discovery)
```

| Item | Decision |
|---|---|
| Primary architecture | Modular monolith |
| Frontend | Angular + TypeScript |
| Backend | Node.js + Express |
| Database | MongoDB Atlas / managed cluster |
| Initial hosting | Vercel |
| Media storage | Cloudflare R2 |
| Media delivery | Cloudflare CDN |
| Email | Resend |
| Vendor discovery | Google Places API |
| Guest media | Images only; no processing pipeline |

---

## Document Map

1. Architecture Principles and Scope
2. System Context and Deployment Topology
3. Application Boundaries and Modules
4. Identity, Authentication and Authorization
5. Multi-Tenant Wedding Model
6. MongoDB Data Architecture
7. Public Wedding Website Architecture
8. Invitation and RSVP Flows
9. Gallery, QR Upload and Media Storage
10. Vendor Discovery Integration
11. Email Integration with Resend
12. API Architecture
13. Angular Frontend Architecture
14. Security Architecture
15. Reliability, Observability and Backups
16. Performance and Scalability
17. Environment and CI/CD Plan
18. AWS Migration Strategy
19. Recommended Implementation Order
20. Architecture Decisions and Open Notes
21. Appendices

---

# 1. Architecture Principles and Scope

The architecture follows the approved PRD and the decisions made during system-design discussion. The primary goal is to keep V1 understandable and inexpensive to run while avoiding shortcuts that would make a future SaaS version difficult.

## Core rule

The **Wedding** is the central domain object. Users gain management access through a wedding membership. Public guests interact through controlled public links, not management accounts.

## 1.1 In scope

- Authentication with email and password, including email verification and password reset.
- Admin and Manager roles with configurable Manager permissions.
- Wedding creation, settings, functions, tasks, guests, expenses, vendors and gallery.
- Unique invitation link per family/group; guests do not need full accounts.
- Wedding website automatically created for each wedding with three initial themes.
- Website workflow: edit, save draft, preview, publish.
- Function-specific photo albums plus a general wedding album.
- Guest photo upload through function QR codes and a general gallery QR.
- Images only for guest uploads; original files are stored as uploaded with no image-processing pipeline.
- Nearby vendor discovery using a backend-mediated Google Places API integration.
- External live-stream URL integration.
- Resend for essential transactional emails.

## 1.2 Explicitly out of scope

- Microservices
- Kubernetes
- Redis
- Kafka
- RabbitMQ
- Custom streaming infrastructure
- Video upload processing
- AI assistant
- Chat/social features
- Vendor booking marketplace
- Travel
- Hotels/accommodation
- Transportation
- Full drag-and-drop website builder
- Complex accounting
- Payment processing

## 1.3 Architecture principles

1. Keep one deployable backend and use clear module boundaries internally.
2. Keep public and private access paths separate.
3. Enforce authorization in Node.js; Angular guards are not security boundaries.
4. Use managed services when they remove infrastructure work without constraining the domain design.
5. Store large binary media outside MongoDB.
6. Keep the data model multi-wedding from day one.
7. Avoid duplicate copies of the same wedding facts between management and website data.
8. Prefer simple synchronous application flows unless a real workload requires asynchronous processing.

# 2. System Context and Deployment Topology

The initial deployment uses Vercel for the Angular application and the Node.js API, MongoDB Atlas for persistent data, Cloudflare R2 for photo storage, Cloudflare CDN for media delivery, Resend for email, and Google Places for nearby-vendor discovery.

```text
                            INTERNET
                               |
                 +-------------+-------------+
                 |                           |
             Guests                    Admin / Manager
                 |                           |
                 +-------------+-------------+
                               |
                            Vercel
                     +---------+---------+
                     |                   |
                Angular app        Node.js API
                     |                   |
                     |         +---------+---------+
                     |         |         |         |
                     |       MongoDB    R2      Resend   Google Places
                     |       Atlas      |
                     |                  CDN
                     |                   |
                     +-------------------+
```

## 2.1 V1 deployment topology

| Layer | V1 choice | Responsibility |
|---|---|---|
| Frontend | Vercel | Angular static/client application, routing and public wedding pages. |
| Backend | Vercel Node/Express deployment | REST API, authentication, authorization, domain logic, storage authorization. |
| Database | MongoDB Atlas | Users, weddings, memberships, domain records and media metadata. |
| Object storage | Cloudflare R2 | Original wedding images. |
| CDN | Cloudflare CDN | Fast delivery of stored images. |
| Email | Resend | Verification, password reset and Manager invitation emails. |
| Vendor discovery | Google Places API | Nearby vendor search. |
| Live stream | External provider | Actual video stream; app only stores/displays the link. |

## 2.2 Why modular monolith

The application has one coherent domain and modest initial scale. A modular monolith keeps deployment, debugging and local development simple while still allowing each domain area to have its own controller/service/repository boundaries.

If a module later becomes a scaling bottleneck, it can be extracted without first untangling an unstructured codebase.

# 3. Application Boundaries and Modules

```text
NODE.JS / EXPRESS MODULAR MONOLITH

core/
  auth/
  database/
  storage/
  email/

modules/
  weddings/
  memberships/
  functions/
  tasks/
  guests/
  expenses/
  vendors/
  gallery/
  website/
  public/
  vendor-discovery/
```

| Module | Primary responsibility | Depends on |
|---|---|---|
| Auth | Credentials, verification, sessions/tokens, password reset | User storage, email |
| Weddings | Create/update wedding and core settings | Auth |
| Memberships | Admin/Manager membership and permissions | Auth, Weddings |
| Functions | Wedding functions and schedules | Weddings, Memberships |
| Tasks | Task lifecycle and assignment | Weddings, Memberships |
| Guests | Family/group guest data and optional guest members | Weddings, Memberships |
| Expenses | Budget and expense records | Weddings, Memberships |
| Vendors | Wedding vendor records | Weddings, Memberships |
| Gallery | Albums, media metadata and upload authorization | Weddings, Functions, Memberships, Storage |
| Website | Themes, draft/published configuration and public rendering data | Weddings, Functions, Gallery |
| Public | Public wedding, invitation and guest upload endpoints | Website, Guests, Gallery |
| Vendor discovery | Google Places proxy and result normalization | Weddings, external API |

### Boundary rule

Modules can call shared core infrastructure and other domain services through explicit interfaces. Avoid direct access to another module's database layer when a service boundary can express the dependency.

# 4. Identity, Authentication and Authorization

Authentication answers **who the user is**. Authorization answers **what that user may do in a particular wedding**. These must remain separate in both code and mental model.

```text
REGISTER
  |
  +-- create user
  +-- hash password
  +-- send verification email via Resend
  |
VERIFY EMAIL
  |
LOGIN
  |
  +-- create an opaque browser session
  +-- set a Secure/HttpOnly/SameSite cookie (Secure in production)
  |
REQUEST
  |
  +-- authenticate
  +-- resolve wedding context
  +-- load membership
  +-- evaluate role + permissions
  +-- execute action
```

## 4.1 Roles

| Role | Meaning | Default access model |
|---|---|---|
| Admin | Primary wedding manager | Full wedding management; can manage Managers and website configuration. |
| Manager | Collaborative planner | Access controlled by explicit permissions configured by an Admin. |
| Guest | Public participant | No management account; uses public wedding/invitation/QR flows. |

## 4.2 Membership model

```text
WeddingMembership
  _id
  userId
  weddingId
  role: ADMIN | MANAGER
  permissions: [string]
  isPrimaryAdmin: boolean
  status
  createdAt
```

## 4.3 Authorization sequence

1. Verify the authentication credential/session.
2. Identify the target wedding from route/context.
3. Load the membership for user + wedding.
4. Reject if no active membership exists.
5. Evaluate role/permission for the requested operation.
6. Execute the domain operation.
7. Never rely on hidden Angular buttons as the authorization mechanism.

## 4.4 Primary Admin

The product still exposes only Admin and Manager. Internally, one Admin membership may be marked as the primary Admin so that the system can prevent accidental orphaning of a wedding and define ownership-sensitive operations such as removing the last Admin.

# 5. Multi-Tenant Wedding Model

The application is multi-wedding by design even though V1 will be used for one real wedding. A user may belong to multiple weddings and can hold different roles in different weddings.

```text
User
  |
  +---- WeddingMembership ----> Wedding
                                  |
                                  +--> Functions
                                  +--> Tasks
                                  +--> GuestGroups
                                  +--> Expenses
                                  +--> Vendors
                                  +--> Albums
                                  +--> Website
                                  +--> Invitations
```

## 5.1 Tenant isolation rule

Every wedding-owned resource must be resolved in the context of a wedding and must be authorized against that wedding.

Do not accept a `weddingId` from the browser and assume it is legitimate; the backend must verify membership and resource ownership.

## 5.2 Slugs and identifiers

| Identifier | Purpose | Public? |
|---|---|---|
| MongoDB `_id` | Internal primary identifier | No |
| `weddingId` | Tenant ownership/reference key | No |
| Website slug | Human-friendly public wedding URL | Yes |
| Invitation token | Family/group invitation context | Yes, but unguessable |
| Upload token | Function/general gallery upload context | Yes, but unguessable |

# 6. MongoDB Data Architecture

Major domain objects should be separate collections rather than one giant Wedding document. References such as `weddingId` and membership IDs keep documents focused and enable targeted indexing.

| Collection | Key fields | Notes |
|---|---|---|
| `users` | `_id, email, passwordHash, isEmailVerified, name, createdAt` | Authentication identity. |
| `sessions` | `userId, tokenHash, createdAt, expiresAt` | Revocable server-side login sessions; browser token is HttpOnly cookie. |
| `auth_tokens` | `userId, purpose, tokenHash, expiresAt` | One-time email-verification and password-reset credentials. |
| `weddings` | `_id, names, weddingDate, location, venue, status, slug` | Central tenant object. |
| `wedding_memberships` | `userId, weddingId, role, permissions, isPrimaryAdmin, status` | Authorization boundary. |
| `functions` | `weddingId, name, date, times, venue, status` | Custom wedding events. |
| `tasks` | `weddingId, title, assigneeMembershipId, dueDate, priority, status` | Simple task management. |
| `guest_groups` | `weddingId, groupName, primaryContact, phone, expectedCount, confirmedCount, rsvpStatus` | Family/group invitation unit. |
| `guest_members` | `guestGroupId, name, attendance/notes` | Optional individuals inside a family group. |
| `expenses` | `weddingId, category, amount, paidBy, date, notes` | Simple expense tracker. |
| `budgets` | `weddingId, totalBudget, categoryBudgets` | Optional separate budget config. |
| `vendors` | `weddingId, category, name, contact, cost, advance, notes` | Saved wedding vendors. |
| `websites` | `weddingId, theme, draftConfig, publishedConfig, status` | Website presentation state. |
| `invitations` | `weddingId, guestGroupId, tokenHash, status, createdAt` | Family-level invitation links. |
| `gallery_albums` | `weddingId, functionId?, name, visibility` | Function-specific or general album. |
| `media` | `weddingId, albumId, storageKey, type, size, filename, uploadContext, createdAt` | Photo metadata only; binary stays in R2. |
| `live_streams` | `weddingId, title, url, date, status` | External stream reference. |
| `qr_codes` | `weddingId, type, albumId?, tokenHash, status` | QR target metadata. |

## 6.1 Recommended indexes

- `wedding_memberships`: unique index on `{userId, weddingId}`; index on `{weddingId, role}`.
- `functions`: `{weddingId, date}`.
- `tasks`: `{weddingId, status, dueDate}`.
- `guest_groups`: `{weddingId, rsvpStatus}`; optionally `{weddingId, groupName}`.
- `expenses`: `{weddingId, date, category}`.
- `vendors`: `{weddingId, category}`.
- `media`: `{weddingId, albumId, createdAt}`.
- `websites`: unique index on `{weddingId}`; unique index on public slug if stored separately.
- `invitations` and `qr_codes`: unique index on token hash.

### Do not over-index

V1 should add only indexes that support real access patterns. Revisit indexes after real usage and query analysis.

# 7. Public Wedding Website Architecture

Every wedding gets a public website record and a public URL. The website is rendered by the same Angular application using a theme engine and normalized public wedding data.

```text
/w/{slug}
      |
      v
Public Wedding Route
      |
      v
GET /api/public/weddings/{slug}
      |
      v
Public Wedding View Model
      |
      +---- Website configuration
      +---- Couple/date data
      +---- Published functions
      +---- Venue
      +---- Gallery summary
      +---- Live-stream info
      |
      v
Theme Renderer
  +-- Traditional
  +-- Modern
  +-- Floral
```

## 7.1 Theme architecture

- One renderer/contract shared by all themes.
- Theme controls layout and visual presentation; domain meaning remains common.
- Theme selection is stored in website configuration.
- Adding a future theme should not require a database schema change.

## 7.2 Website state

| State | Purpose |
|---|---|
| Draft | Editable website configuration; not public. |
| Preview | Authenticated preview of draft configuration. |
| Published | Public snapshot/configuration exposed to guests. |

Core wedding facts remain the source of truth. Website-specific state should contain presentation settings such as theme, optional story content, image selections, section visibility and publication state.

Avoid duplicating functions, venue or other operational data when it can be referenced from the wedding domain.

## 7.3 Public website privacy

The public site is link-accessible but intended not to be indexed. Include `noindex/nofollow` behavior and avoid exposing private management fields in the public API payload.

# 8. Invitation and RSVP Architecture

The invitation model is family/group based. A group receives one unique invitation link. The same link can be reopened until an Admin revokes or regenerates it.

```text
Admin creates Guest Group
        |
        v
Create invitation token
        |
        v
/invite/{token}
        |
        +--> public wedding view
        +--> invitation context
        +--> RSVP form
                    |
                    v
             RSVP submission
                    |
                    v
            guest group updated
                    |
                    v
             dashboard counts
```

## 8.1 Token handling

- Generate cryptographically strong random tokens.
- Store a hash of the token when practical so the database does not hold usable bearer secrets.
- Allow explicit revoke/regenerate by Admin.
- Do not use sequential database IDs as public invitation tokens.

## 8.2 RSVP behavior

- Guest sees wedding information and RSVP controls.
- Guest submits status and attendee count for the family/group.
- Backend validates the token, invitation status and expected data shape.
- No management session is created for the guest.
- Updated RSVP data is reflected in the private dashboard.

# 9. Gallery, QR Upload and Media Storage

The V1 media strategy is intentionally simple:

- Images only.
- No processing pipeline.
- Original upload retained.
- Object storage for binary media.
- CDN for delivery.

```text
FUNCTION / GENERAL QR
        |
        v
/upload/{token}
        |
        v
Node validates token + album context
        |
        v
Issue secure upload authorization
        |
        v
Guest uploads directly to R2
        |
        +---- media metadata -> MongoDB
        |
        v
CDN serves stored image
        |
        v
Gallery view
```

## 9.1 Album model

| Album type | Example | QR |
|---|---|---|
| Function album | Haldi | Dedicated Haldi upload QR |
| Function album | Sangeet | Dedicated Sangeet upload QR |
| Function album | Wedding | Dedicated Wedding upload QR |
| General album | Wedding memories | General gallery QR |

## 9.2 Storage responsibilities

| Component | Stores |
|---|---|
| MongoDB | Media metadata, ownership/context, storage keys, timestamps. |
| R2 | Actual image files. |
| CDN | Cached delivery of stored image objects. |
| Node.js | Authorization and metadata orchestration; not the normal image data path. |

## 9.3 Upload controls

- Allow-list image MIME types/extensions.
- Set a maximum image size for public uploads.
- Limit the number of files per upload action.
- Apply rate limiting to public upload endpoints.
- Validate the target wedding/album from the upload token.
- Record upload timestamps for abuse investigation.

### Why no image pipeline

V1 explicitly favors implementation simplicity. Original images are kept as uploaded. If future scale or UX requires transformations, a media-processing service can be introduced behind the storage/media abstraction later.

# 10. Vendor Discovery Integration

Vendor discovery is a lightweight search feature, not a marketplace. The backend should proxy Google Places/Maps calls so API credentials are never exposed in the browser and to provide a place where validation, quota control and normalization can be added.

```text
Angular
  |
  | category + location
  v
GET /api/vendor-discovery
  |
  v
Node VendorDiscoveryService
  |
  v
Google Places API
  |
  v
Normalized results
  |
  v
Angular list
  |
  +--> optional Save to Wedding Vendors
```

Keep provider credentials in server-side environment secrets.

Normalize only the fields the UI needs, such as display name, category, address, rating if provided, and provider place identifier.

Do not replicate Google reviews or provider data into a permanent vendor record unless the user explicitly saves a vendor and the stored fields are appropriate.

Consider short-lived caching later if repeated searches create unnecessary API cost.

# 11. Email Integration with Resend

Resend is the V1 transactional-email provider. Business logic should call an internal `EmailService` rather than importing the Resend SDK in every module.

```text
modules/auth -> EmailService.sendVerification()
modules/auth -> EmailService.sendPasswordReset()
modules/members -> EmailService.sendManagerInvite()
                         |
                         v
                     Resend adapter
                         |
                         v
                     Recipient inbox
```

| Email | Trigger | Required in V1 |
|---|---|---|
| Email verification | New account registration | Yes |
| Password reset | User requests reset | Yes |
| Manager invitation | Admin invites Manager | Yes |
| General reminders/notifications | Future feature | No |

Keep Resend API credentials server-side.

Use a verified sending domain for production.

Keep email templates versioned with the application.

Do not create a general notification subsystem in V1.

A provider adapter makes future email-provider changes localized.

# 12. REST API Architecture

REST is the selected V1 API style. Private routes are wedding-scoped and protected; public routes expose only the data and operations needed for guests.

## Private

```text
/api/auth/*
/api/weddings
/api/weddings/:weddingId/members
/api/weddings/:weddingId/functions
/api/weddings/:weddingId/tasks
/api/weddings/:weddingId/guests
/api/weddings/:weddingId/expenses
/api/weddings/:weddingId/vendors
/api/weddings/:weddingId/gallery
/api/weddings/:weddingId/website
```

## Public

```text
/api/public/weddings/:slug
/api/public/invitations/:token
/api/public/invitations/:token/rsvp
/api/public/uploads/:token
/api/vendor-discovery
```

## 12.1 Request pipeline

```text
HTTP request
  -> security headers / CORS
  -> rate limit (where applicable)
  -> authentication middleware (private routes)
  -> wedding context resolution
  -> authorization
  -> request validation
  -> controller
  -> service
  -> repository / external adapter
  -> response
  -> centralized error handler
```

## 12.2 Response conventions

| Case | HTTP status | Example meaning |
|---|---|---|
| Success read/write | 200 / 201 / 204 | Resource returned/created/updated/deleted. |
| Validation error | 400 | Request shape or values invalid. |
| Unauthorized | 401 | No valid authentication. |
| Forbidden | 403 | Authenticated but not allowed. |
| Not found | 404 | Resource not visible or does not exist. |
| Rate limited | 429 | Public endpoint request limit exceeded. |
| Unexpected failure | 500 | Unhandled server error. |

# 13. Angular Frontend Architecture

Use one Angular application for both private management and public wedding experiences. Routing, services and feature boundaries separate the two experiences without duplicating the frontend project.

```text
src/app/
  core/
    auth/
    guards/
    interceptors/
    api/
    services/

  shared/
    components/
    directives/
    pipes/

  features/
    auth/
    dashboard/
    wedding/
      functions/
      tasks/
      guests/
      expenses/
      vendors/
      gallery/
      members/
      website/
    vendor-discovery/
    public-wedding/
      website/
      invitation/
      rsvp/
      gallery/
      upload/
      live/
```

## 13.1 Route groups

| Route family | Access | Purpose |
|---|---|---|
| `/` | Public | Make My Marriage product marketing landing page. |
| `/app/*` | Authenticated | Private management experience. |
| `/w/:slug` | Public | Wedding website. |
| `/invite/:token` | Public | Family invitation context / RSVP. |
| `/upload/:token` | Public | Function/general gallery photo upload. |
| `/login`, `/register` | Public | Authentication entry points. |

## 13.2 State management

Use simple service-based state and RxJS for V1. Do not introduce a global state-management library solely for convention. Add a heavier state library only when cross-feature state or collaboration complexity justifies it.

# 14. Security Architecture

Security is primarily about enforcing boundaries consistently. The public wedding surface is intentionally link-accessible, so bearer tokens and rate limits deserve particular attention.

| Area | V1 approach |
|---|---|
| Passwords | Strong password hashing; never store plaintext. |
| Authentication | Random opaque session token in an HttpOnly, SameSite cookie; persist only its hash in MongoDB and revoke on logout/password reset. |
| Authorization | Server-enforced membership + role + permission checks. |
| Public tokens | Cryptographically random; avoid sequential IDs; store hashes where practical. |
| Secrets | Environment/secret management; never ship provider secrets to Angular. |
| CORS | Explicitly allow the production frontend origin(s). |
| Headers | Enable common HTTP security headers. |
| Validation | Validate all request bodies, query parameters and path parameters on server. |
| Rate limiting | Apply to authentication, public RSVP, upload and vendor-discovery endpoints. Initial auth limits are per process and should move to shared storage before multi-instance deployment. |
| Uploads | Allow-list types; enforce size/count limits; associate upload with wedding + album context. |
| Privacy | Public APIs return only public fields; management APIs require membership. |
| Deletion | Prefer soft deletion for wedding-level destructive actions; define recovery period. |

### Security invariant

A user who is authenticated but not a member of Wedding B must receive no management access to Wedding B, even if they manually alter a `weddingId` in the browser.

# 15. Reliability, Observability and Backups

V1 observability should be lightweight but intentional. Weddings and their photos can become irreplaceable, so persistence and accidental deletion deserve stronger safeguards than a typical demo application.

## 15.1 Logging

- Structured application logs for errors and important lifecycle events.
- Include request correlation IDs where practical.
- Never log passwords, raw bearer tokens or full invitation/upload secrets.
- Log provider failures from Resend and Google integrations without exposing secrets.

## 15.2 Database backup

Use managed MongoDB backup/restore facilities appropriate to the selected Atlas tier. The application itself should not implement ad hoc database backup scripts for V1.

## 15.3 Media resilience

R2 is the system of record for original images. MongoDB stores their metadata. Avoid deleting an object before the corresponding database record is removed/retired, and implement a safe deletion workflow for Admin actions.

## 15.4 Wedding deletion

```text
Admin requests delete
      |
      v
Mark wedding = DELETED
      |
      +--> remove from normal application queries
      +--> keep recoverable during retention window
      |
      v
Retention expires
      |
      +--> permanent cleanup of DB records + media
```

# 16. Performance and Scalability

## 16.1 V1 performance priorities

- Keep public wedding pages lightweight and mobile-first.
- Load gallery images lazily and paginate/infinite-scroll rather than requesting the entire album.
- Use CDN delivery for media.
- Do not proxy normal image bytes through Node.js.
- Keep dashboard queries targeted; do not retrieve every wedding record on every dashboard request.
- Use database indexes for common wedding-scoped queries.

## 16.2 Expected scale path

```text
V1
  One wedding -> simple Vercel deployment -> managed services

Growth
  More weddings -> add monitoring, caching and database/query tuning

Later scale
  Media volume -> stronger CDN/cache strategy
  API volume -> dedicated Node runtime / containers
  Heavy async workloads -> background worker/queue
  Large tenants -> evaluate dedicated storage/database strategies
```

The architecture is intentionally designed so infrastructure can scale independently from the domain model. We do not need to build the future scaling stack now.

# 17. Environment and CI/CD Plan

| Environment | Purpose | Suggested setup |
|---|---|---|
| Local | Development | Angular dev server + local Node API + development MongoDB/Atlas project + test storage. |
| Preview | Feature/PR validation | Vercel preview deployment with safe test data; separate environment variables. |
| Production V1 | Personal wedding | Vercel production + MongoDB Atlas + R2 + Resend + Google Places. |

## 17.1 Configuration

- Keep provider credentials outside source control.
- Use separate keys/secrets for local/preview/production environments.
- Do not embed Google, Resend, database or storage secrets in Angular bundles.
- Keep public, non-sensitive configuration separate from server secrets.

## 17.2 CI/CD

1. Push code to Git repository.
2. Run lint/type checks/tests.
3. Build Angular and Node artifacts.
4. Deploy preview for branch/PR.
5. Validate smoke flows.
6. Promote to production after approval.

# 18. AWS Migration Strategy

Vercel is the V1 deployment choice. The application should not depend on Vercel-specific domain logic. The future AWS migration is an infrastructure change rather than an application rewrite.

## V1

```text
Angular + Node -> Vercel
MongoDB       -> Atlas
Images        -> R2 + CDN
Email         -> Resend
Google        -> Places API
```

## Future AWS option

```text
Angular       -> S3/CloudFront or container/static hosting
Node          -> ECS/Fargate or EC2 (based on scale/ops needs)
MongoDB       -> Atlas (can remain managed)
Images        -> R2 or S3 + CDN
Email         -> Resend (can remain)
Google        -> Places API (can remain)
```

### Migration principle

Do not migrate to AWS merely for the sake of migration. Move when commercial usage, operational control, workload characteristics or cost justify it.

# 19. Recommended Implementation Order

Implementation should proceed from platform foundations to core domain flows, then public experience and media. Each stage should be testable before moving on.

| Stage | Build | Outcome |
|---|---|---|
| 1 | Repository + environments + Angular/Node skeleton | Running baseline with config handling. |
| 2 | Auth + email verification + password reset | Secure user identity. |
| 3 | Wedding + membership + Admin/Manager permissions | Shared wedding workspace. |
| 4 | Functions + dashboard basics | Core schedule management. |
| 5 | Tasks | Collaboration workflow. |
| 6 | Guest groups + invitations + RSVP | Guest management loop. |
| 7 | Expenses + budgets | Budget loop. |
| 8 | Vendors + vendor discovery | Vendor loop. |
| 9 | Website engine + 3 themes + draft/preview/publish | Public wedding website. |
| 10 | Gallery + albums + QR + direct upload to R2 | Shared photo loop. |
| 11 | Live-stream link + public integration | Complete guest experience. |
| 12 | Security hardening + backups + performance review | V1 production readiness. |

# 20. Architecture Decisions and Open Notes

The following decisions are treated as the baseline unless a concrete implementation issue forces a change.

| Decision | Status | Reason |
|---|---|---|
| Modular monolith | Locked | Simple to build and operate; clear module boundaries preserve future extraction paths. |
| Vercel for V1 | Locked | Low-friction deployment for personal V1; future AWS migration remains possible. |
| MongoDB Atlas | Locked | Managed database and replica/backup capabilities without self-hosted operational burden. |
| R2 + CDN | Locked | Fits image-only storage and avoids putting binary media into MongoDB or Node. |
| No image processing | Locked | Intentional V1 simplification. |
| Admin/Manager roles | Locked | Simple user model with configurable Manager permissions. |
| Family invitation token | Locked | One link per family/group, without forcing individual accounts. |
| Function QR albums | Locked | QR determines target album, reducing guest friction. |
| Resend | Locked | Simple transactional email integration for V1 essentials. |
| Google Places via backend | Locked | Protect credentials and centralize external integration. |
| No notification subsystem | Locked | Avoid complexity until a real reminder/notification requirement exists. |
| Soft delete for weddings | Recommended | Protect against accidental destructive actions. |

## 20.1 Remaining implementation-level choices

- Exact Vercel Node/Express deployment pattern and any runtime constraints encountered during implementation.
- Exact MongoDB Atlas tier and region.
- Exact R2 public/custom-domain/CDN configuration.
- Upload file-size and per-request limits.
- Access-token and refresh-session storage details.
- Exact email templates and sending domain.
- Final Angular styling/component library choice.
- Final website theme visual designs.

### Design handoff

This architecture is intentionally implementation-oriented. The next engineering step is to turn these decisions into a concrete project repository plan, MongoDB schemas, API contracts, route map, authentication sequence, and detailed module interfaces before feature coding begins.

---

# Appendix A — Key Request Flows

## A1. Manager invitation

```text
Admin -> Node API -> create membership invitation -> Resend -> Manager opens link -> register/login -> membership activated -> permissions enforced
```

## A2. Guest RSVP

```text
Guest -> /invite/{token} -> public API resolves invitation -> guest submits RSVP -> backend validates token + group -> update guest group -> dashboard reflects new counts
```

## A3. Function photo upload

```text
Admin creates function -> gallery album created -> function QR generated -> guest scans -> public upload route resolves album -> Node grants secure upload -> browser uploads to R2 -> media metadata recorded -> CDN serves photo
```

## A4. Website publish

```text
Admin edits -> save draft -> preview -> publish -> public route reads published website configuration + public wedding data -> theme renderer generates page
```

## A5. Vendor discovery

```text
Manager selects category/location -> Node validates request -> Google Places call -> normalize results -> display list -> optional save as wedding vendor
```

# Appendix B — Non-Functional Requirements Summary

| Requirement | V1 target |
|---|---|
| Availability | Use managed hosting/services; avoid single self-hosted database dependency. |
| Security | Server-side authorization, secure credential handling, public token protection. |
| Performance | Mobile-first public site, CDN images, lazy-loaded gallery. |
| Scalability | Wedding-scoped data model and modular backend enable gradual growth. |
| Maintainability | Feature/module boundaries, adapter pattern for external providers. |
| Recovery | Managed DB backups, soft-delete approach for weddings, durable object storage. |
| Portability | Avoid deep domain coupling to Vercel or any single vendor. |

---

**END OF SYSTEM DESIGN & ARCHITECTURE v1.0**
