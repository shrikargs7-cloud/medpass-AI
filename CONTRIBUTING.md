# Contributing to MedPass AI + Trace Commons

Thank you for contributing to MedPass AI + Trace Commons! This project follows industry-standard software engineering and healthcare compliance best practices.

## Branch Strategy

- `main`: Protected production branch. Direct pushes and force-pushes are disallowed. All changes arrive via approved pull requests.
- `develop`: Integration staging branch.
- `feature/<area>-<description>`: For new capabilities (e.g., `feature/policy-room-cap`, `feature/trace-parquet-export`).
- `fix/<area>-<description>`: For bug fixes (e.g., `fix/deductible-underflow`).
- `chore/<area>-<description>`: Maintenance, dependency updates, and CI tasks.

## Conventional Commits

All commit messages MUST strictly adhere to [Conventional Commits v1.0.0](https://www.conventionalcommits.org/):

Format: `<type>(<scope>): <subject>`

Examples:
- `feat(policy): add room-rent sub-limit evaluation rule`
- `feat(trace): implement duckdb parquet cohort exporter`
- `fix(calculation): ensure non-negative patient payable reconciliation`
- `test(privacy): add small cell k-anonymity suppression test`
- `docs(api): document beeceptor mock endpoints`
- `ci(github): configure automated test and lint matrix`

## Development Workflow

1. Fork or branch from `develop`.
2. Create a dedicated branch with descriptive name.
3. Write clean, modular, and type-annotated code.
4. Add automated tests covering new business logic (e.g. policy rules, privacy checks).
5. Ensure local checks pass:
   ```bash
   pytest backend/app/tests
   cd frontend && npm run build
   ```
6. Open a Pull Request against `develop` (or `main`) using the PR template.
7. Ensure all CI status checks are green and required CODEOWNERS approvals are obtained.
