# Make My Marriage — Database Design Document v1.0

**Product:** Make My Marriage  
**Document:** Database Design  
**Version:** 1.0  
**Status:** Draft for implementation review  
**Database:** MongoDB Atlas / managed MongoDB cluster  
**Application architecture:** Modular monolith  
**Related baseline:** Make My Marriage PRD v1.1 + System Design & Architecture v1.0

---

## 1. Purpose

This document defines the MongoDB data model for Make My Marriage V1.

The database must support:

- one wedding being managed collaboratively by multiple users;
- simple `Admin` and `Manager` roles with configurable Manager permissions;
- family/group-based invitations and RSVP;
- custom wedding functions and schedules;
- tasks, expenses, budgets, and vendors;
- nearby vendor discovery through an external provider, without storing provider data as the primary vendor source;
- a template-based wedding website with draft/preview/publish behavior;
- function-specific photo albums and a general album;
- public QR-based image uploads without guest accounts;
- external live-stream links;
- future multi-wedding SaaS scale without redesigning the core model.

The design deliberately avoids over-modeling V1. MongoDB collections are separated around meaningful domain entities rather than screen/page boundaries.

---

## 2. Core Database Principles

### 2.1 Wedding is the central tenant

A wedding is the central domain object. Most business data belongs to exactly one wedding and carries a `weddingId` reference.

```text
User
  |
  +-- WeddingMembership --+
                          |
                       Wedding
                          |
              +-----------+-----------+
              |           |           |
          Functions     Guests      Expenses
              |           |           |
            Tasks      Vendors      Gallery
                          |
                       Website
```

### 2.2 Users and wedding membership are separate

A user is an identity. Access to a wedding is represented by a membership document.

This allows the same account to participate in another wedding in the future without changing the user record.

### 2.3 Keep major entities in separate collections

Avoid one giant `weddings` document containing all functions, expenses, guests, and media. Major collections are independently queryable and indexable.

### 2.4 Store large media outside MongoDB

MongoDB stores image metadata only. Actual images live in Cloudflare R2. The CDN serves the stored images.

### 2.5 Public bearer secrets are stored as hashes

Invitation and QR tokens should be cryptographically random. The database stores a hash of the token rather than the usable token wherever practical.

### 2.6 Domain data is the source of truth

Website records store website presentation/configuration. Core wedding facts such as event date, function information, and venue remain in their domain collections.

### 2.7 Prefer references for major one-to-many relationships

A function, task, expense, vendor, album, and media item should generally reference the wedding rather than being deeply nested in the wedding document.

### 2.8 Timestamps are required

Domain documents should normally include `createdAt` and `updatedAt`. Event/history timestamps may use additional fields where needed.

---

## 3. High-Level Collection Map

| Collection | Purpose | Tenant Key |
|---|---|---|
| `users` | Authentication identity and profile | N/A |
| `weddings` | Central wedding record | `_id` |
| `wedding_memberships` | User access to a wedding | `weddingId` |
| `functions` | Wedding events/functions | `weddingId` |
| `tasks` | Planning tasks | `weddingId` |
| `guest_groups` | Family/group invitation unit | `weddingId` |
| `guest_members` | Optional people inside a guest group | via `guestGroupId` |
| `expenses` | Expense records | `weddingId` |
| `budgets` | Wedding budget configuration | `weddingId` |
| `vendors` | Vendors saved for the wedding | `weddingId` |
| `websites` | Website theme/configuration and publication state | `weddingId` |
| `invitations` | Family/group invitation links | `weddingId` |
| `gallery_albums` | Function-specific/general photo albums | `weddingId` |
| `media` | Image metadata for stored media | `weddingId` |
| `live_streams` | External live-stream references | `weddingId` |
| `qr_codes` | Public QR target metadata | `weddingId` |

---

# 4. Collection Design

## 4.1 `users`

### Purpose

Stores the application's authenticated user identity.

### Suggested document

