const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique SafeNex ID
 * Format: SNX-XXXX-XXXX (alpha-numeric)
 * Example: SNX-A3F2-9B1C
 */
function generateSafeNexID() {
    const raw = uuidv4().replace(/-/g, '').toUpperCase();
    const part1 = raw.substring(0, 4);
    const part2 = raw.substring(4, 8);
    return `SNX-${part1}-${part2}`;
}

module.exports = { generateSafeNexID };
