# CivicSync Test Plan

`PROJECT_PLAN.md` defines the expected product and architecture. This file defines how implementation must be verified. Until implementation begins, all checks below are **not run** unless explicitly marked otherwise in `CURRENT_STATE.md`.

## 1. Test principles

- Test the deployed application, not only local screens.
- Test direct REST requests, not only buttons hidden by the UI.
- Treat persistence after reload as part of acceptance.
- Test failure states as deliberately as success states.
- Never use real secrets in tests, logs or committed fixtures.
- Use labelled deterministic fixtures for conflict, delay, report and media scenarios.
- Keep optional AI out of all core acceptance gates.

## 2. Test data fixtures

Create a small, labelled fixture set only during implementation:

- Multiple cities/localities.
- Published planned, ongoing, delayed and completed projects.
- Draft and withdrawn projects.
- Projects with complete, partial and missing dates/locations/segments.
- Shared segment/date overlap.
- Same corridor but different segment.
- Nearby parallel-road points.
- Repeated excavation at exactly 90 and 91 days.
- Reports in every permitted workflow state.
- Rejected duplicate reports.
- Resident evidence, official evidence and illustrative before–after pairs.
- Budget values: unknown, zero, ordinary, remaining negative and utilization over 100%.
- Source/reference CSV records with missing fields preserved.

Fixture records must clearly identify synthetic/demo content and must not imply that missing government facts were verified.

## 3. Functional tests

### Public discovery

- Explore loads published projects.
- Search matches supported project fields without allowing arbitrary MongoDB operators or unbounded regular expressions.
- Combined city, locality, department, type and status filters work.
- Map and list results agree for the same filters.
- Nearby results use the documented distance calculation.
- Map viewport queries are bounded and indicate truncation/limits if applicable.
- Manual location works when browser geolocation is denied.
- Map tile failure leaves the list and project links usable.
- Empty results are distinct from API/dependency failure.

### Project details

- Direct project URLs load on refresh.
- Drafts are not public.
- Withdrawn project URLs preserve a withdrawal explanation/history; they are not active project/conflict records.
- Project purpose, authority, contractor, dates, source and update time are visible when known.
- Unknown values are labelled unknown rather than shown as zero or fabricated.
- Original and revised deadlines are both represented.
- Public DTOs contain no private resident data or draft fields.

### Progress, budget and evidence

- Milestone weights must total 100.
- Milestone progress bounds are enforced.
- Weighted overall progress is calculated correctly.
- Completion requires a date and completion update/evidence.
- Original deadline delay remains after a revised forecast.
- Behind-plan threshold boundary is tested at and around 10 percentage points.
- Stale-update boundary is tested at and around 14 days.
- `null`, zero, negative remaining and over-100% utilization are displayed correctly.
- Before–after pairs require matching project/viewpoint and valid date/source labels.
- Missing evidence yields an honest empty/gallery state.

### Resident reports

- A resident can report against a project.
- A resident can submit a location-only report.
- Category and description validation works.
- Submission returns a durable reference only after persistence.
- User can view their own report after reload.
- User cannot view another resident's report.
- Report status history is ordered and complete.
- Project-linked reports route to the owning department; location-only reports route to the coordinator's unassigned queue.
- Completing a project does not silently resolve its reports.
- Rejection and resolution explanations are required where specified.
- Network interruption can safely retry with the same idempotency key.

### Official workflow

- Officer can manage only the officer's department projects.
- Officer can review/act on reports routed to the officer's department.
- Coordinator can route unassigned reports and make cross-department decisions.
- Officer cannot change another department's project by changing an ID in a direct API request.
- Project publication validates all required fields.
- Project update changes milestone/budget/evidence consistently.
- Report action changes status, response, assignment and history together.
- Invalid state transitions are rejected.
- Stale version edits require reload rather than overwriting.

### Insights

- Heatmap counts match the documented reviewed-report population.
- Rejected duplicates are excluded.
- Heatmap and summary totals use identical filters.
- Exact private locations are not exposed publicly.
- Resident identities, raw private descriptions and private photos are not exposed.

## 4. Integration and persistence tests

### MongoDB

- Application connects to Atlas with configured credentials.
- Required indexes exist.
- Invalid references are rejected by service validation.
- Transaction rollback leaves no partial report/status/history write.
- Transaction retry does not duplicate operations.
- Idempotency key with same payload returns the original result.
- Same idempotency key with different payload returns a conflict.
- Concurrent project edits cannot silently overwrite one another.
- Conflict resolution checks current versions of both projects.
- Force a concurrent project edit while a decision is being recorded; the conditional writes to both projects must prevent a stale decision from silently committing.
- Verify every participating Mongoose operation receives the transaction session and no external upload/AI side effect runs inside a retried transaction callback.
- Data survives application restart and Render redeploy.

### Cloudinary

- Valid image uploads persist outside the local filesystem.
- Oversized, unsupported, corrupted and excessive images fail safely.
- Cloudinary response metadata is verified before media becomes ready.
- Cloudinary success followed by MongoDB failure is recoverable.
- Unattached media is not deleted before its cleanup grace period.
- Attached media is not deleted by abandoned-upload cleanup.
- Protected media is unavailable to unrelated residents and anonymous users.
- Original and derived authenticated Cloudinary assets reject unsigned access; public DTOs and authorized browser responses never reveal reusable private delivery URLs.
- Two submissions cannot claim one media record, and a different owner cannot attach it.
- Authorized owner/official access works after reload and restart.

### External services