```js
{
  _id: ObjectId,
  email: String,
  passwordHash: String,
  name: String,
  phone: String | null,
  isEmailVerified: Boolean,
  emailVerifiedAt: Date | null,
  status: "active" | "suspended" | "deleted",
  lastLoginAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### Notes

- Email should be normalized before storage, normally lowercase and trimmed.
- Store only a password hash, never the password itself.
- `status` allows account lifecycle management without immediately destroying identity data.
- A deleted account should not automatically delete wedding data that belongs to the wedding.

### Indexes

```text
UNIQUE: { email: 1 }
{ status: 1 }
```

---

## 4.2 `weddings`

### Purpose

Central record representing a single wedding workspace.

### Suggested document

```js
{
  _id: ObjectId,

  couple: {
    personAName: String,
    personBName: String
  },

  title: String,
  weddingDate: Date,

  location: {
    name: String,
    address: String | null,
    city: String | null,
    state: String | null,
    country: String | null,
    latitude: Number | null,
    longitude: Number | null,
    placeId: String | null
  },

  venue: {
    name: String | null,
    address: String | null,
    latitude: Number | null,
    longitude: Number | null,
    placeId: String | null
  },

  coverImage: {
    mediaId: ObjectId | null
  },

  description: String | null,

  publicSlug: String,
  status: "draft" | "active" | "archived" | "deleted",

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date | null
}
```

### Notes

- `publicSlug` is used for the public wedding website route.
- Slug must be unique globally.
- Public slug is not a security credential; public/private access is determined by route and resource settings.
- `deletedAt` supports soft deletion.

### Indexes

```text
UNIQUE: { publicSlug: 1 }
{ status: 1 }
{ weddingDate: 1 }
```

---

## 4.3 `wedding_memberships`

### Purpose

Defines which users can manage a wedding and what they are allowed to do.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,
  userId: ObjectId,

  role: "ADMIN" | "MANAGER",

  permissions: {
    functions: { read: Boolean, write: Boolean },
    tasks: { read: Boolean, write: Boolean },
    guests: { read: Boolean, write: Boolean },
    expenses: { read: Boolean, write: Boolean },
    vendors: { read: Boolean, write: Boolean },
    gallery: { read: Boolean, write: Boolean },
    website: { read: Boolean, write: Boolean }
  },

  isPrimaryAdmin: Boolean,
  status: "invited" | "active" | "revoked",

  invitedBy: ObjectId | null,
  invitedAt: Date,
  joinedAt: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

### Key rules

1. There must be at least one active Admin for an active wedding.
2. Only one membership should normally have `isPrimaryAdmin: true` for a wedding.
3. A primary Admin cannot remove themselves unless another Admin takes ownership first.
4. Admin permissions are effectively full access; stored Manager permissions are the explicit permission set used by authorization.
5. A membership with `status: "invited"` does not grant management access until accepted/activated.

### Indexes

```text
UNIQUE: { userId: 1, weddingId: 1 }
{ weddingId: 1, role: 1, status: 1 }
{ userId: 1, status: 1 }
{ weddingId: 1, isPrimaryAdmin: 1 }
```

---

## 4.4 `functions`

### Purpose

Stores every wedding function/event, including custom cultural events.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  name: String,
  description: String | null,

  startAt: Date,
  endAt: Date | null,

  venue: {
    name: String | null,
    address: String | null,
    latitude: Number | null,
    longitude: Number | null,
    placeId: String | null
  },

  dressCode: String | null,
  coverMediaId: ObjectId | null,

  status: "planned" | "confirmed" | "completed" | "cancelled",

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Design notes

- Use one event date/time representation consistently in the application layer. UTC storage with explicit timezone conversion is recommended.
- `startAt` is required; `endAt` may be optional.
- Functions are not culture-specific in the schema.

### Indexes

```text
{ weddingId: 1, startAt: 1 }
{ weddingId: 1, status: 1, startAt: 1 }
```

---

## 4.5 `tasks`

### Purpose

Stores planning tasks assigned to Admins or Managers.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  title: String,
  description: String | null,

  assigneeMembershipId: ObjectId | null,

  dueDate: Date | null,
  priority: "LOW" | "MEDIUM" | "HIGH",
  status: "TODO" | "IN_PROGRESS" | "COMPLETED",

  completedAt: Date | null,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Referential rule

`assigneeMembershipId` must belong to the same `weddingId` as the task.

### Indexes

```text
{ weddingId: 1, status: 1, dueDate: 1 }
{ weddingId: 1, assigneeMembershipId: 1, status: 1 }
```

---

## 4.6 `guest_groups`

### Purpose

Represents one invited family/group. This is the primary invitation and RSVP unit.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  groupName: String,
  primaryContact: {
    name: String,
    phone: String,
    email: String | null
  },

  side: "SIDE_A" | "SIDE_B" | "BOTH" | "OTHER" | null,

  expectedCount: Number,
  confirmedCount: Number,

  rsvpStatus: "PENDING" | "YES" | "NO" | "MAYBE",
  rsvpSubmittedAt: Date | null,

  functionsAttending: [ObjectId],

  notes: String | null,

  createdAt: Date,
  updatedAt: Date
}
```

