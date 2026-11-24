require('dotenv').config();
require('node:dns').setDefaultResultOrder('ipv4first');
// Node gives each connection attempt only 250ms by default, which is too short on slower networks
// (this was causing ETIMEDOUT for gnews.io while curl worked), so allow more time
const net = require('node:net');
if (typeof net.setDefaultAutoSelectFamilyAttemptTimeout === 'function') {
    net.setDefaultAutoSelectFamilyAttemptTimeout(3000);
}
const express = require('express');
const app = express();
app.use(express.static('src'));
const port = process.env.PORT || 5500;
// Arrays of the Competition codes and status codes of the matches
const league = ["PL", "CL", "PD", "BL1", "SA", "FL1", "DED", "PPL", "BSA", "WC", "EC"];
const validstatus = ["SCHEDULED","IN_PLAY","FINISHED", "POSTPONED"];


app.get('/api/matches', async (req, res) => {

    // Query for searching matches by league, status, date range and matchday
    const selectedleague = req.query.league || 'PL';
    const selectedstatus = req.query.status;
    const startdate = req.query.dateFrom;
    const enddate = req.query.dateTo;
    const matchday = req.query.matchday;

    // Validate the query
    if (!league.includes(selectedleague)) {
        return res.status(400).json({ error: 'League not found' });
    }
    if (!validstatus.includes(selectedstatus) && selectedstatus !== undefined) {
        return res.status(400).json({ error: 'Invalid status code' });
    }
    if ( startdate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(startdate)) {  
        return res.status(400).json({ error: 'Invalid date format (It must be in the format YYYY-MM-DD)' });
    }
    if ( enddate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(enddate)) {  
        return res.status(400).json({ error: 'Invalid date format (It must be in the format YYYY-MM-DD)' });
    }
    if (matchday !== undefined && !Number.isInteger(Number(matchday)) || 1 > Number(matchday) > 38) {
        return res.status(400).json({ error: 'Invalid matchday' });
    }

    // Fetch data from the API
    try {
        const params = new URLSearchParams();
        let url = process.env.API_URL + `competitions/${selectedleague}/matches`;
        if (selectedstatus) {
            params.append('status', selectedstatus);
        }
        if (startdate) {
            params.append('dateFrom', startdate);
        }
        if (enddate) {
            params.append('dateTo', enddate);
        }
        if (matchday) {
            params.append('matchday', matchday);
        }
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        const response = await fetch(url, {
            headers: {
                'X-Auth-Token': process.env.TOKEN
            }
        });

        // Error handling for the API response

        if (response.ok) {
            const data = await response.json();
            res.json(data);
        }
        else{
            await handleApiError(response, res);
        }

    }
    catch (error) {
        console.error('Error fetching data from API:', error);
        res.status(502).json({ error: 'Server is not available' });
    }
});

app.get('/api/standings', async (req, res) =>{
    const selectedLeague = req.query.league || 'PL';
    if (!league.includes(selectedLeague)) {
        return res.status(400).json({ error: 'League not found' });
    }
    try {
        const params = new URLSearchParams();
        let url = process.env.API_URL + `competitions/${selectedLeague}/standings`;
        const response = await fetch(url, {
            headers: {
                'X-Auth-Token': process.env.TOKEN
            }
        });
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        }
        else{
            await handleApiError(response, res);
        }
        

    }
    catch (error) {
        console.error('Error fetching data from API:', error);
        res.status(502).json({ error: 'Server is not available' });
    }

});
// Live matches across every league
app.get('/api/live', async (req, res) => {
    try {
        const response = await fetch(process.env.API_URL + 'matches?status=IN_PLAY,PAUSED', {
            headers: {
                'X-Auth-Token': process.env.TOKEN
            }
        });
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        }
        else {
            await handleApiError(response, res);
        }
    }
    catch (error) {
        console.error('Error fetching live matches:', error);
        res.status(502).json({ error: 'Server is not available' });
    }
});