- Atlas outage returns a safe dependency error, never an authorization bypass.
- Cloudinary outage preserves report text/draft state and explains upload failure.
- AI outage never blocks publication, reporting, status changes or resolution.
- Render cold start produces a recoverable loading/retry experience.

## 5. Authorization and security tests

### JWT

- Login sets Secure, HttpOnly, host-only cookie in production.
- Cookie is not readable through browser JavaScript.
- Signature, issuer, audience, subject and expiry are checked.
- Expired JWT returns a clear authentication error.
- Malformed, wrong-signature, wrong-algorithm and wrong-audience tokens fail.
- Logout clears the cookie.
- Test and document that a copied token may remain valid until expiry; do not call this revocation.
- Current user `active=false` blocks protected operations.
- Current role/department changes affect authorization even when the JWT remains unexpired.
- Repeat the same current-user tests on private-media retrieval, including JWT expiry and database failure.
- JWT signing configuration remains stable across normal restarts; frontend storage and JSON login responses contain no authentication token.
- Preserve the unsaved form on expiry, require sign-in, and reject resumption under a different account/media owner.

### Roles and ownership

- Anonymous user cannot create reports or access private media.
- Resident A cannot read or mutate Resident B's report.
- Resident cannot call official actions.
- Officer A cannot update Department B.
- Officer cannot cross-assign without coordinator authority.
- Coordinator can route unassigned/cross-department items.
- Official role cannot be created through public registration.
- Direct API requests receive the same authorization results as UI requests.

### Input and web security

- Cookie-authenticated state changes require CSRF/origin protection.
- Reject missing/invalid CSRF tokens and disallowed origins on register/login/logout, multipart upload and business-write endpoints. The CSRF endpoint must not disclose authentication tokens.
- MongoDB operator injection attempts fail.
- Arbitrary remote image fetch is unavailable.
- Response DTOs do not contain passwords, token material, secrets or private media delivery URLs.
- User/model text is rendered safely as text.
- Login, report, upload and AI endpoints have bounded rate limits.
- Logs do not contain credentials, tokens, private descriptions or private image URLs.

## 6. Conflict algorithm tests

- Same exact segment with overlapping dates is a strong candidate.
- Same exact segment with no overlap is not an active overlap candidate.
- Same corridor but different segments is not automatically strong.
- Same-day handover is overlap because intervals are inclusive.
- Point at exactly 200 m is a potential nearby candidate; just outside is not.
- Nearby points on parallel roads are labelled potential, not strong/proven conflict.
- Shared segment with later excavation exactly 90 days after prior restoration is a repeated-disruption candidate; 91 days is not.
- Missing required inputs yields `cannot assess` for the affected rule. Missing segments still permits coordinate-only candidates; missing coordinates still permits valid segment/date candidates.
- Same-department candidates and shared segments with distant discovery markers are handled correctly.
- Expired forecast does not mean completed.
- A–B and B–A produce one canonical pair.
- Multiple matching rules are shown without duplicate pairs.
- Draft data is not exposed publicly.
- Rescheduled outcome changes public dates and removes the matching active rule when appropriate.
- Coordinated outcome keeps the overlap visible with a coordination explanation.
- Dismissed outcome keeps the explanation and does not suppress a new fingerprint.
- Schedule/segment/work-type changes reopen review.
- Budget-only change does not reopen review.
- Concurrent resolution against changed project versions returns a conflict.

### Optional summary

- Generation starts disabled without a usable credential; factual fallback is clearly distinguished from AI output.
- Only allowed public fields reach the provider; private report data never does.
- Timeout, quota exhaustion, invalid output and unsupported factual claims lead to fallback without blocking core operations.
- Relevant project changes invalidate a cached source hash; no stale result is presented as current.
- Core flows pass with AI disabled and after a provider failure.

## 7. Regression checks

Run after each verified milestone relevant to the changed domain:

- Authentication and role matrix.
- Public project list/detail and deep links.
- Report creation/retry/status history.
- Media privacy and persistence.
- Budget/progress/delay boundary fixtures.
- Conflict pair and public resolution fixture.
- Heatmap population/privacy fixture.
- Mobile layout and keyboard navigation for the changed journey.
- API error shape and request IDs.
- Successful official changes refresh affected views immediately; an active report/detail view revalidates within approximately 30 seconds and on focus.

## 8. Production verification checklist

Run against the exact judge-facing URL in a fresh browser:

1. Open the home page after an idle period and recover from Render startup.
2. Navigate directly to a project URL and refresh.
3. Search/filter a multi-city dataset.
4. Open a delayed project and inspect original/current dates, progress, budget and conflict state.
5. Register/sign in as a resident.
6. Upload a test photo, submit a report, record the reference and reload.
7. Open a separate official session and assign/respond/resolve.
8. Return to the resident session and verify the persisted response.
9. Test unauthorized report/private-media access.
10. Record a conflict action and verify its public explanation.
11. Inspect before–after and community insights.
12. Test logout, expired authentication handling and re-login.
13. Disable/fail optional AI and confirm core workflows remain usable.
14. Check responsive, keyboard and non-color status cues.
15. Confirm no actual secret is present in the repository or frontend bundle.
16. Verify HTTPS cookie/proxy handling, absent shared caching of authenticated responses, and JSON API 404 versus SPA fallback behaviour.
17. Reproduce setup from the pinned runtime/lockfile and documented configuration on the handoff laptop or a fresh setup; record whether that check was actually possible.

Record results and known failures in `CURRENT_STATE.md`; update `TASKS.md` only when the stated acceptance criteria are verified.
