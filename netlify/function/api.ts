import express from "express";
import serverless from "serverless-http";
import axios from "axios";

const app = express();
app.use(express.json());

// 这里的逻辑和你的 server.ts 一模一样
app.get("/api/playlist/:id", async (req, res) => {
  const { id } = req.params;
  
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ success: false, message: "Invalid Playlist ID format." });
  }

  try {
    const endpoints = [
      `https://music.163.com/api/v6/playlist/detail?id=${id}&n=10000`,
      `https://music.163.com/api/playlist/detail?id=${id}&n=10000`
    ];

    let playlistData = null;

    for (const url of endpoints) {
      try {
        const response = await axios.get(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Referer": "https://music.163.com/",
            "Cookie": "os=pc; osver=Microsoft-Windows-10-Professional-build-19042-64bit; appver=2.10.123"
          },
          timeout: 15000
        });

        if (response.data && (response.data.code === 200 || response.data.code === 20000)) {
          playlistData = response.data.playlist || response.data.result;
          if (playlistData) break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!playlistData) {
      return res.status(404).json({ success: false, message: "Playlist not found." });
    }

    let trackIds = [];
    if (playlistData.trackIds) {
      trackIds = playlistData.trackIds.map((t) => typeof t === 'object' ? t.id : t);
    } else if (playlistData.tracks) {
      trackIds = playlistData.tracks.map((t) => t.id);
    }

    const allTracks = [];
    const batchSize = 400;
    
    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batchIds = trackIds.slice(i, i + batchSize);
      try {
        const songUrl = `https://music.163.com/api/v3/song/detail?ids=[${batchIds.join(",")}]`;
        const songResponse = await axios.get(songUrl, {
          headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://music.163.com/" },
          timeout: 15000
        });
        if (songResponse.data?.songs) {
          allTracks.push(...songResponse.data.songs);
        }
      } catch (e) {}
    }

    const finalTracks = allTracks.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.ar ? track.ar.map((a) => a.name).join(", ") : "Unknown",
      album: track.al ? track.al.name : "Unknown",
      duration: track.dt || 0,
      picUrl: track.al ? track.al.picUrl : ""
    }));

    res.json({
      success: true,
      playlist: {
        name: playlistData.name,
        coverImgUrl: playlistData.coverImgUrl,
        tracks: finalTracks
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 导出为 NetEase 云函数
export const handler = serverless(app);
