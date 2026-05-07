'use strict';

const fs = require('node:fs');
const path = require('node:path');

function wildcardToRegExp(pattern) {
    // Very small wildcard support: * and ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const re = '^' + escaped.replace(/\*/g, '.*').replace(/\?/g, '.') + '$';
    return new RegExp(re, 'i');
}

function listFiles(inputPath, { filterPattern, recurse }) {
    const stat = fs.statSync(inputPath);
    if (stat.isFile()) return [inputPath];

    const filterRe = wildcardToRegExp(filterPattern);
    const out = [];

    function walkDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (recurse) walkDir(full);
                continue;
            }
            if (ent.isFile() && filterRe.test(ent.name)) {
                out.push(full);
            }
        }
    }

    walkDir(inputPath);
    out.sort((a, b) => a.localeCompare(b));
    return out;
}

module.exports = {
    listFiles,
};
