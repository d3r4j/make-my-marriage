# Make My Marriage — Product Requirements Document v1.1

**Product:** Make My Marriage  
**Version:** 1.1 — Revised User Roles  
**Scope:** Wedding Management + Wedding Website + Guest Experience  
**V1 Objective:** Build and use for one real wedding  
**Primary Stack:** Angular + Node.js + MongoDB  
**Core Idea:** One shared digital workspace for the whole wedding

> **Role terminology decision:** V1 uses only two internal management roles — **Admin** and **Manager**. The system does not distinguish bride, groom, parent, sibling, or other family relationships for authorization.

---

## Document Map

1. Product Overview
2. Problem Statement
3. Goals and Non-Goals
4. Users and Roles
5. Core Product Model
6. Functional Requirements
7. Wedding Website Builder
8. Guest Experience and QR
9. Permissions and Access Control
10. Main Screens and User Journeys
11. High-Level Data Model
12. Technical Direction
13. Non-Functional Requirements
14. MVP Priorities
15. Definition of Done
16. Future Expansion

---

# 1. Product Overview

Make My Marriage is a web application for families planning an Indian wedding. It combines private wedding management with a public wedding website that can be shared with guests.

The central object is one **Wedding**. Multiple people can collaborate on that wedding through two simple application roles: **Admin** and **Manager**. Guests do not need a normal application account in V1; they use shareable wedding links and QR flows.

The first release is intentionally simple enough to build and use for one real wedding, while the underlying data model and access boundaries should support future commercial scale.

# 2. Problem Statement

Indian weddings involve multiple functions, many people, vendors, expenses, invitations, and large volumes of photos. Information commonly becomes fragmented across WhatsApp messages, spreadsheets, notes, galleries, and vendor conversations.

Make My Marriage should reduce that fragmentation by giving the planning team one shared workspace and giving guests one clean digital wedding experience.

# 3. Goals and Non-Goals

## Goals

- Collaborative planning for one wedding.
- Simple role-based access using Admin and Manager.
- Centralized functions, tasks, guests, expenses, vendors, gallery, and live-stream information.
- A public wedding website generated from the wedding data.
- A public Make My Marriage product landing page with a clear path to authentication.
- Simple guest-level RSVP without forcing guests to create accounts.
- QR-based guest photo upload.
- Simple nearby vendor discovery using an external places/search API.
- A mobile-friendly experience, especially for guests.
- A scalable multi-wedding foundation for future commercial use.

## Non-Goals for V1

- Hotel/accommodation management
- Travel/transport management
- Professional wedding-planner accounts
- Vendor booking marketplace
- Online vendor payments
- Complex accounting
- Seating planner
- Native mobile apps
- AI wedding assistant
- Full drag-and-drop website builder
- In-app chat/social network

# 4. Users and Roles

To keep the product easy to understand and implement, V1 uses generic role terminology rather than relationship-specific roles.

| Role | Purpose | Typical access |
|---|---|---|
| **Admin** | Primary wedding manager(s). | Full management access to wedding settings and operational data. Can manage Managers and website settings. |
| **Manager** | Collaborative planner. | Can work with day-to-day wedding data such as functions, tasks, guests, expenses, vendors, and gallery according to granted permissions. |
| **Guest** | Public wedding participant. | No full account required. Uses invitation link, RSVP flow, public website, live stream, and photo-upload QR. |

## Admin and Manager model

- A wedding can have one or more Admin users and one or more Managers.
- The relationship between a user and a wedding is represented by a membership record.
- The application should not infer permissions from a person being the bride, groom, parent, or sibling.

**Design rule:** If a real family wants to call the bride an Admin and the bride's sibling a Manager, the system should work exactly the same as if the labels were reversed. Roles describe permissions, not family relationships.

# 5. Core Product Model

The Wedding is the central product entity. Users get access to wedding data through membership in that wedding.

```text
User -> Wedding Membership -> Wedding
Wedding -> Functions / Tasks / Guests / Expenses / Vendors / Gallery / Website / Invitation / Live Stream
Public guests -> controlled links rather than private management APIs
```

# 6. Functional Requirements

## 6.1 Authentication and Accounts

