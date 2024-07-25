const express = require('express');
const axios = require('axios');
const cors = require('cors');
const serverless = require('serverless-http');
const admin = require('firebase-admin');
const { linearRegression, linearRegressionLine } = require('simple-statistics');
const regression = require('regression');
require('dotenv').config();

const app = express();
const router = express.Router();

const allowedOrigins = [
  'https://watchmarketracker.netlify.app', 
  'http://localhost:4000', 
  'https://watchmarketracker.com', 
  'https://watchmarket-3bfeb-default-rtdb.firebaseio.com/', 
  'https://chrono24.p.rapidapi.com/scraper/chrono24/product',
  'https://*.postman.com',
  'https://www.chrono24*'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

var serviceAccount = require('../watchmarket-3bfeb-50164081e136.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://watchmarket-3bfeb-default-rtdb.firebaseio.com'
});

const db = admin.database();

const predictPrices = (prices, method, degree) => {
  console.log('Prices received for prediction:', prices);
  console.log('Prediction method:', method);
  console.log('Polynomial degree:', degree);

  if (!Array.isArray(prices)) {
    console.error('Prices is not an array.');
    throw new Error('Prices data must be an array.');
  }

  for (const price of prices) {
    if (!price.ds || !price.y) {
      console.error('Invalid price object:', price);
      throw new Error('Each price must have a ds (date) and y (value) property.');
    }
  }

  const data = prices.map(price => {
    const daysSinceEpoch = Math.floor(new Date(price.ds).getTime() / (24 * 60 * 60 * 1000));
    return [daysSinceEpoch, price.y];
  });

  let predict;
  switch (method) {
    case 'linear':
      const lr = linearRegression(data);
      predict = linearRegressionLine(lr);
      break;
    case 'logarithmic':
      const logR = regression.logarithmic(data);
      predict = (x) => logR.predict(x)[1];
      break;
    case 'exponential':
      const expR = regression.exponential(data);
      predict = (x) => expR.predict(x)[1];
      break;
    case 'polynomial':
      const polyR = regression.polynomial(data, { order: degree });
      predict = (x) => polyR.predict(x)[1];
      break;
    default:
      throw new Error('Invalid prediction method');
  }

  const predictions = [];
  const lastDate = Math.floor(new Date(prices[prices.length - 1].ds).getTime() / (24 * 60 * 60 * 1000));

  for (let i = 1; i <= 365; i++) {
    const futureDate = lastDate + i;
    predictions.push({
      ds: new Date(futureDate * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      yhat: predict(futureDate)
    });
  }

  return predictions;
};

router.post('/predictPrices', async (req, res) => {
  const { prices, method = 'linear', degree = 2 } = req.body;
  if (!prices) {
    return res.status(400).send('Prices data is required');
  }

  try {
    console.log('Received prices data:', prices);
    const predictions = predictPrices(prices, method, degree);
    res.json(predictions);
  } catch (error) {
    console.error('Error predicting prices:', error);
    res.status(500).send(`Error occurred while predicting prices: ${error.message}`);
  }
});

router.get('/getWatchDetails', async (req, res) => {
  let { link } = req.query; // Changed to let
  if (!link) {
    return res.status(400).send('Link is required');
  }

  try {
    link = decodeURIComponent(link); // Ensure link is declared with let
    console.log('Decoded link:', link); // Log to verify correct decoding

    const options = {
      method: 'GET',
      url: 'https://chrono24.p.rapidapi.com/scraper/chrono24/product',
      params: { query: link },
      headers: {
        'x-rapidapi-key': 'b0ff88c45fmsh56db915eb09c381p132049jsnc2fce4413a93',
        'x-rapidapi-host': 'chrono24.p.rapidapi.com'
      },
    };

    console.log('Request options:', options); // Log request options
    const response = await axios.request(options);

    if (response.status !== 200) {
      console.error('API responded with status:', response.status);
      return res.status(500).send('API error');
    }

    res.json(response.data);
  } catch (error) {
    console.error('Error during API request:', {
      message: error.message,
      status: error.response ? error.response.status : 'No status',
      data: error.response ? error.response.data : 'No response data'
    });
    res.status(500).send(`Error occurred: ${error.response ? error.response.data : error.message}`);
  }
});
router.post('/sendWatchDetails', async (req, res) => {
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

router.get('/getWatchesByBrandAndModel', async (req, res) => {
  const { brand, model } = req.query;
  if (!brand || !model) {
    return res.status(400).send('Brand and model are required');
  }

  try {
    console.log(`Fetching watches for brand: ${brand}, model: ${model}`);
    const watchesRef = db.ref('watches');
    const snapshot = await watchesRef.orderByChild('brand').equalTo(brand).once('value');
    console.log('Database snapshot received:', snapshot.exists());
    const watches = snapshot.val();
    if (!watches) {
      console.log('No watches found for the specified brand.');
      return res.status(404).send('No watches found');
    }

    const filteredWatches = Object.values(watches).filter(watch => {
      console.log(`Evaluating watch: ${watch.id}`);
      return watch.model && watch.model.toLowerCase().includes(model.toLowerCase());
    });

    const watchesWithCreationDate = filteredWatches.map(watch => {
      if (!watch.creationDate) {
        console.log(`Warning: Missing creationDate for watch ID ${watch.id}`);
      }
      return {
        id: watch.id,
        brand: watch.brand, // Include brand in the response
        model: watch.model, // Include model in the response
        price_formated: watch.price_formated,
        creationDate: watch.creationDate || 'Not available',
      };
    });

    res.json(watchesWithCreationDate);
  } catch (error) {
    console.error('Error occurred while fetching watches:', error);
    res.status(500).send('Error occurred while fetching watches');
  }
});

// Chatbot endpoint
router.post('/api/message', async (req, res) => {
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

// Use the router and set up the serverless handler
app.use('/.netlify/functions/server', router);
module.exports.handler = serverless(app);
