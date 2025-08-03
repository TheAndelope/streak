const express = require('express');
const { Client } = require('@notionhq/client');

const app = express();
const port = process.env.PORT || 3000;

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

const DATABASE_ID = process.env.DATABASE_ID;

if (!process.env.NOTION_TOKEN || !process.env.DATABASE_ID) {
    console.error('Missing required environment variables: NOTION_TOKEN and DATABASE_ID');
    process.exit(1);
}

// Cache for streak data
let cachedStreak = 0;
let lastUpdate = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

async function fetchRows() {
    const results = [];
    let startCursor = undefined;
    
    while (true) {
        const response = await notion.databases.query({
            database_id: DATABASE_ID,
            start_cursor: startCursor,
            page_size: 100,
            sorts: [{ property: "Date", direction: "descending" }]
        });
        
        results.push(...response.results);
        
        if (!response.has_more) break;
        startCursor = response.next_cursor;
    }
    
    return results;
}

async function calculateStreak() {
    try {
        const rows = await fetchRows();
        let streak = 0;
        
        for (const row of rows) {
            const status = row.properties["On Track?"]?.select?.name?.toLowerCase();
            if (status === "yes") {
                streak++;
            } else {
                break;
            }
        }
        
        return streak;
    } catch (error) {
        console.error('Error calculating streak:', error);
        return cachedStreak; // Return cached value on error
    }
}

async function updateStreak() {
    const now = Date.now();
    if (now - lastUpdate > CACHE_DURATION) {
        cachedStreak = await calculateStreak();
        lastUpdate = now;
        console.log(`Streak updated: ${cachedStreak}`);
    }
    return cachedStreak;
}

const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Current Streak</title>
    <style>
        body {
            background: transparent;
            margin: 0;
            padding: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
                Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            color: #28a745;
            text-align: center;
        }
        .streak-widget {
            background: #121212;
            border-radius: 12px;
            padding: 20px;
            border: 1px solid #444;
            max-width: 200px;
            margin: 0 auto;
        }
        .streak-number {
            font-size: 3rem;
            font-weight: bold;
            margin: 0;
        }
        .streak-label {
            color: #888;
            font-size: 0.9rem;
            margin-top: 5px;
        }
        .last-updated {
            color: #666;
            font-size: 0.7rem;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <div class="streak-widget">
        <div class="streak-number">{{STREAK}}</div>
        <div class="streak-label">day streak</div>
        <div class="last-updated">Updated: {{TIME}}</div>
    </div>
</body>
</html>
`;

app.get('/', async (req, res) => {
    try {
        const streak = await updateStreak();
        const html = htmlTemplate
            .replace('{{STREAK}}', streak)
            .replace('{{TIME}}', new Date().toLocaleTimeString('en-US', { 
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit'
            }));
        
        res.send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error loading streak data');
    }
});

// API endpoint for just the streak number
app.get('/api/streak', async (req, res) => {
    try {
        const streak = await updateStreak();
        res.json({ streak, lastUpdated: new Date(lastUpdate).toISOString() });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch streak' });
    }
});

// Force refresh endpoint
app.get('/refresh', async (req, res) => {
    try {
        lastUpdate = 0; // Force cache refresh
        const streak = await updateStreak();
        res.json({ message: 'Streak refreshed', streak });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to refresh streak' });
    }
});

app.listen(port, () => {
    console.log(`Notion streak widget running on port ${port}`);
    // Update streak on startup
    updateStreak();
});