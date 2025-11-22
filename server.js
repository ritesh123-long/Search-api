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
  res.send('YouTube Music Search — try GET /search?q=arijit+singh or POST /search { search: "arijit singh" }');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// helper - performs yt-search and returns array of items
async function doSearch(q, maxResults = 10, filter = '') {
  const searchQuery = filter === 'music' ? `${q} music` : q;
  const r = await yts(searchQuery);
  const videos = (r && r.videos) ? r.videos.slice(0, Math.min(50, maxResults)) : [];
  const items = videos.map(v => {
    const videoId = v.videoId || '';
    return {
      id: videoId,
      title: v.title || '',
      description: v.description || '',
      timestamp: v.timestamp || '',
      seconds: v.seconds || 0,
      views: v.views || 0,
      author: v.author ? { name: v.author.name, url: v.author.url } : null,
      youtube_url: v.url || (`https://www.youtube.com/watch?v=${videoId}`),
      youtube_music_url: `https://music.youtube.com/watch?v=${videoId}`,
      youtube_short_url: `https://youtu.be/${videoId}`,
      thumbnail: v.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
    };
  });
  return items;
}

// GET /search?q=...
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'q is required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.query.maxResults || '10', 10)));
    const filter = (req.query.filter || '').toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached); // directly return array

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);
    return res.json(items); // <-- IMPORTANT: return only the items array
  } catch (err) {
    console.error('GET /search error:', err);
    return res.status(500).json({ error: 'search_failed', details: err.message });
  }
});

// POST /search  (accepts form-urlencoded or JSON body)
// expects body: { search: "query" } or { q: "query" }
app.post('/search', async (req, res) => {
  try {
    const q = (req.body.search || req.body.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'search (or q) is required in body' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.body.maxResults || '10', 10)));
    const filter = (req.body.filter || '').toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached); // directly return array

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);
    return res.json(items); // <-- return only the array
  } catch (err) {
    console.error('POST /search error:', err);
    return res.status(500).json({ error: 'search_failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
