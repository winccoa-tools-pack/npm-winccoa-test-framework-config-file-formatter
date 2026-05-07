'use strict';

const fs = require('node:fs');
const path = require('node:path');

function getBundledSchemaPath(name) {
    const file = name;
    return path.join(__dirname, '..', 'schema', file);
}

function getDefaultSchemaPath() {
    return getBundledSchemaPath('testSuite.schema.json');
}

function loadSchema(schemaPath) {
    const p = schemaPath ? path.resolve(process.cwd(), schemaPath) : getDefaultSchemaPath();
    const raw = fs.readFileSync(p, 'utf8');
    return { schema: JSON.parse(raw), path: p };
}

function loadBundledSchema(kind) {
    switch (kind) {
        case 'testsuite':
            return loadSchema(getBundledSchemaPath('testSuite.schema.json'));
        case 'testproj':
            return loadSchema(getBundledSchemaPath('testProj.schema.json'));
        case 'testruns':
            return loadSchema(getBundledSchemaPath('testRuns.schema.json'));
        case 'general':
            return loadSchema(getBundledSchemaPath('general.schema.json'));
        case 'users':
            return loadSchema(getBundledSchemaPath('users.schema.json'));
        default:
            throw new Error(`Unknown bundled schema kind: ${kind}`);
    }
}

module.exports = {
    getDefaultSchemaPath,
    loadSchema,
    loadBundledSchema,
};