### Design notes

- Invitation is family/group-level even though the database can hold individual members.
- `functionsAttending` references `functions._id` and must only include functions in the same wedding.
- `confirmedCount` is derived from the latest RSVP submission and may be maintained as a denormalized value for fast dashboard queries.

### Indexes

```text
{ weddingId: 1, rsvpStatus: 1 }
{ weddingId: 1, groupName: 1 }
{ weddingId: 1, "primaryContact.phone": 1 }
```

---

## 4.7 `guest_members`

### Purpose

Optional individual people inside a family/group.

This collection exists because the invitation remains family-based, but the family may still want to record individual names.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestGroupId: ObjectId,

  name: String,
  ageCategory: "ADULT" | "CHILD" | null,
  attendanceStatus: "UNKNOWN" | "ATTENDING" | "NOT_ATTENDING",
  notes: String | null,

  createdAt: Date,
  updatedAt: Date
}
```

### Why keep `weddingId` here too?

Although `guestGroupId` already identifies the wedding indirectly, storing `weddingId` makes tenant-scoped queries and authorization simpler and provides an additional consistency check.

### Indexes

```text
{ weddingId: 1, guestGroupId: 1 }
{ weddingId: 1, name: 1 }
```

---

## 4.8 `expenses`

### Purpose

Stores individual wedding expenses.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  title: String,
  amount: Decimal128,
  category: String,

  paidBy: {
    type: "USER" | "OTHER",
    userId: ObjectId | null,
    name: String | null
  },

  expenseDate: Date,
  notes: String | null,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Amount handling

Use MongoDB `Decimal128` for money values instead of floating-point numbers. The application should still validate that the amount is positive and uses an appropriate precision/scale policy.

### Categories

Initial application categories:

```text
VENUE
FOOD
DECORATION
PHOTOGRAPHY
CLOTHING
JEWELRY
MUSIC
MAKEUP
INVITATIONS
OTHER
```

Category values should be represented by stable backend identifiers, even if the UI displays human-friendly names.

### Indexes

```text
{ weddingId: 1, expenseDate: -1 }
{ weddingId: 1, category: 1, expenseDate: -1 }
{ weddingId: 1, "paidBy.userId": 1, expenseDate: -1 }
```

---

## 4.9 `budgets`

### Purpose

Stores total wedding budget and optional category allocations.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  totalBudget: Decimal128,

  categoryBudgets: [
    {
      category: String,
      amount: Decimal128
    }
  ],

  createdAt: Date,
  updatedAt: Date
}
```

### Constraint

V1 assumes one budget configuration per wedding.

### Index

```text
UNIQUE: { weddingId: 1 }
```

### Calculations

`totalSpent` and `remainingBudget` should normally be computed from expenses rather than stored as independently editable values. If later denormalized counters are introduced for performance, they must be maintained transactionally or through an explicitly reliable update strategy.

---

## 4.10 `vendors`

### Purpose

Stores vendors that the family has saved for the wedding.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  category: String,
  name: String,

  contact: {
    phone: String | null,
    email: String | null,
    address: String | null,
    website: String | null
  },

  placeReference: {
    provider: "GOOGLE" | null,
    placeId: String | null
  },

  cost: Decimal128 | null,
  advancePaid: Decimal128 | null,
  notes: String | null,

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Important distinction

A Google Places search result is **not** automatically a wedding vendor record. A vendor becomes part of the wedding only when the user explicitly saves/adds it.

### Indexes

```text
{ weddingId: 1, category: 1 }
{ weddingId: 1, name: 1 }
{ weddingId: 1, "placeReference.placeId": 1 }
```

---

## 4.11 `websites`

### Purpose