// Football news written by Gemini (with Google Search), cached for 10 minutes
const leagueNames = {
    PL: 'Premier League', CL: 'Champions League', PD: 'La Liga', BL1: 'Bundesliga',
    SA: 'Serie A', FL1: 'Ligue 1', DED: 'Eredivisie', PPL: 'Primeira Liga',
    BSA: 'Campeonato Brasileiro Serie A', WC: 'FIFA World Cup', EC: 'UEFA European Championship'
};
// Finished matches from the last few days, one text line per match
async function recentResults(code, topic) {
    try {
        const day = 24 * 60 * 60 * 1000;
        const from = new Date(Date.now() - 4 * day).toISOString().slice(0, 10);
        const to = new Date(Date.now() + day).toISOString().slice(0, 10);
        const path = code ? `competitions/${code}/matches` : 'matches';
        const response = await fetch(process.env.API_URL + `${path}?status=FINISHED&dateFrom=${from}&dateTo=${to}`, {
            headers: {
                'X-Auth-Token': process.env.TOKEN
            },
            signal: AbortSignal.timeout(8000)
        });
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        return data.matches.slice(-30).map(match => {
            const competition = (match.competition || data.competition || {}).name || topic;
            return `${match.homeTeam.name} ${match.score.fullTime.home}-${match.score.fullTime.away} ` +
                `${match.awayTeam.name} (${competition}, ${match.utcDate.slice(0, 10)})`;
        });
    }
    catch (error) {
        console.error('Error fetching recent results:', error);
        return [];
    }
}

// Option 1: real news articles from GNews (free key at gnews.io, needs GNEWS_API_KEY)
// Search words per league, so "football" never pulls in American football
const gnewsQueries = {
    '': 'soccer OR "Premier League" OR "La Liga" OR Bundesliga OR "Serie A" OR "Ligue 1" OR "Champions League"',
    PL: '"Premier League"',
    PD: '"La Liga"',
    BL1: 'Bundesliga',
    SA: '"Serie A" soccer',
    FL1: '"Ligue 1"',
    DED: 'Eredivisie',
    PPL: '"Primeira Liga"',
    BSA: 'Brasileirão OR "Campeonato Brasileiro"',
    CL: '"Champions League" soccer',
    WC: '"World Cup" soccer',
    EC: '"European Championship" soccer'
};
// articles that are clearly about American football are dropped
const notSoccer = /\b(NFL|NCAA|college football|American football|quarterback|touchdown|Super Bowl|gridiron)\b/i;

let gnewsDownUntil = 0;
async function newsFromGNews(code) {
    if (!process.env.GNEWS_API_KEY || Date.now() < gnewsDownUntil) {
        return null;
    }
    try {
        const query = gnewsQueries[code] || gnewsQueries[''];
        const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&max=10&sortby=publishedAt&apikey=${process.env.GNEWS_API_KEY}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!response.ok) {
            console.error('GNews error:', response.status, (await response.text()).slice(0, 300));
            return null;
        }
        const data = await response.json();
        const soccerOnly = (data.articles || [])
            .filter(article => !notSoccer.test(`${article.title} ${article.description}`))
            .slice(0, 6);
        if (soccerOnly.length === 0) {
            return null;
        }
        const articles = soccerOnly.map(article => ({
            title: article.title,
            summary: article.description,
            url: article.url,
            source: article.source && article.source.name,
            published: article.publishedAt
        }));
        return { articles, sources: [], provider: 'News from GNews' };
    }
    catch (error) {
        console.error('Error fetching GNews (skipping it for 10 minutes):', error.message);
        gnewsDownUntil = Date.now() + 10 * 60 * 1000;
        return null;
    }
}

// Calls Gemini once, retrying when the model says it is busy (503)
async function askGemini(prompt, model, useSearch) {
    const requestBody = { contents: [{ parts: [{ text: prompt }] }] };
    if (useSearch) {
        requestBody.tools = [{ google_search: {} }];
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': process.env.GEMINI_API_KEY
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(10000)
            });
            if (response.ok) {
                return await response.json();
            }
            console.error('Gemini error:', model, response.status, (await response.text()).slice(0, 300));
            if (response.status !== 503) {
                return null;
            }
        }
        catch (error) {
            console.error('Gemini request failed:', model, error.message);
            return null;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return null;
}

