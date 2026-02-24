const QRCode = require('qrcode');

/**
 * Generate a QR code and return it as a base64 data URL (no file system needed).
 * Works in every deployment environment without any static file serving.
 * @param {string} data - Content to encode in the QR
 * @returns {string} base64 data URL — e.g. "data:image/png;base64,iVBOR..."
 */
async function generateQRCode(data) {
    const dataURL = await QRCode.toDataURL(data, {
        type: 'image/png',
        width: 400,
        margin: 2,
        color: {
            dark: '#00D4FF',  // Cyan neon
            light: '#0A0F1E',  // Dark navy
        },
        errorCorrectionLevel: 'H',
    });
    return dataURL; // "data:image/png;base64,..."
}

module.exports = { generateQRCode };
