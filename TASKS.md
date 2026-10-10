# CivicSync Tasks

`PROJECT_PLAN.md` is the source of truth. This file tracks ordered implementation work and verified status. A task is not complete because code exists; its acceptance criteria and verification steps must pass.

## Status legend

- **Pending:** not started.
- **In progress:** currently being worked on.
- **Blocked:** cannot proceed; blocker is recorded.
- **Verified:** acceptance criteria and required checks passed.
- **Unavailable (optional):** an optional integration is deliberately not enabled; this does not mean it passed verification.

## Current queue

| ID | Task | Depends on | Status |
|---|---|---|---|
| D0 | Create and verify project documentation baseline | None | **Verified — documentation checks only** |
| D0H | Commit the reviewed documentation and record its handoff | D0, approved Git author identity | **Verified** |
| I1 | Establish runtime/configuration and minimal hosted foundation | D0H, explicit implementation authorization | Pending |
| I2 | Implement MongoDB schemas, indexes and seed/reference strategy | I1 | Pending |
| I3 | Implement JWT authentication and server-side authorization | I1, I2 | Pending |
| I4 | Implement project drafting/publication, discovery and details | I2, I3 | Pending |
| I5 | Implement progress, milestones, budget and delay rules | I4 | Pending |
| I6 | Implement Cloudinary media lifecycle and protected delivery | I3 | Pending |
| I7 | Implement resident reporting and official response workflow | I3, I6 | Pending |
| I8 | Implement conflict detection, decisions and public effects | I2, I5, I7 | Pending |
| I9 | Implement before–after evidence and community insights | I5, I6, I7 | Pending |
| I10 | Attempt optional grounded AI summary | I7, I8, I9 verified; usable free credential; time gate | Pending — optional |
| I11 | Production hardening, regression, documentation and demo | I1–I9; I10 only if enabled | Pending |

## Task specifications

### D0 — Documentation baseline

**Acceptance criteria**

- Required documentation files exist in the repository root.
- `PROJECT_PLAN.md` contains the canonical approved scope and design.
- Other documents refer to the canonical plan rather than silently changing it.
- No application code, dependencies or deployment were added.
- Initial repository state and blockers are recorded in `CURRENT_STATE.md`.

**Verification**

- Read all documentation files for contradictions.
- Confirm no actual secret values are present.
- Confirm application functionality is recorded as unimplemented.

**Evidence:** All eight requested root files were read/reviewed; approved scope, authority, JWT limitations, transaction boundaries, media privacy, task dependencies and initial application state were cross-checked. Placeholder review found no real secrets; `git diff --check` passed. Exact repository status and the initial author blocker were recorded in `CURRENT_STATE.md` and then resolved through D0H. D0 verifies documents only; all application checks remain unrun.

### D0H — Verified documentation handoff

**Acceptance criteria**

- Review changes, status and recent history; commit only intended documentation using the user's approved author identity.
- Corrected documentation, including factual project state, is committed and resumable.
- Existing `.agents/` work is not overwritten or silently included.
- Do not rewrite the initial commit or invent another author identity without explicit approval.

**Verification**

- `git diff --check`, review of actual content, `git status --short --branch`, and `git log --oneline -10`.
- Confirm the commit covers the reviewed files and disclose any remaining uncommitted work.

**Evidence:** Pre-commit state matched `CURRENT_STATE.md`: no staged changes, exactly the eight intended root files modified, no configured remotes, and untouched untracked `.agents/`. `git diff --check` passed. Commit `886a9b3` contains exactly the eight intended files and was authored by `CivicTech <224425861+Shashankreddy-12@users.noreply.github.com>`. Post-commit status is clean except for the pre-existing untracked `.agents/` directory; nothing was pushed. The earlier placeholder-author commit `a7f0f2d` remains unchanged in local history.

### I1 — Foundation and handoff-safe repository

**Acceptance criteria**

- Git repository has a verified baseline and future commits can be moved to another laptop.
- Add appropriate secret/dependency/build exclusions before creating any actual local credential file.
- Vite/React shell and Express service can run through documented commands.
- Express serves the built frontend and `/api/v1` separately.
- `/health/live` and `/health/ready` have correct success/failure behaviour.
- Environment validation fails clearly when required server configuration is missing.
- Atlas connection succeeds using environment variables that are not committed to Git.
- Render deployment is publicly reachable and survives a cold-start test.
- `.env.example`, README and runtime/dependency instructions are accurate.
- Compatible Node/npm/dependency versions and the lockfile are recorded; local secure-cookie testing is documented without weakening production settings.

**Verification**

- Fresh setup on the current laptop from the latest commit.
- Fresh-browser hosted request, idle/wake request and API/SPA route checks.
- Update `CURRENT_STATE.md` and this task status only after checks pass.

### I2 — Schemas, indexes and data foundation

**Acceptance criteria**

- Collections and indexes match `PROJECT_PLAN.md`.
- Validation rejects invalid dates, coordinates, amounts, milestone totals and references.
- City/locality and road-segment identifiers support multiple cities.
- Demo/source records preserve unknown values as unknown.
- Seed/import process does not convert aggregate CSV rows into fabricated project records.

**Verification**

- Schema validation tests.
- Index inspection.
- Geospatial coordinate-order tests.
- Seed reload and persistence test.

### I3 — JWT authentication and authorization

**Acceptance criteria**

