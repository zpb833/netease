import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API to fetch NetEase Playlist
  app.get("/api/playlist/:id", async (req, res) => {
    const { id } = req.params;
    
    if (!/^\d+$/.test(id)) {
      return res.status(400).json({ success: false, message: "Invalid Playlist ID format. ID must be numeric." });
    }

    console.log(`[Server] Requesting playlist ID: ${id}`);
    
    try {
      // Try multiple API endpoints with 'n' parameter to get more track IDs
      const endpoints = [
        `https://music.163.com/api/v6/playlist/detail?id=${id}&n=10000`,
        `https://music.163.com/api/playlist/detail?id=${id}&n=10000`,
        `https://interface.music.163.com/api/v1/playlist/detail?id=${id}&n=10000`
      ];

      let playlistData = null;

      for (const url of endpoints) {
        try {
          console.log(`[Server] Trying: ${url}`);
          const response = await axios.get(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              "Referer": "https://music.163.com/",
              "Cookie": "os=pc; osver=Microsoft-Windows-10-Professional-build-19042-64bit; appver=2.10.123"
            },
            timeout: 30000 // Increased timeout
          });

          if (response.data && (response.data.code === 200 || response.data.code === 20000)) {
            const data = response.data.playlist || response.data.result;
            if (data) {
              playlistData = data;
              console.log(`[Server] Metadata fetched. Name: ${playlistData.name}, TrackCount: ${playlistData.trackCount}`);
              break;
            }
          }
        } catch (e: any) {
          const status = e.response?.status;
          const data = e.response?.data;
          console.warn(`[Server] Endpoint failed: ${url} - Status: ${status}, Message: ${e.message}`);
          if (data) console.warn(`[Server] Error data:`, JSON.stringify(data).substring(0, 200));
        }
      }

      if (!playlistData) {
        console.error(`[Server] Playlist not found for ID: ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: `Playlist (ID: ${id}) not found. It might be private, deleted, or the ID is incorrect.` 
        });
      }

      // Extract ALL Track IDs
      let trackIds: number[] = [];
      if (playlistData.trackIds && Array.isArray(playlistData.trackIds)) {
        trackIds = playlistData.trackIds.map((t: any) => typeof t === 'object' ? t.id : t);
      } else if (playlistData.tracks && Array.isArray(playlistData.tracks)) {
        trackIds = playlistData.tracks.map((t: any) => t.id);
      }

      console.log(`[Server] Total Track IDs found: ${trackIds.length}`);

      // Step 2: Fetch full song details in batches
      // We always fetch details to ensure we get the full list, 
      // as the initial response usually only has the first 20 tracks.
      const allTracks: any[] = [];
      const batchSize = 400;
      
      for (let i = 0; i < trackIds.length; i += batchSize) {
        const batchIds = trackIds.slice(i, i + batchSize);
        try {
          const songUrl = `https://music.163.com/api/v3/song/detail?ids=[${batchIds.join(",")}]`;
          const songResponse = await axios.get(songUrl, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              "Referer": "https://music.163.com/"
            },
            timeout: 20000
          });

          if (songResponse.data && songResponse.data.code === 200 && songResponse.data.songs) {
            allTracks.push(...songResponse.data.songs);
          }
        } catch (e) {
          console.error(`[Server] Batch fetch error at ${i}`);
        }
      }

      console.log(`[Server] Successfully detailed ${allTracks.length} tracks`);

      // If batch fetching failed but we have some tracks from initial response, use them as fallback
      let finalTracks = allTracks.map((track: any) => ({
        id: track.id,
        name: track.name,
        artists: track.ar ? track.ar.map((a: any) => a.name).join(", ") : "Unknown",
        album: track.al ? track.al.name : "Unknown",
        duration: track.dt || 0,
        picUrl: track.al ? track.al.picUrl : ""
      }));

      if (finalTracks.length === 0 && playlistData.tracks) {
        finalTracks = playlistData.tracks.map((track: any) => ({
          id: track.id,
          name: track.name,
          artists: track.ar ? track.ar.map((a: any) => a.name).join(", ") : (track.artists ? track.artists.map((a: any) => a.name).join(", ") : "Unknown"),
          album: track.al ? track.al.name : (track.album ? track.album.name : "Unknown"),
          duration: track.dt || track.duration || 0,
          picUrl: track.al ? track.al.picUrl : (track.album ? track.album.picUrl : "")
        }));
      }

      res.json({
        success: true,
        playlist: {
          name: playlistData.name,
          coverImgUrl: playlistData.coverImgUrl,
          description: playlistData.description,
          trackCount: trackIds.length,
          tracks: finalTracks
        }
      });

    } catch (error: any) {
      console.error("[Server] Fatal error:", error.message);
      res.status(500).json({ success: false, message: "Server error: " + error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
