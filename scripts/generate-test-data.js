/**
 * Generate Test Data for Silent Room
 * Run: node scripts/generate-test-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const SilentRoomReport = require('../models/SilentRoomReport');
const User = require('../models/User');
const { generateReportId } = require('../utils/silentRoomHelpers');

// Sample data
const categories = [
    'violent_crime',
    'theft',
    'harassment',
    'surveillance',
    'suspicious_activity',
    'traffic',
    'environmental',
    'infrastructure',
    'general',
];

const severities = ['low', 'medium', 'high', 'critical'];

const types = ['incident', 'unsafe_area', 'discussion'];

const sampleTitles = {
    incident: [
        'Armed Robbery in Progress',
        'Assault Reported',
        'Vehicle Break-in',
        'Suspicious Package Found',
        'Harassment Incident',
    ],
    unsafe_area: [
        'Poorly Lit Area',
        'Broken Streetlights',
        'Unsafe Intersection',
        'Abandoned Building',
        'High Crime Zone',
    ],
    discussion: [
        'Safety Tips for Night Walking',
        'Community Watch Meeting',
        'Increased Police Presence',
        'Safety Concerns Discussion',
        'Neighborhood Safety Update',
    ],
};

const sampleDescriptions = {
    incident: [
        'Witnessed suspicious activity involving multiple individuals. Police have been notified.',
        'Incident occurred around 10 PM. Multiple witnesses present. Authorities responding.',
        'Ongoing situation requiring immediate attention. Area should be avoided.',
        'Reported to local authorities. Community members advised to stay alert.',
    ],
    unsafe_area: [
        'This area has poor lighting and limited visibility at night. Recommend avoiding after dark.',
        'Multiple reports of incidents in this location. Infrastructure improvements needed.',
        'Unsafe conditions persist. Community requesting city intervention.',
        'High-risk area with inadequate safety measures. Caution advised.',
    ],
    discussion: [
        'Community members sharing safety tips and experiences. Join the conversation.',
        'Discussion about improving neighborhood safety. All input welcome.',
        'Sharing information about local safety initiatives and programs.',
        'Open forum for safety concerns and solutions.',
    ],
};

// Major cities with coordinates
const locations = [
    { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.0060 },
    { city: 'London', country: 'UK', lat: 51.5074, lng: -0.1278 },
    { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
    { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
    { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
    { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050 },
    { city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
    { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777 },
    { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { city: 'Dubai', country: 'UAE', lat: 25.2048, lng: 55.2708 },
];

function randomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(0, daysAgo));
    date.setHours(randomInt(0, 23));
    date.setMinutes(randomInt(0, 59));
    return date;
}

async function generateTestData(count = 50) {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get a test user or create one
        let testUser = await User.findOne({ email: 'test@safenex.com' });
        if (!testUser) {
            console.log('🔄 Creating test user...');
            testUser = await User.create({
                name: 'Test User',
                email: 'test@safenex.com',
                password: 'Test123456!',
                verified: true,
                safeNexID: 'SNX-TEST-001',
            });
            console.log('✅ Test user created');
        }

        console.log(`🔄 Generating ${count} test reports...`);

        const reports = [];

        for (let i = 0; i < count; i++) {
            const type = randomElement(types);
            const category = randomElement(categories);
            const severity = randomElement(severities);
            const location = randomElement(locations);
            
            // Add some randomness to coordinates (within ~5km)
            const latOffset = (Math.random() - 0.5) * 0.1;
            const lngOffset = (Math.random() - 0.5) * 0.1;

            const report = {
                reportId: generateReportId(),
                userId: testUser._id,
                type,
                title: randomElement(sampleTitles[type]),
                description: randomElement(sampleDescriptions[type]),
                category,
                severity,
                location: {
                    type: 'Point',
                    coordinates: [location.lng + lngOffset, location.lat + latOffset],
                    address: `${randomInt(1, 999)} Main St, ${location.city}`,
                    city: location.city,
                    country: location.country,
                },
                anonymous: Math.random() > 0.7,
                verified: testUser.verified,
                votes: {
                    upvotes: randomInt(0, 50),
                    downvotes: randomInt(0, 20),
                    voters: [],
                },
                likes: {
                    count: type === 'discussion' ? randomInt(0, 30) : 0,
                    users: [],
                },
                comments: [],
                viewCount: randomInt(10, 500),
                status: 'active',
                flags: {
                    count: 0,
                    users: [],
                },
                similarReportsCount: randomInt(0, 5),
                clusterRisk: Math.random() > 0.8,
                createdAt: randomDate(30),
                editableUntil: new Date(Date.now() + 30 * 60 * 1000),
            };

            reports.push(report);
        }

        // Insert all reports
        await SilentRoomReport.insertMany(reports);

        console.log(`✅ Generated ${count} test reports`);

        // Show statistics
        const stats = {
            total: count,
            byType: {},
            bySeverity: {},
            byCategory: {},
        };

        reports.forEach(r => {
            stats.byType[r.type] = (stats.byType[r.type] || 0) + 1;
            stats.bySeverity[r.severity] = (stats.bySeverity[r.severity] || 0) + 1;
            stats.byCategory[r.category] = (stats.byCategory[r.category] || 0) + 1;
        });

        console.log('\n📊 Test Data Statistics:');
        console.log('   Total Reports:', stats.total);
        console.log('   By Type:', stats.byType);
        console.log('   By Severity:', stats.bySeverity);
        console.log('   By Category:', stats.byCategory);

        console.log('\n✅ Test data generation complete!');
        console.log('\n📝 Test User Credentials:');
        console.log('   Email: test@safenex.com');
        console.log('   Password: Test123456!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error generating test data:', error);
        process.exit(1);
    }
}

// Run with command line argument for count
const count = parseInt(process.argv[2]) || 50;
generateTestData(count);
