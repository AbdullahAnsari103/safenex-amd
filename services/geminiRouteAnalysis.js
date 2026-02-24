/**
 * Gemini AI Route Analysis Service
 * Provides intelligent route insights and step-by-step guidance
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use primary API key (SafeTrace key hit rate limit)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Use the faster 2.5-flash model for better performance and availability
const GEMINI_MODEL = process.env.GEMINI_MODEL_NEXA || 'gemini-2.5-flash';

// Initialize Gemini AI
let genAI = null;
let model = null;

if (GEMINI_API_KEY) {
    try {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ 
            model: GEMINI_MODEL,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        });
        console.log(`✅ Gemini AI initialized successfully with model: ${GEMINI_MODEL}`);
    } catch (error) {
        console.error('❌ Failed to initialize Gemini AI:', error.message);
    }
} else {
    console.warn('⚠️ Gemini API key not configured. AI route analysis will be disabled.');
}

/**
 * Generate AI-powered route analysis and recommendations
 */
async function analyzeRouteWithAI(routeData) {
    if (!model) {
        console.warn('Gemini AI model not initialized');
        return {
            success: false,
            analysis: 'AI analysis unavailable - API key not configured',
            keyInsights: [],
            safetyTips: [],
            stepByStepGuidance: []
        };
    }

    try {
        const {
            route,
            dangerZones,
            travelMode,
            startAddress,
            endAddress
        } = routeData;

        console.log('Generating AI analysis for route:', {
            mode: travelMode,
            distance: route.distanceKm,
            risk: route.risk.riskLevel
        });

        // Build context for Gemini
        const prompt = `You are a safety-focused navigation assistant. Analyze this route and provide helpful insights.

**Route Details:**
- Travel Mode: ${getTravelModeName(travelMode)}
- Distance: ${route.distanceKm} km
- Duration: ${route.durationDisplay || route.durationMin + ' min'}
- Risk Level: ${route.risk.riskLevel}
- Risk Score: ${route.risk.totalRisk}/100
- Danger Zones: ${route.dangerZoneCount}
- From: ${startAddress || 'Current location'}
- To: ${endAddress}

**Danger Zones Along Route:**
${route.risk.affectedZones.length > 0 ? route.risk.affectedZones.map((zone, i) => 
    `${i + 1}. ${zone.placeName || zone.category} - ${zone.severity} risk (${zone.distance}m from route)${zone.activeHours ? ` - Active: ${zone.activeHours}` : ''}`
).join('\n') : 'No danger zones detected'}

**Risk Factors:**
${route.risk.riskFactors.length > 0 ? route.risk.riskFactors.map(f => `- ${f}`).join('\n') : '- No significant risk factors'}

**Instructions:**
Provide ONLY a valid JSON object (no markdown, no code blocks, no backticks) with this exact structure:
{
    "summary": "Brief 2-3 sentence overview of the route safety and what to expect",
    "keyInsights": ["First key insight about this route", "Second important observation", "Third notable point"],
    "safetyTips": ["First practical safety tip", "Second safety recommendation", "Third safety advice"],
    "stepByStepGuidance": [
        {
            "step": 1,
            "instruction": "Start from [location] and head [direction]",
            "distance": "0.5 km",
            "safetyNote": "Watch for traffic/pedestrians"
        },
        {
            "step": 2,
            "instruction": "Continue on [road name] for [distance]",
            "distance": "1.2 km",
            "safetyNote": "Stay in designated lane"
        }
    ],
    "timeRecommendations": "Best time to travel this route (e.g., early morning, avoid rush hour)",
    "alternativeConsiderations": "When to consider alternative routes (e.g., if weather is bad, during peak hours)"
}

IMPORTANT:
- Return ONLY the JSON object, no markdown formatting
- No code blocks, no backticks, no \`\`\`json
- Provide 3-5 detailed step-by-step guidance items
- Make each step specific and actionable
- Include distance markers for each step
- Add relevant safety notes for each step
- Focus on ${getTravelModeName(travelMode)}-specific guidance
- Keep language clear, friendly, and helpful`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log('AI response received, length:', text.length);

        // Clean up response - remove markdown code blocks if present
        let cleanedText = text.trim();
        
        // Remove markdown code blocks (```json ... ``` or ``` ... ```)
        cleanedText = cleanedText.replace(/^```(?:json)?\s*/i, '');
        cleanedText = cleanedText.replace(/\s*```$/, '');
        cleanedText = cleanedText.trim();

        // Parse JSON response with better error handling
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                // Try to clean up common JSON issues
                let jsonStr = jsonMatch[0];
                
                // Remove trailing commas before closing brackets
                jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                
                // Try to fix incomplete JSON by closing unclosed arrays/objects
                const openBraces = (jsonStr.match(/\{/g) || []).length;
                const closeBraces = (jsonStr.match(/\}/g) || []).length;
                const openBrackets = (jsonStr.match(/\[/g) || []).length;
                const closeBrackets = (jsonStr.match(/\]/g) || []).length;
                
                // Add missing closing brackets
                for (let i = 0; i < (openBrackets - closeBrackets); i++) {
                    jsonStr += ']';
                }
                // Add missing closing braces
                for (let i = 0; i < (openBraces - closeBraces); i++) {
                    jsonStr += '}';
                }
                
                // Remove any trailing commas before we added closing brackets
                jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                
                console.log('JSON parsing attempt...');
                const analysis = JSON.parse(jsonStr);
                console.log('AI insights generated:', {
                    analysisSuccess: true,
                    hasInsights: Array.isArray(analysis.keyInsights) && analysis.keyInsights.length > 0,
                    hasTips: Array.isArray(analysis.safetyTips) && analysis.safetyTips.length > 0,
                    guidanceSuccess: Array.isArray(analysis.stepByStepGuidance),
                    stepCount: analysis.stepByStepGuidance?.length || 0
                });
                
                return {
                    success: true,
                    analysis: analysis.summary || 'Route analysis completed',
                    keyInsights: Array.isArray(analysis.keyInsights) ? analysis.keyInsights : [],
                    safetyTips: Array.isArray(analysis.safetyTips) ? analysis.safetyTips : [],
                    stepByStepGuidance: Array.isArray(analysis.stepByStepGuidance) ? analysis.stepByStepGuidance : [],
                    timeRecommendations: analysis.timeRecommendations,
                    alternativeConsiderations: analysis.alternativeConsiderations
                };
            } catch (parseError) {
                console.warn('JSON parsing failed:', parseError.message);
                console.log('Attempting to extract insights from text...');
                // Extract insights manually from text
                return extractInsightsFromText(cleanedText, route);
            }
        }

        // Fallback if JSON parsing fails
        console.warn('Could not find JSON in AI response, using raw text');
        return extractInsightsFromText(cleanedText, route);

    } catch (error) {
        console.error('Gemini AI analysis error:', error.message);
        console.error('Error stack:', error.stack);
        return {
            success: false,
            analysis: 'Unable to generate AI analysis at this time',
            keyInsights: [],
            safetyTips: [],
            stepByStepGuidance: [],
            error: error.message
        };
    }
}