- Resident registration cannot create official roles.
- Login sets a 30-minute Secure HttpOnly cookie.
- Protected routes verify signature, issuer, audience, subject and expiry.
- Every protected operation checks current active status, role and department from MongoDB.
- Logout clears the cookie and does not claim copied-token revocation.
- CSRF/origin protections cover cookie-authenticated state changes.
- Unauthorized resident/official/cross-department requests fail server-side.

**Verification**

- Login, reload, expiry and logout tests.
- Expired/corrupt/wrong-audience token tests.
- Direct API authorization matrix.
- Current account deactivation and role/department change tests.
- Documented copied-token logout test.

### I4 — Project drafting/publication, discovery and details

**Acceptance criteria**

- Map/list, search, combined filters and city/locality selection work.
- An authorized officer can create/edit a draft, read it in the editor and publish only after required facts pass validation; residents cannot retrieve drafts through any endpoint.
- Map queries are bounded by viewport/radius and paginated where appropriate.
- Public project DTOs exclude drafts, private fields and private media.
- Direct project deep links load on the deployed service.
- Unknown fields display honestly.

**Verification**

- Public functional journey on desktop/mobile widths.
- Empty, loading, API failure and map-tile failure states.
- Deep-link reload and cold-start tests.

### I5 — Progress, budget and delay rules

**Acceptance criteria**

- Milestone weights total 100 and progress is calculated consistently.
- Original deadline remains visible after revisions.
- Completion requires date and evidence/update.
- `null`, zero, remaining negative and over-100% utilization behave correctly.
- Behind-plan and stale-update rules have explainable reasons.

**Verification**

- Date-boundary and milestone rule tests.
- Budget calculation tests.
- Official update transaction/reload test.
- Public view after an official change.

### I6 — Cloudinary media lifecycle

**Acceptance criteria**

- Images never depend on local filesystem persistence.
- Uploads enforce count, byte, format, dimension and ownership limits.
- Cloudinary metadata is stored only after verified upload.
- Private resident media is not exposed through public URLs.
- Authorized media retrieval succeeds; unauthorized retrieval fails.
- Cloudinary-success/MongoDB-failure recovery is documented/tested.

**Verification**

- Valid/invalid upload tests.
- Restart/redeploy persistence test.
- Owner/official/other-resident media authorization tests.
- Abandoned/unattached media reconciliation test.

### I7 — Reporting and official response loop

**Acceptance criteria**

- Resident can submit a project-linked or location-only report.
- Report reference is returned only after persistence.
- Same idempotency key does not duplicate a report.
- Assignment, response, status and history commit together.
- Department boundaries and coordinator routing are enforced.
- Rejection/resolution require explanations where specified.
- Resident sees persisted official changes after reload.

**Verification**

- Deployed resident → official → resident walkthrough.
- Transaction rollback test.
- Retry/network interruption test.
- Concurrent/stale report transition test.

### I8 — Coordination

**Acceptance criteria**

- Shared segment/date candidates are stronger than nearby-only candidates.
- 200 m and 90 day boundaries are covered.
- Missing required data says `cannot assess` for the affected rule without suppressing another evaluable rule.
- Decisions distinguish rescheduled, coordinated and dismissed.
- Relevant fact changes reopen review; budget-only changes do not.
- Stale conflict resolution is rejected.
- Public explanation reflects the committed decision.

**Verification**

- Full conflict fixture matrix from `TEST_PLAN.md`.
- Concurrent project/resolution test.
- Public-view reload after each decision outcome.

### I9 — Evidence and insights

**Acceptance criteria**

- Before–after images are explicitly paired and labelled by source/date/viewpoint.
- Missing images produce honest gallery/empty states.
- Heatmap and totals use the same reviewed-report population and filters.
- Rejected duplicates and private identity/details are excluded.
- Approximate locations are used publicly.

**Verification**

- Evidence pairing validation.
- Aggregate fixture count comparison.
- Privacy projection test.
- Mobile/touch/keyboard checks.

### I10 — Optional AI summary

**Gate:** The complete hosted reporting and coordination loops must pass first. Limit the integration attempt to approximately 30 minutes before the final verification reserve. If unavailable, mark this task `Unavailable (optional)` with the reason and verify the factual fallback; never call untested generation verified.

**Acceptance criteria**

- Core workflows do not call or depend on AI.
- Only public project facts are sent.
- Output is source-hashed, bounded, validated and labelled.
- Provider timeout/missing credential returns a factual fallback.
- No unsupported date/number claim is displayed as fact.

**Verification**

- Provider success/failure/timeout tests.
- Source-change invalidation test.
- Verify report/publication still work with AI disabled.

### I11 — Production hardening and submission

**Acceptance criteria**

- All critical production checks in `TEST_PLAN.md` pass on the public URL.
- No known authorization, persistence or deep-link blocker remains.
- README and `.env.example` match actual setup.
- `CURRENT_STATE.md` contains factual verified status and known risks.
- Task statuses reflect actual checks, not intent.
- GitHub repository, accurate setup README, library/API disclosures and a 2–5-minute demo video included in the repository are ready before the submission cutoff.

**Verification**

- Fresh-browser and post-idle hosted walkthrough.
- Final regression/authorization/security checks.
- Review `git status` and commit verified milestones before submission.

## Time policy

This queue is executed through one coding stream, with teammates reviewing, testing, preparing data and rehearsing. The critical path is I1 → I2 → I3 → I4/I5 → I6 → I7 → I8/I9 → I11. I10 is optional and must not consume time reserved for I11. The final two hours are protected for production verification, fixes, documentation and demo preparation. Reconfirm remaining clock time at implementation authorization; the original twelve-hour estimate was made before the interview, not at each resumed session.