Stores wedding website configuration, theme selection, draft state, and published state.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  theme: "TRADITIONAL" | "MODERN" | "FLORAL",

  draftConfig: {
    story: String | null,
    heroMediaId: ObjectId | null,
    sectionVisibility: {
      story: Boolean,
      events: Boolean,
      venue: Boolean,
      invitation: Boolean,
      rsvp: Boolean,
      gallery: Boolean,
      liveStream: Boolean
    },
    invitationText: String | null
  },

  publishedConfig: {
    story: String | null,
    heroMediaId: ObjectId | null,
    sectionVisibility: {
      story: Boolean,
      events: Boolean,
      venue: Boolean,
      invitation: Boolean,
      rsvp: Boolean,
      gallery: Boolean,
      liveStream: Boolean
    },
    invitationText: String | null,
    publishedAt: Date | null
  },

  status: "DRAFT" | "PUBLISHED",

  createdAt: Date,
  updatedAt: Date
}
```

### Index

```text
UNIQUE: { weddingId: 1 }
```

### Design rule

Do not copy core wedding facts such as function names, event dates, or venue details into the website document unless there is a specific snapshot requirement. The website renderer should obtain those values from the wedding domain.

---

## 4.12 `invitations`

### Purpose

Represents one unique family/group invitation link.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,
  guestGroupId: ObjectId,

  tokenHash: String,
  tokenVersion: Number,

  status: "ACTIVE" | "REVOKED",

  createdBy: ObjectId,
  createdAt: Date,
  revokedAt: Date | null,
  regeneratedAt: Date | null,

  lastAccessedAt: Date | null
}
```

### Rules

- One active invitation should normally exist per guest group.
- Regenerating a token revokes the previous one.
- The raw token is returned only at creation/regeneration time and is not stored in plaintext.
- The token is a bearer credential for guest actions such as RSVP; it must never create a management session.

### Indexes

```text
UNIQUE: { tokenHash: 1 }
{ weddingId: 1, guestGroupId: 1, status: 1 }
{ weddingId: 1, status: 1 }
```

---

## 4.13 `gallery_albums`

### Purpose

Stores wedding photo albums.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  functionId: ObjectId | null,
  type: "FUNCTION" | "GENERAL",

  name: String,
  description: String | null,

  visibility: "PUBLIC" | "LINK_ONLY" | "PRIVATE",
  status: "ACTIVE" | "ARCHIVED",

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Rules

- Function albums have a non-null `functionId` belonging to the same wedding.
- General album has `type: "GENERAL"` and `functionId: null`.
- Multiple custom albums can be supported later, but V1 can expose one main album per function plus one general album.

### Indexes

```text
{ weddingId: 1, type: 1 }
{ weddingId: 1, functionId: 1 }
{ weddingId: 1, visibility: 1, status: 1 }
```

---

## 4.14 `media`

### Purpose

Stores metadata for image files stored in Cloudflare R2.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,
  albumId: ObjectId,
  functionId: ObjectId | null,

  storage: {
    provider: "R2",
    bucket: String,
    objectKey: String
  },

  originalFile: {
    filename: String,
    contentType: String,
    sizeBytes: Number
  },

  uploadedBy: {
    type: "ADMIN" | "MANAGER" | "GUEST",
    userId: ObjectId | null,
    invitationId: ObjectId | null,
    qrCodeId: ObjectId | null
  },

  uploadContext: {
    source: "MANAGEMENT" | "FUNCTION_QR" | "GENERAL_QR",
    functionId: ObjectId | null
  },

  status: "ACTIVE" | "DELETED",

  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date | null
}
```

### Important storage rule

The actual image bytes are **not** stored in MongoDB.

```text
MongoDB
  -> metadata

R2
  -> actual image

CDN
  -> image delivery
```

### Function-specific rule

If upload source is `FUNCTION_QR`, `albumId` and `functionId` must point to the function-specific album established by the QR token.

### Indexes

```text
{ weddingId: 1, albumId: 1, createdAt: -1 }
{ weddingId: 1, functionId: 1, createdAt: -1 }
{ weddingId: 1, status: 1, createdAt: -1 }
{ "storage.objectKey": 1 }
```

---

## 4.15 `live_streams`

### Purpose

Stores an external live-stream reference.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  title: String,
  url: String,
  startAt: Date | null,
  endAt: Date | null,
  status: "SCHEDULED" | "LIVE" | "ENDED" | "HIDDEN",

  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Index

```text
{ weddingId: 1, startAt: 1 }
```

V1 should normally have only one active/featured live-stream reference at a time unless product requirements change.

---

## 4.16 `qr_codes`

### Purpose

Stores public QR targets such as function-specific photo-upload links and the general gallery-upload link.

### Suggested document

```js
{
  _id: ObjectId,
  weddingId: ObjectId,

  type: "FUNCTION_UPLOAD" | "GENERAL_UPLOAD" | "WEDDING_WEBSITE",
  functionId: ObjectId | null,
  albumId: ObjectId | null,

  tokenHash: String,

  status: "ACTIVE" | "REVOKED",

  createdBy: ObjectId,
  createdAt: Date,
  revokedAt: Date | null
}
```

### Rules

- Function upload QR must reference a function album in the same wedding.
- General upload QR references the general album.
- Wedding website QR may reference the wedding but does not need an album.
- Raw tokens should not be stored.

### Indexes

```text
UNIQUE: { tokenHash: 1 }
{ weddingId: 1, type: 1, status: 1 }
{ weddingId: 1, functionId: 1, type: 1 }
```

---

# 5. Relationship Model

```text
users
  |
  | 1-to-many
  v
