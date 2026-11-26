'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Ajv = require('ajv/dist/2020');

const { condenseErrors } = require('../lib/condense');
const { loadBundledSchema } = require('../lib/schema');

function validate(data) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    const validateFn = ajv.compile(loadBundledSchema('testsuite').schema);
    validateFn(data);
    return condenseErrors(validateFn.errors || []).map((e) => `${e.instancePath} ${e.message}`);
}

test('valid TEST_PROJECTS shapes produce no errors', () => {
    assert.deepEqual(
        validate({
            NAME: 'x',
            TEST_PROJECTS: [
                'a',
                [
                    'b',
                    { PROJECT_CONFIG: 'c' },
                    {
                        NODE: 'n',
                        PROJECT_CONFIG: 'c',
                        STEPS: ['create', { id: 'start', serialized: true, delayedStart: 5 }],
                    },
                ],
            ],
        }),
        [],
    );
});

test('a value of the wrong type yields one combined type error', () => {
    assert.deepEqual(validate({ NAME: 'x', TEST_PROJECTS: ['a', 42] }), [
        '/TEST_PROJECTS/1 must be string or array',
    ]);
});

test('only the errors of the type-matching branch are kept', () => {
    assert.deepEqual(
        validate({
            NAME: 'x',
            TEST_PROJECTS: [
                [{ PROJECT_CONFIG: 'c', STEPS: ['create', { serialized: true }] }, { NODE: 'n' }],
            ],
        }),
        [
            "/TEST_PROJECTS/0/0/STEPS/1 must have required property 'id'",
            "/TEST_PROJECTS/0/1 must have required property 'PROJECT_CONFIG'",
        ],
    );
});

test('errors outside oneOf are left untouched', () => {
    assert.deepEqual(validate({ TEST_PROJECTS: 'p' }), [
        " must have required property 'NAME'",
        '/TEST_PROJECTS must be array',
    ]);
});

test('a oneOf failure without branch errors keeps its own error', () => {
    const error = { keyword: 'oneOf', instancePath: '/a', message: 'matches several' };
    assert.deepEqual(condenseErrors([error]), [error]);
});
