/**
 * Silent Room Database Initialization Script
 * Run this script to set up indexes and initial data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SilentRoomReport = require('../models/SilentRoomReport');

async function initializeSilentRoom() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('🔄 Creating indexes...');
        
        // Ensure geospatial index
        await SilentRoomReport.collection.createIndex({ 'location.coordinates': '2dsphere' });
        console.log('✅ Geospatial index created');

        // Ensure compound indexes
        await SilentRoomReport.collection.createIndex({ type: 1, status: 1, createdAt: -1 });
        console.log('✅ Type-Status-Date index created');

        await SilentRoomReport.collection.createIndex({ riskScore: -1, createdAt: -1 });
        console.log('✅ RiskScore-Date index created');

        await SilentRoomReport.collection.createIndex({ userId: 1, createdAt: -1 });
        console.log('✅ User-Date index created');

        await SilentRoomReport.collection.createIndex({ reportId: 1 }, { unique: true });
        console.log('✅ ReportId unique index created');

        // Get collection stats
        const stats = await SilentRoomReport.collection.stats();
        console.log('\n📊 Collection Statistics:');
        console.log(`   Documents: ${stats.count}`);
        console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   Indexes: ${stats.nindexes}`);

        console.log('\n✅ Silent Room initialization complete!');
        console.log('\n📝 Next steps:');
        console.log('   1. Start the server: npm start');
        console.log('   2. Access Silent Room: http://localhost:5000/silentroom');
        console.log('   3. Create your first report');

        process.exit(0);
    } catch (error) {
        console.error('❌ Initialization error:', error);
        process.exit(1);
    }
}

// Run initialization
initializeSilentRoom();
