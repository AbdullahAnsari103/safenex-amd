/**
 * Seed Script for SafeTrace Danger Zones
 * Populates the database with sample danger zones for testing
 */

require('dotenv').config();
const { initDB, upsertDangerZone } = require('../store/db');

// Sample danger zones for Delhi, India (can be customized for any location)
const sampleZones = [
    // High crime areas
    {
        latitude: 28.6139,
        longitude: 77.2090,
        radius: 200,
        severity: 'high',
        category: 'crime',
        description: 'Multiple theft reports in this area'
    },
    {
        latitude: 28.6304,
        longitude: 77.2177,
        radius: 150,
        severity: 'medium',
        category: 'theft',
        description: 'Pickpocketing incidents reported'
    },
    {
        latitude: 28.6517,
        longitude: 77.2219,
        radius: 180,
        severity: 'high',
        category: 'harassment',
        description: 'Harassment cases reported in evening hours'
    },
    // Accident-prone areas
    {
        latitude: 28.5355,
        longitude: 77.3910,
        radius: 250,
        severity: 'medium',
        category: 'accident',
        description: 'High traffic accident zone'
    },
    {
        latitude: 28.7041,
        longitude: 77.1025,
        radius: 200,
        severity: 'low',
        category: 'accident',
        description: 'Poor road conditions'
    },
    // Critical zones
    {
        latitude: 28.6692,
        longitude: 77.4538,
        radius: 300,
        severity: 'critical',
        category: 'assault',
        description: 'Recent assault incidents reported'
    },
    // General safety concerns
    {
        latitude: 28.5494,
        longitude: 77.2501,
        radius: 150,
        severity: 'low',
        category: 'general',
        description: 'Poorly lit area at night'
    },
    {
        latitude: 28.6448,
        longitude: 77.2167,
        radius: 120,
        severity: 'medium',
        category: 'theft',
        description: 'Vehicle theft reports'
    },
    {
        latitude: 28.6289,
        longitude: 77.3772,
        radius: 180,
        severity: 'high',
        category: 'crime',
        description: 'Gang activity reported'
    },
    {
        latitude: 28.5706,
        longitude: 77.3272,
        radius: 160,
        severity: 'medium',
        category: 'harassment',
        description: 'Street harassment incidents'
    }
];

async function seedDangerZones() {
    console.log('🌱 Starting danger zone seeding...\n');

    try {
        await initDB();
        console.log('✅ Database initialized\n');

        let created = 0;
        let updated = 0;

        for (const zone of sampleZones) {
            try {
                const result = await upsertDangerZone({
                    ...zone,
                    source: 'seed_script',
                    sourceId: 'system',
                    metadata: {
                        seeded: true,
                        seedDate: new Date().toISOString()
                    }
                });

                if (result.created) {
                    created++;
                    console.log(`✓ Created ${zone.severity} ${zone.category} zone at (${zone.latitude}, ${zone.longitude})`);
                } else if (result.updated) {
                    updated++;
                    console.log(`↻ Updated ${zone.severity} ${zone.category} zone at (${zone.latitude}, ${zone.longitude})`);
                }
            } catch (error) {
                console.error(`✗ Failed to seed zone:`, error.message);
            }
        }

        console.log(`\n📊 Seeding Summary:`);
        console.log(`   Created: ${created} zones`);
        console.log(`   Updated: ${updated} zones`);
        console.log(`   Total: ${created + updated} zones`);
        console.log('\n✅ Danger zone seeding completed successfully!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }

    process.exit(0);
}

// Run seeding
seedDangerZones();
