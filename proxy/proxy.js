require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5050;
const ENDPOINT_URL = process.env.ENDPOINT_URL;
const ENDPOINT_AUTH_TOKEN = process.env.ENDPOINT_AUTH_TOKEN

app.post('/api/score', async (req, res) => {
  try {
    const response = await axios.post(ENDPOINT_URL, req.body, {
      headers: {
        'Authorization': `Bearer ${ENDPOINT_AUTH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Erreur proxy Azure :', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Proxy listening on http://localhost:${PORT}`);
});
