import React, { useState, useEffect } from "react";
import { 
  Search, 
  Download, 
  Copy, 
  Music, 
  ExternalLink, 
  ListMusic, 
  FileJson, 
  FileSpreadsheet, 
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Track {
  id: number;
  name: string;
  artists: string;
  album: string;
  duration: number;
  picUrl: string;
}

interface Playlist {
  name: string;
  coverImgUrl: string;
  description: string;
  trackCount: number;
  tracks: Track[];
}

export default function App() {
  const [url, setUrl] = useState("https://music.163.com/#/playlist?id=5010763244");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [copied, setCopied] = useState(false);

  const extractId = (input: string) => {
    if (!input) return null;
    const trimmed = input.trim();
    
    // Case 1: Just a numeric ID
    if (/^\d+$/.test(trimmed)) return trimmed;
    
    // Case 2: URL
    try {
      // Handle mobile URLs and hash URLs
      const normalized = trimmed.replace("/#/", "/").replace("/m/", "/");
      const urlObj = new URL(normalized);
      
      // Try 'id' parameter
      let id = urlObj.searchParams.get("id");
      if (id) return id;
      
      // Try path segments (e.g., /playlist/123)
      const segments = urlObj.pathname.split("/");
      const playlistIdx = segments.indexOf("playlist");
      if (playlistIdx !== -1 && segments[playlistIdx + 1]) {
        return segments[playlistIdx + 1].split("?")[0];
      }
      
      return null;
    } catch (e) {
      return null;
    }
  };

  const fetchPlaylist = async () => {
    const id = extractId(url);
    console.log("Extracted ID:", id);
    if (!id) {
      setError("Invalid URL or Playlist ID. Please make sure it's a valid NetEase playlist link.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/playlist/${id}`);
      
      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response:", text);
        setError(`Server returned an unexpected response (Status: ${response.status}). Please try again later.`);
        return;
      }

      const data = await response.json();
      if (data.success) {
        setPlaylist(data.playlist);
      } else {
        setError(data.message || "Failed to fetch playlist");
      }
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(`Network error: ${err.message || "Could not connect to the server"}`);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? "0" : ""}${seconds}`;
  };

  const exportAsCSV = () => {
    if (!playlist) return;
    const headers = ["Name", "Artists", "Album", "Duration"];
    const rows = playlist.tracks.map(t => [
      `"${t.name.replace(/"/g, '""')}"`,
      `"${t.artists.replace(/"/g, '""')}"`,
      `"${t.album.replace(/"/g, '""')}"`,
      formatDuration(t.duration)
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    downloadFile(csvContent, `${playlist.name}.csv`, "text/csv");
  };

  const exportAsJSON = () => {
    if (!playlist) return;
    const jsonContent = JSON.stringify(playlist.tracks, null, 2);
    downloadFile(jsonContent, `${playlist.name}.json`, "application/json");
  };

  const exportAsText = () => {
    if (!playlist) return;
    const textContent = playlist.tracks.map((t, i) => `${i + 1}. ${t.name} - ${t.artists} (${t.album})`).join("\n");
    downloadFile(textContent, `${playlist.name}.txt`, "text/plain");
  };

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  const copyToClipboard = () => {
    if (!playlist) return;
    const textContent = playlist.tracks.map((t, i) => `${i + 1}. ${t.name} - ${t.artists}`).join("\n");
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Header */}
      <header className="border-b border-[#141414] p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListMusic className="w-8 h-8" />
            NETEASE PLAYLIST EXPORTER
          </h1>
          <p className="text-xs opacity-60 font-mono mt-1 uppercase tracking-widest">
            Professional Data Extraction Tool v1.0
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-96">
            <input 
              type="text" 
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste NetEase Playlist URL here..."
              className="w-full bg-transparent border border-[#141414] px-4 py-2 pr-10 focus:outline-none focus:bg-white transition-colors text-sm"
              onKeyDown={(e) => e.key === "Enter" && fetchPlaylist()}
            />
            <button 
              onClick={fetchPlaylist}
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 hover:opacity-70 disabled:opacity-30"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 border border-red-500 bg-red-50 text-red-700 flex items-center gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5" />
              {error}
            </motion.div>
          )}

          {!playlist && !loading && !error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 text-center"
            >
              <div className="w-24 h-24 border border-[#141414] flex items-center justify-center mb-6">
                <Music className="w-12 h-12 opacity-20" />
              </div>
              <h2 className="text-xl font-medium italic serif mb-2">Ready to Export</h2>
              <p className="text-sm opacity-60 max-w-md">
                Enter a NetEase Cloud Music playlist URL in the search bar above to begin the extraction process.
              </p>
            </motion.div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-32">
              <Loader2 className="w-12 h-12 animate-spin mb-4" />
              <p className="text-sm font-mono uppercase tracking-widest opacity-60">Extracting Data...</p>
            </div>
          )}

          {playlist && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8"
            >
              {/* Sidebar Info */}
              <div className="space-y-6">
                <div className="border border-[#141414] p-1 bg-white shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                  <img 
                    src={playlist.coverImgUrl || undefined} 
                    alt={playlist.name} 
                    className="w-full aspect-square object-cover grayscale hover:grayscale-0 transition-all duration-500"
                    referrerPolicy="no-referrer"
                  />
                </div>
                
                <div>
                  <h2 className="text-xl font-bold italic serif leading-tight mb-2">{playlist.name}</h2>
                  <p className="text-xs opacity-70 line-clamp-4 mb-4">{playlist.description || "No description available."}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-tighter opacity-50">
                    <span className="border border-[#141414] px-1.5 py-0.5">{playlist.trackCount} TRACKS</span>
                    <span className="border border-[#141414] px-1.5 py-0.5">NETEASE CLOUD MUSIC</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest opacity-40 mb-2">Export Options</p>
                  <button 
                    onClick={exportAsCSV}
                    className="w-full flex items-center justify-between border border-[#141414] p-3 text-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4" />
                      Export as CSV
                    </span>
                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button 
                    onClick={exportAsJSON}
                    className="w-full flex items-center justify-between border border-[#141414] p-3 text-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <FileJson className="w-4 h-4" />
                      Export as JSON
                    </span>
                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button 
                    onClick={exportAsText}
                    className="w-full flex items-center justify-between border border-[#141414] p-3 text-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Export as Text
                    </span>
                    <Download className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <button 
                    onClick={copyToClipboard}
                    className="w-full flex items-center justify-between border border-[#141414] p-3 text-sm hover:bg-[#141414] hover:text-[#E4E3E0] transition-all group"
                  >
                    <span className="flex items-center gap-2">
                      {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy Tracklist"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Tracks Table */}
              <div className="border border-[#141414] bg-white overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-bottom border-[#141414] bg-[#f0f0f0]">
                        <th className="p-4 text-[10px] font-mono uppercase tracking-widest opacity-50 w-12">#</th>
                        <th className="p-4 text-[10px] font-mono uppercase tracking-widest opacity-50">Track Title</th>
                        <th className="p-4 text-[10px] font-mono uppercase tracking-widest opacity-50">Artist</th>
                        <th className="p-4 text-[10px] font-mono uppercase tracking-widest opacity-50">Album</th>
                        <th className="p-4 text-[10px] font-mono uppercase tracking-widest opacity-50 text-right">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playlist.tracks.map((track, index) => (
                        <tr 
                          key={track.id} 
                          className="border-t border-[#141414] hover:bg-[#141414] hover:text-[#E4E3E0] transition-colors group cursor-default"
                        >
                          <td className="p-4 text-xs font-mono opacity-40 group-hover:opacity-100">{index + 1}</td>
                          <td className="p-4 text-sm font-medium">
                            <div className="flex items-center gap-3">
                              <img 
                                src={track.picUrl || undefined} 
                                alt={track.name} 
                                className="w-8 h-8 object-cover grayscale group-hover:grayscale-0 transition-all"
                                referrerPolicy="no-referrer"
                              />
                              <span className="line-clamp-1">{track.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-sm opacity-70 group-hover:opacity-100 line-clamp-1">{track.artists}</td>
                          <td className="p-4 text-sm opacity-70 group-hover:opacity-100 line-clamp-1">{track.album}</td>
                          <td className="p-4 text-xs font-mono text-right opacity-40 group-hover:opacity-100">
                            {formatDuration(track.duration)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-20 border-t border-[#141414] p-8 text-center">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] opacity-30">
          Built for Professional Music Data Management &copy; 2026
        </p>
      </footer>
    </div>
  );
}
