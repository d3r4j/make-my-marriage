# Make My Marriage — Development Progress

**Last updated:** 2026-10-05

This file tracks implementation status at a project level. Product scope and architecture remain defined by the [PRD](PRD.md), [System Design](SYSTEM_DESIGN.md), [API Design](API_DESIGN.md), and [Database Design](DATABASE_DESIGN.md).

## Current Summary

- **Overall stage:** Initial project scaffold, marketing homepage, authentication, and wedding setup implementation.
- **Currently in progress:** Wedding setup and membership handoff; the broader management workspace remains planned.
- **Most recent verification:** API typecheck/build and Angular production build passed on 2026-10-05. MongoDB-backed onboarding smoke verification could not complete because Atlas was unreachable from this environment; Angular's test builder also failed before executing tests due workspace path resolution errors.

## Completed

| Area | Status | Notes |
|---|---|---|
| Repository and application scaffold | Complete | npm workspaces are configured with an Angular web app and an Express API app. Initial route groups and API entry points exist. This is scaffolding, not completed product functionality. |
| Product and architecture documentation | Complete | PRD, system design, API design, and database design documents are present under `docs/`. |
| Public marketing homepage | Complete (frontend prototype) | The `/` route renders the marketing landing page, styles, and local brand/homepage images. Theme switching and RSVP status controls are demonstrations; the page is not integrated with product data or backend functionality. |
| Authentication and accounts | Complete | Registration sends a one-time verification email; verified login creates an HttpOnly session, while unverified login returns a stable error code and no session. Resend, verification outcomes, password recovery, and session-guarded management navigation are implemented. API typecheck/build and Angular production build passed; live Atlas flow check was blocked by connectivity. |

## In Progress

| Area | Status | Notes |
|---|---|---|
| Wedding creation and membership | In progress | Signed-in users without a membership receive a welcome/setup flow. Wedding creation initializes the workspace, primary Admin membership, website, general album, and hashed gallery QR token, and returns the one-time upload URL; dashboard handoff is implemented. Broader management features remain planned. |

## Planned Implementation Areas

These are high-level areas from the approved product documents, not additional requirements. Update their status as implementation begins and progresses.

| Area | Status | Notes |
|---|---|---|
| Management workspace | Not started | Dashboard, functions, tasks, guests/RSVP management, expenses, vendors, and gallery management. |
| Public wedding experience | Not started | Published wedding website, invitation/RSVP, live stream, gallery, and guest photo upload flows. Current public routes are scaffolds only. |
| Vendor discovery | Not started | Backend-mediated provider integration and saving discovered vendors. |
| Production readiness | Not started | Security, deployment configuration, backups, and performance work from the approved design. |

## Progress Update Notes

- 2026-10-03: Recorded the existing application scaffold and marketing homepage as the current baseline. The Angular production build passed during that baseline review.
- 2026-10-03: Started authentication and accounts from the approved Stitch screen. Added the MongoDB-backed auth/session APIs, Resend email adapter, frontend forms, and documentation for session storage. Angular production build, API build, and API typecheck passed; live auth verification remains pending environment configuration.
- 2026-10-03: Verified MongoDB with a temporary insert/read/delete fixture and confirmed the running `/api/auth/me` endpoint reaches MongoDB (expected HTTP 401 without a session). No account was created and no email was sent. Resend configuration is still absent, so signup verification and password-recovery email delivery are unverified. Added a registration preflight so missing email settings fail before any account write and provide a local setup message.
- 2026-10-03: Resend settings were added; the API server was restarted. A temporary pre-verified dummy user completed login (200), `/me` session lookup (200), logout (200), and post-logout `/me` rejection (401). The dummy user and its session/token records were removed. No email was sent, so signup verification and password-recovery delivery remain unverified.
- 2026-10-04: Temporarily paused signup verification-email delivery by user request. Registration now stores an unverified account without calling Resend; sign-in continues to require verified email. API typecheck/build and Angular production build passed; no live registration request or database write was performed in this work session.
- 2026-10-05: Restored verification email delivery and added explicit verification/resend states, stable auth errors, bounded frontend and database waits, management session guard, welcome/setup flow, and documented wedding creation with primary Admin membership. API typecheck/build and Angular production build passed. Angular tests failed before execution because the test builder could not resolve workspace paths; Atlas-backed registration-to-wedding smoke flow timed out while connecting.
- 2026-10-05: Added a signed-in header Sign out button to onboarding and the wedding workspace. It uses the existing logout endpoint, which revokes the MongoDB session and expires the HttpOnly cookie; the UI returns to sign-in only after a successful response.
- 2026-10-05: Added visible touched-field validation for sign-in and registration email/password/name fields, aligned registration limits with the API, and added accessible password visibility toggles. Angular production build passed.
- 2026-10-05: Corrected wedding setup to return the general-upload URL once while retaining only its token hash in MongoDB. Password reset now consumes the reset token and updates the password/revokes sessions within one MongoDB transaction. API typecheck/build run for these fixes.
- 2026-10-05: User confirmed code review and manual testing of login/signup are complete. Browser checks in this session also confirmed validation for malformed email, short password, and short name; generic invalid-credentials handling; recovery-email validation; and unauthenticated dashboard redirect. A successful signup was not submitted in this session.
