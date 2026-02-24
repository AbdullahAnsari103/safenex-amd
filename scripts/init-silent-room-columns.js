/**
 * Initialize Silent Room Additional Columns
 * Adds admin response and private complaint columns
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

async function initSilentRoomColumns() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    console.log('🔧 Adding Silent Room columns...');

    try {
        // Add status column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN status TEXT DEFAULT "pending"');
        console.log('✅ Added status column');
    } catch (e) {
        console.log('ℹ️  status column already exists');
    }

    try {
        // Add moderation_reason column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN moderation_reason TEXT');
        console.log('✅ Added moderation_reason column');
    } catch (e) {
        console.log('ℹ️  moderation_reason column already exists');
    }

    try {
        // Add moderated_by column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN moderated_by TEXT');
        console.log('✅ Added moderated_by column');
    } catch (e) {
        console.log('ℹ️  moderated_by column already exists');
    }

    try {
        // Add moderated_at column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN moderated_at TEXT');
        console.log('✅ Added moderated_at column');
    } catch (e) {
        console.log('ℹ️  moderated_at column already exists');
    }

    try {
        // Add admin_response column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN admin_response TEXT');
        console.log('✅ Added admin_response column');
    } catch (e) {
        console.log('ℹ️  admin_response column already exists');
    }

    try {
        // Add admin_response_at column
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN admin_response_at TEXT');
        console.log('✅ Added admin_response_at column');
    } catch (e) {
        console.log('ℹ️  admin_response_at column already exists');
    }

    try {
        // Add is_private column for private complaints
        await client.execute('ALTER TABLE silent_room_posts ADD COLUMN is_private INTEGER DEFAULT 0');
        console.log('✅ Added is_private column');
    } catch (e) {
        console.log('ℹ️  is_private column already exists');
    }

    console.log('\n✅ Silent Room columns initialized successfully!');
    console.log('\nColumns added:');
    console.log('  - status (TEXT)');
    console.log('  - moderation_reason (TEXT)');
    console.log('  - moderated_by (TEXT)');
    console.log('  - moderated_at (TEXT)');
    console.log('  - admin_response (TEXT)');
    console.log('  - admin_response_at (TEXT)');
    console.log('  - is_private (INTEGER)');
    
    process.exit(0);
}

initSilentRoomColumns().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
