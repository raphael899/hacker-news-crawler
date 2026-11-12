# Repository guidance

- Read `README.md` for setup and commands, `docs/architecture.md` for design decisions and code responsibilities, and `docs/testing.md` for database/cache verification before changing related areas.
- Keep documentation roles distinct: put quick setup and the SQLite query in the README, design rationale and layer responsibilities in `docs/architecture.md`, and detailed verification steps in `docs/testing.md`.
- Keep the hexagonal boundaries intact: domain rules stay framework-independent, application code depends on ports, and external tools belong in infrastructure adapters.
- Mirror `src/` when adding tests under `test/`. Prefer deterministic tests with fixtures and injected clocks over tests that depend on live Hacker News responses or wall-clock delays.
- After code changes, run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build`. Run `pnpm test:coverage` when changing behavior or tests that affect coverage.
- Do not delete or reset a developer's SQLite database while testing. Use a temporary `DB_PATH` when a clean database is needed.
- Keep changes on the task's branch. Do not create or merge a pull request unless the user asks.
