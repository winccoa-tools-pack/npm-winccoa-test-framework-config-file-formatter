'use strict';

function isAtOrUnder(pointer, base) {
    return pointer === base || pointer.startsWith(`${base}/`);
}

/**
 * Reduces the noise ajv produces for oneOf/anyOf: it reports every branch separately
 * plus a summary. Keeps only the errors of the branch that matched the value's type,
 * or one combined type error when no branch matched the type.
 * Relies on ajv listing branch errors before their oneOf/anyOf summary error.
 *
 * @param {object[]} errors ajv errors (allErrors mode)
 * @returns {object[]}
 */
function condenseErrors(errors) {
    let kept = [];

    for (const error of errors) {
        if (error.keyword !== 'oneOf' && error.keyword !== 'anyOf') {
            kept.push(error);
            continue;
        }

        const base = error.instancePath || '';
        const related = kept.filter((e) => isAtOrUnder(e.instancePath || '', base));
        const typeErrors = related.filter((e) => e.keyword === 'type' && e.instancePath === base);
        const details = related.filter((e) => !typeErrors.includes(e));
        kept = kept.filter((e) => !related.includes(e));

        if (details.length > 0) {
            kept.push(...details);
        } else if (typeErrors.length > 0) {
            const types = [...new Set(typeErrors.flatMap((e) => [].concat(e.params?.type ?? [])))];
            kept.push({
                instancePath: error.instancePath,
                schemaPath: error.schemaPath,
                keyword: 'type',
                params: { type: types },
                message: `must be ${types.join(' or ')}`,
            });
        } else {
            kept.push(error);
        }
    }

    return kept;
}

module.exports = { condenseErrors };
