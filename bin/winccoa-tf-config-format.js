#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { decodeText, encodeText } = require('../lib/encoding');
const { formatCtrlJsonText } = require('../lib/formatter');
const { parseConfigText } = require('../lib/parse');
const { loadSchema, loadBundledSchema } = require('../lib/schema');
const { listFiles } = require('../lib/walk');

const Ajv = require('ajv/dist/2020');

function printHelp() {
    process.stdout.write(`winccoa-tf-config-format

Usage:
  winccoa-tf-config-format [options] <path...>

Paths can be files or directories.
Directories are scanned for files matching --filter (default: testSuite*.config).

Options:
  --filter <pattern>   Wildcard filter for directory scan (default: testSuite*.config)
  --no-recurse         Do not scan subdirectories
  --check              Do not write; exit code 1 if any file would change
  --dry-run            Do not write; exit code 0 (prints files that would change)
  --validate           Validate files against a JSON Schema (prints WARNING lines; exit code 1 on any issue)
  --schema <path>      Path to a JSON Schema file (default: bundled schema)
  --extend <path>      Extra schema overlay to apply via allOf (repeatable). Useful for internal rules.
  -h, --help           Show help

Examples:
  winccoa-tf-config-format .\\Test\\CtrlTF\\WinCC_OA_Test\\TestSuites
  winccoa-tf-config-format --check .\\Test\\CtrlTF\\WinCC_OA_Test\\TestSuites
  winccoa-tf-config-format --validate .\\Test\\CtrlTF\\WinCC_OA_Test\\TestSuites
  winccoa-tf-config-format --validate --schema .\\schema.json .\\Test\\CtrlTF\\WinCC_OA_Test\\TestSuites
  winccoa-tf-config-format --validate --extend .\\my-userdata-rules.json .\\Test\\CtrlTF\\WinCC_OA_Test\\TestSuites
  winccoa-tf-config-format .\\some\\testSuite.unix.config
`);
}

function parseArgs(argv) {
    const args = argv.slice(2);

    let filter = 'testSuite*.config';
    let recurse = true;
    let check = false;
    let dryRun = false;
    let validate = false;
    let schemaPath = undefined;
    /** @type {string[]} */
    const extendPaths = [];

    const paths = [];

    for (let i = 0; i < args.length; i++) {
        const a = args[i];

        if (a === '-h' || a === '--help') {
            return { help: true };
        }

        if (a === '--filter') {
            const v = args[++i];
            if (!v) throw new Error('Missing value for --filter');
            filter = v;
            continue;
        }

        if (a === '--no-recurse') {
            recurse = false;
            continue;
        }

        if (a === '--check') {
            check = true;
            continue;
        }

        if (a === '--dry-run') {
            dryRun = true;
            continue;
        }

        if (a === '--validate') {
            validate = true;
            continue;
        }

        if (a === '--schema') {
            const v = args[++i];
            if (!v) throw new Error('Missing value for --schema');
            schemaPath = v;
            continue;
        }

        if (a === '--extend') {
            const v = args[++i];
            if (!v) throw new Error('Missing value for --extend');
            extendPaths.push(v);
            continue;
        }

        if (a.startsWith('-')) {
            throw new Error(`Unknown option: ${a}`);
        }

        paths.push(a);
    }

    if (paths.length === 0) paths.push('.');
    if (validate && (check || dryRun)) {
        throw new Error(
            'Do not combine --validate with --check/--dry-run. Use --validate alone (it never writes).',
        );
    }

    return {
        help: false,
        filter,
        recurse,
        check,
        dryRun,
        validate,
        schemaPath,
        extendPaths,
        paths,
    };
}

function pickSchemaKindAuto(filePath) {
    const base = path.basename(filePath).toLowerCase();
    if (base.startsWith('testsuite') && base.endsWith('.config')) return 'testsuite';
    if (base.startsWith('testproj.') && base.endsWith('.config')) return 'testproj';
    if (base === 'testruns.config') return 'testruns';
    if (base === 'general.config') return 'general';
    if (base === 'users.config') return 'users';
    return null;
}

