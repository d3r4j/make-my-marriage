# Make My Marriage — API Design Document v1.0

**Product:** Make My Marriage  
**Document:** API Design  
**Version:** 1.0  
**Status:** Draft for implementation review  
**API style:** REST  
**Backend:** Node.js + Express modular monolith  
**Frontend:** Angular  
**Database:** MongoDB Atlas  
**Media storage:** Cloudflare R2  
**Media delivery:** Cloudflare CDN  
**Email:** Resend  
**Vendor discovery:** Google Places API  
**Related documents:** PRD v1.1, System Design & Architecture v1.0, Database Design v1.0

---

## 1. Purpose

This document defines the V1 REST API contract for Make My Marriage.

The API is responsible for:

- Authentication and account lifecycle.
- Wedding creation and management.
- Admin/Manager membership and permission enforcement.
- Functions and schedules.
- Tasks.
- Family/group-based guests and RSVP.
- Budgets and expenses.
- Wedding vendors.
- Nearby vendor discovery.
- Wedding website configuration and publishing.
- Gallery albums and media metadata.
- Secure guest photo uploads through QR links.
- Live-stream configuration.
- Public wedding and invitation experiences.

The API is designed as part of a **modular monolith**. It should remain simple enough for V1 while keeping module boundaries clean for future extraction if a module eventually requires independent scaling.

---

## 2. API Design Principles

### 2.1 REST

Use resource-oriented REST endpoints with standard HTTP methods.

```text
GET     read
POST    create/action
PATCH   partial update
PUT     replace where appropriate
DELETE  remove/deactivate
```

### 2.2 Wedding-scoped private resources

Private management resources are normally scoped by `weddingId`.

```text
/api/weddings/:weddingId/...
```

### 2.3 Public resources are separate

Guest-facing routes must not reuse private management endpoints with weaker checks.

```text
/api/public/...
```

### 2.4 Authorization is server-side

Angular route guards and UI controls are not security boundaries.

Node.js must verify:

1. Authentication, where required.
2. Wedding membership, where required.
3. Role.
4. Fine-grained permission.
5. Resource ownership/context.

### 2.5 Validate at the boundary

Every write request should be schema-validated before business logic runs.

Validation covers:

- Required fields.
- Data types.
- Allowed enum values.
- String lengths.
- Date/time formats.
- Numeric ranges.
- URL formats.
- File upload metadata.

### 2.6 Do not expose database implementation details

API responses should use stable resource representations rather than leaking internal MongoDB structure or arbitrary collection fields.

Never return password hashes, token hashes, internal secrets, storage credentials, or provider credentials.

### 2.7 Consistent errors

All modules should use a common error envelope.

### 2.8 Pagination

Pagination should be used for:

- Guests.
- Tasks.
- Expenses.
- Vendors.
- Gallery media.

Cursor-based pagination is preferred for gallery/media; offset pagination is acceptable for smaller management lists in V1.

---

## 3. Base URL

Initial shape:

```text
https://<api-host>/api
```

A future version can introduce `/api/v1` deliberately if backward-compatible versioning becomes necessary.

---

## 4. Request Processing Pipeline

```text
HTTP Request
   |
   v
Security Headers / CORS
   |
   v
Rate Limiting (where applicable)
   |
   v
Authentication (private routes)
   |
   v
Wedding Context Resolution
   |
   v
Authorization / Permissions
   |
   v
Request Validation
   |
   v
Controller
   |
   v
Service
   |
   +---- Repository
   |
   +---- External Adapter
   |
   v
Response
   |
   v
Central Error Handler
```

For public routes, authentication is replaced by public slug/token validation.

---

# 5. Authentication

V1 uses:

- Email + password.
- Email verification.
- Password reset.
- Secure session/token mechanism.
- Google login later.

Authentication must be separate from wedding authorization.

Being logged in does not automatically grant access to a wedding.

---

# 6. Authentication Endpoints