- Register, login, logout, password reset.
- Authenticated management users can access only weddings for which they have membership.
- Users have a basic profile with name and contact information.
- Future versions may add Google login or OTP, but these are not required for V1.

## 6.2 Wedding Creation and Setup

- Create a wedding with couple names, wedding date, and primary location.
- Optional cover image, venue details, description, and contact information.
- Creating a wedding automatically creates its dashboard and public website record.
- A unique public-friendly wedding slug/link is generated.
- A default website theme is assigned until the Admin changes it.

## 6.3 Dashboard

- Show couple names and wedding date.
- Show countdown to the wedding.
- Show upcoming functions.
- Show task summary: pending, completed, overdue.
- Show guest/RSVP summary.
- Show budget, spent, and remaining.
- Show vendor summary.
- Show recent gallery activity.
- Prioritize information that needs attention rather than displaying every possible statistic.

## 6.4 Functions and Schedule

- Users can create custom functions; no culture-specific function is mandatory.
- Fields: function name, date, start time, end time, venue, description, dress code, cover image, status.
- Create, edit, delete, and view functions chronologically.
- Support calendar/timeline presentation.
- Website automatically reflects published function data.

## 6.5 Tasks

- Create, edit, complete, and delete tasks.
- Assign a task to a Manager or Admin.
- Fields: title, description, assignee, due date, priority, status.
- Statuses: To Do, In Progress, Completed.
- Dashboard exposes task counts and overdue items.

## 6.6 Guests and RSVP

- Guests are organized around invitation groups/families rather than requiring an individual invitation for every person.
- Guest group fields: family/group name, primary contact, phone, side, expected attendees, confirmed attendees, RSVP status, functions attending, notes.
- RSVP statuses: Pending, Yes, No, Maybe.
- A public link allows the invitation group to submit RSVP without creating a full account.
- The system should support recording individual attendees within a group when needed, without forcing that model into the invitation experience.

## 6.7 Expenses and Budget

- Set a total wedding budget.
- Record expenses with title, amount, category, paid by, date, and notes.
- Initial categories: venue, food, decoration, photography, clothing, jewelry, music, makeup, invitations, other.
- Calculate total budget, total spent, and remaining budget.
- Show category-level spending.
- Keep this as a simple planning tracker rather than a full accounting system.

## 6.8 Vendors

- Record vendors connected to the wedding.
- Categories may include photographer, decorator, caterer, DJ, makeup artist, mehendi artist, florist, invitation designer, and other.
- Store name, category, phone/email, total cost, advance paid, remaining amount, and notes.
- V1 is management only; no booking or payment marketplace.

## 6.9 Vendor Discovery

Provide a simple nearby-vendor discovery page. The feature is not intended to be a full marketplace in V1.

- Select a vendor category such as Photographer.
- Use the wedding location or a user-entered location as the search area.
- Query a suitable external Google Places/Maps API.
- Display a simple list of nearby results with basic information returned by the provider.
- Allow the user to save a discovered vendor into their wedding vendor list manually if desired.
- The app should not attempt to replicate Google reviews, booking, messaging, or vendor payments.

## 6.10 Photo Gallery

- Wedding gallery with albums, preferably organized by function.
- Family management users can create/manage albums and upload images.
- Guests can upload through a QR-based public flow.
- Gallery access must honor public/private settings.
- V1 prioritizes images; advanced video storage can come later.

## 6.11 Live Stream

- Store a live-stream title, URL, and basic status/date information.
- Public wedding website shows Watch Live when configured.
- V1 uses an external streaming service rather than building custom streaming infrastructure.

# 7. Wedding Website Builder

Every wedding gets a small public website. This is a core part of Make My Marriage, not a separate product.

## 7.1 Website lifecycle

1. Wedding is created.
2. Website record and public slug are created automatically.
3. Admin selects one of three initial themes.
4. Existing wedding data populates the site.
5. Admin previews and publishes the public site.
6. Changes to relevant wedding data appear on the site according to publication rules.

## 7.2 Initial themes

| Theme | Intent |
|---|---|
| Traditional / Royal | Indian wedding-inspired ornamental look with a richer ceremonial feel. |
| Modern Indian | Contemporary, elegant layout with subtle Indian visual elements. |
| Minimal / Floral | Light, photography-focused design with restrained decoration. |