wedding_memberships
  |
  | many-to-1
  v
weddings
  |
  +--------------------+----------------+----------------+
  |                    |                |                |
  v                    v                v                v
functions           tasks         guest_groups        expenses
  |                    |                |
  |                    |                v
  |                    |          guest_members
  |
  v
 gallery_albums
  |
  v
 media

weddings
  |
  +---- vendors
  +---- budgets
  +---- websites
  +---- invitations
  +---- live_streams
  +---- qr_codes
```

---

# 6. Key Referential Rules

MongoDB does not provide relational foreign-key enforcement in the same way a relational database does, so the application service layer must enforce cross-document consistency.

## 6.1 Wedding ownership

Every wedding-owned document must reference an existing wedding.

## 6.2 Membership ownership

A membership's `userId` and `weddingId` must refer to valid records.

## 6.3 Task assignee

The assignee membership must belong to the task's wedding.

## 6.4 Guest functions

Functions listed under a guest group must belong to the same wedding.

## 6.5 Guest members

`guest_members.guestGroupId` must belong to the same wedding as `guest_members.weddingId`.

## 6.6 Vendor provider references

A Google `placeId` is only an external reference. It is never a substitute for the internal vendor `_id`.

## 6.7 Gallery

Album, function and media documents must all resolve to the same wedding context.

## 6.8 Website

A website document must belong to exactly one wedding.

## 6.9 Invitation

An invitation token must resolve to exactly one guest group and exactly one wedding.

## 6.10 QR token

A QR token must resolve to a target belonging to exactly one wedding.

---

# 7. Indexing Strategy

Indexes should support the most common access patterns, not every possible query.

## 7.1 Critical indexes

```text
users
  UNIQUE email

weddings
  UNIQUE publicSlug

wedding_memberships
  UNIQUE (userId, weddingId)
  (weddingId, role, status)

functions
  (weddingId, startAt)

tasks
  (weddingId, status, dueDate)

guest_groups
  (weddingId, rsvpStatus)

expenses
  (weddingId, expenseDate)

vendors
  (weddingId, category)

websites
  UNIQUE weddingId

invitations
  UNIQUE tokenHash
  (weddingId, guestGroupId, status)

gallery_albums
  (weddingId, functionId)

media
  (weddingId, albumId, createdAt)

qr_codes
  UNIQUE tokenHash