## POST `/api/auth/register`

Create a user.

### Request

```json
{
  "name": "Dhiraj",
  "email": "dhiraj@example.com",
  "password": "StrongPassword"
}
```

### Response `201`

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "name": "Dhiraj",
      "email": "dhiraj@example.com",
      "isEmailVerified": false
    }
  }
}
```

Send verification email through Resend.

## GET `/api/auth/verify-email?token=<token>`

Verify a user email.

Token should be one-time-use and expire.

## POST `/api/auth/login`

```json
{
  "email": "dhiraj@example.com",
  "password": "StrongPassword"
}
```

Returns the authenticated user and establishes the chosen secure authentication state.

## POST `/api/auth/logout`

Invalidate the active authentication session/refresh mechanism.

## GET `/api/auth/me`

Return the current user.

## POST `/api/auth/forgot-password`

Request a password reset email.

Use a generic success response to reduce account-enumeration risk.

## POST `/api/auth/reset-password`

```json
{
  "token": "reset_token",
  "newPassword": "NewStrongPassword"
}
```

Validate and invalidate the token after successful use.

---

# 7. Wedding API

## POST `/api/weddings`

Create a wedding.

The creator becomes the initial primary Admin.

### Request

```json
{
  "brideName": "Priya",
  "groomName": "Dhiraj",
  "weddingDate": "2026-12-18",
  "location": {
    "name": "Nagpur",
    "address": "Example address"
  },
  "venue": {
    "name": "Royal Palace",
    "address": "Nagpur"
  }
}
```

### Creation behavior

The application should initialize:

1. Wedding.
2. Primary Admin membership.
3. Website record.
4. Public slug.
5. General gallery album.
6. General gallery QR configuration.

Where multiple records must succeed together, use a MongoDB transaction as appropriate.

## GET `/api/weddings`

Return weddings for which the authenticated user has membership.

## GET `/api/weddings/:weddingId`

Return private wedding details.

## PATCH `/api/weddings/:weddingId`

Update wedding settings.

## DELETE `/api/weddings/:weddingId`

Admin only.

Use soft deletion rather than immediate destructive deletion.

---

# 8. Dashboard API

## GET `/api/weddings/:weddingId/dashboard`

Authenticated + member.

Example:

```json
{
  "success": true,
  "data": {
    "countdown": {
      "daysRemaining": 79
    },
    "functions": {
      "total": 5,
      "upcoming": []
    },
    "tasks": {
      "pending": 7,
      "completed": 24,
      "overdue": 2
    },
    "guests": {
      "invited": 428,
      "confirmed": 276,
      "pending": 112,
      "declined": 40
    },
    "budget": {
      "total": 1200000,
      "spent": 840000,
      "remaining": 360000
    },
    "vendors": {
      "total": 8
    },
    "gallery": {
      "mediaCount": 2431
    }
  }
}
```

Dashboard data is derived from domain resources and is not itself a source of truth.

---

# 9. Membership / Admin / Manager API

## POST `/api/weddings/:weddingId/members/invitations`

Admin only.

Invite a Manager.

```json
{
  "email": "rahul@example.com",
  "permissions": {
    "functions": true,
    "tasks": true,
    "guests": true,
    "expenses": false,
    "vendors": true,
    "gallery": true,
    "website": false
  }
}
```

Send Manager invitation email through Resend.

## GET `/api/weddings/:weddingId/members`

Admin only.

Return current memberships without exposing unnecessary sensitive fields.

## PATCH `/api/weddings/:weddingId/members/:membershipId`

Admin only.

Update Manager permissions/status.

## DELETE `/api/weddings/:weddingId/members/:membershipId`

Admin only.

Deactivate/remove the member.

Primary Admin cannot be removed without an ownership-transfer rule.

## POST `/api/members/invitations/:token/accept`

Accept Manager invitation.

The invitation token is one-time-use.

---

# 10. Functions API

Base:

```text
/api/weddings/:weddingId/functions
```

## GET

List functions.

Example filters:

```text
?page=1
&pageSize=20
&from=2026-12-01
&to=2026-12-31
```

Default ordering: date ascending, then start time.

## POST

```json
{
  "name": "Sangeet",
  "date": "2026-12-14",
  "startTime": "19:00",
  "endTime": "22:00",
  "venue": {
    "name": "Royal Palace",
    "address": "Nagpur"
  },
  "description": "Family sangeet",
  "dressCode": "Traditional"
}
```

## GET `/api/weddings/:weddingId/functions/:functionId`

Get one function.

## PATCH `/api/weddings/:weddingId/functions/:functionId`

Update function.

## DELETE `/api/weddings/:weddingId/functions/:functionId`

Delete function.

Deletion behavior for linked albums/media must be explicitly enforced by the service layer.

---

# 11. Tasks API

Base:

```text
/api/weddings/:weddingId/tasks
```

## GET

Supported filters:

```text
?status=TODO
&assigneeMembershipId=...
&priority=HIGH
&overdue=true
```

## POST

```json
{
  "title": "Finalize Menu",
  "description": "Review final catering menu",
  "assigneeMembershipId": "membership_id",
  "dueDate": "2026-10-20",
  "priority": "HIGH",
  "status": "TODO"
}
```

## PATCH `/api/weddings/:weddingId/tasks/:taskId`

Update task.

## DELETE `/api/weddings/:weddingId/tasks/:taskId`

Delete task.

---

# 12. Guest Group API

Base:

```text
/api/weddings/:weddingId/guests
```

The family/group is the primary invitation unit.

## GET

List guest groups with optional filters:

```text
?rsvpStatus=PENDING
&side=GROOM
```

## POST

```json
{
  "groupName": "Sharma Family",
  "primaryContact": "Rajesh Sharma",
  "phone": "+91XXXXXXXXXX",
  "side": "GROOM",
  "expectedCount": 4,
  "notes": "Close family"
}
```

## GET `/api/weddings/:weddingId/guests/:guestGroupId`

Return group plus optional guest members.

## PATCH `/api/weddings/:weddingId/guests/:guestGroupId`

Update group.

## DELETE `/api/weddings/:weddingId/guests/:guestGroupId`

Delete/deactivate group according to retention rules.

---

# 13. Guest Member API

Optional people within a group.

Base:

```text
/api/weddings/:weddingId/guests/:guestGroupId/members
```

## POST

```json
{
  "name": "Rahul Sharma",
  "notes": ""
}
```

## GET

List members.

## PATCH `/:guestMemberId`

Update member.

## DELETE `/:guestMemberId`

Remove member.

The invitation experience remains family-level.

---

# 14. Invitation API

## POST `/api/weddings/:weddingId/guests/:guestGroupId/invitation`

Create or regenerate a family invitation.

### Response

```json
{
  "success": true,
  "data": {
    "invitationUrl": "https://makemymarriage.com/invite/<token>",
    "status": "ACTIVE"
  }
}
```

The raw token should not be persisted in plaintext.

## POST `/api/weddings/:weddingId/invitations/:invitationId/revoke`

Admin only.

Revoke invitation.

---

# 15. Public Invitation API

## GET `/api/public/invitations/:token`

Public.

Return only data required by the invitation experience.

Example:

```json
{
  "success": true,
  "data": {
    "wedding": {
      "slug": "dhiraj-priya",
      "displayNames": "Dhiraj & Priya",
      "weddingDate": "2026-12-18"
    },
    "invitation": {
      "groupName": "Sharma Family",
      "currentRsvpStatus": "PENDING",
      "expectedCount": 4
    }
  }
}
```

## POST `/api/public/invitations/:token/rsvp`

```json
{
  "status": "YES",
  "attendeeCount": 4,
  "notes": "Looking forward to it"
}
```

Validate the invitation token and update the corresponding guest group.

No management session is created.

---

# 16. Budget API

## GET `/api/weddings/:weddingId/budget`

Return total and category budgets.

## PUT `/api/weddings/:weddingId/budget`

```json
{
  "totalBudget": 1200000,
  "categoryBudgets": [
    {
      "category": "FOOD",
      "amount": 300000
    },
    {
      "category": "PHOTOGRAPHY",
      "amount": 150000
    }
  ]
}
```

---

# 17. Expense API

## GET `/api/weddings/:weddingId/expenses`

Supported filters:

```text
?category=FOOD
&paidByMembershipId=...
&from=2026-10-01
&to=2026-12-31
```

Paginated.

## POST `/api/weddings/:weddingId/expenses`

```json
{
  "title": "Photographer Advance",
  "amount": 40000,
  "category": "PHOTOGRAPHY",
  "paidByMembershipId": "membership_id",
  "date": "2026-09-29",
  "notes": "Advance payment"
}
```

Money should use integer minor units internally where practical, e.g. paise for INR, instead of floating-point calculations.

## GET `/api/weddings/:weddingId/expenses/:expenseId`

## PATCH `/api/weddings/:weddingId/expenses/:expenseId`

## DELETE `/api/weddings/:weddingId/expenses/:expenseId`

---

# 18. Vendor Management API

Base:

```text
/api/weddings/:weddingId/vendors
```

## GET

List saved vendors.

## POST

```json
{
  "name": "ABC Photography",
  "category": "PHOTOGRAPHER",
  "phone": "+91XXXXXXXXXX",
  "email": "abc@example.com",
  "cost": 80000,
  "advancePaid": 30000,
  "notes": "Wedding day package"
}
```

## GET `/:vendorId`

## PATCH `/:vendorId`

## DELETE `/:vendorId`

---

# 19. Vendor Discovery API

## GET `/api/vendor-discovery`

Authenticated Admin/Manager.

Example:

```text
?category=PHOTOGRAPHER
&latitude=...
&longitude=...
&radius=10000
```

Backend flow:

```text
Angular
  |
