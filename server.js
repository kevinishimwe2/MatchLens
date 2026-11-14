require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.static('src'));
const port = process.env.PORT || 5500;
// Arrays of the Competition codes and status codes of the matches
const league = ["PL", "CL", "PD", "BL1", "SA", "FL1", "DED", "PPL", "BSA", "WC", "EC", "ELC"];
const validstatus = ["SCHEDULED", "LIVE", "IN_PLAY", "PAUSED", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELED"];


app.get('/api/matches', async (req, res) => {
    const selectedleague = req.query.league || 'PL';
    const selectedstatus = req.query.status;

    if (!league.includes(selectedleague)) {
        return res.status(400).json({ error: 'League not found' });
    }
    if (!validstatus.includes(selectedstatus) && selectedstatus !== undefined) {
        return res.status(400).json({ error: 'Invalid status code' });
    }
    try {
        const params = new URLSearchParams();
        let url = process.env.API_URL + `competitions/${selectedleague}/matches`;
        if (selectedstatus) {
            params.append('status', selectedstatus);
            url = process.env.API_URL + `competitions/${selectedleague}/matches` + `?${params.toString()}`;
        }
        
        const response = await fetch(url, {
            headers: {
                'X-Auth-Token': process.env.TOKEN
            }
        });
    
        if (response.ok) {
            const data = await response.json();
            res.json(data);
        }
        else {

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

    }
    catch (error) {
        console.error('Error fetching data from API:', error);
        res.status(502).json({ error: 'Server is not available' });
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});