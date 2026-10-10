# CivicSync Project Plan

**Status:** Approved specification; implementation not started
**Canonical source:** This file is the source of truth for the approved CivicSync product and technical design.
**Delivery constraint:** 24-hour hackathon; the team reported approximately 12 hours remaining at the start of the grilling interview. Planning elapsed time reduces that budget; do not assume twelve fresh hours remain.
**Scope changes:** Require explicit user approval and an update to `DECISIONS.md` before implementation changes.

## 1. Purpose and problem

CivicSync is a public-works transparency and coordination platform. Residents can discover nearby public works, understand responsibility, progress, spending and disruption, report problems with evidence, and track official responses. Officials can publish and maintain project information, handle reports and identify potentially overlapping work.

The solution addresses the CivicTech problem statement:

- Residents lack reliable information about the purpose, authority, contractor, schedule and delay reasons for public works.
- Residents cannot easily follow up on poor or stalled work.
- Departments may schedule work without seeing related work by other departments, causing repeated disruption.
- Public spending and progress are difficult to understand.

The primary product loop is:

> Discover work → understand it → report an issue → receive an official response → inspect accountability and coordination.

## 2. Facts, assumptions and boundaries

### Confirmed facts

- The team knows the MERN stack and does not know Next.js.
- Four team members share one laptop/workspace; one person edits and runs code at a time.
- The other team members support architecture review, testing, data preparation, documentation, application testing and presentation rehearsal.
- No paid services are available or planned.
- The team has free-tier accounts and prior personal experience with Cloudinary, Render and MongoDB Atlas.
- Public browsing, resident accounts and provisioned official accounts are required.
- JWT authentication is approved with the limitations documented below.
- Resident evidence remains private; public transparency uses reviewed summaries and aggregates.
- Original deadlines and change history remain visible.
- The final two hours are reserved for deployed verification, fixes, documentation and demo preparation.

### Assumptions to verify during implementation

- JavaScript is the default implementation language unless the team confirms an existing TypeScript workflow is faster.
- Tailwind CSS is the styling system because it is the preferred familiar option.
- The initial operational demonstration uses approximately 12–15 labelled projects across two or three cities.
- The operational demonstration uses synthetic scenarios where source data lacks required fields.
- The application uses Asia/Kolkata for construction calendar-date interpretation and UTC timestamps for events.
- Official accounts are provisioned rather than created through public signup.
- The exact free AI provider and credential may be unavailable; AI is optional.

The hackathon document specifies a development cutoff of 10 October 2026 at 8:30 PM and submission cutoff of 9:00 PM. IST is the planning assumption. Submission requires a public deployment, GitHub repository, README/setup information, disclosure of used libraries/APIs and a 2–5-minute demo video included in the repository. The four-person team is not four parallel implementation streams.

### Scope boundaries

Included features are listed in Section 3. Do not add microservices, Redis, Docker, complex GIS, gamification, push notifications, machine-learning delay prediction, or unrelated civic datasets without explicit approval.

The CSV files supplied by the team are source/reference data, not automatically valid operational project records. Their origin is reported by the team as a government website, but the original URL and reporting date are unverified.

## 3. Approved features

1. Interactive project map and list discovery.
2. Nearby projects, search and combined filters.
3. Public project details: purpose, location, department, contractor, schedule, source and update time.
4. Project status, weighted milestones, progress updates and evidence.
5. Citizen issue reporting with location, category, description and photographs.
6. Resident report tracking and official assignment, response and resolution.
7. Official project and report administration with department boundaries.
8. Budget and contractor transparency.
9. Explainable delay, behind-plan and stale-update indicators.
10. Project coordination candidates and recorded resolutions.
11. Before–after comparison using explicitly paired, labelled photographs.
12. Complaint heatmap and community insights.
13. Responsive and accessible public and official interfaces.
14. Optional grounded AI project summary, outside every critical workflow.

### Features explicitly deferred

- AI/ML delay prediction.
- Gamification and leaderboards.
- Personalized in-app alerts and live push notifications.
- A free-form AI chatbot and verified impact analytics.
- Broad external-government data integration.
- Sophisticated road-network or polygon GIS.
- Public release of raw resident descriptions, photographs or exact locations.

## 4. Roles and authority

| Role | Access and responsibility |
|---|---|
| Public visitor | Browse published projects, public progress, public budget/contractor information, public coordination explanations and aggregate insights. |
| Resident | Public access plus submit reports and view the resident's own private reports/evidence and official responses. |
| Department officer | Manage projects owned by the officer's department; review, assign and respond to reports routed to that department; inspect relevant coordination candidates. |
| Municipal coordinator/administrator | Cross-department oversight, unassigned-report routing and final cross-department conflict decisions. |