GET /api/vendor-discovery
  |
VendorDiscoveryService
  |
Google Places Adapter
  |
Google Places API
  |
Normalized Results
```

Example result:

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "providerPlaceId": "place_id",
        "name": "ABC Photography",
        "address": "Nagpur",
        "rating": 4.5,
        "category": "PHOTOGRAPHER"
      }
    ]
  }
}
```

Provider credentials remain server-side.

---

# 20. Save Discovered Vendor

## POST `/api/weddings/:weddingId/vendors/from-discovery`

Authenticated + vendor-write permission.

```json
{
  "provider": "GOOGLE_PLACES",
  "providerPlaceId": "place_id",
  "name": "ABC Photography",
  "category": "PHOTOGRAPHER",
  "address": "Nagpur",
  "phone": "+91XXXXXXXXXX"
}
```

The saved vendor becomes a normal wedding vendor record.

---

# 21. Website API

Base:

```text
/api/weddings/:weddingId/website
```

## GET

Return editable website configuration.

## PATCH

Update draft configuration.

```json
{
  "theme": "TRADITIONAL",
  "heroImageMediaId": "media_id",
  "story": {
    "enabled": true,
    "text": "Our story..."
  },
  "sections": {
    "hero": true,
    "story": true,
    "events": true,
    "venue": true,
    "invitation": true,
    "rsvp": true,
    "gallery": true,
    "liveStream": true
  }
}
```

