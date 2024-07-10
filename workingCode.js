const express = require('express');
const ytdl = require('ytdl-core');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const https = require('https');

const app = express();

// Use cors middleware to allow all origins (not recommended for production)
app.use(cors());

app.get("/", (req, res) => res.send("Express on Vercel"));

// Route to download and serve YouTube audio as MP3 along with album cover
app.get('/youtube/:videoId', async (req, res) => {
    const videoId = req.params.videoId;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(__dirname, `${videoId}.mp3`);
    const albumCoverPath = path.join(__dirname, `${videoId}_cover.jpg`);

    // Function to encode file data to base64
    const base64Encode = (file) => {
        const bitmap = fs.readFileSync(file);
        return Buffer.from(bitmap).toString('base64');
    };

    try {
        const info = await ytdl.getInfo(videoUrl);
        const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });

        // Extract the URL of the highest quality album cover
        const thumbnails = info.videoDetails.thumbnails;
        const highestQualityThumbnail = thumbnails[thumbnails.length - 1].url;

        // Extract additional details
        const songName = info.videoDetails.title;
        const artistName = info.videoDetails.author.name;

        // Check if files already exist
        if (fs.existsSync(outputPath) && fs.existsSync(albumCoverPath)) {
            const audioBase64 = base64Encode(outputPath);
            const albumCoverBase64 = base64Encode(albumCoverPath);
            return res.json({ audioBase64, albumCoverUrl: `data:image/jpeg;base64,${albumCoverBase64}`,songName,
                artistName });
        }

        // Stream the audio to a local file
        const audioStream = ytdl(videoUrl, { format: audioFormat })
            .pipe(fs.createWriteStream(outputPath));
        
        audioStream.on('finish', async () => {
            // Download the album cover
            const coverFile = fs.createWriteStream(albumCoverPath);
            https.get(highestQualityThumbnail, function(response) {
                response.pipe(coverFile).on('finish', () => {
                    const audioBase64 = base64Encode(outputPath);
                    const albumCoverBase64 = base64Encode(albumCoverPath);
                    return res.json({ audioBase64, albumCoverUrl: `data:image/jpeg;base64,${albumCoverBase64}`,songName,
                        artistName });
                });
            });
        });

        audioStream.on('error', (err) => {
            console.error('Error streaming audio:', err);
            res.status(500).send('An error occurred while processing the video.');
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).send('An error occurred while processing the video.');
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server ready on port ${PORT}`));