Contractors are information records, not login roles in this scope.

Server-side authorization must enforce the following:

- A resident cannot change an official status or read another resident's private report.
- An officer cannot edit another department's project.
- An officer cannot reassign across departments without coordinator authority.
- A coordinator can route unassigned reports and finalize cross-department coordination decisions.
- Public signup can create only a resident account.
- UI visibility never substitutes for API authorization.

## 5. User journeys and website flow

### 5.1 Navigation

Public navigation:

**Explore · Community Insights · My Reports · Sign in**

Official navigation:

**Overview · Projects · Reports · Coordination · Public View**

### 5.2 Resident flow

1. **Explore (`/`)**: Search, filter, switch map/list, choose a locality or use location permission.
2. **Project (`/projects/:id`)**: See purpose, authority, contractor, status, original/current dates, progress, spending, evidence and coordination information.
3. **Progress/evidence**: Inspect weighted milestones, dated public official updates, source labels and any before–after pair. Private citizen evidence is accessed through the authorized report screen.
4. **Report (`/reports/new`)**: Start from a project or a location, choose issue category, add description, location and up to three photographs.
5. **Authentication**: Sign in or register as a resident, then return to the intended route while preserving unsaved text where possible.
6. **Submission confirmation**: Receive a durable report reference only after the database confirms persistence.
7. **My Reports (`/my-reports`)**: See the resident's reports and current status.
8. **Report detail (`/reports/:id`)**: See the original submission, private evidence, official responses and status history.
9. **Community Insights (`/insights`)**: See aggregate reviewed-report heatmaps and category/status totals.

The public project page exposes public official evidence, not residents' original photos. Original citizen evidence is visible only in authorized report detail. Search/filter state survives reload through URL parameters. A user can remove a failed optional image deliberately; the application never silently discards it or confirms a report before the database commits.

### 5.3 Official flow

1. Sign in through a provisioned account.
2. **Overview**: See department projects, report queues, stale/overdue work and coordination candidates.
3. **Projects**: Create a draft, enter required project facts and milestones, review validation, then publish.
4. **Project updates**: Change milestones, progress, budget and official evidence in one committed operation.
5. **Reports**: Review, assign, respond, set status, reject with a reason or resolve with a response.
6. **Coordination**: Compare candidate projects, record rescheduling, coordination or dismissal with an explanation.
7. **Public View**: Verify what a resident can see after each published change.

Official screens use `/admin`, `/admin/projects`, `/admin/reports` and `/admin/coordination`. Public signup is ordinary resident email/password registration without an email-verification/OTP dependency for the hackathon; it does not prove residency or email ownership. Provision working demo accounts for judging through secure configuration rather than committed credentials.

### 5.4 State transitions

Project publication states:

**Draft → Published → Withdrawn with explanation**

Project execution states:

**Planned → Ongoing → Completed**

Derived indicators are not manually trusted status values:

- Missed original deadline.
- Current forecast overdue.
- Milestone overdue or behind plan.
- Stale official update.

Report states:

**Submitted → Under review → Assigned → In progress → Resolved**

Additional report transitions:

- Under review → Rejected with explanation.
- Assigned/In progress → Reassigned with history.
- Resolved → In progress only through an authorized correction with a reason.

A project-linked report routes to its responsible department; a location-only report enters the coordinator's unassigned queue. Assignment must name an eligible official. Completing a project does not automatically resolve its reports. Published project withdrawal leaves an explanation and history at the existing URL; authorized completion corrections retain history rather than hard-deleting records.

Coordination states:

**Open → Coordinating → Resolved or Dismissed**

Material changes to relevant project dates, locations, segments or work type require re-evaluation.

All data screens need loading, empty, recoverable error, unauthorized and missing-record states. Mutations need editing, validating, saving, confirmed and failed/uncertain states.

## 6. Recommended architecture

### 6.1 Stack

| Layer | Recommendation |
|---|---|
| Frontend | React + Vite + React Router |
| Styling | Tailwind CSS |
| API | Node.js + Express REST API |
| Database | MongoDB Atlas + Mongoose |
| Authentication | Short-lived JWT in a Secure, HttpOnly cookie |
| Maps | Leaflet |
| Media | Cloudinary |
| Hosting | One free Render Node service serving the Vite build and Express API |
| Optional AI | One hosted AI provider, only after core workflows pass |

