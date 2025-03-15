// Spotify API routes to be added to server/index.js

// Add this near the top of server/index.js with other requires
const spotifyService = require("./spotify");

// Add these routes after app.use(cors()) but before socket.io setup
// =================================================================

// Endpoint to search for songs via Spotify
app.get("/api/spotify/search", async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // Optional market parameter, defaults to US if not provided
    const market = req.query.market || "US";

    // Search tracks using our Spotify service
    const tracks = await spotifyService.searchTracks(query, market);

    res.json({ tracks });
  } catch (error) {
    console.error("Error in Spotify search endpoint:", error.message);
    res.status(500).json({
      error: "Failed to search Spotify",
      message: error.message,
    });
  }
});

// Health check endpoint for Spotify API
app.get("/api/spotify/status", async (req, res) => {
  try {
    // Try to get a token to verify API connection
    await spotifyService.getSpotifyToken();
    res.json({ status: "ok", message: "Spotify API connection successful" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Could not connect to Spotify API",
      error: error.message,
    });
  }
});

// =================================================================
// Then continue with your existing socket.io setup