```

## 7.2 Avoid premature indexing

Do not add indexes merely because a field exists. Every additional index increases write overhead and storage usage. New indexes should correspond to a known query pattern or observed performance need.

---

# 8. Data Validation Rules

Validation should happen in the Node.js service layer and, where supported, at the MongoDB schema/ODM layer.

## 8.1 Common validation

- Required identifiers must be valid ObjectIds when using ObjectIds.
- Strings should have explicit maximum lengths.
- Dates must be valid.
- Enum values must come from approved backend enums.
- Amounts must be non-negative where appropriate and positive for expenses.
- Public slugs must be normalized and unique.
- Email addresses should be normalized.

## 8.2 Money

Use `Decimal128` for monetary amounts.

Do not use JavaScript binary floating-point values as the persisted source of monetary truth.

## 8.3 Upload metadata

The upload endpoint must validate:

- allowed MIME type;
- maximum file size;
- wedding/album context;
- valid upload token;
- active album;
- upload rate/limits.

## 8.4 Public tokens

Tokens must be:

- cryptographically random;
- sufficiently long;
- non-sequential;
- stored as hashes when persisted.

---

# 9. Denormalization Strategy

MongoDB supports denormalization, but V1 should use it selectively.

## Good candidates

### `guest_groups.confirmedCount`

Useful for fast dashboard counts. It can be updated when RSVP changes.

### `media.functionId`

Redundant with `albumId`, but useful because function-scoped gallery queries are frequent.

### `uploadedBy` context on media

Useful for audit/debugging without joining invitation/QR records for every gallery request.

## Avoid unnecessary denormalization

Do not duplicate:

- wedding date into every function unless needed;
- function names into media records as text;
- venue into website config when it already belongs to the wedding/function;
- guest group name into invitation documents;
- vendor details from Google Places as the canonical external copy.

The default principle is:

> **Duplicate for a measured read-performance reason, not merely for convenience.**

---

# 10. Transactions and Consistency

MongoDB transactions should be used only where multiple related writes must succeed or fail together.

## Transaction candidates

### Wedding creation

```text
Create wedding
Create initial Admin membership
Create website record
Create budget record (if initialized)
```

These can be done in one transaction so that a wedding is not left half-created.

### Manager invitation acceptance

Where appropriate, activation of the membership and invitation state should be consistent.

### Website publish

Updating publication state/configuration should be done atomically enough that the public website never observes a partially written published configuration.

### Invitation regeneration

Revoking the old invitation and activating a new one should be handled consistently.

### QR regeneration/revocation

The old token should be revoked before/with creation of the replacement.

---

# 11. Soft Deletion Strategy

Hard deletion should not be the default for important wedding data.

### Wedding

```text
status = "deleted"
deletedAt = timestamp
```

### Media

```text
status = "DELETED"
deletedAt = timestamp
```

### Membership

Use membership status such as `revoked` rather than immediately removing the record when an audit trail is useful.

### Public behavior

Soft-deleted weddings must immediately stop serving public content and must not be accessible through normal authenticated management routes.

Permanent purge can be introduced later as an administrative maintenance process.

---

# 12. Public Data Boundary

The public wedding website must not expose complete internal documents.

The backend should construct a dedicated **Public Wedding View Model**.

Example:

```js
{
  slug,
  couple,
  weddingDate,
  location,
  venue,
  publishedWebsiteConfig,
  publishedFunctions,
  publicGallerySummary,
  publicLiveStream
}
```

It must not include:

```text
private expenses
internal member permissions
Manager list
private guest contact information
invitation token hashes
QR token hashes
internal storage credentials
```

This is an API/data-model rule, not only a frontend rendering rule.

---

# 13. Invitation and RSVP Data Flow

```text
Admin creates Guest Group
        |
        v
Create Invitation
        |
        v
Generate raw token
        |
        +--> return/share link
        |
        v
Store tokenHash

Guest opens /invite/{token}
        |
        v
Hash submitted token
        |
        v
Find active invitation
        |
        v
Resolve guestGroup + wedding
        |
        v
Display public wedding
        |
        v
Guest submits RSVP
        |
        v
Validate status/count
        |
        v
Update guest group
        |
        v
Dashboard reads updated RSVP data
```

No guest authentication session is created.

---

# 14. QR Photo Upload Data Flow

## Function QR

```text
Admin creates Haldi album
        |
        v
Create Haldi QR
        |
        v
QR token -> Haldi album
        |
        v
Guest scans QR
        |
        v
Validate QR token
        |
        v
Resolve Wedding + Function + Album
        |
        v
Issue secure R2 upload authorization
        |
        v
Guest uploads directly to R2
        |
        v
Create media metadata
        |
        v
Gallery reads media by album
```

## General QR

Same flow, except the QR resolves to the general wedding album.

---

# 15. Media Storage Key Strategy

The actual image lives in R2, while MongoDB stores the storage key.

A recommended logical key structure is:

```text
weddings/{weddingId}/albums/{albumId}/{mediaId}/{originalFilename}
```

Example:

```text
weddings/66f.../albums/88c.../91a.../IMG_2031.JPG
```

### Benefits

- clear tenant isolation;
- easy album-oriented organization;
- collisions are avoided by including a generated media identifier;
- migration/export is easier later;
- application code does not rely on user-provided filenames for uniqueness.

The CDN URL should be derived from the storage key or an equivalent stable media URL abstraction.

---

# 16. Website Data Strategy

The website document owns presentation/configuration.

```text
websites
  |
  +-- theme
  +-- draftConfig
  +-- publishedConfig
```

Core wedding content remains elsewhere:

```text
weddings
functions
live_streams
gallery_albums
media
```

### Publishing model

```text
Core wedding data + draft website config
                  |
                  v
               Preview
                  |
                  v
               Publish
                  |
                  v
Public view model
```

The API responsible for the public site should use `publishedConfig`, not `draftConfig`.

---

# 17. Gallery Visibility Model

`gallery_albums.visibility` determines public availability.

### `PUBLIC`

Gallery may be included in the public wedding website.

### `LINK_ONLY`

Gallery is accessible only through the intended shareable gallery route/link and should not be linked from broadly discoverable public surfaces unless configured.

### `PRIVATE`

Only authenticated Admin/Manager requests with appropriate permissions may view the album.

Regardless of visibility, private application APIs must enforce wedding membership and role/permission checks.

---

# 18. Dashboard Query Strategy

The dashboard is an aggregation of domain collections rather than a separate dashboard collection.

Example data needed:

```text
Wedding
  -> wedding header + countdown input