### 6.2 Request and component boundaries

Browser requests use the same origin:

**React application → `/api/v1` Express routes → validation/auth middleware → domain service → Mongoose → MongoDB Atlas**

External boundaries:

- Express → Cloudinary for persistent media.
- Browser → map tile provider for visible map tiles.
- Express → optional AI provider for grounded summaries.

Frontend areas:

- Application shell and route layouts.
- Authentication context and expiry handling.
- Explore/map/list/filtering.
- Project detail/progress/budget/evidence.
- Resident report form/tracking.
- Official workspace.
- Community insights.
- Shared API/error/accessibility components.

Backend domain services:

- Auth: login, logout, JWT verification and current user.
- Projects: publication, lifecycle, milestones, updates, budget and contractor data.
- Reports: creation, routing, assignment, responses and history.
- Coordination: candidate rules, fingerprints and decisions.
- Media: validation, Cloudinary upload and authorized delivery.
- Insights: reviewed-report aggregation.
- Summaries: source snapshot, optional generation and factual fallback.
- Audit/activity: public-safe and private change history.

Keep the application as one modular service. Do not split these domains into independently deployed services.

The server owns authorization, progress and delay calculations. Public responses select allowed fields explicitly. The frontend refreshes affected data immediately after a successful mutation and revalidates active detail/report screens within approximately 30 seconds and on focus. Private/authenticated responses are not stored in a shared cache.

## 7. Stack trade-offs

The team knows MERN and does not know Next.js. MERN is therefore the safer deadline choice even though the previous Next.js/Supabase plan offered stronger relational constraints and managed authorization primitives.

| Concern | Chosen MERN design | Previous Next.js/Supabase alternative | Decision consequence |
|---|---|---|---|
| Team speed | Familiar React/Vite/Express/Mongoose | New Next.js server/client and Supabase patterns | Lower learning risk; more explicit backend discipline is required. |
| Data integrity | Mongoose validation, application rules, indexes and transactions | PostgreSQL constraints/RLS | MongoDB references do not enforce foreign keys; services must verify them. |
| Authorization | Express middleware plus current database role/department checks | Supabase Auth/RLS | Every protected route and media access path must be tested directly. |
| Geography | Curated road-segment IDs plus optional `2dsphere` point queries | PostGIS geometry support | Feasible for the scope; no complex geometry proof. |
| Hosting | Single free Render service | Vercel/managed Supabase deployment | Simpler same-origin cookies; free Render cold starts are accepted. |
| Media | Cloudinary plus API authorization | Supabase Storage policies | More explicit private delivery logic is required. |

The plan does not introduce Vercel as the primary deployment. A Vercel frontend plus cross-origin/proxied Express API is a documented alternative, not an automatically authorized fallback. Changing the selected topology still requires explicit approval.

### JWT versus server-session trade-off

Both alternatives need secure cookies, CSRF protection, password hashing and current-user authorization checks. MongoDB-backed sessions allow logout to invalidate the stored session identifier, but require session-store configuration and persistence tests. The selected JWT approach avoids that store and refresh-token machinery, but clearing the cookie cannot revoke a copied token. Because each protected request still reads the current user, JWTs do not remove the MongoDB dependency or provide a claimed database-free scaling advantage. Test signature/claims/expiry and the accepted logout limitation explicitly.

### Scalability and complexity

Use bounded/paginated queries, spatial and department/status indexes, bounded milestone arrays, separate growing histories and a reused bounded database connection pool. Public images can use Cloudinary delivery; private image relay and upload processing consume API bandwidth and memory. Restrict processing concurrency and cache optional summaries by source hash. Inspect query/provider bottlenecks before introducing additional infrastructure. No city-wide all-pairs scan should run on every page request.

## 8. MongoDB data model

Use references for independently growing records and embed only bounded data that changes with the parent. Serialize record IDs consistently as strings at the API boundary; choose and document the Mongoose identifier representation during I2. There is no server authentication-session collection in the approved JWT design.

### Collections

#### `users`

- `emailNormalized` (unique).
- `passwordHash`.
- `displayName`.
- `role`: `resident`, `officer`, `coordinator`.
- `departmentId` for officials.
- `active`.
- Timestamps.

#### `departments`

- Code, name and public contact/source fields.

#### `contractors`

- Name and public contact/source fields.

#### `roadSegments`

- City/municipality.
- Stable corridor and segment codes.
- Start/end labels.
- Optional display point/line data.

#### `projects`

