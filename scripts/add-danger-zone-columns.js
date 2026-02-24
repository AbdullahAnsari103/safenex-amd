/**
 * Add missing columns to verified_danger_zones table
 * Adds: reported_incidents, last_incident_date, data_source
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

async function addDangerZoneColumns() {
    console.log('🔧 Adding missing columns to verified_danger_zones table...');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    try {
        // Check if table exists
        const tableCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='verified_danger_zones'
        `);

        if (tableCheck.rows.length === 0) {
            console.log('❌ Table verified_danger_zones does not exist');
            console.log('   Run: node scripts/init-verified-danger-zones-turso.js first');
            process.exit(1);
        }

        // Get current columns
        const columns = await client.execute(`
            PRAGMA table_info(verified_danger_zones)
        `);

        const columnNames = columns.rows.map(row => row.name);
        console.log('📋 Current columns:', columnNames.join(', '));

        // Add reported_incidents column if missing
        if (!columnNames.includes('reported_incidents')) {
            console.log('➕ Adding column: reported_incidents');
            await client.execute(`
                ALTER TABLE verified_danger_zones 
                ADD COLUMN reported_incidents INTEGER DEFAULT 0
            `);
            console.log('✅ Added: reported_incidents');
        } else {
            console.log('✓ Column already exists: reported_incidents');
        }

        // Add last_incident_date column if missing
        if (!columnNames.includes('last_incident_date')) {
            console.log('➕ Adding column: last_incident_date');
            await client.execute(`
                ALTER TABLE verified_danger_zones 
                ADD COLUMN last_incident_date TEXT
            `);
            console.log('✅ Added: last_incident_date');
        } else {
            console.log('✓ Column already exists: last_incident_date');
        }

        // Add data_source column if missing
        if (!columnNames.includes('data_source')) {
            console.log('➕ Adding column: data_source');
            await client.execute(`
                ALTER TABLE verified_danger_zones 
                ADD COLUMN data_source TEXT
            `);
            console.log('✅ Added: data_source');
        } else {
            console.log('✓ Column already exists: data_source');
        }

        // Verify columns were added
        const updatedColumns = await client.execute(`
            PRAGMA table_info(verified_danger_zones)
        `);

        const updatedColumnNames = updatedColumns.rows.map(row => row.name);
        console.log('\n📋 Updated columns:', updatedColumnNames.join(', '));

        console.log('\n✅ Migration complete!');
        console.log('   All required columns are now present.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
addDangerZoneColumns()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
