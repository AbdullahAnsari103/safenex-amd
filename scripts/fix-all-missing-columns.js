/**
 * Fix all missing columns in database tables
 * - Adds missing columns to verified_danger_zones
 * - Adds missing columns to silent_room_posts
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

async function fixAllMissingColumns() {
    console.log('🔧 Fixing all missing columns in database...\n');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    try {
        // ═══════════════════════════════════════════════════════════════
        // FIX 1: verified_danger_zones table
        // ═══════════════════════════════════════════════════════════════
        console.log('📊 Fixing verified_danger_zones table...');
        
        const dangerZonesCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='verified_danger_zones'
        `);

        if (dangerZonesCheck.rows.length > 0) {
            const dangerColumns = await client.execute(`
                PRAGMA table_info(verified_danger_zones)
            `);

            const dangerColumnNames = dangerColumns.rows.map(row => row.name);
            console.log('   Current columns:', dangerColumnNames.join(', '));

            // Add reported_incidents
            if (!dangerColumnNames.includes('reported_incidents')) {
                console.log('   ➕ Adding: reported_incidents');
                await client.execute(`
                    ALTER TABLE verified_danger_zones 
                    ADD COLUMN reported_incidents INTEGER DEFAULT 0
                `);
                console.log('   ✅ Added: reported_incidents');
            } else {
                console.log('   ✓ Already exists: reported_incidents');
            }

            // Add last_incident_date
            if (!dangerColumnNames.includes('last_incident_date')) {
                console.log('   ➕ Adding: last_incident_date');
                await client.execute(`
                    ALTER TABLE verified_danger_zones 
                    ADD COLUMN last_incident_date TEXT
                `);
                console.log('   ✅ Added: last_incident_date');
            } else {
                console.log('   ✓ Already exists: last_incident_date');
            }

            // Add data_source
            if (!dangerColumnNames.includes('data_source')) {
                console.log('   ➕ Adding: data_source');
                await client.execute(`
                    ALTER TABLE verified_danger_zones 
                    ADD COLUMN data_source TEXT
                `);
                console.log('   ✅ Added: data_source');
            } else {
                console.log('   ✓ Already exists: data_source');
            }

            console.log('✅ verified_danger_zones table fixed!\n');
        } else {
            console.log('⚠️  Table verified_danger_zones does not exist');
            console.log('   Run: node scripts/init-verified-danger-zones-turso.js\n');
        }

        // ═══════════════════════════════════════════════════════════════
        // FIX 2: silent_room_posts table
        // ═══════════════════════════════════════════════════════════════
        console.log('📊 Fixing silent_room_posts table...');
        
        const silentRoomCheck = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='silent_room_posts'
        `);

        if (silentRoomCheck.rows.length > 0) {
            const silentColumns = await client.execute(`
                PRAGMA table_info(silent_room_posts)
            `);

            const silentColumnNames = silentColumns.rows.map(row => row.name);
            console.log('   Current columns:', silentColumnNames.join(', '));

            // Add is_private
            if (!silentColumnNames.includes('is_private')) {
                console.log('   ➕ Adding: is_private');
                await client.execute(`
                    ALTER TABLE silent_room_posts 
                    ADD COLUMN is_private INTEGER DEFAULT 0
                `);
                console.log('   ✅ Added: is_private');
            } else {
                console.log('   ✓ Already exists: is_private');
            }

            // Add status
            if (!silentColumnNames.includes('status')) {
                console.log('   ➕ Adding: status');
                await client.execute(`
                    ALTER TABLE silent_room_posts 
                    ADD COLUMN status TEXT DEFAULT 'pending'
                `);
                console.log('   ✅ Added: status');
            } else {
                console.log('   ✓ Already exists: status');
            }

            // Add admin_response
            if (!silentColumnNames.includes('admin_response')) {
                console.log('   ➕ Adding: admin_response');
                await client.execute(`
                    ALTER TABLE silent_room_posts 
                    ADD COLUMN admin_response TEXT
                `);
                console.log('   ✅ Added: admin_response');
            } else {
                console.log('   ✓ Already exists: admin_response');
            }

            // Add admin_response_at
            if (!silentColumnNames.includes('admin_response_at')) {
                console.log('   ➕ Adding: admin_response_at');
                await client.execute(`
                    ALTER TABLE silent_room_posts 
                    ADD COLUMN admin_response_at TEXT
                `);
                console.log('   ✅ Added: admin_response_at');
            } else {
                console.log('   ✓ Already exists: admin_response_at');
            }

            console.log('✅ silent_room_posts table fixed!\n');
        } else {
            console.log('⚠️  Table silent_room_posts does not exist');
            console.log('   This should have been created by initDB()\n');
        }

        // ═══════════════════════════════════════════════════════════════
        // VERIFICATION
        // ═══════════════════════════════════════════════════════════════
        console.log('🔍 Verifying all columns...\n');

        // Verify danger zones
        if (dangerZonesCheck.rows.length > 0) {
            const verifyDanger = await client.execute(`
                PRAGMA table_info(verified_danger_zones)
            `);
            const verifyDangerNames = verifyDanger.rows.map(row => row.name);
            console.log('✅ verified_danger_zones columns:');
            console.log('   ', verifyDangerNames.join(', '));
            
            const requiredDanger = ['reported_incidents', 'last_incident_date', 'data_source'];
            const missingDanger = requiredDanger.filter(col => !verifyDangerNames.includes(col));
            if (missingDanger.length > 0) {
                console.log('   ⚠️  Still missing:', missingDanger.join(', '));
            } else {
                console.log('   ✅ All required columns present!\n');
            }
        }

        // Verify silent room
        if (silentRoomCheck.rows.length > 0) {
            const verifySilent = await client.execute(`
                PRAGMA table_info(silent_room_posts)
            `);
            const verifySilentNames = verifySilent.rows.map(row => row.name);
            console.log('✅ silent_room_posts columns:');
            console.log('   ', verifySilentNames.join(', '));
            
            const requiredSilent = ['is_private', 'status', 'admin_response', 'admin_response_at'];
            const missingSilent = requiredSilent.filter(col => !verifySilentNames.includes(col));
            if (missingSilent.length > 0) {
                console.log('   ⚠️  Still missing:', missingSilent.join(', '));
            } else {
                console.log('   ✅ All required columns present!\n');
            }
        }

        console.log('═══════════════════════════════════════════════════════════');
        console.log('✅ ALL FIXES COMPLETE!');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('\nYou can now:');
        console.log('1. Create danger zones in admin dashboard');
        console.log('2. Submit complaints in Silent Room');
        console.log('3. View complaints in Complaints tab');
        console.log('\nRestart your server for changes to take effect.');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        console.error('\nError details:', error.message);
        process.exit(1);
    }
}

// Run migration
fixAllMissingColumns()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
