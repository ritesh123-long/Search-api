const express = require("express");
const cors = require("cors");
const yts = require("yt-search");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// POST /search  → return ONLY ONE JSON OBJECT
app.post("/search", async (req, res) => {
  try {
    const q = req.body.search || "";
    if (!q) return res.status(400).json({ error: "search is required" });

    const r = await yts(q);

    if (!r.videos || r.videos.length === 0) {
      return res.json({ error: "no_results" });
    }

    const v = r.videos[0]; // only first item

    const item = {
      id: v.videoId,
      title: v.title,
      duration: v.timestamp,
      views: v.views,
      thumbnail: v.thumbnail,
      youtube_url: v.url
    };

    return res.json(item); // <-- ONLY JSON OBJECT
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Render PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));
