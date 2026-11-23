'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createCollector, writeReport } = require('../lib/reports');

function tempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'tf-report-'));
}

test('collector uses root-relative paths and stable fingerprints', () => {
    const root = tempDir();
    const file = path.join(root, 'suite dir', 'testSuite.config');
    const first = createCollector(root);
    first.add({ file, line: 3, ruleId: 'winccoa.tfconfig.Schema', message: 'm', signature: 's' });
    const second = createCollector(root);
    second.add({ file, line: 9, ruleId: 'winccoa.tfconfig.Schema', message: 'm', signature: 's' });

    assert.equal(first.findings[0].path, 'suite dir/testSuite.config');
    assert.equal(first.findings[0].fingerprint, second.findings[0].fingerprint);
});

test('collector distinguishes duplicate findings by occurrence', () => {
    const root = tempDir();
    const file = path.join(root, 'testSuite.config');
    const collector = createCollector(root);
    for (let i = 0; i < 2; i++) {
        collector.add({
            file,
            line: 1,
            ruleId: 'winccoa.tfconfig.Schema',
            message: 'm',
            signature: 's',
        });
    }
    assert.notEqual(collector.findings[0].fingerprint, collector.findings[1].fingerprint);
});

test('collector rejects files outside the report root', () => {
    const root = tempDir();
    const collector = createCollector(root);
    assert.throws(
        () =>
            collector.add({
                file: path.join(os.tmpdir(), 'other', 'testSuite.config'),
                line: 1,
                ruleId: 'winccoa.tfconfig.Parse',
                message: 'm',
                signature: 's',
            }),
        /outside report root/,
    );
});

test('writeReport emits SARIF 2.1.0 with URI-encoded paths', () => {
    const root = tempDir();
    const out = path.join(root, 'out', 'r.sarif');
    const collector = createCollector(root);
    collector.add({
        file: path.join(root, 'a b', 'testSuite.config'),
        line: 7,
        ruleId: 'winccoa.tfconfig.Schema',
        message: '/USER_DATA must be object',
        signature: 's',
    });
    writeReport('sarif', out, collector.findings, '1.2.3');

    const sarif = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs[0].tool.driver.version, '1.2.3');
    const result = sarif.runs[0].results[0];
    assert.equal(result.level, 'error');
    assert.equal(
        result.locations[0].physicalLocation.artifactLocation.uri,
        'a%20b/testSuite.config',
    );
    assert.equal(result.locations[0].physicalLocation.region.startLine, 7);
    assert.ok(result.partialFingerprints['winccoaTfConfig/v1']);
});

test('writeReport emits a valid empty SARIF and a GitLab report', () => {
    const root = tempDir();
    const sarifFile = path.join(root, 'empty.sarif');
    writeReport('sarif', sarifFile, []);
    assert.deepEqual(JSON.parse(fs.readFileSync(sarifFile, 'utf8')).runs[0].results, []);

    const collector = createCollector(root);
    collector.add({
        file: path.join(root, 'testSuite.config'),
        line: 2,
        ruleId: 'winccoa.tfconfig.Formatting',
        message: 'f',
        signature: 'formatting',
    });
    const gitlabFile = path.join(root, 'gl.json');
    writeReport('gitlab', gitlabFile, collector.findings);
    const [entry] = JSON.parse(fs.readFileSync(gitlabFile, 'utf8'));
    assert.equal(entry.severity, 'minor');
    assert.deepEqual(entry.location, { path: 'testSuite.config', lines: { begin: 2 } });
});

test('writeReport rejects unknown formats', () => {
    assert.throws(() => writeReport('xml', path.join(tempDir(), 'r'), []), /Unknown report format/);
});
