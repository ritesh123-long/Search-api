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
app.use(express.json()); // accept application/json
app.use(express.urlencoded({ extended: true })); // accept form-urlencoded (Sketchware)

// Simple cache (TTL 60 seconds)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// health
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// helper: perform yt-search and return array of items
async function doSearch(q, maxResults = 10, filter = '') {
  // ensure q is string and trimmed
  const query = (q || '').toString().trim();
  const searchQuery = filter === 'music' ? `${query} music` : query;

  // call yt-search and build items array
  const r = await yts(searchQuery);
  const videos = Array.isArray(r?.videos) ? r.videos.slice(0, Math.min(50, maxResults)) : [];
  const items = videos.map(v => {
    const videoId = v.videoId || '';
    const thumbnail = v.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '');
    return {
      id: videoId,
      title: v.title || '',
      description: v.description || '',
      timestamp: v.timestamp || '',
      seconds: v.seconds || 0,
      views: v.views || 0,
      author: v.author ? { name: v.author.name || '', url: v.author.url || '' } : null,
      youtube_url: v.url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
      youtube_music_url: videoId ? `https://music.youtube.com/watch?v=${videoId}` : '',
      youtube_short_url: videoId ? `https://youtu.be/${videoId}` : '',
      thumbnail,
      thumbnail_hq: videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '',
      uploadedAt: v.ago || null
    };
  });

  return items;
}

// GET /search?q=...  -> returns JSON array (items)
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'q is required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.query.maxResults || '10', 10)));
    const filter = (req.query.filter || '').toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      // cached is already an items array
      return res.json(cached);
    }

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);
    return res.json(items);
  } catch (err) {
    console.error('GET /search error:', err);
    return res.status(500).json({ error: 'search_failed', details: String(err && err.message ? err.message : err) });
  }
});

// POST /search  -> expects form-urlencoded or JSON body { search: "..." } (returns JSON array)
app.post('/search', async (req, res) => {
  try {
    const q = (req.body.search || req.body.q || '').toString().trim();
    if (!q) return res.status(400).json({ error: 'search (or q) is required in body' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.body.maxResults || '10', 10)));
    const filter = (req.body.filter || '').toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    const items = await doSearch(q, maxResults, filter);
    cache.set(cacheKey, items);
    return res.json(items);
  } catch (err) {
    console.error('POST /search error:', err);
    return res.status(500).json({ error: 'search_failed', details: String(err && err.message ? err.message : err) });
  }
});

// root
app.get('/', (req, res) => {
  res.send('YouTube Music Search (no-key) - use GET /search?q=... or POST /search { search: "..." }');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});    });
}

// GET /search?q=xxx
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return res.status(400).json([]);

    const maxResults = parseInt(req.query.maxResults || "10", 10);

    const items = await doSearch(q, maxResults);

    // Only JSONArray output
    res.json(items);

  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

// POST /search (form-data or JSON)
app.post('/search', async (req, res) => {
  try {
    const q = (req.body.search || req.body.q || "").trim();
    if (!q) return res.status(400).json([]);

    const maxResults = parseInt(req.body.maxResults || "10", 10);

    const items = await doSearch(q, maxResults);

    // Only JSONArray output
    res.json(items);

  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API running on port " + PORT));    if (!q) return res.status(400).json({ error: 'q is required' });

    const maxResults = Math.min(50, Math.max(1, parseInt(req.query.maxResults || '10', 10)));
    const filter = (req.query.filter || '').toLowerCase();

    const cacheKey = `search:${q}:${maxResults}:${filter}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json({ ok: true, cached: true, ...cached });

    const searchQuery = filter === 'music' ? `${q} music` : q;
    const r = await yts(searchQuery);
    const videos = (r.videos || []).slice(0, maxResults);

    const items = videos.map(v => {
      const videoId = v.videoId;

      // Thumbnails
      const thumbnail = v.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const thumbnail_hq = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      const thumbnail_sd = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;

      return {
        id: videoId,
        title: v.title,
        description: v.description,
        timestamp: v.timestamp,
        seconds: v.seconds,
        views: v.views,

        author: v.author ? {
          name: v.author.name,
          url: v.author.url
        } : null,

        youtube_url: v.url,
        youtube_watch_url: `https://www.youtube.com/watch?v=${videoId}`,
        youtube_music_url: `https://music.youtube.com/watch?v=${videoId}`,
        youtube_short_url: `https://youtu.be/${videoId}`,

        thumbnail,
        thumbnail_hq,
        thumbnail_sd,

        uploadedAt: v.ago || null
      };
    });

    const payload = { query: q, count: items.length, items };
    cache.set(cacheKey, payload);

    res.json({ ok: true, cached: false, ...payload });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'search_failed', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