- Stable project code, title, purpose, type.
- City/locality.
- Department and contractor references.
- Discovery `location` as GeoJSON Point where known.
- Explicit `roadSegmentIds`.
- Work flags such as excavation/restoration.
- Publication and execution states.
- Original/revised/actual schedule dates.
- Official delay explanation.
- Budget amounts in paise or explicit `null`.
- Bounded embedded milestones.
- Source/provenance and last-update fields.
- Source-record identity and reported status/amount retained separately from operational values; a demo/source origin label.
- Selected before/after media IDs where a valid comparison is available.
- `version` for optimistic concurrency.

Schedule fields distinguish original planned start/deadline, current revised forecast and actual start/completion. Budget fields distinguish estimate and expenditure with update/source metadata. Each embedded milestone has a stable ID, title, weight, due date, progress percentage, order and optional actual completion date.

#### `projectUpdates`

- Project, author, narrative, progress/budget snapshot, media IDs and publication timestamp.

#### `reports`

- Durable report reference.
- Resident owner.
- Optional project.
- Private exact location and approximate public grid cell.
- Category and description.
- Routed department and assignee.
- Status, public-safe summary and response fields.
- Media IDs.
- `version` and timestamps.

#### `media`

- Owner, purpose and association.
- Cloudinary asset/public ID and delivery type.
- Format, size, dimensions and state.
- Capture/upload date and optional viewpoint identifier.

#### `conflictDecisions`

- Canonical project pair.
- Rule ID and rule version.
- Input fingerprint.
- Decision/status and public explanation.
- Actor and timestamps.

#### `activityEvents`

- Entity type/ID, actor, event, safe before/after details and timestamp.

#### Supporting collections

- `idempotencyRecords` for retry-safe commands.
- `aiSummaries` for source-hashed optional summaries.
- `rateLimitBuckets` for bounded abuse protection.

Idempotency records contain actor, operation, key, request hash, committed outcome/reference and expiry. AI records contain project, source hash, prompt version, generation state, text/references and timestamp. Rate-limit records contain a bucket key, window, count and expiry. All temporary expiration checks must be enforced by application logic; eventual TTL cleanup is not an authentication or authorization check.

### Indexes

- Unique normalized user email.
- TTL indexes for expiring idempotency/rate-limit records; no authentication-session TTL index.
- Unique project code.
- Projects by publication, city/locality, department and lifecycle.
- `projects.location` as `2dsphere`.
- Projects by `roadSegmentIds`.
- Reports by unique reference, owner/time, department/status/time, project/status and public grid cell/time.
- Updates/events by entity/time.
- Unique conflict pair/rule key.
- Unique actor/operation/idempotency key with expiry.
- AI summary source hash/prompt version key.

MongoDB coordinates use GeoJSON longitude first, latitude second. Leaflet commonly uses latitude first, longitude second; conversion must be centralized and tested.

## 9. Data and business rules

### Source records and operational demo data

Use approximately 12–15 labelled operational demo projects across two or three cities with scenarios for all approved workflows. Relevant incomplete CSV rows remain staged drafts/reference records with missing values preserved. Do not add an unrelated source-data analytics screen or generic CSV-import product feature.

`csv5` provides 21 named projects, reported statuses and amounts in crores; it does not provide actual expenditure, schedules, coordinates, milestones or verified project ownership. Its city association needs source confirmation. `csv1`/`csv7` are location references and `csv2`/`csv6` are aggregate reference data. Do not turn an aggregate count into invented individual projects. The other supplied files are outside the approved operational scope.

Source snapshots keep reported status separate from operational lifecycle. A source row marked completed must not cause fabricated completion dates/evidence to be created. Unknown amounts/dates/coordinates remain unknown. Use precisely the provenance statement: user-supplied data, reported by the team to originate from a government website; original URL and reporting date unverified.

### Publication and reference validation

Publication requires purpose, responsible department, valid location/schedule, source/demo label and a usable milestone plan. Contractor and budget can be explicitly unknown. Validate referenced departments, contractors, segments, assignees and media in services: Mongoose references do not enforce foreign keys. Drafts may be incomplete; they must pass the full publication gate before becoming operational public records.

### Money

- Store integer paise within safe integer limits.
- `null` means unknown; `0` means known zero.
- Remaining budget may be negative.
- Utilization may exceed 100%.
- If estimated cost is null or zero, utilization is unavailable.
- Do not treat the source `csv5` amount as actual expenditure without verified meaning.
- Contractor transparency links the contractor's actual stored published projects; it does not invent performance ratings, penalties or completion histories.

