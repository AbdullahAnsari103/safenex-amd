/**
 * Initialize Verified Environmental Vulnerability Zones for Turso (LibSQL)
 * Production-ready database schema and seed data
 */

const { createClient } = require('@libsql/client');
require('dotenv').config();

async function initVerifiedDangerZones() {
    console.log('🔧 Initializing verified danger zones schema...');

    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
        console.error('❌ TURSO_DATABASE_URL is not set in .env');
        process.exit(1);
    }

    const client = createClient({ url, authToken: token });

    try {
        // Create verified_danger_zones table
        await client.execute(`
            CREATE TABLE IF NOT EXISTS verified_danger_zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                place_name TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                risk_level TEXT NOT NULL CHECK (risk_level IN ('Critical', 'High', 'Medium', 'Low')),
                category TEXT NOT NULL,
                active_hours TEXT NOT NULL,
                radius_meters INTEGER NOT NULL DEFAULT 100,
                severity_weight REAL NOT NULL DEFAULT 1.0,
                description TEXT,
                source TEXT,
                verified_by TEXT,
                verification_date TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `);

        console.log('✅ Table created: verified_danger_zones');

        // Create indexes for performance
        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_verified_danger_zones_location 
            ON verified_danger_zones (latitude, longitude)
        `);

        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_verified_danger_zones_risk_level 
            ON verified_danger_zones (risk_level)
        `);

        await client.execute(`
            CREATE INDEX IF NOT EXISTS idx_verified_danger_zones_active 
            ON verified_danger_zones (is_active)
        `);

        console.log('✅ Indexes created');

        // Check if data already exists
        const existingCount = await client.execute(
            'SELECT COUNT(*) as count FROM verified_danger_zones'
        );

        if (existingCount.rows[0].count > 0) {
            console.log(`ℹ️  Database already contains ${existingCount.rows[0].count} verified danger zones`);
            console.log('   Skipping seed data insertion');
            return;
        }

        // Seed verified danger zones
        console.log('📊 Seeding verified danger zones...');

        const verifiedZones = [
            // CRITICAL - Fatal Infrastructure / High-Speed Collision Zones
            {
                place_name: 'Eastern Freeway - Bhakti Park Exit',
                latitude: 19.026362,
                longitude: 72.871131,
                risk_level: 'Critical',
                category: 'vehicular_fatality_zone',
                active_hours: '00:00-05:00',
                radius_meters: 150,
                severity_weight: 3.0,
                description: 'High-speed exit with poor visibility and frequent fatal accidents',
                source: 'Mumbai Traffic Police Data 2024',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Mankhurd T-Junction (GMLR)',
                latitude: 19.048743,
                longitude: 72.932230,
                risk_level: 'Critical',
                category: 'freight_collision_zone',
                active_hours: '21:00-06:00',
                radius_meters: 200,
                severity_weight: 3.0,
                description: 'Heavy freight traffic intersection with blind spots',
                source: 'Mumbai Traffic Police Data 2024',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Sion-Panvel Highway - BARC Junction',
                latitude: 19.043644,
                longitude: 72.915243,
                risk_level: 'Critical',
                category: 'heavy_truck_blindspot',
                active_hours: '21:00-06:00',
                radius_meters: 180,
                severity_weight: 3.0,
                description: 'Major truck route with limited pedestrian infrastructure',
                source: 'Mumbai Traffic Police Data 2024',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Ghatkopar Mankhurd Link Road - Baiganwadi Junction',
                latitude: 19.062833,
                longitude: 72.926451,
                risk_level: 'Critical',
                category: 'pedestrian_fatality_zone',
                active_hours: '18:00-22:00',
                radius_meters: 150,
                severity_weight: 3.0,
                description: 'High pedestrian fatality rate during evening hours',
                source: 'Mumbai Traffic Police Data 2024',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Amar Mahal Junction',
                latitude: 19.0458,
                longitude: 72.8989,
                risk_level: 'Critical',
                category: 'pedestrian_fatality_zone',
                active_hours: '00:00-23:59',
                radius_meters: 200,
                severity_weight: 3.5,
                description: 'Deadliest junction in Mumbai - 24 fatalities in 3 years (2019-2021)',
                source: 'BMC & Mumbai Traffic Police Black Spot Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Ghatkopar-Mahul Road Corridor',
                latitude: 19.0747,
                longitude: 72.9142,
                risk_level: 'Critical',
                category: 'high_density_accident_zone',
                active_hours: '00:00-23:59',
                radius_meters: 250,
                severity_weight: 3.0,
                description: 'Highest accident density - 65 accidents per 1.3km',
                source: 'Mumbai Traffic Police Data 2023',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },

            // HIGH - Isolation + Poor Lighting + High Theft Density
            {
                place_name: 'Aarey Colony Internal Road',
                latitude: 19.155000,
                longitude: 72.877000,
                risk_level: 'High',
                category: 'low_illumination_isolation',
                active_hours: '19:00-06:00',
                radius_meters: 300,
                severity_weight: 2.5,
                description: 'Isolated forest area with minimal lighting and security',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Deonar Dumping Ground Perimeter Road',
                latitude: 19.052671,
                longitude: 72.924823,
                risk_level: 'High',
                category: 'industrial_isolation',
                active_hours: '19:00-05:00',
                radius_meters: 250,
                severity_weight: 2.5,
                description: 'Industrial area with poor lighting and limited surveillance',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Reay Road Station Underbridge',
                latitude: 18.974558,
                longitude: 72.844357,
                risk_level: 'High',
                category: 'isolated_infrastructure',
                active_hours: '20:00-05:00',
                radius_meters: 120,
                severity_weight: 2.5,
                description: 'Poorly lit underpass with reported theft incidents',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'CSMT Station Subway',
                latitude: 18.940578,
                longitude: 72.835163,
                risk_level: 'High',
                category: 'night_theft_cluster',
                active_hours: '23:00-04:30',
                radius_meters: 100,
                severity_weight: 2.5,
                description: 'Late night theft hotspot with limited security presence',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Sion Circle Junction',
                latitude: 19.0433,
                longitude: 72.8614,
                risk_level: 'High',
                category: 'high_accident_intersection',
                active_hours: '00:00-23:59',
                radius_meters: 150,
                severity_weight: 2.5,
                description: 'Major black spot with multiple fatalities',
                source: 'BMC Black Spot Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'King Circle Junction',
                latitude: 19.0275,
                longitude: 72.8561,
                risk_level: 'High',
                category: 'high_accident_intersection',
                active_hours: '00:00-23:59',
                radius_meters: 150,
                severity_weight: 2.5,
                description: 'Complex intersection with high accident rate',
                source: 'BMC Black Spot Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Ghatkopar Flyover',
                latitude: 19.0860,
                longitude: 72.9081,
                risk_level: 'High',
                category: 'high_speed_accident_zone',
                active_hours: '00:00-23:59',
                radius_meters: 200,
                severity_weight: 2.5,
                description: '35 accidents per kilometer - high-speed collision zone',
                source: 'Mumbai Traffic Police Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },

            // MEDIUM - Transit Congestion + Opportunistic Theft
            {
                place_name: 'Kurla Railway Station Concourse',
                latitude: 19.065556,
                longitude: 72.879722,
                risk_level: 'Medium',
                category: 'theft_cluster_zone',
                active_hours: '18:00-22:00',
                radius_meters: 100,
                severity_weight: 1.8,
                description: 'High-density transit area with pickpocketing incidents',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Dadar Station Foot Over Bridge',
                latitude: 19.018335,
                longitude: 72.843214,
                risk_level: 'Medium',
                category: 'crowd_compression_zone',
                active_hours: '08:00-10:30,18:00-21:00',
                radius_meters: 80,
                severity_weight: 1.8,
                description: 'Extreme crowding during peak hours with safety concerns',
                source: 'Mumbai Railway Police Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Andheri Station East Exit',
                latitude: 19.119167,
                longitude: 72.846944,
                risk_level: 'Medium',
                category: 'transit_theft_density',
                active_hours: '17:00-21:00',
                radius_meters: 100,
                severity_weight: 1.8,
                description: 'Busy transit hub with reported theft during evening rush',
                source: 'Mumbai Police Crime Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Bandra Terminus Gate',
                latitude: 19.059286,
                longitude: 72.840251,
                risk_level: 'Medium',
                category: 'crowd_bottleneck',
                active_hours: '18:00-22:00',
                radius_meters: 90,
                severity_weight: 1.8,
                description: 'Congestion point with crowd management challenges',
                source: 'Mumbai Railway Police Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Tilak Nagar Junction',
                latitude: 19.0467,
                longitude: 72.8514,
                risk_level: 'Medium',
                category: 'moderate_accident_zone',
                active_hours: '00:00-23:59',
                radius_meters: 120,
                severity_weight: 1.8,
                description: 'Identified black spot with moderate accident frequency',
                source: 'BMC Black Spot Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Chedda Nagar Junction',
                latitude: 19.0525,
                longitude: 72.8989,
                risk_level: 'Medium',
                category: 'moderate_accident_zone',
                active_hours: '00:00-23:59',
                radius_meters: 120,
                severity_weight: 1.8,
                description: 'Black spot junction requiring safety improvements',
                source: 'BMC Black Spot Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            },
            {
                place_name: 'Asha Nagar Road Kandivali',
                latitude: 19.2042,
                longitude: 72.8544,
                risk_level: 'Medium',
                category: 'moderate_accident_zone',
                active_hours: '00:00-23:59',
                radius_meters: 150,
                severity_weight: 1.8,
                description: '38 accidents per 1.3km stretch',
                source: 'Mumbai Traffic Police Data',
                verified_by: 'SafeNex Safety Team',
                verification_date: '2026-02-24'
            }
        ];

        // Insert all zones
        for (const zone of verifiedZones) {
            await client.execute({
                sql: `INSERT INTO verified_danger_zones (
                    place_name, latitude, longitude, risk_level, category,
                    active_hours, radius_meters, severity_weight, description,
                    source, verified_by, verification_date
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    zone.place_name,
                    zone.latitude,
                    zone.longitude,
                    zone.risk_level,
                    zone.category,
                    zone.active_hours,
                    zone.radius_meters,
                    zone.severity_weight,
                    zone.description,
                    zone.source,
                    zone.verified_by,
                    zone.verification_date
                ]
            });
        }

        const finalCount = await client.execute(
            'SELECT COUNT(*) as count FROM verified_danger_zones WHERE is_active = 1'
        );

        console.log(`✅ Successfully seeded ${finalCount.rows[0].count} verified danger zones`);
        console.log('\n📊 Breakdown by risk level:');

        const breakdown = await client.execute(`
            SELECT risk_level, COUNT(*) as count 
            FROM verified_danger_zones 
            WHERE is_active = 1 
            GROUP BY risk_level 
            ORDER BY 
                CASE risk_level 
                    WHEN 'Critical' THEN 1 
                    WHEN 'High' THEN 2 
                    WHEN 'Medium' THEN 3 
                    ELSE 4 
                END
        `);

        breakdown.rows.forEach(row => {
            const emoji = row.risk_level === 'Critical' ? '🔴' : 
                         row.risk_level === 'High' ? '🟠' : '🟡';
            console.log(`   ${emoji} ${row.risk_level}: ${row.count} zones`);
        });

        console.log('\n✅ Verified danger zones initialization complete!');

    } catch (error) {
        console.error('❌ Error initializing verified danger zones:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    initVerifiedDangerZones()
        .then(() => {
            console.log('\n🎉 Database initialization successful!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Database initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initVerifiedDangerZones };