Functions
  -> next upcoming functions

Tasks
  -> counts by status + overdue count

Guest Groups
  -> RSVP counts

Expenses + Budget
  -> total budget + total spent + remaining

Vendors
  -> vendor count/categories

Media
  -> recent uploads
```

Initial V1 can compute these values at request time or through targeted aggregation queries.

Do not introduce a materialized dashboard collection until profiling demonstrates a need.

---

# 19. Query Patterns the Design Must Support

The database design must efficiently support at least these queries.

### Management

1. Find all weddings for a user.
2. Verify a user's membership in a wedding.
3. Load one wedding dashboard.
4. List functions chronologically.
5. List pending/overdue tasks.
6. List guest groups by RSVP status.
7. Calculate expenses by date/category.
8. Load wedding vendors.
9. Load website draft for an Admin.
10. Load gallery albums.
11. Load media for one album with pagination.

### Public

12. Resolve wedding by slug.
13. Resolve invitation by token hash.
14. Load public wedding view model.
15. Submit RSVP for an invitation group.
16. Resolve QR token to an album.
17. List public media for an album.

---

# 20. Pagination

Any potentially large collection should be paginated.

Particularly:

```text
media
guest_groups
expenses
vendors (if growth requires)
tasks
functions (if many custom events are created)
```

For gallery media, cursor-based pagination is preferred once the dataset becomes large.

A simple page/limit model is acceptable for low-volume administrative lists in V1 if implemented consistently.

---

# 21. Time and Date Handling

Wedding scheduling is sensitive to local date/time.

### Recommended model

- Store instants consistently in UTC at the database layer.
- Store the wedding's intended timezone, for example `Asia/Kolkata`, in the wedding document.
- Convert to local time in the UI.

Suggested additional field:

```js
timezone: "Asia/Kolkata"
```

This prevents ambiguity when the application eventually serves weddings in different regions.

---

# 22. Data Security Considerations

## Sensitive values

Never store plaintext:

- user passwords;
- invitation bearer tokens;
- QR bearer tokens;
- API keys;
- email provider secrets;
- storage credentials.

## Public data

Only fields explicitly intended for guests should be returned through public APIs.

## Tenant isolation

Every private query should be scoped to the authorized wedding.

Do not accept an arbitrary `weddingId` from the client and assume it is authorized.

The backend should derive or verify the user's wedding membership before allowing access.

---

# 23. Recommended Mongoose/ODM Structure

If Mongoose is used with Node.js, each collection can have its own schema/model and domain service.

Example conceptual structure:

```text
models/
  User.ts
  Wedding.ts
  WeddingMembership.ts
  Function.ts
  Task.ts
  GuestGroup.ts
  GuestMember.ts
  Expense.ts
  Budget.ts
  Vendor.ts
  Website.ts
  Invitation.ts
  GalleryAlbum.ts
  Media.ts
  LiveStream.ts
  QRCode.ts