function main() {
    let opts;
    try {
        opts = parseArgs(process.argv);
    } catch (err) {
        process.stderr.write(String(err.message ?? err) + '\n');
        process.stderr.write('Use --help for usage.\n');
        process.exit(2);
    }

    if (opts.help) {
        printHelp();
        process.exit(0);
    }

    const allFiles = [];
    for (const p of opts.paths) {
        const full = path.resolve(process.cwd(), p);
        if (!fs.existsSync(full)) {
            process.stderr.write(`Not found: ${p}\n`);
            process.exitCode = 2;
            continue;
        }

        const files = listFiles(full, { filterPattern: opts.filter, recurse: opts.recurse });
        allFiles.push(...files);
    }

    const uniqFiles = Array.from(new Set(allFiles)).sort((a, b) => a.localeCompare(b));
    if (uniqFiles.length === 0) {
        process.stdout.write('No files matched.\n');
        process.exit(0);
    }

    if (opts.validate) {
        let issues = 0;
        let skipped = 0;

        const ajv = new Ajv({ allErrors: true, strict: false });

        /** @type {Map<string, {validateFn: any, schemaPath: string}>} */
        const validators = new Map();

        function loadJsonSchemaFile(p) {
            const full = path.resolve(process.cwd(), p);
            let raw = fs.readFileSync(full, 'utf8');
            if (raw.length > 0 && raw.charCodeAt(0) === 0xfeff) {
                raw = raw.slice(1);
            }
            return { schema: JSON.parse(raw), path: full };
        }

        function getValidatorForKind(kind) {
            const keyParts = [
                opts.schemaPath
                    ? `schema:${path.resolve(process.cwd(), opts.schemaPath)}`
                    : `kind:${kind}`,
            ];
            for (const ext of opts.extendPaths || []) {
                keyParts.push(`ext:${path.resolve(process.cwd(), ext)}`);
            }
            const key = keyParts.join('|');
            const cached = validators.get(key);
            if (cached) return cached;

            const baseLoaded = opts.schemaPath
                ? loadSchema(opts.schemaPath)
                : loadBundledSchema(kind);

            const overlays = (opts.extendPaths || []).map((p) => loadJsonSchemaFile(p).schema);

            const combinedSchema =
                overlays.length === 0
                    ? baseLoaded.schema
                    : {
                          $schema: baseLoaded.schema.$schema,
                          allOf: [baseLoaded.schema, ...overlays],
                      };

            const schemaPathLabel =
                overlays.length === 0
                    ? baseLoaded.path
                    : `${baseLoaded.path} + ${opts.extendPaths.length} overlay(s)`;

            const validateFn = ajv.compile(combinedSchema);
            const entry = { validateFn, schemaPath: schemaPathLabel };
            validators.set(key, entry);
            return entry;
        }

        for (const file of uniqFiles) {
            const buf = fs.readFileSync(file);
            const { text } = decodeText(buf);

            let data;
            try {
                data = parseConfigText(text);
            } catch (err) {
                issues++;
                process.stdout.write(
                    `WARNING: ${file}: parse failed: ${String(err.message ?? err)}\n`,
                );
                continue;
            }

            const kind = opts.schemaPath ? 'custom' : pickSchemaKindAuto(file) || null;
            if (!opts.schemaPath && kind === null) {
                skipped++;
                continue;
            }

            const { validateFn, schemaPath } = getValidatorForKind(kind);
            const ok = validateFn(data);
            if (!ok) {
                issues++;
                const errs = (validateFn.errors || [])
                    .map((e) => `${e.instancePath || '/'} ${e.message || 'invalid'}`)
                    .join('; ');
                process.stdout.write(`WARNING: ${file}: schema validation failed: ${errs}\n`);
                process.stdout.write(`Schema: ${schemaPath}\\n`);
            }
        }

        if (issues > 0) {
            process.exit(1);
        }

        if (skipped > 0) {
            process.stdout.write(
                `Validated ${uniqFiles.length - skipped} file(s); skipped ${skipped} file(s) (no matching schema).\\n`,
            );
        } else {
            process.stdout.write(`Validated ${uniqFiles.length} file(s); no issues found.\\n`);
        }
        return;
    }

    let changed = 0;
    const changedFiles = [];

    for (const file of uniqFiles) {
        const buf = fs.readFileSync(file);
        const { text, info } = decodeText(buf);
        const newline = text.includes('\r\n') ? '\r\n' : '\n';
        const formatted = formatCtrlJsonText(text, { newline });

        if (formatted !== text) {
            changed++;
            changedFiles.push(file);

            if (!opts.check && !opts.dryRun) {
                const outBuf = encodeText(formatted, info);
                fs.writeFileSync(file, outBuf);
            }
        }
    }

    if (opts.check) {
        if (changed > 0) {
            for (const f of changedFiles) {
                process.stdout.write(`WARNING: ${f} needs formatting\n`);
            }
            process.exit(1);
        }

        process.stdout.write(
            `Checked ${uniqFiles.length} file(s); no formatting changes needed.\n`,
        );
        return;
    }

    if (opts.dryRun) {
        if (changed > 0) {
            for (const f of changedFiles) {
                process.stdout.write(`WARNING: ${f} would be formatted\n`);
            }
        }
        process.stdout.write(`Would format ${changed} / ${uniqFiles.length} file(s).\n`);
        return;
    }

    process.stdout.write(`Formatted ${changed} / ${uniqFiles.length} file(s).\n`);
}

main();
