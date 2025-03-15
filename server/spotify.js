// Spotify API integration service
const axios = require("axios");

// Spotify API credentials - should be stored in environment variables
// Replace these with your actual Spotify Developer credentials
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "YOUR_CLIENT_ID";
const SPOTIFY_CLIENT_SECRET =
  process.env.SPOTIFY_CLIENT_SECRET || "YOUR_CLIENT_SECRET";

// Store Spotify access token
let spotifyToken = null;
let tokenExpirationTime = null;

/**
 * Get a Spotify access token using Client Credentials flow
 * This doesn't require user login and is perfect for search functionality
 */
async function getSpotifyToken() {
  // Check if we already have a valid token
  if (spotifyToken && tokenExpirationTime && Date.now() < tokenExpirationTime) {
    return spotifyToken;
  }

  try {
    // Prepare authentication header (Basic Auth with client ID and secret)
    const authHeader =
      "Basic " +
      Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString(
        "base64"
      );

    // Make request to Spotify API for access token
    const response = await axios({
      method: "post",
      url: "https://accounts.spotify.com/api/token",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: "grant_type=client_credentials",
    });

    // Store the token and its expiration time
    spotifyToken = response.data.access_token;
    // Token expires in 3600 seconds (1 hour), we set expiration time slightly earlier to be safe
    tokenExpirationTime = Date.now() + response.data.expires_in * 1000 - 60000;

    console.log(
      "New Spotify token acquired, expires in",
      response.data.expires_in,
      "seconds"
    );
    return spotifyToken;
  } catch (error) {
    console.error(
      "Error getting Spotify token:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Search for tracks on Spotify
 * @param {string} query - The search query
 * @param {string} market - Optional market code (e.g., 'NO' for Norway)
 * @param {number} limit - Maximum number of results to return
 */
async function searchTracks(query, market = "US", limit = 10) {
  try {
    // Get Spotify access token
    const token = await getSpotifyToken();

    // Make request to Spotify Search API
    const response = await axios({
      method: "get",
      url: "https://api.spotify.com/v1/search",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        q: query,
        type: "track",
        market: market,
        limit: limit,
      },
    });

    // Process and return results
    return response.data.tracks.items.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      previewUrl: track.preview_url,
      albumImageUrl: track.album.images[0]?.url || null,
      spotifyUrl: track.external_urls.spotify,
      popularity: track.popularity,
    }));
  } catch (error) {
    console.error(
      "Error searching Spotify:",
      error.response?.data || error.message
    );

    // If token expired, clear it and try again once
    if (error.response?.status === 401 && spotifyToken) {
      console.log("Token expired, clearing and retrying...");
      spotifyToken = null;
      tokenExpirationTime = null;
      return searchTracks(query, market, limit);
    }

    throw error;
  }
}

module.exports = {
  getSpotifyToken,
  searchTracks,
};
