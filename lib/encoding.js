'use strict';

function detectEncoding(buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
        return { encoding: 'utf8', bom: buffer.subarray(0, 3), bomLen: 3 };
    }
    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return { encoding: 'utf16le', bom: buffer.subarray(0, 2), bomLen: 2 };
    }
    if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
        return { encoding: 'utf16be', bom: buffer.subarray(0, 2), bomLen: 2 };
    }
    return { encoding: 'utf8', bom: Buffer.alloc(0), bomLen: 0 };
}

function swapUtf16Bytes(buffer) {
    const swapped = Buffer.allocUnsafe(buffer.length);
    for (let i = 0; i + 1 < buffer.length; i += 2) {
        swapped[i] = buffer[i + 1];
        swapped[i + 1] = buffer[i];
    }
    if (buffer.length % 2 === 1) {
        swapped[buffer.length - 1] = buffer[buffer.length - 1];
    }
    return swapped;
}

function decodeText(buffer) {
    const info = detectEncoding(buffer);
    const body = buffer.subarray(info.bomLen);

    if (info.encoding === 'utf16be') {
        const le = swapUtf16Bytes(body);
        return { text: le.toString('utf16le'), info };
    }

    return { text: body.toString(info.encoding), info };
}

function encodeText(text, info) {
    let body;
    if (info.encoding === 'utf16be') {
        const le = Buffer.from(text, 'utf16le');
        body = swapUtf16Bytes(le);
    } else {
        body = Buffer.from(text, info.encoding);
    }

    return Buffer.concat([Buffer.from(info.bom), body]);
}

module.exports = {
    detectEncoding,
    decodeText,
    encodeText,
};
