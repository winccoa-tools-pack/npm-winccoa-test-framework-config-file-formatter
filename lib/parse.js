'use strict';

/**
 * Removes full-line # comments and converts ctrl-code blocks %...% outside
 * of strings into JSON string literals so JSON.parse can work.
 *
 * Notes:
 * - A line is considered a comment if the first non-blank character is '#'.
 * - Ctrl-code blocks inside JSON strings are left untouched.
 * - Ctrl-code blocks outside strings are wrapped via JSON.stringify("%...%")
 *   to keep them verbatim and parseable.
 *
 * @param {string} input
 * @returns {string}
 */
function sanitizeToJson(input) {
    const out = [];
    let inString = false;
    let escape = false;

    let atLineStart = true;

    const len = input.length;
    let i = 0;

    while (i < len) {
        const ch = input[i];

        if (inString) {
            // Tolerate ctrl-code blocks inside strings that may contain unescaped quotes,
            // e.g. "%getenv("SMTP_USER")%".
            if (!escape && ch === '%') {
                let j = i + 1;
                while (j < len && input[j] !== '%') j++;
                if (j < len && input[j] === '%') {
                    const ctrl = input.slice(i, j + 1);
                    const escapedCtrl = ctrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
                    out.push(escapedCtrl);
                    i = j + 1;
                    continue;
                }
            }

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

        // Handle newlines: keep them to preserve line numbers somewhat.
        if (ch === '\r') {
            if (i + 1 < len && input[i + 1] === '\n') {
                out.push('\r\n');
                i += 2;
            } else {
                out.push('\r');
                i += 1;
            }
            atLineStart = true;
            continue;
        }
        if (ch === '\n') {
            out.push('\n');
            i += 1;
            atLineStart = true;
            continue;
        }

        if (atLineStart) {
            // Skip leading blanks, but keep them (they don't hurt JSON).
            if (ch === ' ' || ch === '\t') {
                out.push(ch);
                i++;
                continue;
            }

            if (ch === '#') {
                // Skip until end of line.
                while (i < len && input[i] !== '\n' && input[i] !== '\r') i++;
                // Do not emit comment text.
                continue;
            }

            atLineStart = false;
        }

        if (ch === '%') {
            // Ctrl-code outside strings: consume until next '%' (inclusive) and stringify it.
            let j = i + 1;
            while (j < len && input[j] !== '%') j++;
            if (j < len && input[j] === '%') {
                const ctrl = input.slice(i, j + 1);
                out.push(JSON.stringify(ctrl));
                i = j + 1;
                continue;
            }
            // Unclosed %, treat as normal char.
        }

        if (ch === '"') {
            inString = true;
            escape = false;
            out.push(ch);
            i++;
            continue;
        }

        out.push(ch);
        i++;
    }

    return out.join('');
}

function parseConfigText(input) {
    const sanitized = sanitizeToJson(input);
    return JSON.parse(sanitized);
}

module.exports = {
    sanitizeToJson,
    parseConfigText,
};