### Dates and progress

- Construction dates are real, validated `YYYY-MM-DD` calendar dates interpreted in Asia/Kolkata. Compare day boundaries explicitly; the deadline is not missed until its local day has ended.
- Event times are BSON Date values serialized as UTC timestamps through the API.
- Reject reversed intervals, impossible dates and future actual-start/completion dates.
- Original deadline remains visible after revision.
- Current forecast and original deadline are separate facts.
- Milestone weights total 100.
- Progress is `sum(weight × milestoneProgress) / 100`.
- Formal completion requires an actual completion date and completion update/evidence.
- Expected minimum progress is the sum of weights for milestones due by the evaluation date. Compare it to the weighted actual progress and show the overdue milestones; missing plans mean insufficient information.
- Approved behind-plan default: 10 percentage points below milestone-based expected progress.
- Approved stale-update default: 14 days without an official update for unfinished work. This signals old information, not proof that work stopped.
- Completed-late projects show historical lateness rather than an active overdue warning. Preserve original and current-forecast delay explanations separately.

### Atomic commands, retries and concurrency

| Command | Records that must commit together |
|---|---|
| Report submission | Report, eligible media ownership/attachment claims, initial activity and idempotency outcome |
| Report action | Status/assignment, official response, history and idempotency outcome |
| Project update/action | Project/milestones/budget, associated update/media claims, history and idempotency outcome |
| Conflict decision | Version-guarded project writes, authorized schedule changes, decision, history and idempotency outcome |

Use a transaction-capable Atlas replica-set deployment and verify it before relying on transactions. Pass the same transaction session to every participating operation, execute sequentially inside the transaction, and keep transactions short. External media/AI calls and other irreversible effects remain outside retryable transaction callbacks.

Single-document writes are atomic, but do not replace the above multi-record boundaries. Check expected versions before changing records. Same actor/operation/key and same payload return the original committed result after authorization; a changed payload returns `409`. A retry after a lost response uses the same key. Do not store credentials or JWTs in idempotency outcomes. A failed transaction must never leave a resolved report without its required response/history.

### Community insights

- Population: reviewed reports in `Assigned`, `In progress` or `Resolved`.
- Exclude rejected duplicates.
- Aggregate to approximate 250-metre cells.
- Display report concentration, not neighbourhood quality or causality.
- Use the same population and filters for map and totals.

### Optional summary

AI starts disabled. Only after the complete deployed reporting/coordination loops pass and a usable free credential is verified may there be an approximately 30-minute integration attempt, before the final verification reserve. If it fails, retain the labelled factual fallback and record generation as unavailable, not completed.

An authorized official triggers a bounded generation request from a snapshot of public fields only. Cache by source hash and prompt version; relevant source changes invalidate the result. Use timeouts/rate limits, validate structure/references and numerical/date claims, and display the source/update information. Treat generated text as untrusted. No private reports, arbitrary tools or database-write permission are provided to the model. No core mutation calls the AI provider.

## 10. Conflict detection

Strong candidates use explicit shared segment IDs and inclusive date overlap. Nearby coordinate matches are advisory and are not proof of conflict.

| Rule | Conditions | Display |
|---|---|---|
| Shared-segment overlap | Same segment and intersecting work intervals | Strong coordination candidate |
| Nearby concurrent work | Recorded points within 200 metres and intersecting intervals | Potential nearby-work candidate |
| Repeated excavation | Shared segment; later excavation starts within 90 days of earlier excavation/restoration ending | Potential repeated disruption |
| Completion uncertainty | Earlier work remains ongoing after forecast and another project affects the same area | Clarification required |

Rules:

- Same-day handovers are overlaps because intervals are inclusive.
- Each rule requires its own inputs: missing segments prevents a strong segment match but does not prevent a lower-confidence coordinate match; missing coordinates does not prevent a valid segment match. Missing required inputs yield `cannot assess` for that rule, not `no conflict`.
- An expired forecast does not prove a project completed.
- Actual dates take precedence where known. Completed pairs describe historical repetition/overlap rather than active coordination. Future work near an overdue ongoing project receives a completion-uncertain explanation rather than a fabricated future end date.
- Nearby parallel roads may be false positives; label confidence basis and require review.
- Draft projects are not exposed publicly.
- Project pair order is canonicalized; A–B and B–A are one pair.
- Multiple matching rules can appear for one pair.
- Same-department work can still conflict; long works with shared segments are matched even if their discovery markers are far apart. Withdrawn work stops being an active candidate but retains public history.

