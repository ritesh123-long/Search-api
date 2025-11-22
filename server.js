// server.js
const express = require('express');
const yts = require('yt-search');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.get('/', (req, res) => {
  res.type('application/json').send(JSON.stringify({
    info: 'Use /search?q=... or POST /search { search: "..." , maxResults:1 }'
  }));
});

// helper async search
async function doSearch(q, maxResults = 10, filter = '') {
  const searchQuery = filter === 'music' ? `${q} music` : q;
  const r = await yts(searchQuery);
  const videos = (r && r.videos) ? r.videos.slice(0, Math.min(50, maxResults)) : [];
  const items = videos.map(v => {
    const videoId = v.videoId || '';
    const thumbnail = v.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    return {
      id: videoId,
      title: v.title || '',
      duration: v.timestamp || '',
      views: v.views || 0,
      thumbnail,
      youtube_url: v.url || `https://www.youtube.com/watch?v=${videoId}`
    };
  });
  return items;
}

// Unified handler function used by GET and POST
async function handleSearchRequest(req, res) {
  try {
    const q = (req.method === 'GET' ? (req.query.q || '') : (req.body.search || req.body.q || '')).toString().trim();
    if (!q) {
      return res.status(400).json({ error: 'search (q) required' });
    }

    const maxResults = Math.min(50, Math.max(1, parseInt(
      (req.method === 'GET' ? req.query.maxResults : req.body.maxResults) || '10', 10
    )));
    const filter = ((req.method === 'GET' ? req.query.filter : req.body.filter) || '').toLowerCase();
    const singleFlag = ((req.method === 'GET' ? req.query.single : req.body.single) || '').toString() === '1';

    const cacheKey = `s:${q}:m:${maxResults}:f:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      // cached is always an array (items)
      if (maxResults === 1 || singleFlag) {
        return res.type('application/json').send(JSON.stringify(cached[0] || {}));
      } else {
        return res.type('application/json').send(JSON.stringify(cached));
      }
    }

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);

    if (maxResults === 1 || singleFlag) {
      // return single object (not array)
      const first = items[0] || {};
      return res.type('application/json').send(JSON.stringify(first));
    } else {
      // return array directly (not wrapped)
      return res.type('application/json').send(JSON.stringify(items));
    }
  } catch (err) {
    console.error('search error:', err);
    // always return a JSON object on error so client can detect easily
    return res.status(500).json({ error: 'search_failed', details: String(err && err.message ? err.message : err) });
  }
}

// GET /search?q=...
app.get('/search', (req, res) => {
  handleSearchRequest(req, res);
});

// POST /search  (form-urlencoded or JSON)
app.post('/search', (req, res) => {
  handleSearchRequest(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});
