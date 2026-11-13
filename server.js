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
        const data = await response.json();
        res.json(data);

    }
    catch (error){
        console.error('Error fetching data from API:', error);
        res.status(500).json({ error: 'Failed to fetch data from API' });}
})
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});