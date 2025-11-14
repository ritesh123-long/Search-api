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

// Simple cache (TTL 60 seconds)
const cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

// Rate limiting
const limiter = rateLimit({
  windowMs: 60000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

app.get('/', (req, res) => {
  res.send('YouTube Music Search (no-key) — try /search?q=arijit+singh');
});

app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Main Search API
app.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.status(400).json({ error: 'q is required' });

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