## POST `/api/weddings/:weddingId/website/preview`

Return an authenticated preview representation of draft configuration.

## POST `/api/weddings/:weddingId/website/publish`

Admin only.

Validate draft and publish it for the public site.

---

# 22. Public Wedding Website API

## GET `/api/public/weddings/:slug`

Return a public wedding view model.

It may include:

- Couple display data.
- Date.
- Published website configuration.
- Published functions.
- Public venue information.
- Public gallery information.
- Live-stream information.
- Invitation-related public content.

It must not expose:

- Budget.
- Expenses.
- Manager list.
- Private guest information.
- Internal permissions.
- Token hashes.
- Storage credentials.

---

# 23. Gallery API

Base:

```text
/api/weddings/:weddingId/gallery
```

## GET `/albums`

List wedding albums.

## POST `/albums`

```json
{
  "name": "Haldi",
  "functionId": "function_id",
  "visibility": "LINK_ONLY"
}
```

A general album can use `functionId: null`.

## PATCH `/albums/:albumId`

Update album.

## DELETE `/albums/:albumId`

Delete/deactivate album according to media-retention rules.

---

# 24. Public Gallery API

## GET `/api/public/weddings/:slug/gallery`

Return only media allowed by the wedding gallery privacy setting.

Recommended parameters:

