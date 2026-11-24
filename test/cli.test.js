'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CLI = path.join(__dirname, '..', 'bin', 'winccoa-tf-config-format.js');

function run(cwd, args) {
    return spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
}

function workspace(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-cli-'));
    for (const [name, content] of Object.entries(files)) {
        const full = path.join(root, name);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf8');
    }
    return root;
}

const VALID = '{\n  "NAME": "x",\n  "TEST_PROJECTS": [\n    "p"\n  ]\n}\n';
const INVALID = '{\n  "NAME": "x",\n  "TEST_PROJECTS": "p"\n}\n';
const OVERLAY = JSON.stringify({
    properties: {
        USER_DATA: { properties: { jenkins: { properties: { timeout: { type: 'number' } } } } },
    },
});

test('--validate writes SARIF with the line of a schema violation', () => {
    const root = workspace({ 'suite/testSuite.config': INVALID });
    const result = run(root, [
        '--validate',
        '--report-format',
        'sarif',
        '--report-file',
        'out/r.sarif',
        'suite',
    ]);
    assert.equal(result.status, 1);

    const sarif = JSON.parse(fs.readFileSync(path.join(root, 'out', 'r.sarif'), 'utf8'));
    const [finding] = sarif.runs[0].results;
    assert.equal(finding.ruleId, 'winccoa.tfconfig.Schema');
    assert.equal(
        finding.locations[0].physicalLocation.artifactLocation.uri,
        'suite/testSuite.config',
    );
    assert.equal(finding.locations[0].physicalLocation.region.startLine, 3);
});

test('--validate --extend reports USER_DATA violations at the offending line', () => {
    const config =
        '{\n  "NAME": "x",\n  "TEST_PROJECTS": ["p"],\n  "USER_DATA": {\n    "jenkins": {\n      "timeout": "slow"\n    }\n  }\n}\n';
    const root = workspace({ 'testSuite.config': config, 'overlay.json': OVERLAY });
    const result = run(root, [
        '--validate',
        '--extend',
        'overlay.json',
        '--report-format',
        'sarif',
        '--report-file',
        'r.sarif',
        'testSuite.config',
    ]);
    assert.equal(result.status, 1);
    const sarif = JSON.parse(fs.readFileSync(path.join(root, 'r.sarif'), 'utf8'));
    assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 6);
});

test('--validate reports parse failures with a line', () => {
    const root = workspace({ 'testSuite.config': '{\n  "NAME": "x"\n  "TEST_PROJECTS": []\n}\n' });
    const result = run(root, [
        '--validate',
        '--report-format',
        'sarif',
        '--report-file',
        'r.sarif',
        'testSuite.config',
    ]);
    assert.equal(result.status, 1);
    const sarif = JSON.parse(fs.readFileSync(path.join(root, 'r.sarif'), 'utf8'));
    assert.equal(sarif.runs[0].results[0].ruleId, 'winccoa.tfconfig.Parse');
    assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.region.startLine, 3);
});

test('clean validation writes an empty report and exits 0', () => {
    const root = workspace({ 'testSuite.config': VALID });
    const result = run(root, [
        '--validate',
        '--report-format',
        'gitlab',
        '--report-file',
        'gl.json',
        'testSuite.config',
    ]);
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'gl.json'), 'utf8')), []);
    assert.match(result.stdout, /no issues found\.\n/);
});

test('--check reports formatting findings', () => {
    const root = workspace({ 'testSuite.config': '{"NAME":"x","TEST_PROJECTS":["p"]}' });
    const result = run(root, [
        '--check',
        '--report-format',
        'sarif',
        '--report-file',
        'r.sarif',
        'testSuite.config',
    ]);
    assert.equal(result.status, 1);
    const sarif = JSON.parse(fs.readFileSync(path.join(root, 'r.sarif'), 'utf8'));
    assert.equal(sarif.runs[0].results[0].ruleId, 'winccoa.tfconfig.Formatting');
});

test('a failed run removes a stale report instead of keeping it', () => {
    const root = workspace({ 'r.sarif': 'stale' });
    const result = run(root, [
        '--validate',
        '--report-format',
        'sarif',
        '--report-file',
        'r.sarif',
        'missing-dir',
    ]);
    assert.equal(result.status, 2);
    assert.equal(fs.existsSync(path.join(root, 'r.sarif')), false);
});

test('report options are validated', () => {
    const root = workspace({ 'testSuite.config': VALID });
    assert.equal(run(root, ['--validate', '--report-format', 'sarif', '.']).status, 2);
    assert.equal(run(root, ['--report-format', 'sarif', '--report-file', 'r', '.']).status, 2);
    assert.equal(
        run(root, ['--validate', '--report-format', 'xml', '--report-file', 'r', '.']).status,
        2,
    );
});
