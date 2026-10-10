# CivicSync Agent Instructions

## Authority and scope

- `PROJECT_PLAN.md` is the canonical product and architecture specification.
- `TASKS.md` is the ordered work queue and acceptance record.
- `TEST_PLAN.md` defines required verification.
- `DECISIONS.md` records rationale, assumptions and accepted risks.
- `CURRENT_STATE.md` records only the actual verified repository/application state.
- Do not silently add, remove or reinterpret approved features.
- Scope, architecture, security, hosting or data-model changes require explicit user approval and an entry in `DECISIONS.md`.

## Before every future task

1. Read `CURRENT_STATE.md`.
2. Read the relevant pending item in `TASKS.md`.
3. Read only the relevant sections of `PROJECT_PLAN.md`.
4. Read additional source files selectively when needed.
5. Inspect the current code and Git status before editing.
6. Do not reread every project document or scan the entire repository without a reason.

## Implementation discipline

- Keep the team’s one-laptop, one-implementation-stream constraint in mind.
- Make small, scoped changes that match surrounding structure.
- Prefer the approved MERN/Tailwind architecture and familiar solutions.
- Do not introduce microservices, Redis, Docker, complex GIS, gamification, push notifications or unrelated services without explicit approval.
- Keep AI summaries optional and outside all critical workflows.
- Use server-side authorization for every protected operation; frontend guards are not security.
- Keep JWTs in Secure, HttpOnly cookies only; never use localStorage for authentication tokens.
- Preserve the documented 30-minute JWT/logout limitation; never claim immediate revocation of copied tokens.
- Use MongoDB transactions for the specified multi-record operations and pass the transaction session to every operation.
- Use idempotency keys and optimistic version checks for retry-safe/concurrent writes.
- Never use the local filesystem as production media storage.
- Keep resident descriptions, exact locations and photos private according to the approved plan.
- Do not invent missing CSV fields, project dates, coordinates, spending meanings, provenance or evidence.
- Keep synthetic/demo records and illustrative images clearly labelled.

## Secrets and configuration

- Never commit actual secrets, tokens, passwords or private URLs.
- Update `.env.example` when configuration names change; it must contain placeholders only.
- Check that secrets are not included in logs, client bundles, screenshots or demo fixtures.
- Do not casually share credentials in chat or documentation.

## Verification requirements

- Inspect relevant code before changing it.
- Run the smallest relevant tests first, then the required regression checks.
- Exercise direct API authorization, not only UI paths.
- Verify persistence after reload/restart for changed workflows.
- Verify deployed behaviour before marking a production-related task complete.
- Treat dependency/provider failures as test cases.
- Never mark functionality complete because code was generated; completion requires passing acceptance criteria and recording the evidence.

## Milestone and handoff procedure

After each verified milestone:

1. Record exact checks and outcomes in `CURRENT_STATE.md`.
2. Update only the relevant status and evidence in `TASKS.md`.
3. Record any approved decision change in `DECISIONS.md`.
4. Review `git diff`, `git status` and recent history before staging only intended files.
5. Commit the verified milestone with a concise message using the user's authorized identity. If identity is missing, record the blocker and ask; do not invent an author, override Git configuration, or rewrite history without approval.
6. Leave the repository resumable from the latest verified commit and `CURRENT_STATE.md`.

Do not mark a task verified when it is merely partially implemented or locally assumed to work.

Respect the current task's execution scope: documentation-only authorization permits documentation work, not scaffolding, dependency installation, credentials setup or deployment. These require explicit implementation authorization. Do not treat a previous estimate of remaining hours as a newly available budget.

## Handoff requirements

The complete repository and Git history must be movable to another laptop. Keep runtime/dependency versions and setup commands documented in `README.md`. A new session should be able to identify the exact next task from `CURRENT_STATE.md` without repeating discovery work.
