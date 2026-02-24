/**
 * Migration script to add new columns to silent_room_posts table
 * Run this once: node scripts/migrate-silent-room.js
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

async function migrate() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    console.log('🔄 Starting Silent Room migration...');

    try {
        // Check if columns already exist
        const tableInfo = await client.execute('PRAGMA table_info(silent_room_posts)');
        const columns = tableInfo.rows.map(row => row.name);

        // Add post_type column if it doesn't exist
        if (!columns.includes('post_type')) {
            console.log('➕ Adding post_type column...');
            await client.execute(`
                ALTER TABLE silent_room_posts 
                ADD COLUMN post_type TEXT DEFAULT 'general'
            `);
            console.log('✅ Added post_type column');
        } else {
            console.log('✓ post_type column already exists');
        }

        // Add location_lat column if it doesn't exist
        if (!columns.includes('location_lat')) {
            console.log('➕ Adding location_lat column...');
            await client.execute(`
                ALTER TABLE silent_room_posts 
                ADD COLUMN location_lat REAL
            `);
            console.log('✅ Added location_lat column');
        } else {
            console.log('✓ location_lat column already exists');
        }

        // Add location_lng column if it doesn't exist
        if (!columns.includes('location_lng')) {
            console.log('➕ Adding location_lng column...');
            await client.execute(`
                ALTER TABLE silent_room_posts 
                ADD COLUMN location_lng REAL
            `);
            console.log('✅ Added location_lng column');
        } else {
            console.log('✓ location_lng column already exists');
        }

        // Add location_address column if it doesn't exist
        if (!columns.includes('location_address')) {
            console.log('➕ Adding location_address column...');
            await client.execute(`
                ALTER TABLE silent_room_posts 
                ADD COLUMN location_address TEXT
            `);
            console.log('✅ Added location_address column');
        } else {
            console.log('✓ location_address column already exists');
        }

        console.log('\n✅ Migration completed successfully!');
        console.log('You can now restart your server and use the new features.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