```text
?albumId=...
&pageSize=30
&cursor=...
```

Use cursor pagination for media.

---

# 25. Guest Photo Upload API

Guest upload is function-specific through QR tokens.

## GET `/api/public/uploads/:token`

Validate token and return upload context.

Example:

```json
{
  "success": true,
  "data": {
    "wedding": {
      "displayNames": "Dhiraj & Priya"
    },
    "album": {
      "name": "Haldi"
    }
  }
}
```

## POST `/api/public/uploads/:token/authorize`

Request short-lived upload authorization.

```json
{
  "files": [
    {
      "name": "IMG_001.jpg",
      "contentType": "image/jpeg",
      "size": 8423912
    }
  ]
}
```

Backend checks:

- QR token.
- Wedding/album context.
- Allowed file type.
- Maximum file size.
- Maximum files per request.
- Rate limits.

### Response

```json
{
  "success": true,
  "data": {
    "uploads": [
      {
        "clientReference": "file-1",
        "uploadUrl": "secure-upload-url",
        "storageKey": "weddings/..."
      }
    ]
  }
}
```

The upload URL should be short-lived.

## POST `/api/public/uploads/:token/complete`

```json
{
  "uploads": [
    {
      "clientReference": "file-1",
      "storageKey": "weddings/...",
      "fileName": "IMG_001.jpg",
      "contentType": "image/jpeg",
      "size": 8423912
    }
  ]
}
```

After validation, create media metadata records.

Uploaded images become immediately available.

---

# 26. Why Upload Is Split Into Authorize + Complete

Node should not proxy large image files.

Instead:

```text
1. Guest asks Node for upload authorization.
2. Node validates token and file metadata.
3. Node issues secure R2 upload authorization.
4. Browser uploads directly to R2.
5. Browser calls complete endpoint.
6. Node records media metadata.
7. CDN serves the image.
```

This keeps large media traffic away from the Node application.

---

# 27. Media Management API

## GET `/api/weddings/:weddingId/gallery/albums/:albumId/media`

Authenticated + gallery-read permission.

Paginated.

## DELETE `/api/weddings/:weddingId/gallery/media/:mediaId`

Authenticated + gallery-write permission.

When deleting, remove/deactivate both metadata and the corresponding storage object according to retention rules.

---

# 28. QR Code API

## POST `/api/weddings/:weddingId/qr-codes`

Create a QR configuration.

Function album example:

```json
{
  "type": "FUNCTION_UPLOAD",
  "albumId": "album_id"
}
```

General album example:

```json
{
  "type": "GENERAL_UPLOAD",
  "albumId": "general_album_id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "type": "FUNCTION_UPLOAD",
    "url": "https://makemymarriage.com/upload/<token>",
    "status": "ACTIVE"
  }
}
```

## POST `/api/weddings/:weddingId/qr-codes/:qrId/revoke`

Admin only.

---

# 29. Live Stream API

## GET `/api/weddings/:weddingId/live-stream`

Authenticated + member.

## PUT `/api/weddings/:weddingId/live-stream`

