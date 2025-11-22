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
  res.send('YouTube Music Search API — use /search?q=... or POST /search with body { search: "..." }');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
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
      description: v.description || '',
      duration: v.timestamp || '',
      seconds: v.seconds || 0,
      views: v.views || 0,
      author: v.author ? { name: v.author.name, url: v.author.url } : null,
      youtube_url: v.url || (`https://www.youtube.com/watch?v=${videoId}`),
      thumbnail
    };
  });
  return items;
}

// Utility to respond according to requested format
function respondWithFormat(res, items, format) {
  format = (format || 'array').toLowerCase();
  if (format === 'single') {
    // return first item as single object (or {} if none)
    return res.json(items.length ? items[0] : {});
  }
  if (format === 'object') {
    // return object keyed by id
    if (items.length === 1) {
      // if single item and object requested, return the single object (your wanted shape)
      return res.json(items[0]);
    }
    const map = {};
    items.forEach(it => {
      // if id missing, fallback to index key
      const key = it.id && it.id.length ? it.id : Object.keys(map).length.toString();
      map[key] = it;
    });
    return res.json(map);
  }
  // default: array
  return res.json(items);
}

// GET /search?q=...
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || req.query.search || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'q or search query param required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.query.maxResults || '10', 10)));
    const filter = (req.query.filter || '').toString().toLowerCase();
    const format = (req.query.format || 'array').toString().toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}:${format}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const items = await doSearch(q, maxResults, filter);
    // store raw items in cache (not formatted) to keep cache consistent
    cache.set(cacheKey, items);
    // respond according to format
    respondWithFormat(res, items, format);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'search_failed', details: err.message });
  }
});

// POST /search (form or json)
app.post('/search', async (req, res) => {
  try {
    const q = (req.body.search || req.body.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'search (or q) is required in body' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.body.maxResults || '10', 10)));
    const filter = (req.body.filter || '').toString().toLowerCase();
    const format = (req.body.format || 'array').toString().toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}:${format}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);
    respondWithFormat(res, items, format);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'search_failed', details: err.message });
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
