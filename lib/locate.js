'use strict';

function escapePointer(segment) {
    return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Maps every JSON pointer of already sanitized JSON text to its 1-based start line.
 * sanitizeToJson() keeps all line breaks, so lines match the original config file.
 *
 * @param {string} json valid JSON text
 * @returns {Map<string, number>}
 */
function indexJsonLines(json) {
    const index = new Map();
    let pos = 0;
    let line = 1;

    function skipWhitespace() {
        while (pos < json.length) {
            const ch = json[pos];
            if (ch === '\n') {
                line++;
                pos++;
            } else if (ch === ' ' || ch === '\t' || ch === '\r') {
                pos++;
            } else {
                break;
            }
        }
    }

    function readString() {
        const start = pos++;
        while (pos < json.length) {
            const ch = json[pos++];
            if (ch === '\\') pos++;
            else if (ch === '"') break;
        }
        return json.slice(start, pos);
    }

    function parseContainer(pointer, close, readKey) {
        pos++;
        skipWhitespace();
        if (json[pos] === close) {
            pos++;
            return;
        }
        for (let i = 0; ; i++) {
            skipWhitespace();
            let childPointer = `${pointer}/${i}`;
            if (readKey) {
                childPointer = `${pointer}/${escapePointer(JSON.parse(readString()))}`;
                skipWhitespace();
                pos++; // ':'
            }
            parseValue(childPointer);
            skipWhitespace();
            if (json[pos] !== ',') {
                pos++; // closing bracket
                return;
            }
            pos++;
        }
    }

    function parseValue(pointer) {
        skipWhitespace();
        index.set(pointer, line);
        const ch = json[pos];
        if (ch === '{') {
            parseContainer(pointer, '}', true);
        } else if (ch === '[') {
            parseContainer(pointer, ']', false);
        } else if (ch === '"') {
            readString();
        } else {
            while (pos < json.length && !/[\s,}\]]/.test(json[pos])) pos++;
        }
    }

    try {
        parseValue('');
    } catch {
        // Return what was indexed so far; callers fall back to a parent pointer.
    }
    return index;
}

/**
 * Resolves the line of an ajv error, falling back to the closest existing parent.
 *
 * @param {Map<string, number>} index
 * @param {{instancePath?: string, keyword?: string, params?: any}} error
 * @returns {number}
 */
function lineForError(index, error) {
    let pointer = error.instancePath || '';
    if (error.keyword === 'additionalProperties' && error.params?.additionalProperty) {
        pointer += `/${escapePointer(String(error.params.additionalProperty))}`;
    }
    while (!index.has(pointer) && pointer.length > 0) {
        pointer = pointer.slice(0, pointer.lastIndexOf('/'));
    }
    return index.get(pointer) ?? 1;
}

/**
 * Extracts the line of a JSON.parse failure from the sanitized text.
 *
 * @param {Error} error
 * @param {string} json sanitized JSON text
 * @returns {number}
 */
function lineForParseError(error, json) {
    const message = String(error?.message ?? '');
    const lineMatch = /line (\d+)/.exec(message);
    if (lineMatch) return Number(lineMatch[1]);
    const posMatch = /position (\d+)/.exec(message);
    if (!posMatch) return 1;
    return json.slice(0, Number(posMatch[1])).split('\n').length;
}

module.exports = {
    indexJsonLines,
    lineForError,
    lineForParseError,
};
