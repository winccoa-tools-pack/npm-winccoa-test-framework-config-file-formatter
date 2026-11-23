'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// `node --test <dir>` is not supported on Node 22+, so pass explicit file paths.
function collectTests(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectTests(full);
        return entry.name.endsWith('.test.js') ? [full] : [];
    });
}

const root = path.resolve(__dirname, '..', process.argv[2] ?? 'test');
const files = collectTests(root).sort();
if (files.length === 0) {
    process.stderr.write(`No test files found in ${root}\n`);
    process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
