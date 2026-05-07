'use strict';

function endsWithNewline(out, newline) {
    if (out.length < newline.length) return false;
    return out.slice(out.length - newline.length) === newline;
}

function appendIndent(outArr, indentLevel, indentUnit) {
    for (let i = 0; i < indentLevel; i++) outArr.push(indentUnit);
}

/**
 * Formats JSON-with-#comments content.
 *
 * Rules:
 * - A line is a comment if the first non-blank character is '#'. Those lines are preserved.
 * - Everything between two '%' characters is copied verbatim when it appears outside of JSON strings.
 * - JSON strings are preserved verbatim (no escaping changes).
 * - Output uses 2-space indentation.
 *
 * @param {string} input
 * @param {object} [options]
 * @param {string} [options.newline] Newline to use ("\n" or "\r\n"). If omitted, detected from input.
 * @returns {string}
 */
function formatCtrlJsonText(input, options = {}) {
    const newline = options.newline ?? (input.includes('\r\n') ? '\r\n' : '\n');
    const indentUnit = '  ';

    const out = [];
    let indent = 0;

    let inString = false;
    let escape = false;

    // Ctrl-code block outside strings: %...% copied verbatim.
    let inCtrl = false;

    // Start-of-source-line flag (based on input newlines).
    let atLineStart = true;

    const len = input.length;
    let i = 0;

    while (i < len) {
        const ch = input[i];

        if (inString) {
            out.push(ch);
            if (escape) {
                escape = false;
            } else if (ch === '\\') {
                escape = true;
            } else if (ch === '"') {
                inString = false;
            }
            i++;
            continue;
        }

        if (inCtrl) {
            out.push(ch);
            if (ch === '%') inCtrl = false;
            i++;
            continue;
        }

        if (ch === '%') {
            inCtrl = true;
            out.push(ch);
            i++;
            continue;
        }

        // Consume input newlines but do not emit them (we reformat).
        if (ch === '\r') {
            if (i + 1 < len && input[i + 1] === '\n') i += 2;
            else i += 1;
            atLineStart = true;
            continue;
        }
        if (ch === '\n') {
            i += 1;
            atLineStart = true;
            continue;
        }

        if (atLineStart) {
            // Skip leading whitespace in source.
            if (ch === ' ' || ch === '\t') {
                i++;
                continue;
            }

            // Comment line: first non-blank char is '#'
            if (ch === '#') {
                const start = i;
                let j = i;
                while (j < len && input[j] !== '\n' && input[j] !== '\r') j++;
                const comment = input.slice(start, j).replace(/[\s\t]+$/g, '');

                const outStr = out.join('');
                if (out.length > 0 && !endsWithNewline(outStr, newline)) out.push(newline);
                appendIndent(out, indent, indentUnit);
                out.push(comment);
                out.push(newline);

                i = j;
                atLineStart = true;
                continue;
            }

            // Non-comment content begins. Only indent if we're at a fresh output line.
            const outStr = out.join('');
            if (
                ch !== '}' &&
                ch !== ']' &&
                (out.length === 0 || endsWithNewline(outStr, newline))
            ) {
                appendIndent(out, indent, indentUnit);
            }

            atLineStart = false;
        }

        // Skip non-leading whitespace.
        if (ch === ' ' || ch === '\t') {
            i++;
            continue;
        }

        switch (ch) {
            case '{': {
                out.push('{');
                indent++;

                // Peek next non-ws char in input.
                let j = i + 1;
                while (j < len) {
                    const c = input[j];
                    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
                        j++;
                        continue;
                    }
                    break;
                }
                if (j < len && input[j] !== '}') {
                    out.push(newline);
                    appendIndent(out, indent, indentUnit);
                }

                i++;
                break;
            }

            case '[': {
                out.push('[');
                indent++;

                let j = i + 1;
                while (j < len) {
                    const c = input[j];
                    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
                        j++;
                        continue;
                    }
                    break;
                }
                if (j < len && input[j] !== ']') {
                    out.push(newline);
                    appendIndent(out, indent, indentUnit);
                }

                i++;
                break;
            }

            case '}': {
                indent = Math.max(0, indent - 1);
                const outStr = out.join('');
                if (out.length > 0 && !endsWithNewline(outStr, newline)) out.push(newline);
                appendIndent(out, indent, indentUnit);
                out.push('}');
                i++;
                break;
            }

            case ']': {
                indent = Math.max(0, indent - 1);
                const outStr = out.join('');
                if (out.length > 0 && !endsWithNewline(outStr, newline)) out.push(newline);
                appendIndent(out, indent, indentUnit);
                out.push(']');
                i++;
                break;
            }

            case ',': {
                out.push(',');
                out.push(newline);
                appendIndent(out, indent, indentUnit);
                atLineStart = true;
                i++;
                break;
            }

            case ':': {
                out.push(': ');
                i++;
                break;
            }

            case '"': {
                out.push('"');
                inString = true;
                escape = false;
                i++;
                break;
            }

            default: {
                out.push(ch);
                i++;
                break;
            }
        }
    }

    let result = out.join('').trim();
    result += newline;
    return result;
}

module.exports = {
    formatCtrlJsonText,
};