/**
 * Generate step-by-step navigation guidance with safety context
 */
async function generateNavigationGuidance(routeData) {
    if (!model) {
        return generateFallbackGuidance(routeData);
    }

    try {
        const { route, travelMode, instructions } = routeData;

        const prompt = `Generate clear, step-by-step navigation instructions for a ${getTravelModeName(travelMode)} route.

**Route Info:**
- Distance: ${route.distanceKm} km
- Duration: ${route.durationDisplay || route.durationMin + ' min'}
- Risk Level: ${route.risk.riskLevel}
- Danger Zones: ${route.dangerZoneCount}

**Turn-by-Turn Instructions:**
${instructions && instructions.length > 0 ? instructions.map((inst, i) => 
    `${i + 1}. ${inst.instruction} (${(inst.distance / 1000).toFixed(2)} km)`
).join('\n') : 'No detailed instructions available'}

Provide a JSON array of enhanced navigation steps:
[
    {
        "stepNumber": 1,
        "instruction": "Clear, concise instruction",
        "distance": "X.XX km",
        "estimatedTime": "X min",
        "safetyNote": "Any safety considerations for this segment",
        "landmark": "Notable landmark if applicable"
    }
]

Make instructions:
1. Clear and easy to follow
2. Include distance and time estimates
3. Add safety notes where relevant
4. Mention landmarks when helpful
5. Appropriate for ${getTravelModeName(travelMode)} travel`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Parse JSON response
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const steps = JSON.parse(jsonMatch[0]);
            return {
                success: true,
                steps: steps
            };
        }

        return generateFallbackGuidance(routeData);

    } catch (error) {
        console.error('Navigation guidance generation error:', error);
        return generateFallbackGuidance(routeData);
    }
}