Generate strong candidates from indexed shared-segment queries, then evaluate inclusive date/work rules in a pure domain function. Query nearby points separately with the spatial index. Deduplicate ordered project pairs and attach decisions matching the relevant fact fingerprint. Return the rule, confidence basis and evaluation time. Persist human decisions, not stale manually toggled warning flags; use current facts and the evaluation date on reads. Bound and paginate the coordination queue.

Each decision stores a fingerprint of relevant project facts. Schedule, segment, coordinate, work-type or lifecycle changes can reopen review. Budget-only changes do not.

Resolution outcomes:

- **Rescheduled:** stored dates changed and the overlap no longer matches.
- **Coordinated:** overlap remains, but an authorized official recorded the arrangement.
- **Dismissed:** authorized explanation says the candidate is not a meaningful conflict.
- **Changed later:** new facts require a fresh review while old history remains.

Conflict resolution checks both expected project versions and performs a conditional write to both projects inside the same transaction, even when recording coordination without a schedule change. Reading both and writing only the decision does not prevent a concurrent project edit. Re-evaluate current facts and fingerprint before committing. Stale inputs return `409`; retain old decision history and match resolutions to the resulting facts.

## 11. REST API contracts

Business/auth routes below are under `/api/v1`; deployment health routes are listed separately in Section 14. JSON responses use explicit DTOs, bounded pagination and ISO-compatible dates/timestamps. Nontrivial creation/transition commands use `Idempotency-Key`; edits/transitions use `expectedVersion`. Authentication is verified afresh rather than replaying a cached login response.

### Authentication

- `GET /auth/csrf`: issue a CSRF token for the current browser context; state-changing requests send it in `X-CSRF-Token`.
- `POST /auth/register`: resident registration.
- `POST /auth/login`: credential verification and JWT cookie.
- `POST /auth/logout`: clear cookie with CSRF/origin protection.
- `GET /auth/me`: current user or anonymous state.

### Public/resident reads

- `GET /reference-data`: public departments, categories, cities/localities and road segments.
- `GET /projects`: search, filters, cursor and optional city/location/radius.
- `GET /projects/map`: bounded map viewport query.
- `GET /projects/:id`: public project detail and computed indicators.
- `GET /projects/:id/updates`: public dated update/evidence history.
- `GET /projects/:id/conflicts`: public candidates and decisions.
- `GET /projects/:id/summary`: cached grounded summary or labelled factual fallback.
- `GET /insights`: heatmap cells and matching aggregate totals.
- `POST /reports`: authenticated resident report creation.
- `GET /reports/mine`: authenticated resident's reports.
- `GET /reports/:id`: owner or authorized official report detail.

### Media

- `POST /media`: authenticated bounded multipart image upload to Cloudinary.
- `GET /media/:id/content`: authorized media retrieval.

### Official

- `GET /admin/projects`: department-scoped projects.
- `GET /admin/projects/:id`: authorized project detail for the editor, including an accessible draft.
- `POST /admin/projects`: create draft.
- `PATCH /admin/projects/:id`: allowed draft/project edits with version.
- `POST /admin/projects/:id/actions`: publish, start, complete, withdraw or authorized correction.
- `POST /admin/projects/:id/updates`: atomic progress/budget/evidence update.
- `GET /admin/reports`: department/coordinator queue.
- `POST /admin/reports/:id/actions`: review, assign, respond, resolve, reject or reassign.
- `GET /admin/conflicts`: current coordination queue.
- `POST /admin/conflicts/actions`: version-checked decision/resolution.
- `POST /admin/projects/:id/summary`: authorized optional AI generation.

### Payload and response requirements

| Operation | Required contract |
|---|---|
| Registration/login | Name where registering, normalized email and password; successful login sets the cookie and returns safe user/expiry data, never the JWT in JSON. Public role input cannot grant authority. |
| Project discovery | Search, city/locality, department, type, derived status, cursor/limit; optional coordinates/radius or bounds. Return public summaries and paging metadata; map truncation is explicit. |
| Project create/edit | Allowlisted project fields from Section 8; references validated, identity/actor server-derived; version and change reason where applicable. Return saved version. |
| Project action/update | Action or narrative plus proposed milestone/budget fields, media IDs, expected version and required reason/evidence. Return committed project/update version. |
| Report submission | Optional published project ID, location, category, description and ready media IDs. Category includes stalled work, poor quality, safety hazard, incorrect information, excessive disruption and other. Return durable reference/status/version. |
| Report action | Action, expected version, optional assignee/department and required response/reason. Enforce the permitted transition and authority; return saved status/version. |
| Conflict decision | Ordered project pair, rule, input fingerprint, both expected project versions, decision/reason and authorized schedule edits. Return applicable outcome and saved versions. |
| Media upload/read | Multipart image with purpose and target where known; return verified ready media ID. Retrieval returns authorized bytes, not a private reusable Cloudinary URL. |
| Insights | Area, date range, category and status filters; return approximate cells and totals from the same reviewed population. |
| Summary read/generation | Project ID and source version/hash; return matching generated text/references or a clearly distinguished factual fallback. |

