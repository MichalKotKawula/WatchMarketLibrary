const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json()); // To parse JSON bodies

const PORT = 3000;

// Initialize Firebase Admin with service account credentials
var serviceAccount = require('./watchmarket-3bfeb-50164081e136.json');

//path/to/your-firebase-adminsdk-key

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://watchmarket-3bfeb-default-rtdb.firebaseio.com'
});

const db = admin.database();

app.get('/getWatchDetails', async (req, res) => {
  const { link } = req.query;
  if (!link) {
    return res.status(400).send('Link is required');
  }

  const options = {
    method: 'GET',
    url: 'https://chrono24.p.rapidapi.com/scraper/chrono24/product',
    params: { query: link },
    headers: {
      'X-RapidAPI-Key': 'b0ff88c45fmsh56db915eb09c381p132049jsnc2fce4413a93',
      'X-RapidAPI-Host': 'chrono24.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred');
  }
});

app.post('/sendWatchDetails', async (req, res) => {
  const watchData = req.body;
  if (!watchData || !watchData.id) {
    return res.status(400).send('Watch data with a valid ID is required');
  }

  try {
    await db.ref(`watches/${watchData.id}`).set(watchData);
    res.send('Watch details successfully saved to Firebase');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error saving watch details to Firebase');
  }
});


app.get('/getWatchesByBrandAndModel', async (req, res) => {
  const { brand, model } = req.query;
  if (!brand || !model) {
    return res.status(400).send('Brand and model are required');
  }

  try {
    const watchesRef = db.ref('watches');
    const snapshot = await watchesRef.orderByChild('brand').equalTo(brand).once('value');
    const watches = snapshot.val();
    if (!watches) {
      return res.status(404).send('No watches found');
    }

    // Filter watches where the model string contains the model query parameter (case-insensitive)
    const filteredWatches = Object.values(watches).filter(watch => {
      return watch.model && watch.model.toLowerCase().includes(model.toLowerCase());
    });

    const watchesWithCreationDate = filteredWatches.map(watch => {
      if (!watch.creationDate) {
        console.log(`Warning: Missing creationDate for watch ID ${watch.id}`);
      }
      return {
        id: watch.id,
        price_formated: watch.price_formated,
        creationDate: watch.creationDate || 'Not available', // Include creationDate or a placeholder
      };
    });

    res.json(watchesWithCreationDate);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error occurred while fetching watches');
  }
});

// Chatbot endpoint
app.post('/api/message', async (req, res) => {
  const userInput = req.body.message;


  try {
    const response = await axios.post('https://api.openai.com/v1/completions', {
      model: 'gpt-3.5-turbo-instruct', 
      prompt: `Suggest a watch type for the user based on the following preferences: ${userInput}`,
      max_tokens: 256
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    res.json({ response: response.data.choices[0].text.trim() });
  } catch (error) {
    console.error('Error communicating with OpenAI:', error);
    res.status(500).send('Error occurred');
  }
});




app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});