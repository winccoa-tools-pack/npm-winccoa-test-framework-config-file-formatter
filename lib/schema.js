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

function readJsonFile(filePath) {
    let raw = fs.readFileSync(filePath, 'utf8');
    // Windows editors and PowerShell 5.1 write a UTF-8 BOM that JSON.parse rejects.
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    try {
        return JSON.parse(raw);
    } catch (err) {
        throw new Error(`Cannot parse JSON file ${filePath}: ${err.message}`, { cause: err });
    }
}

function loadSchema(schemaPath) {
    const p = schemaPath ? path.resolve(process.cwd(), schemaPath) : getDefaultSchemaPath();
    return { schema: readJsonFile(p), path: p };
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
    readJsonFile,
    loadSchema,
    loadBundledSchema,
};
