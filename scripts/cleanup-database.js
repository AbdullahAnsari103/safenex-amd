/**
 * Database Cleanup Script
 * Removes orphaned records and optimizes database storage
 * Run this periodically: node scripts/cleanup-database.js
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');

async function cleanupDatabase() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    console.log('🧹 Starting database cleanup...\n');

    try {
        // 1. Remove orphaned likes (likes for deleted posts)
        console.log('🔍 Checking for orphaned likes...');
        const orphanedLikes = await client.execute(`
            DELETE FROM silent_room_likes 
            WHERE post_id NOT IN (SELECT id FROM silent_room_posts)
        `);
        console.log(`✅ Removed ${orphanedLikes.rowsAffected || 0} orphaned likes\n`);

        // 2. Remove orphaned comments (comments for deleted posts)
        console.log('🔍 Checking for orphaned comments...');
        const orphanedComments = await client.execute(`
            DELETE FROM silent_room_comments 
            WHERE post_id NOT IN (SELECT id FROM silent_room_posts)
        `);
        console.log(`✅ Removed ${orphanedComments.rowsAffected || 0} orphaned comments\n`);

        // 3. Fix like/comment counts on posts
        console.log('🔍 Recalculating post statistics...');
        
        // Update like counts
        await client.execute(`
            UPDATE silent_room_posts 
            SET likes = (
                SELECT COUNT(*) 
                FROM silent_room_likes 
                WHERE post_id = silent_room_posts.id
            )
        `);
        
        // Update comment counts
        await client.execute(`
            UPDATE silent_room_posts 
            SET comments = (
                SELECT COUNT(*) 
                FROM silent_room_comments 
                WHERE post_id = silent_room_posts.id
            )
        `);
        console.log('✅ Post statistics updated\n');

        // 4. Remove old SOS sessions (older than 90 days)
        console.log('🔍 Checking for old SOS sessions...');
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const oldSessions = await client.execute({
            sql: `DELETE FROM sos_sessions WHERE created_at < ?`,
            args: [ninetyDaysAgo.toISOString()],
        });
        console.log(`✅ Removed ${oldSessions.rowsAffected || 0} old SOS sessions (>90 days)\n`);

        // 5. Remove old user activities (older than 30 days)
        console.log('🔍 Checking for old user activities...');
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            const oldActivities = await client.execute({
                sql: `DELETE FROM user_activities WHERE created_at < ?`,
                args: [thirtyDaysAgo.toISOString()],
            });
            console.log(`✅ Removed ${oldActivities.rowsAffected || 0} old user activities (>30 days)\n`);
        } catch (err) {
            console.log('ℹ️  user_activities table does not exist (skipping)\n');
        }

        // 6. Get database statistics
        console.log('📊 Database Statistics:');
        
        const userCount = await client.execute('SELECT COUNT(*) as count FROM users');
        console.log(`   Users: ${userCount.rows[0].count}`);
        
        const postCount = await client.execute('SELECT COUNT(*) as count FROM silent_room_posts');
        console.log(`   Posts: ${postCount.rows[0].count}`);
        
        const likeCount = await client.execute('SELECT COUNT(*) as count FROM silent_room_likes');
        console.log(`   Likes: ${likeCount.rows[0].count}`);
        
        const commentCount = await client.execute('SELECT COUNT(*) as count FROM silent_room_comments');
        console.log(`   Comments: ${commentCount.rows[0].count}`);
        
        const sosConfigCount = await client.execute('SELECT COUNT(*) as count FROM sos_configs');
        console.log(`   SOS Configs: ${sosConfigCount.rows[0].count}`);
        
        const sosSessionCount = await client.execute('SELECT COUNT(*) as count FROM sos_sessions');
        console.log(`   SOS Sessions: ${sosSessionCount.rows[0].count}\n`);

        // 7. Run VACUUM to reclaim space
        console.log('🗜️  Running VACUUM to optimize database...');
        try {
            await client.execute('VACUUM');
            console.log('✅ Database optimized\n');
        } catch (err) {
            console.warn('⚠️  VACUUM not supported or failed (non-critical)\n');
        }

        // 8. Check for unused tables
        console.log('🔍 Checking database schema...');
        const tables = await client.execute(`
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            ORDER BY name
        `);
        
        console.log('\n📋 Current Tables:');
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
            const isExpected = expectedTables.includes(row.name);
            const status = isExpected ? '✅' : '⚠️ ';
            console.log(`   ${status} ${row.name}`);
        });

        console.log('\n✅ Database cleanup completed successfully!');
        console.log('\n💡 Tips:');
        console.log('   - Run this script monthly to keep database optimized');
        console.log('   - Orphaned records are automatically cleaned on post deletion');
        console.log('   - VACUUM reclaims unused space from deleted records');

    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

cleanupDatabase();
