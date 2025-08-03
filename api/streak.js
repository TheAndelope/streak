const { Client } = require('@notionhq/client');

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
        return 0;
    }
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    try {
        // Check environment variables
        if (!process.env.NOTION_TOKEN || !process.env.DATABASE_ID) {
            return res.status(500).json({ error: 'Missing environment variables' });
        }
        
        const streak = await calculateStreak();
        res.status(200).json({ 
            streak, 
            lastUpdated: new Date().toISOString(),
            timezone: 'America/New_York'
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: `Failed to fetch streak: ${error.message}` });
    }
};