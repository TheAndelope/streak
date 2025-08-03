const { Client } = require('@notionhq/client');

// Initialize Notion client
const notion = new Client({
    auth: process.env.NOTION_TOKEN
});

const DATABASE_ID = process.env.DATABASE_ID;

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
            const props = row.properties;
            const onTrackProp = props["On Track?"];
            
            if (!onTrackProp) {
                continue;
            }
            
            let onTrack = false;
            
            // Handle different property types like the Python code
            if (onTrackProp.checkbox !== undefined) {
                onTrack = onTrackProp.checkbox;
            } else if (onTrackProp.select && onTrackProp.select) {
                onTrack = onTrackProp.select.name.toLowerCase() === "yes";
            } else if (onTrackProp.formula && onTrackProp.formula) {
                const formulaResult = onTrackProp.formula;
                if (formulaResult.string && formulaResult.string) {
                    onTrack = formulaResult.string.toLowerCase() === "yes";
                }
            }
            
            if (onTrack) {
                streak++;
            } else {
                break; // Stop counting when we hit a day that's not on track
            }
        }
        
        return streak;
    } catch (error) {
        console.error('Error calculating streak:', error);
        return 0;
    }
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

module.exports = async (req, res) => {
    // Enable CORS for widget embedding
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        // Check if environment variables are set
        if (!process.env.NOTION_TOKEN || !process.env.DATABASE_ID) {
            return res.status(500).send('Missing environment variables: NOTION_TOKEN and DATABASE_ID required');
        }
        
        const streak = await calculateStreak();
        const html = htmlTemplate
            .replace('{{STREAK}}', streak)
            .replace('{{TIME}}', new Date().toLocaleTimeString('en-US', { 
                timeZone: 'America/New_York',
                hour: '2-digit',
                minute: '2-digit'
            }));
        
        res.setHeader('Content-Type', 'text/html');
        res.status(200).send(html);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send(`Error loading streak data: ${error.message}`);
    }
};