```json
{
  "title": "Wedding Ceremony Live",
  "url": "https://example.com/stream",
  "date": "2026-12-18",
  "status": "SCHEDULED"
}
```

## DELETE `/api/weddings/:weddingId/live-stream`

Remove/disable stream configuration.

The application stores the link; the actual video infrastructure is external.

---

# 30. Standard Response Envelope

## Success

```json
{
  "success": true,
  "data": {},
  "message": "Optional message"
}
```

## Error

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

---

# 31. HTTP Status Codes

| Status | Meaning |
|---|---|
| `200` | Successful read/update/action |
| `201` | Resource created |
| `204` | Successful operation with no body |
| `400` | Invalid request |
| `401` | Authentication required/invalid |
| `403` | Authenticated but forbidden |
| `404` | Resource not found |
| `409` | Conflict |
| `422` | Optional semantic-validation response if adopted |
| `429` | Rate limited |
| `500` | Unexpected server error |
| `502` | External provider failure |
| `503` | Temporary service unavailable |

The implementation should choose a consistent 400-vs-422 convention and use it across modules.

---

# 32. Stable Error Codes

Examples:

```text
AUTH_INVALID_CREDENTIALS
AUTH_EMAIL_NOT_VERIFIED
AUTH_TOKEN_INVALID
AUTH_TOKEN_EXPIRED

WEDDING_NOT_FOUND
WEDDING_ACCESS_DENIED

MEMBERSHIP_NOT_FOUND
MEMBERSHIP_INVITATION_INVALID

INVALID_INPUT
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT

INVITATION_INVALID
INVITATION_REVOKED
RSVP_INVALID

UPLOAD_TOKEN_INVALID
UPLOAD_NOT_ALLOWED
UPLOAD_TOO_LARGE
UPLOAD_RATE_LIMITED

VENDOR_PROVIDER_ERROR
```

Angular should rely on stable error codes rather than parsing messages.

---

# 33. Pagination Contract

For smaller lists:

