const express = require("express");
const yts = require("yt-search");
const cors = require("cors");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// POST /search
app.post("/search", async (req, res) => {
    try {
        const q = (req.body.search || "").trim();
        if (!q) return res.json({ error: "search required" });

        const r = await yts(q);
        const videos = r.videos || [];

        if (videos.length === 0) return res.json({ error: "no_results" });

        const v = videos[0]; // first item only

        const obj = {
            id: v.videoId,
            title: v.title,
            duration: v.timestamp,
            views: v.views,
            thumbnail: v.thumbnail,
            youtube_url: `https://www.youtube.com/watch?v=${v.videoId}`
        };

        res.json(obj); // <-- ARRAY नहीं, OBJECT भेज रहा हूँ
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});