## 7.3 Website sections

- Hero / couple section
- Wedding date
- Couple story (optional)
- Functions and schedule
- Venue and directions
- Digital invitation
- RSVP
- Live stream
- Gallery
- Photo upload / QR access

## 7.4 Customization philosophy

V1 is template-based, not a free-form website builder. Admins can customize supported content such as names, photos, story, event information, venue, invitation text, and selected theme settings. The overall layout remains controlled by the theme system.

**Single source of truth:** The family should not have to enter the same event or venue information separately in the management dashboard and the wedding website.

# 8. Guest Experience and QR

## 8.1 Public wedding link

Each wedding has a shareable URL that guests can open directly from WhatsApp, SMS, email, or a QR code.

## 8.2 Invitation group flow

1. Open wedding link.
2. View wedding invitation and schedule.
3. Select RSVP status.
4. Enter expected attendee count.
5. Submit.
6. Family sees the updated RSVP status in the private dashboard.

## 8.3 Photo-upload QR flow

1. Guest scans the wedding photo-upload QR.
2. A public upload page identifies the wedding context.
3. Guest selects images on their phone.
4. Images are uploaded to the wedding gallery flow.
5. Family can view/manage the resulting media.

# 9. Permissions and Access Control

Roles remain intentionally simple, but authorization must still be enforced on the server.

| Area | Admin | Manager | Guest |
|---|---|---|---|
| Wedding settings | Full | No / limited | No |
| Functions | Manage | Manage | View public |
| Tasks | Manage | Manage | No |
| Guests | Manage | Manage | RSVP through public flow |
| Expenses | Manage | Manage | No |
| Vendors | Manage | Manage | No |
| Vendor discovery | Use | Use | No |
| Gallery management | Manage | Manage | Public view/upload only as allowed |
| Website theme/settings | Manage | No / limited | View published site |
| Members / roles | Manage | No | No |

## Authorization rule

For every private action:

1. Is the user authenticated?
2. Which wedding is the request for?
3. Does the user have membership in that wedding?
4. Is the requested operation allowed by the user's role/permissions?

For public routes:

- Is the requested resource intentionally public?
- Is the public token/slug valid and active?

Never rely on the Angular UI to enforce permissions. The Node/Express API must enforce authorization independently.

# 10. Main Screens and User Journeys

## 10.1 Private screens

- Login / Register / Password reset
- Create Wedding
- Dashboard
- Functions
- Tasks
- Guests
- Expenses / Budget
- Vendors
- Vendor Discovery
- Gallery
- Members
- Website Builder
- Website Preview
- Wedding Settings

## 10.2 Public screens

- Make My Marriage product marketing landing page (`/`)
- Wedding Website
- Invitation / RSVP
- Live Stream
- Gallery
- Photo Upload

## 10.3 Core journey: setup

```text
Register -> Create Wedding -> Initial website created -> Select theme -> Invite Managers -> Add functions -> Set budget -> Start planning from Dashboard
```

## 10.4 Core journey: family collaboration

```text
Admin invites a user as Manager -> user joins wedding -> Manager sees permitted modules -> Manager updates shared wedding data -> Dashboard reflects changes
```

## 10.5 Core journey: guest

```text
Guest receives shared wedding link -> opens website -> views invitation and schedule -> submits RSVP -> later scans photo QR -> uploads photos -> optionally watches live stream
```

# 11. High-Level Data Model

| Entity | Purpose |
|---|---|
| User | Authenticated management user. |
| Wedding | Central wedding record. |
| WeddingMember | Links User to Wedding with role and membership status. |
| Function | Wedding ceremony/event information. |
| Task | Planning work item. |
| GuestGroup | Invitation/RSVP group representing a family/group. |
| GuestMember | Optional individuals inside a GuestGroup. |
| Vendor | Vendor attached to wedding. |
| Expense | Wedding expense record. |
| Budget | Wedding-level budget configuration and limits. |
| Invitation | Public invitation configuration/content. |
| Website | Public wedding website configuration. |
| WebsiteTheme | Theme definitions/settings. |
| GalleryAlbum | Wedding photo album. |
| Media | Uploaded image metadata and storage reference. |
| LiveStream | External streaming link/configuration. |
| QRCode | Generated QR definition and target. |