```text
GET /api/weddings/:id/tasks?page=1&pageSize=20
```

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 80,
      "totalPages": 4
    }
  }
}
```

For large media:

```text
GET /api/public/weddings/:slug/gallery?albumId=abc&pageSize=30&cursor=xyz
```

```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "nextCursor": "next_xyz",
      "hasMore": true
    }
  }
}
```

---

# 34. Filtering and Sorting

Only whitelisted fields should be allowed.

Example:

```text
?status=COMPLETED
&sortBy=dueDate
&sortOrder=asc
```

Never pass arbitrary client-supplied field names directly into MongoDB queries.

---

# 35. Idempotency

Consider an `Idempotency-Key` header for retry-sensitive writes such as:

- Invitation creation.
- Website publication.
- Upload completion.
- Other duplicate-sensitive create operations.

Do not build idempotency handling for every request.

---

# 36. Concurrency

The service layer should account for:

- Two Admins editing the same resource.
- Duplicate RSVP submissions.
- Duplicate upload completion callbacks.
- Simultaneous membership changes.
- Stale updates.

For low-risk V1 resources, normal last-write-wins may be acceptable.

State transitions such as invitation revocation should be explicit and safe.

---

# 37. Public Token Security

Invitation and QR upload tokens are bearer credentials.

Rules:

1. Generate cryptographically strong random values.
2. Never use sequential database IDs as public secrets.
3. Store hashes where practical.
4. Do not log raw tokens.
5. Revoke explicitly.
6. Keep different token purposes separate.
7. Never turn a public token into a management authentication session.
8. Rate-limit token endpoints.

---

# 38. Storage Key Convention

Recommended:

```text
weddings/{weddingId}/albums/{albumId}/media/{randomId}/{originalFilename}
```

Example:

```text
weddings/64abc/albums/71def/media/98xyz/IMG_001.jpg
```

Storage paths are generated by the backend.

---

# 39. Transactional Operations

Use MongoDB transactions only where atomicity is important.

Good candidates include:

### Wedding initialization

```text
Wedding
+
Primary Membership
+
Website
```

### Manager invitation acceptance

```text
Membership
+
Invitation state
```

### RSVP updates

Use a transaction only if multiple stored values must be updated together and cannot instead be derived safely.

Avoid transactions by default.

---

# 40. Dashboard Data Strategy

Prefer deriving:

```text
Total spent = sum(expenses.amount)
Remaining = totalBudget - totalSpent
```

rather than keeping fragile duplicated totals.

Denormalized counters may be added later if real profiling shows a need.

---

# 41. Angular API Client Structure

Use feature-specific API services:

```text
AuthApiService
WeddingApiService
MemberApiService
FunctionApiService
TaskApiService
GuestApiService
InvitationApiService
ExpenseApiService
VendorApiService
VendorDiscoveryApiService
WebsiteApiService
GalleryApiService
UploadApiService
LiveStreamApiService
PublicWeddingApiService
```

Shared HTTP interception/error handling lives in the Angular core layer.

---

# 42. Backend Module Structure

```text
src/
├── core/
│   ├── auth/
│   ├── database/
│   ├── storage/
│   └── email/
│
├── modules/
│   ├── auth/
│   ├── weddings/
│   ├── memberships/
│   ├── functions/
│   ├── tasks/
│   ├── guests/
│   ├── invitations/
│   ├── expenses/
│   ├── vendors/
│   ├── vendor-discovery/
│   ├── website/
│   ├── gallery/
│   ├── uploads/
│   ├── qr/
│   ├── live-stream/
│   └── public/
│
└── shared/
```

Each feature should generally follow:

```text
routes
controller
service
repository
validation/schema
```

External systems use adapters:

```text
R2Adapter
ResendAdapter
GooglePlacesAdapter
```

---

# 43. Security Requirements

The API must include:

- Password hashing.
- Secure authentication/session handling.
- Email verification.
- Password reset tokens.
- Server-side authorization.
- Request validation.
- CORS allow-list.
- Security headers.
- Rate limiting.
- Public token hashing.
- Server-side provider credentials.
- Upload validation.
- Wedding-level tenant isolation.
- Public/private response separation.
- Centralized error handling.

---

# 44. File Upload Security

Before authorizing an upload:

- Validate MIME type.
- Validate extension where appropriate.
- Enforce file-size limit.
- Enforce file-count limit.
- Verify QR token.
- Verify target wedding/album.
- Apply rate limits.
- Generate controlled storage keys.

The client must never choose arbitrary storage paths.

---

# 45. API Logging

Never log:

- Passwords.
- Reset tokens.
- Verification tokens.
- Invitation raw tokens.
- QR raw tokens.
- Resend API key.
- Google API key.
- R2 credentials.

Useful fields:

```text
requestId
timestamp
route
method
status
duration
userId (when available)
weddingId (when available)
errorCode
```

---

# 46. CORS

Allow only known frontend origins.

Development:

```text
http://localhost:4200
```

Production:

```text
https://makemymarriage.com
```

Avoid unrestricted CORS for authenticated APIs.

---

# 47. Rate Limiting

High-priority endpoints:

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/forgot-password

POST /api/public/invitations/:token/rsvp

POST /api/public/uploads/:token/authorize
POST /api/public/uploads/:token/complete

GET /api/vendor-discovery
```

Exact limits can be tuned after real-world usage.

---

# 48. Email Integration

Business modules call an internal service:

```text
Auth / Membership
      |
      v
EmailService
      |
      v
ResendAdapter
      |
      v
Resend
```

V1 functions:

```text
sendVerificationEmail()
sendPasswordResetEmail()
sendManagerInvitationEmail()
```

No general notification subsystem.

---

# 49. External Provider Isolation

Provider-specific behavior should stay behind adapters.

Example:

```text
VendorDiscoveryService
       |
       v
GooglePlacesAdapter
       |
       v
Google Places
```

