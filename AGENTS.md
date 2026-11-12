# Repository guidance

- Read `README.md` for setup and commands, `docs/architecture.md` for design decisions and code responsibilities, and `docs/testing.md` for database/cache verification before changing related areas.
- Keep documentation roles distinct: put quick setup and the PostgreSQL query in the README, design rationale and layer responsibilities in `docs/architecture.md`, and detailed verification steps in `docs/testing.md`.
- Keep the hexagonal boundaries intact: domain rules stay framework-independent, application code depends on ports, and external tools belong in infrastructure adapters.
- Mirror `src/` when adding tests under `test/`. Prefer deterministic tests with fixtures and injected clocks over tests that depend on live Hacker News responses or wall-clock delays.
- After code changes, run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build`. Run `pnpm test:coverage` when changing behavior or tests that affect coverage.
- Use the Docker Compose stack for a local database: `docker compose run --rm --build test` runs the full suite with PostgreSQL. PostgreSQL integration tests must use `TEST_DATABASE_URL` for a disposable database and create isolated schemas; never point tests at a production database, and do not run `docker compose down -v` on a developer's stack without asking, because it deletes their usage history.
- Keep changes on the task's branch. Do not create or merge a pull request unless the user asks.