```

The model layer should enforce basic data shape, while domain services enforce cross-document business rules.

---

# 24. Collection Ownership Table

| Collection | Created/managed by | Publicly readable? |
|---|---|---|
| `users` | Auth system | No |
| `weddings` | Admin | Selected fields only |
| `wedding_memberships` | Admin | No |
| `functions` | Admin/authorized Manager | Published fields only |
| `tasks` | Admin/authorized Manager | No |
| `guest_groups` | Admin/authorized Manager | RSVP context only |
| `guest_members` | Admin/authorized Manager | No by default |
| `expenses` | Admin/authorized Manager | No |
| `budgets` | Admin | No |
| `vendors` | Admin/authorized Manager | No by default |
| `websites` | Admin | Published site only |
| `invitations` | Admin | Token-derived controlled flow only |
| `gallery_albums` | Admin/authorized Manager | According to visibility |
| `media` | Admin/Manager/Guest upload | According to album visibility |
| `live_streams` | Admin/authorized Manager | Published fields only |
| `qr_codes` | Admin | Token-derived controlled flow only |

---

# 25. Backup and Recovery Expectations

MongoDB Atlas should provide managed backups according to the selected plan.

The application design must assume:

- database backups are external to application code;
- R2 is the authoritative media store;
- deleting an image record should not automatically be assumed to delete the object unless the application explicitly performs the corresponding storage operation;
- permanent deletion should be deliberate and auditable.

For the personal V1, backup/retention policy can be simple, but it should be documented before production use.

---

# 26. Future Expansion Compatibility

The V1 schema deliberately leaves room for future features without introducing them now.

Potential future additions:

```text
notifications
payments
vendor_profiles
vendor_reviews
website_domains
premium_themes
multiple_gallery_permissions
video_media
audit_logs
analytics
subscriptions
```

These should be added as separate domain concepts rather than turning existing documents into unbounded catch-all objects.

---

# 27. What We Explicitly Do Not Store in MongoDB

Do not store:

- uploaded image binaries;
- CDN cached data;
- user passwords in plaintext;
- Google API credentials;
- Resend API credentials;
- raw invitation tokens;
- raw QR bearer tokens;
- live video streams;
- arbitrary HTML/CSS/JavaScript generated by users.

---

# 28. V1 Database Checklist

Before implementation begins, verify that the following are true:

- [ ] All wedding-owned collections include `weddingId` where appropriate.
- [ ] `users` is independent of wedding membership.
- [ ] `wedding_memberships` enforces one membership per user per wedding.
- [ ] Only one primary Admin is allowed per wedding.
- [ ] Manager permissions are stored explicitly.
- [ ] Guest invitations are family/group-based.
- [ ] Guest groups can optionally contain individual members.
- [ ] Invitation tokens are random and hashed in storage.
- [ ] QR tokens are random and hashed in storage.
- [ ] Function albums map to the correct wedding function.
- [ ] General gallery album is supported.
- [ ] Media metadata is stored in MongoDB; actual files are in R2.
- [ ] Expense amounts use `Decimal128`.
- [ ] Website has separate draft and published configuration.
- [ ] Public wedding is resolved by slug.
- [ ] Public APIs return dedicated view models, not raw private documents.
- [ ] Required indexes are created.
- [ ] Soft deletion exists for important records.
- [ ] Cross-document ownership is validated in services.
- [ ] Large collections are paginated.

---

# 29. Recommended Implementation Order

Database implementation should follow the application dependency graph.

```text
1. users
        ↓
2. weddings
        ↓
3. wedding_memberships
        ↓
4. functions / tasks
        ↓
5. guest_groups / guest_members / invitations
        ↓
6. budgets / expenses
        ↓
7. vendors
        ↓
8. websites
        ↓
9. gallery_albums / media / qr_codes
        ↓
10. live_streams
```

This order is not mandatory for coding, but it is a useful dependency guide.

---

# 30. Final Database Design Summary

The V1 data model is intentionally centered on one principle:

> **A User is an identity, a Wedding is a tenant/workspace, Membership provides access, and every major wedding capability is modeled as its own focused entity.**

The resulting structure is:

```text
                         USER
                          |
                   WEDDING MEMBERSHIP
                          |
                       WEDDING
                          |
      +-----------+-------+-------+-----------+
      |           |       |       |           |
   FUNCTIONS    TASKS   GUESTS  EXPENSES    VENDORS
      |                   |
      |              INVITATIONS
      |
   GALLERY ALBUMS
      |
     MEDIA  <---------------- R2 objects / CDN delivery

      WEDDING
         |
      WEBSITE  ------> Theme / Draft / Published config
         |
      LIVE STREAM
         |
      QR CODES ------> Function/general upload targets
```

This model is deliberately simple for the personal V1 while maintaining clean tenant isolation and clear expansion points for a future commercial version.

---

## 31. Open Implementation Notes

These are implementation details rather than unresolved product decisions:

1. Final ObjectId vs UUID choice should be made before schema implementation. ObjectId is the default recommendation for this MongoDB project unless there is a strong reason to use UUIDs.
2. Exact file-size limits for guest uploads should be defined in the media/upload API design.
3. Exact MongoDB Atlas tier and backup retention should be selected at deployment time.
4. The application should use one consistent validation library and one consistent error format.
5. The final API DTOs should not expose raw persistence schemas directly.
6. If performance profiling later shows dashboard aggregation is expensive, introduce targeted read models rather than prematurely creating a general-purpose caching layer.

---

**Status:** Ready for database schema implementation review.  
**Next step after approval:** Convert this design into concrete Mongoose schemas, TypeScript interfaces/types, validation rules, indexes, seed strategy, and migration/versioning conventions.
