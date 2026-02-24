/**
 * Initialize Activity Log Table for Turso (LibSQL)
 * Production-ready database schema for activity tracking
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

async function initActivityLog() {
    console.log('🔧 Initializing activity_log table...');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    try {
        // Create activity_log table
        await client.execute(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                action TEXT NOT NULL,
                description TEXT,
                metadata TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        console.log('✅ Table created: activity_log');

        // Create indexes for performance
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_activity_log_user_id 
            ON activity_log (user_id)
        `);

        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_activity_log_action 
            ON activity_log (action)
        `);

        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_activity_log_created_at 
            ON activity_log (created_at DESC)
        `);

        console.log('✅ Indexes created');

        // Check if data already exists
        const existingCount = await client.execute(
            'SELECT COUNT(*) as count FROM activity_log'
        );

        console.log(`ℹ️  Database contains ${existingCount.rows[0].count} activity log entries`);

        console.log('\n✅ Activity log table initialization complete!');

    } catch (error) {
        console.error('❌ Error initializing activity_log table:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    initActivityLog()
        .then(() => {
            console.log('\n🎉 Activity log initialization successful!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Activity log initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initActivityLog };