// Option 2: Gemini writes the news from real recent results (or uses Google Search on a paid plan)
async function newsFromGemini(code, topic) {
    if (!process.env.GEMINI_API_KEY) {
        return null;
    }
    const useSearch = process.env.GEMINI_SEARCH === 'true';
    let prompt;
    if (useSearch) {
        prompt = `Using Google Search, find the 6 most recent football news stories about ${topic}. ` +
            `Reply with ONLY a JSON array and no markdown. Each item must look like ` +
            `{"title": "short headline", "summary": "one or two sentences"}.`;
    }
    else {
        const lines = await recentResults(code, topic);
        if (lines.length === 0) {
            return null;
        }
        prompt = `Write 6 short football news items about ${topic} using ONLY the recent results below. ` +
            `Do not add facts that are not listed. Reply with ONLY a JSON array and no markdown. ` +
            `Each item must look like {"title": "short headline", "summary": "one or two sentences"}.\n\n` +
            lines.join('\n');
    }

    // if the first model is busy, the second one is tried
    const models = [...new Set([process.env.GEMINI_MODEL || 'gemini-4-hydrogen', 'gemini-3.8-flash'])];
    for (const model of models) {
        try {
            const data = await askGemini(prompt, model, useSearch);
            if (!data) {
                continue;
            }
            const candidate = data.candidates[0];
            const text = candidate.content.parts.map(part => part.text || '').join('');
            // keep only the JSON array, in case Gemini adds extra words around it
            const articles = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
            const chunks = (candidate.groundingMetadata && candidate.groundingMetadata.groundingChunks) || [];
            const sources = chunks
                .filter(chunk => chunk.web)
                .map(chunk => ({ title: chunk.web.title, uri: chunk.web.uri }))
                .slice(0, 6);
            return { articles, sources, provider: 'Written by Gemini from recent results' };
        }
        catch (error) {
            console.error('Could not use the Gemini reply:', error.message);
        }
    }
    return null;
}

// Option 3 (always works): plain latest results, no AI
async function newsFromResults(code, topic) {
    const lines = await recentResults(code, topic);
    if (lines.length === 0) {
        return null;
    }
    const articles = lines.slice(-6).reverse().map(line => {
        const parts = line.match(/^(.*) \((.*)\)$/);
        return { title: parts ? parts[1] : line, summary: parts ? parts[2] : '' };
    });
    return { articles, sources: [], provider: 'Latest results' };
}

const newsCache = {};
const NEWS_CACHE_MS = 10 * 60 * 1000;

app.get('/api/news', async (req, res) => {
    const code = req.query.league || '';
    if (code && !league.includes(code)) {
        return res.status(400).json({ error: 'League not found' });
    }
    const cached = newsCache[code];
    if (cached && Date.now() - cached.time < NEWS_CACHE_MS) {
        return res.json(cached.data);
    }

    const topic = leagueNames[code] || 'football (soccer) worldwide';
    const result =
        (await newsFromGNews(code)) ||
        (await newsFromGemini(code, topic)) ||
        (await newsFromResults(code, topic));

    if (!result) {
        return res.status(502).json({ error: 'No news is available right now.' });
    }
    result.updatedAt = new Date().toISOString();
    newsCache[code] = { time: Date.now(), data: result };
    res.json(result);
});

function handleApiError(response, res){

            if (response.status === 429) {
                res.status(response.status).json({ error: 'Too many requests, wait a minute and try again.' });
            }
            else if (response.status === 400) {
                res.status(response.status).json({ error: 'API key problem or competition not available.' });
            }
            else if (response.status === 404) {
                res.status(response.status).json({ error: 'Not found.' });
            }
            else {
                res.status(response.status).json({ error: 'Service is unavailable, try again.' });
            }

        
}
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});