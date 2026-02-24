/**
 * Drop Unused Tables Script
 * Removes old MongoDB-era tables that are no longer needed
 * Run this once: node scripts/drop-unused-tables.js
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

async function dropUnusedTables() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    console.log('🗑️  Dropping unused tables...\n');

    // Tables to drop (old MongoDB-era tables)
    const tablesToDrop = [
        'silentroom_reports',
        'silentroom_comments',
        'silentroom_likes',
        'silentroom_votes',
        'silentroom_flags',
        'silentroom_images'
    ];

    try {
        for (const table of tablesToDrop) {
            try {
                console.log(`🔍 Checking table: ${table}`);
                
                // Check if table exists
                const exists = await client.execute({
                    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                    args: [table],
                });

                if (exists.rows.length > 0) {
                    // Get row count before dropping
                    const count = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
                    const rowCount = count.rows[0].count;
                    
                    // Drop the table
                    await client.execute(`DROP TABLE ${table}`);
                    console.log(`✅ Dropped table: ${table} (had ${rowCount} rows)\n`);
                } else {
                    console.log(`ℹ️  Table ${table} does not exist (skipping)\n`);
                }
            } catch (err) {
                console.error(`❌ Failed to drop ${table}:`, err.message, '\n');
            }
        }

        // Show remaining tables
        console.log('📋 Remaining Tables:');
        const tables = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            ORDER BY name
        `);
        
        const expectedTables = [
            'users',
            'sos_configs',
            'sos_sessions',
            'silent_room_posts',
            'silent_room_likes',
            'silent_room_comments',
            'user_activities'
        ];
        
        tables.rows.forEach(row => {
            const isExpected = expectedTables.includes(row.name) || row.name === 'sqlite_sequence';
            const status = isExpected ? '✅' : '⚠️ ';
            console.log(`   ${status} ${row.name}`);
        });

        console.log('\n✅ Cleanup completed successfully!');
        console.log('💾 Database is now clean and optimized.');

    } catch (error) {
        console.error('❌ Operation failed:', error);
        process.exit(1);
    }
}

dropUnusedTables();
