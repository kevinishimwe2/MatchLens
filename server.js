require('dotenv').config();
const express = require('express');
const app = express();
app.use(express.static('src'));
const port = process.env.PORT || 5500;


app.get('/api/matches', async (req, res) => {
    try {
        const url = process.env.API_URL + 'competitions/PL/matches';
        const response = await fetch(url, {
            headers: {
                'X-Auth-Token': process.env.TOKEN}
        });
        if (response.ok){
            const data = await response.json();
            res.json(data);
        }
        else{
            
                if (response.status === 429){
                    res.status(response.status).json({ error: 'Too many requests, wait a minute and try again.' });
                }
                else  if (response.status === 400){
                    res.status(response.status).json({ error: 'API key problem or competition not available.' });
                }
                else if (response.status === 404){
                    res.status(response.status).json({ error: 'Not found.' });
                }
                else{
                    res.status(response.status).json({ error: 'Service is unavailable, try again.' });
                }
            
        }

    } 
    catch (error){
        console.error('Error fetching data from API:', error);
        res.status(502).json({ error: 'Server is not available' });}
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});