This prevents Google-specific response shapes from leaking across the domain.

The same principle applies to Resend and R2.

---

# 50. Public vs Authenticated Identity

```text
Authenticated User
    |
    +--> User account
    +--> Wedding membership
    +--> Admin/Manager permissions

Guest
    |
    +--> Invitation token
    or
    +--> QR upload token
```

A guest token is never a substitute for private wedding membership.

---

# 51. Example Flow — Create Function

```text
Admin/Manager
  |
Angular
  |
POST /api/weddings/{weddingId}/functions
  |
Security middleware
  |
Authentication
  |
Membership resolution
  |
Permission check
  |
Validation
  |
FunctionService
  |
FunctionRepository
  |
MongoDB
  |
201 Created
```

---

# 52. Example Flow — RSVP

```text
Guest
  |
/invite/{token}
  |
GET /api/public/invitations/{token}
  |
Validate invitation
  |
Return public context
  |
Guest submits
  |
POST /api/public/invitations/{token}/rsvp
  |
Validate token/data
  |
Update guest group
  |
Return RSVP result
```

---

# 53. Example Flow — Guest Photo Upload

```text
Guest scans function QR
  |
/upload/{token}
  |
GET public upload context
  |
Select images
  |
POST authorize
  |
Node validates token + limits
  |
Short-lived R2 authorization
  |
Browser uploads directly to R2
  |
POST complete
  |
Node validates completion
  |
Create media metadata
  |
Gallery displays image
  |
CDN serves image
```

---

# 54. Example Flow — Website Publish

```text
Admin edits
  |
PATCH website
  |
Draft saved
  |
POST preview
  |
Authenticated preview
  |
POST publish
  |
Validate draft
  |
Publish state
  |
Public GET /api/public/weddings/{slug}
```

---

# 55. V1 API Completeness

The API is considered complete for V1 when it supports this full product flow:

```text
Register
  ↓
Verify email
  ↓
Login
  ↓
Create wedding
  ↓
Invite Manager
  ↓
Manager accepts
  ↓
Admin configures permissions
  ↓
Create functions/tasks/guests/vendors/expenses
  ↓
Create family invitation
  ↓
Guest opens invitation
  ↓
Guest submits RSVP
  ↓
Customize website
  ↓
Save → Preview → Publish
  ↓
Guest opens public wedding website
  ↓
Guest scans function QR
  ↓
Guest uploads images directly to R2
  ↓
Media metadata saved
  ↓
Function album displays images
  ↓
CDN delivers images
```

---

# 56. API Design Decisions Summary

| Concern | V1 Decision |
|---|---|
| API style | REST |
| Backend | Node.js + Express modular monolith |
| Private route model | Wedding-scoped |
| Public route model | Separate public endpoints |
| Authentication | Email/password + verification |
| Roles | Admin / Manager |
| Guest account | Not required |
| Invitation | Family/group-level token |
| RSVP | Public token-based |
| Media | Direct browser → R2 |
| Gallery | Function-specific + general album |
| Website | Draft → Preview → Publish |
| Vendor discovery | Node → Google Places |
| Email | Resend via adapter |
| Pagination | Offset for small lists, cursor for media |
| Authorization | Server-side |
| Validation | Backend + frontend |
| Rate limiting | Yes, targeted endpoints |
| Caching | Not required initially |
| Queues | Not required initially |
| Versioning | Keep simple; formal versioning can be added later |

---

# 57. Implementation Order

```text
1. Express/API foundation
2. Security + validation middleware
3. Authentication
4. Wedding + membership authorization
5. Functions
6. Tasks
7. Guests
8. Invitations + RSVP
9. Budget + expenses
10. Vendors
11. Vendor discovery
12. Website
13. Gallery + albums
14. QR + R2 upload flow
15. Live stream
16. Production hardening
```

This document should be treated as the API contract baseline alongside the approved PRD, System Design, and Database Design documents.