## 11.1 Relationship model

```text
User -> WeddingMember -> Wedding

Wedding
  -> Functions
  -> Tasks
  -> Guest Groups
  -> Vendors
  -> Budget / Expenses
  -> Website
  -> Gallery
  -> Invitation
  -> Live Stream
  -> QR configurations
```

# 12. Technical Direction

## 12.1 Frontend

- Angular + TypeScript
- Angular Router for private and public route areas
- Reactive Forms for structured input
- RxJS for API and asynchronous state
- Responsive design; public guest pages should be mobile-first

## 12.2 Backend

- Node.js + Express.js
- REST API
- Authentication and authorization middleware
- Wedding-scoped business logic
- Validation and error handling
- Media metadata management

## 12.3 Database

- MongoDB for application data
- Wedding ID must be consistently available for wedding-scoped entities
- Indexes should be planned around wedding-scoped queries and public slug lookups

## 12.4 Storage and external services

- Store image files in object/file storage rather than large blobs inside normal MongoDB documents.
- Use a suitable Google Places/Maps API for nearby vendor discovery.
- Use an external live-stream provider for V1.
- Use a QR-code generation library/service for public QR targets.

# 13. Non-Functional Requirements

## Security

- Wedding data isolation between different weddings.
- Server-side authorization.
- Secure password handling.
- Public links must expose only intended guest-facing data.
- Media access should respect public/private settings.

## Privacy

- Private expenses and internal planning data must not be visible on the public site.
- Public wedding pages should expose only fields selected for guest use.
- The product should eventually support removing or moderating guest-uploaded media.

## Performance

- Optimize public pages for mobile networks.
- Avoid loading the entire gallery at once; use pagination/lazy loading.
- Keep dashboard API payloads focused on information needed for initial rendering.

## Reliability

- Database backups should be part of deployment planning.
- Media should use durable storage.
- Error logging and basic monitoring should be added before real-world use.

## Scalability

The system should treat every wedding as an isolated tenant-like workspace. V1 can be small in infrastructure but should not assume that only one wedding will ever exist.

# 14. MVP Priorities

| Priority | Features |
|---|---|
| **P0 — Core** | Authentication, Wedding creation, Admin/Manager membership, Dashboard, Functions, Tasks, Guests/RSVP, Budget/Expenses, Vendor management, Wedding website, 3 themes, Vendor discovery |
| **P1 — Guest/media** | Gallery, guest photo upload via QR, live stream link, wedding QR, photo-upload QR |
| **P2 — Future** | AI assistant, premium themes, custom domains, vendor marketplace, online payments, advanced analytics, deeper customization |

# 15. Definition of Done

V1 is considered complete when this end-to-end scenario works reliably:

1. An Admin creates a wedding.
2. The system creates the public wedding website and a unique shareable link.
3. The Admin invites one or more Managers.
4. Managers join and collaboratively update permitted wedding data.
5. Functions, tasks, guests, budget, expenses, and vendors can be managed.
6. The Admin selects one of three website themes and publishes the wedding site.
7. A family/group can receive one invitation link and submit an RSVP without creating a full account.
8. Guests can access the public wedding information from the link.
9. Guests can scan a photo QR and upload images.
10. The wedding gallery can display uploaded images.
11. A live-stream link can be shown publicly when configured.
12. Different weddings remain isolated from one another.

# 16. Future Expansion

- Additional cultural/regional website themes
- Premium website themes and branding options
- Custom domains
- Vendor profiles and marketplace
- Online vendor booking/payments
- AI planning assistant
- Advanced invitation customization
- Guest communications/reminders
- Additional media and video capabilities
- Native mobile applications

## Product Principles to Preserve

- One wedding, one shared workspace.
- Admin and Manager are the only management roles in V1.
- Roles describe permissions, not family relationships.
- Guests should be able to participate without creating a full account.
- Wedding data should populate the public website automatically where appropriate.
- Keep V1 simple on the surface, scalable underneath.
- Do not build marketplace or infrastructure-heavy features until the core workflow is proven.

---

**PRD v1.1 — Final Product Baseline**