Private report reads require owner/department/coordinator access; public queries return only published public fields. Register fixed paths such as `/reports/mine` before generic identifier routes. Reject unknown writable fields instead of passing request bodies directly to Mongoose.

### Error contract

Use consistent JSON errors with `code`, safe `message`, optional `fieldErrors` and `requestId`.

- `400/422`: malformed or invalid input.
- `401`: sign-in required/expired JWT.
- `403`: insufficient authority.
- `404`: missing or undiscoverable record.
- `409`: stale version, invalid transition or idempotency mismatch.
- `413`: upload too large.
- `429`: rate limit.
- `503`: dependency unavailable.

## 12. Authentication and security

### JWT design

- 30-minute absolute expiry.
- No refresh token or rotation system.
- Secure, HttpOnly, host-only cookie.
- `SameSite=Lax` for the single-origin deployment.
- Strong server-only signing secret.
- Hash passwords with an established library and a calibrated work factor; never store plaintext passwords. If bcrypt is used, enforce its input-byte limit rather than silently truncating.
- Fixed signing algorithm allowlist.
- Verify signature, issuer, audience, subject and expiration.
- Every protected operation loads current user active status, role and department from MongoDB.
- JWT claims never grant authority by themselves.
- Expiration returns a clear sign-in-required error; preserve unsaved form state where possible and require explicit sign-in. Recheck identity and media ownership before resuming and never silently submit under another account.
- Protected private-media reads follow the same current-user checks. Database failures return dependency errors and never bypass authorization. Cookie clearing uses matching path/security attributes.

Clearing the cookie on logout does not invalidate a copied/stolen JWT. A copied token can remain usable until its expiry unless current account/permission checks reject the operation. The system must not claim immediate JWT revocation.

### CSRF, origin and input security

- Use an allowed-origin check plus a CSRF token obtained from `GET /auth/csrf` and sent in `X-CSRF-Token` for cookie-authenticated state changes, including registration, login, logout, uploads and all write actions.
- The CSRF token is not an authentication token and must not be treated as one. The JWT remains Secure and HttpOnly.
- Validate allowed origins for mutations.
- Successful login issues a fresh JWT; there is no server authentication-session identifier to regenerate. Keep the signing configuration stable across normal restarts/handoffs.
- Allowlist writable fields.
- Reject MongoDB operator injection and arbitrary regular expressions.
- Bound text, pagination, upload count and image size.
- Use server-side validation even when frontend validation exists.
- Never put secrets, passwords, tokens or private media URLs in logs.
- Render resident/model-generated text as text, not executable HTML.
- Never fetch arbitrary user-provided remote image URLs through the server.

### Media privacy

Resident evidence and unpublished official images use Cloudinary's `authenticated` delivery type. The `private` type alone can leave derived images accessible and is not an equivalent replacement. Express authorizes access against the associated report/project before fetching the stored, fixed asset and streaming it with `Cache-Control: private, no-store`. Do not expose reusable signed delivery URLs to the browser. Ordinary signed Cloudinary URLs are not automatically expiring or user-bound. Public official images are explicitly published. The local filesystem is never the production source of media.

## 13. Cloudinary upload design

Flow:

**Browser → bounded Express upload → validate/normalize → Cloudinary → ready media record → transactionally attach to report/update**

Limits:

- Three images per report/update.
- Maximum 2 MB per image after resizing.
- JPEG, PNG and WebP only.
- Validate actual bytes, decoded dimensions and format.
- Normalize orientation and remove metadata.
- Keep image-processing concurrency bounded.

Cloudinary calls occur outside MongoDB transactions. MongoDB attachment and ownership claims occur inside the relevant transaction. Reserved deterministic identifiers allow reconciliation after a Cloudinary-success/MongoDB-failure boundary. Unattached assets may be cleaned after a grace period without deleting attached evidence.

Illustrative before–after images are clearly labelled and must not be represented as verified evidence for an unrelated source project.

