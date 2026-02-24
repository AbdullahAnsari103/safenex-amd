/**
 * Migration Script: Add last_active_at column to users table
 * Run this once to add the column to existing database
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

async function addLastActiveColumn() {
    console.log('🔄 Starting migration: Add last_active_at column...');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    try {
        // Test connection
        await client.execute('SELECT 1');
        console.log('✅ Connected to database');

        // Check if column already exists
        try {
            const result = await client.execute('SELECT last_active_at FROM users LIMIT 1');
            console.log('ℹ️ Column last_active_at already exists');
            console.log('✅ Migration not needed');
            process.exit(0);
        } catch (error) {
            // Column doesn't exist, proceed with adding it
            console.log('📝 Column last_active_at does not exist, adding it...');
        }

        // Add the column
        await client.execute(`
            ALTER TABLE users ADD COLUMN last_active_at TEXT
        `);
        console.log('✅ Added last_active_at column');

        // Set default value for existing users (current timestamp)
        const now = new Date().toISOString();
        await client.execute({
            sql: 'UPDATE users SET last_active_at = ? WHERE last_active_at IS NULL',
            args: [now]
        });
        console.log('✅ Set default values for existing users');

        // Verify the column was added
        const verify = await client.execute('SELECT last_active_at FROM users LIMIT 1');
        console.log('✅ Verified column exists');

        console.log('\n🎉 Migration completed successfully!');
        console.log('ℹ️ You can now restart your server');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
}

// Run migration
addLastActiveColumn();
