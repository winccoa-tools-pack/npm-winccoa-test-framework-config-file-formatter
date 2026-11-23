'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { indexJsonLines, lineForError, lineForParseError } = require('../lib/locate');
const { sanitizeToJson } = require('../lib/parse');

const CONFIG = [
    '{',
    '  "NAME": "x",',
    '  # full-line comment',
    '  "USER_DATA": {',
    '    "jenkins": {',
    '      "timeout": 5,',
    '      "labels": ["a", "b"]',
    '    }',
    '  }',
    '}',
    '',
].join('\n');

test('indexJsonLines maps pointers to 1-based source lines', () => {
    const index = indexJsonLines(sanitizeToJson(CONFIG));
    assert.equal(index.get(''), 1);
    assert.equal(index.get('/NAME'), 2);
    assert.equal(index.get('/USER_DATA/jenkins'), 5);
    assert.equal(index.get('/USER_DATA/jenkins/timeout'), 6);
    assert.equal(index.get('/USER_DATA/jenkins/labels/1'), 7);
});

test('indexJsonLines keeps lines with CRLF line breaks', () => {
    const index = indexJsonLines(sanitizeToJson(CONFIG.replace(/\n/g, '\r\n')));
    assert.equal(index.get('/USER_DATA/jenkins/timeout'), 6);
});

test('indexJsonLines escapes ~ and / in keys', () => {
    const index = indexJsonLines('{\n"a/b": 1,\n"c~d": 2\n}');
    assert.equal(index.get('/a~1b'), 2);
    assert.equal(index.get('/c~0d'), 3);
});

test('lineForError resolves additionalProperties to the offending key', () => {
    const index = indexJsonLines(sanitizeToJson(CONFIG));
    const line = lineForError(index, {
        instancePath: '/USER_DATA/jenkins',
        keyword: 'additionalProperties',
        params: { additionalProperty: 'timeout' },
    });
    assert.equal(line, 6);
});

test('lineForError falls back to the closest parent', () => {
    const index = indexJsonLines(sanitizeToJson(CONFIG));
    assert.equal(
        lineForError(index, { instancePath: '/USER_DATA/jenkins/missing', keyword: 'required' }),
        5,
    );
    assert.equal(lineForError(index, { instancePath: '/nope', keyword: 'type' }), 1);
});

test('lineForParseError reports the line of the failing token', () => {
    const json = sanitizeToJson('{\n"a": 1\n"b": 2\n}');
    let error;
    try {
        JSON.parse(json);
    } catch (err) {
        error = err;
    }
    assert.ok(error);
    assert.equal(lineForParseError(error, json), 3);
});