/**
 * Fallback guidance when AI is unavailable
 */
function generateFallbackGuidance(routeData) {
    const { route, instructions } = routeData;
    
    const steps = instructions && instructions.length > 0 
        ? instructions.map((inst, i) => ({
            stepNumber: i + 1,
            instruction: inst.instruction,
            distance: `${(inst.distance / 1000).toFixed(2)} km`,
            estimatedTime: `${Math.round(inst.duration / 60)} min`,
            safetyNote: null,
            landmark: null
        }))
        : [{
            stepNumber: 1,
            instruction: `Travel ${route.distanceKm} km to your destination`,
            distance: `${route.distanceKm} km`,
            estimatedTime: route.durationDisplay || `${route.durationMin} min`,
            safetyNote: route.risk.riskLevel !== 'safe' ? 'Stay alert in this area' : null,
            landmark: null
        }];

    return {
        success: true,
        steps: steps
    };
}

/**
 * Extract insights from text when JSON parsing fails
 */
function extractInsightsFromText(text, route) {
    // Try to extract summary (first paragraph or sentence)
    const lines = text.split('\n').filter(l => l.trim());
    const summary = lines[0] || `This ${route.distanceKm} km route has ${route.risk.riskLevel} risk level.`;
    
    // Try to extract bullet points or numbered lists as insights
    const insights = [];
    const tips = [];
    
    lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.match(/^[\d\-\*•]/)) {
            const cleaned = trimmed.replace(/^[\d\-\*•\.\)]\s*/, '');
            if (cleaned.length > 10) {
                if (insights.length < 3) {
                    insights.push(cleaned);
                } else if (tips.length < 3) {
                    tips.push(cleaned);
                }
            }
        }
    });
    
    return {
        success: true,
        analysis: summary,
        keyInsights: insights,
        safetyTips: tips,
        stepByStepGuidance: []
    };
}

/**
 * Get human-readable travel mode name
 */
function getTravelModeName(mode) {
    const names = {
        'foot-walking': 'Walking',
        'cycling-regular': 'Cycling',
        'driving-car': 'Driving'
    };
    return names[mode] || mode;
}

/**
 * Generate quick safety summary for a route
 */
async function generateQuickSafetySummary(route) {
    if (!model) {
        return generateFallbackSummary(route);
    }

    try {
        const prompt = `Provide a brief safety summary for this route in 1-2 sentences:

Risk Level: ${route.risk.riskLevel}
Risk Score: ${route.risk.totalRisk}/100
Danger Zones: ${route.dangerZoneCount}
Distance: ${route.distanceKm} km

Be concise, helpful, and reassuring if safe, or cautionary if risky.`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();

    } catch (error) {
        console.error('Quick summary generation error:', error);
        return generateFallbackSummary(route);
    }
}

/**
 * Fallback summary when AI is unavailable
 */
function generateFallbackSummary(route) {
    if (route.risk.riskLevel === 'safe' || route.risk.riskLevel === 'low') {
        return `This route appears safe with ${route.risk.riskLevel} risk. Enjoy your journey!`;
    } else if (route.risk.riskLevel === 'medium') {
        return `This route has moderate risk with ${route.dangerZoneCount} danger zone(s). Stay alert and follow safety guidelines.`;
    } else {
        return `This route has ${route.risk.riskLevel} risk with ${route.dangerZoneCount} danger zone(s). Consider alternative routes or travel during safer hours.`;
    }
}

module.exports = {
    analyzeRouteWithAI,
    generateNavigationGuidance,
    generateQuickSafetySummary
};
