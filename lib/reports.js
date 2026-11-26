'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const REPORT_FORMATS = ['sarif', 'gitlab'];

const RULES = {
    'winccoa.tfconfig.Parse': {
        description: 'Config file cannot be parsed',
        level: 'error',
    },
    'winccoa.tfconfig.Schema': {
        description: 'Config violates the JSON Schema',
        level: 'error',
    },
    'winccoa.tfconfig.Formatting': {
        description: 'Config formatting differs from the formatter output',
        level: 'warning',
    },
};

function toRelativePath(file, root) {
    const relative = path.relative(path.resolve(root), path.resolve(file)).replace(/\\/g, '/');
    if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
        throw new Error(`Report source is outside report root: ${file}`);
    }
    return relative;
}

/**
 * Collects findings with checkout-relative paths and location-independent fingerprints.
 *
 * @param {string} root report root; findings outside of it are rejected
 */
function createCollector(root) {
    const findings = [];
    const occurrences = new Map();

    return {
        findings,
        add({ file, line, ruleId, message, signature }) {
            const relative = toRelativePath(file, root);
            const key = JSON.stringify([ruleId, relative, signature]);
            const occurrence = occurrences.get(key) ?? 0;
            occurrences.set(key, occurrence + 1);
            findings.push({
                path: relative,
                line: Math.max(1, line),
                ruleId,
                message,
                fingerprint: createHash('sha256')
                    .update(JSON.stringify([ruleId, relative, signature, occurrence]))
                    .digest('hex'),
            });
        },
    };
}

function buildSarif(findings, toolVersion) {
    return {
        $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
        version: '2.1.0',
        runs: [
            {
                tool: {
                    driver: {
                        name: 'winccoa-tf-config-format',
                        version: toolVersion,
                        rules: Object.entries(RULES).map(([id, rule]) => ({
                            id,
                            shortDescription: { text: rule.description },
                            defaultConfiguration: { level: rule.level },
                        })),
                    },
                },
                invocations: [{ executionSuccessful: true }],
                results: findings.map((finding) => ({
                    ruleId: finding.ruleId,
                    level: RULES[finding.ruleId].level,
                    message: { text: finding.message },
                    partialFingerprints: { 'winccoaTfConfig/v1': finding.fingerprint },
                    locations: [
                        {
                            physicalLocation: {
                                artifactLocation: {
                                    uri: finding.path.split('/').map(encodeURIComponent).join('/'),
                                },
                                region: { startLine: finding.line },
                            },
                        },
                    ],
                })),
            },
        ],
    };
}

function buildGitlab(findings) {
    return findings.map((finding) => ({
        description: finding.message,
        check_name: finding.ruleId,
        fingerprint: finding.fingerprint,
        severity: RULES[finding.ruleId].level === 'error' ? 'major' : 'minor',
        location: { path: finding.path, lines: { begin: finding.line } },
    }));
}

/**
 * Writes SARIF 2.1.0 or GitLab Code Quality JSON (UTF-8, no BOM).
 *
 * @param {'sarif'|'gitlab'} format
 * @param {string} filePath
 * @param {object[]} findings
 * @param {string} [toolVersion]
 */
function writeReport(format, filePath, findings, toolVersion = '0.0.0') {
    if (!REPORT_FORMATS.includes(format)) {
        throw new Error(`Unknown report format: ${format}`);
    }
    const report = format === 'gitlab' ? buildGitlab(findings) : buildSarif(findings, toolVersion);
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

module.exports = {
    REPORT_FORMATS,
    createCollector,
    writeReport,
};