Explicitly select images from the same project/viewpoint, order their dates and label capture dates when known or upload dates otherwise. Store the selected IDs with the project; reject unauthorized/ineligible media. One missing image falls back to a gallery/empty comparison. The comparison must work with touch and keyboard.

## 14. Deployment

### Primary: single free Render Node service

The service serves the Vite production build and Express API from one origin:

- `/api/v1/*` for API routes.
- `/health/live` for process health.
- `/health/ready` for database readiness.
- Static assets and React Router fallback for frontend routes.

API routes must be matched before the SPA fallback. Unknown API routes return JSON 404; missing JavaScript assets must not return HTML. Deep links must work on direct navigation. Bind Express to the host-provided port and correct interface; configure proxy trust for the actual topology and verify secure-cookie behaviour. Keep private/authenticated API responses out of shared caches.

Accepted risks:

- Free Render services sleep after inactivity and may take approximately one minute to wake.
- The whole application can be unavailable during startup.
- Free-tier service limits and restarts are accepted for the hackathon.

Before the service wakes, Render may supply its own loading response; the React application cannot guarantee its own startup UI before its assets are available. Test the real first-visit behaviour rather than treating prewarming as guaranteed availability.

### Alternative: Vercel frontend with Express API

This is not primary because it introduces CORS, credentialed cross-origin cookies, two deployments, proxy/cache configuration and possible frontend/API version mismatch.

If used, prefer a Vercel rewrite to the API so browser requests appear same-origin, disable caching for private/authenticated responses, preserve cookies and test proxy timeouts. Direct cross-origin requests require exact CORS, credentials, preflight and `SameSite=None; Secure` handling.

### Environment configuration

Frontend-exposed configuration is public. Server-only values include:

- MongoDB URI.
- JWT secret and issuer/audience settings.
- Cloudinary cloud name/API key/API secret.
- Optional AI key/model.
- Allowed origin and environment mode.

Document names in `.env.example`; never commit actual values.

Allowlist Render's published outbound ranges in Atlas and use a database user scoped to the application database. Verify provider credentials early, pin compatible runtime/dependency versions and retain the lockfile. Keep a known-good release for rollback, use compatible/additive data changes during the hackathon and check the selected tier's backup/export capabilities. Cloudinary/Atlas persistence must survive application redeployment. Vite-exposed values are public build-time values and normally require a rebuild when changed.

Choose a free map-tile provider during configuration and record attribution/usage terms. Leaflet is not itself a tile service. Provider failure must leave list/search usable; do not claim an SLA for a best-effort free tile service.

### Production first-visit check

Use a fresh browser against the exact public URL. Test deep-link loading, cold-start recovery, login, report submission with a real persistent image, official response, reload persistence, sign-out and private-media denial.

## 15. Failure modes and mitigations

| Failure | Mitigation |
|---|---|
| Render cold start | Early hosted deployment, visible retry state and idle-to-first-visit test. |
| API/SPA route collision | API routing before frontend fallback and production deep-link tests. |
| JWT copied after logout | Documented 30-minute maximum exposure; current DB status/role checks; no false revocation claim. |
| Cross-department authorization bypass | Server scope checks and direct API tests. |
| Partial report/status write | MongoDB transactions and idempotency keys. |
| Stale official edit | Version checks and `409` response. |
| Cloudinary succeeds but DB fails | Reserved IDs, ready/attached media state and reconciliation. |
| Private media leak | Authenticated Cloudinary delivery plus Express access checks. |
| Coordinate order error | Central adapter and geospatial fixtures. |
| Conflict false positive | Segment IDs for strong candidates, lower-confidence nearby label, human resolution. |
| Source data missing fields | Preserve `null`/unknown and use labelled demo fixtures. |
| AI failure | Independent request, timeout, validation and factual fallback. |
| Atlas/network/config failure | Readiness endpoint, early smoke test and safe dependency errors. |

## 16. Quality gates

The resident-to-official-to-resident journey must work on the deployed application with real persistence before polishing secondary screens. No functionality is complete merely because code was generated. Verification requirements are in `TEST_PLAN.md`; the ordered work is in `TASKS.md`.

Check 360px/mobile and desktop layouts, labelled forms, keyboard/focus handling, touch interaction, readable contrast and status text beyond color. Use representative bounded fixture queries before claiming scaling capability. Preserve the final two hours for production verification, fixes, README and a 2–5-minute hosted demo video. Optional AI or visual polish cannot consume that reserve; further reductions in approved non-AI scope require approval.
