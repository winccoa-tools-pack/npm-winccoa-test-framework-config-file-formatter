# winccoa-test-framework-config-file-formatter

Formats WinCC OA Test Framework `testSuite*.config` files.

These config files are JSON-like but allow full-line comments where the first non-blank character is `#`.
Additionally, the files may contain ctrl-code expressions like `%VERSION%` which are evaluated at runtime.

This tool:

- Pretty-prints the JSON structure with 2-space indentation
- Preserves full-line `#` comments (keeps them and aligns them to the current indentation level)
- Preserves everything between two `%` characters **verbatim** when it appears outside of JSON strings
- Does **not** change content inside JSON strings (so `%VERSION%` inside a string stays untouched)
- Preserves input newline style (`\n` vs `\r\n`) and BOM (UTF-8/UTF-16LE/UTF-16BE)

## Install

```powershell
npm install @winccoa-tools-pack/npm-winccoa-test-framework-config-file-formatter
```

## Usage

### Format a file

```powershell
npx winccoa-tf-config-format .\Test\CtrlTF\WinCC_OA_Test\TestSuites\suite_API\testSuite.unix.config
```

### Format a directory (default filter: `testSuite*.config`, recursive)

```powershell
npx winccoa-tf-config-format .\Test\CtrlTF\WinCC_OA_Test\TestSuites
```

### Check only (no writes), fail if changes needed

```powershell
npx winccoa-tf-config-format --check .\Test\CtrlTF\WinCC_OA_Test\TestSuites
```

In `--check` mode, every file that needs formatting is reported as:

```text
WARNING: <path> needs formatting
```

This is designed to be consumable by CI log parsers (e.g. Jenkins NextGen Warnings plugin) and static analysis scanners.

### Options

- `--filter <pattern>`: wildcard file filter when a directory is provided (default: `testSuite*.config`)
- `--no-recurse`: do not search subdirectories
- `--check`: do not write; exit code 1 if any file would change
- `--dry-run`: do not write; exit code 0 (prints warnings for files that would change)
- `--validate`: validate config files against a JSON Schema (prints `WARNING:` lines; exit code 1 on any issue)
- `--schema <path>`: use a custom schema file (default: bundled schemas auto-selected by filename)
- `--extend <path>`: add one or more overlay schemas (composed via `allOf`) on top of the official schema
- `--report-format <sarif|gitlab>`: write findings as SARIF 2.1.0 or GitLab Code Quality JSON (requires `--report-file` and one of `--validate`, `--check`, `--dry-run`)
- `--report-file <path>`: report output file; an existing file is replaced
- `--report-root <dir>`: base directory for the relative report paths (default: current directory)

## Validate with JSON Schema

Validate a suite config (no writes):

```powershell
npx winccoa-tf-config-format --validate .\Test\CtrlTF\WinCC_OA_Test\TestSuites\suite_API\testSuite.unix.config
```

Validate a folder:

```powershell
npx winccoa-tf-config-format --validate .\Test\CtrlTF\WinCC_OA_Test\TestSuites
```

On problems, the tool prints `WARNING:` lines suitable for CI parsing, for example:

```text
WARNING: <path>: schema validation failed: ...
WARNING: <path>: parse failed: ...
```

`--validate` understands ctrl-code expressions `%...%` both outside and inside JSON strings (e.g. `"%getenv("SMTP_USER")%"`), even when the inner quotes are not JSON-escaped.

## Reports (SARIF and GitLab Code Quality)

Write findings for GitHub code scanning, Jenkins Warnings NG, GitLab or SonarQube:

```powershell
npx winccoa-tf-config-format --validate --report-format sarif --report-file .artifacts/tf-config.sarif --report-root . .\Test\CtrlTF\WinCC_OA_Test\TestSuites
npx winccoa-tf-config-format --check --report-format gitlab --report-file gl-code-quality-report.json .\Test\CtrlTF\WinCC_OA_Test\TestSuites
```

| Rule ID                       | Source                                                      | SARIF level / GitLab severity |
| ----------------------------- | ----------------------------------------------------------- | ----------------------------- |
| `winccoa.tfconfig.Parse`      | config cannot be parsed                                     | error / major                 |
| `winccoa.tfconfig.Schema`     | one finding per JSON Schema error (`--validate`)            | error / major                 |
| `winccoa.tfconfig.Formatting` | file differs from formatter output (`--check`, `--dry-run`) | warning / minor               |

- Paths are relative to `--report-root`, use `/` and are URI-encoded in SARIF. Files outside the root are rejected.
- Lines point to the offending value (schema) or the first changed line (formatting).
- Fingerprints hash rule, path and finding content, not line numbers.
- A clean run writes a valid empty report. Usage errors and missing paths exit with `2`, remove any existing report and write no replacement.
- Exit codes are unchanged: `1` if findings exist, `0` otherwise.

Jenkins:

```groovy
recordIssues(enabledForFailure: true, tools: [sarif(pattern: '.artifacts/tf-config.sarif')])
```

GitHub: upload with `github/codeql-action/upload-sarif`.

## Derived (overlay) schemas

If you want to keep using the official bundled schemas but add your internal rules (e.g. Jenkins constraints inside `USER_DATA`), create an overlay schema and pass it with `--extend`.

Example: enforce `USER_DATA.jenkins.timeout <= 15`:

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "USER_DATA": {
            "type": "object",
            "properties": {
                "jenkins": {
                    "type": "object",
                    "properties": {
                        "timeout": { "type": "number", "maximum": 15 }
                    }
                }
            }
        }
    }
}
```

Run validation with the overlay:

```powershell
npx winccoa-tf-config-format --validate --extend .\my-userdata-overlay.schema.json .\Test\CtrlTF\WinCC_OA_Test\TestSuites
```

You can repeat `--extend` multiple times to layer several internal rule sets.

### Bundled schemas

This package bundles one schema per important TestFramework config type:

- `schema/testSuite.schema.json` (default for `testSuite*.config`)
- `schema/testProj.schema.json` (validates e.g. mandatory non-empty `ID` and `NAME`)
- `schema/testRuns.schema.json` (for `testRuns.config`)
- `schema/general.schema.json` (for `general.config`)
- `schema/users.schema.json` (for `users.config`)

By default, `--validate` selects the schema by filename:

- `testSuite*.config` → testSuite schema
- `testProj.*.config` → testProj schema
- `testRuns.config` → testRuns schema
- `general.config` → general schema
- `users.config` → users schema

Validate all `testProj.*.config` files in a suite folder:

```powershell
npx winccoa-tf-config-format --validate --filter "testProj.*.config" .\Test\CtrlTF\WinCC_OA_Test\TestSuites\suite_API
```

Validate global configs:

```powershell
npx winccoa-tf-config-format --validate .\Test\CtrlTF\WinCC_OA_Test\testRuns.config
npx winccoa-tf-config-format --validate .\Test\CtrlTF\WinCC_OA_Test\general.config
npx winccoa-tf-config-format --validate .\Test\CtrlTF\WinCC_OA_Test\users.config
```

## Notes

- Only full-line comments are supported: a line is treated as a comment if the first non-blank character is `#`.
- Inline comments after JSON tokens are not supported.
