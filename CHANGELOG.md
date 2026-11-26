# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-11-26

### Fixed

- add the changelog scripts and the changelog check from the template (#61)
- use client-id instead of the deprecated app-id for the bot token (#59)
- ignore TypeScript 7 and ESLint 10 updates until the lint tooling supports them (#57)
- ignore TypeScript 7 and ESLint 10 updates until the lint tooling supports them (#57)
- ignore TypeScript 7 and ESLint 10 updates until the lint tooling supports them (#57)

### Changed

- align .github files and scripts with the template (#62)
- prefer REPO_ADMIN_TOKEN over the bot app token for merges and branch updates (#60)
- use the winccoa-tools-pack-bot app token for automated PR actions (#58)
- run integration tests manually and warn on limited test coverage (#56)
- add apply-settings helper scripts and actions policy (#55)

## [Unreleased]

### Added

- `--report-format sarif|gitlab`, `--report-file` and `--report-root` to export `--validate`, `--check` and `--dry-run` findings as SARIF 2.1.0 or GitLab Code Quality JSON, including source lines.
- Unit and CLI tests (`npm run test:unit`).

### Fixed

- `--validate` printed a literal `\n` instead of a line break after the schema path and summary lines.
- `testSuite.schema.json` rejected valid `TEST_PROJECTS` groups (nested arrays of `NODE`/`PROJECT_CONFIG`/`STEPS` objects) used by redundancy and multi-node suites.

### Changed

- `--validate` condenses ajv `oneOf`/`anyOf` noise to the relevant errors.

## [0.1.0] - 2026-05-07

### Added

- Initial release of the `winccoa-tf-config-format` CLI.
- Formatter for JSON-like `testSuite*.config` files with full-line `#` comments.
- Ctrl-code `%...%` preservation outside JSON strings.
- Optional JSON Schema validation with bundled schemas.
