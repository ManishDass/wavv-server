const express = require('express');
const ytdl = require('ytdl-core');
const https = require('https');
const rangeParser = require('range-parser');
const cors = require('cors');
const app = express();

// Use CORS middleware
app.use(cors());

// Middleware to allow all origins (optional but not recommended for production)
// If you need to allow specific origins, configure cors middleware accordingly.
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/', async (req, res)=> res.send('Welcome to Wavv-Server'))
// Route to download and serve YouTube audio as MP3
app.get('/youtube/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    try {
        const info = await ytdl.getInfo(videoUrl);
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'lowestaudio' });

        // Extract additional details
        const songName = info.videoDetails.title;
        const artistName = info.videoDetails.author.name;

        // Stream the audio directly to response with support for byte range requests
        const audioStream = ytdl(videoUrl, { format: audioFormat });

        // Set headers for streaming
        res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': `attachment; filename="${encodeURIComponent(songName)}.mp3"`,
            'Accept-Ranges': 'bytes',
        });

        // Handle range requests
        const range = req.headers.range;
        if (range) {
            const ranges = rangeParser(audioStream.byteLength, range);

            if (ranges === -1) {
                // Unsatisfiable range
                res.status(416).end();
            } else if (ranges === -2) {
                // Malformed header
                res.status(400).end();
            } else if (ranges.length !== 1) {
                // Multiple ranges are not supported
                res.status(416).end();
            } else {
                // Single valid range
                const { start, end } = ranges[0];
                res.status(206);
                audioStream.pipe(res);
            }
        } else {
            // No range requested, send entire audio
            audioStream.pipe(res);
        }

        audioStream.on('error', (err) => {
            console.error('Error streaming audio:', err);
            res.status(500).send('An error occurred while processing the video.');
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).send('An error occurred while processing the video.');
    }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => console.log(`Server ready on port ${PORT}`));
