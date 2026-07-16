/**
 * Spotify Web API Utility for Client-Side OAuth and Endpoint Calls
 */

const SPOTIFY_AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const SPOTIFY_API_BASE = "https://api.spotify.com/v1";

/**
 * Generates the Spotify Authorization URL
 * @param {string} clientId - Spotify Client ID from Developer Dashboard
 * @param {string} redirectUri - Redirect URI registered in the dashboard
 * @returns {string}
 */
export function getSpotifyAuthUrl(clientId, redirectUri) {
  const scopes = [
    "user-top-read",
    "user-read-currently-playing",
    "playlist-read-private",
    "playlist-read-collaborative"
  ];
  
  return `${SPOTIFY_AUTH_ENDPOINT}?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(" "))}&response_type=token&show_dialog=true`;
}

/**
 * Extracts the access token from the URL hash, saves it to localStorage, and cleans the URL
 * @returns {string|null} The active access token
 */
export function handleSpotifyAuthCallback() {
  const hash = window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get("access_token");
  const expiresIn = params.get("expires_in");

  if (accessToken) {
    const expiresAt = Date.now() + parseInt(expiresIn, 10) * 1000;
    localStorage.setItem("spotify_access_token", accessToken);
    localStorage.setItem("spotify_token_expires_at", expiresAt.toString());
    
    // Clean hash from URL without reloading
    window.history.replaceState(null, null, window.location.pathname + window.location.search);
    return accessToken;
  }
  
  return null;
}

/**
 * Gets the active Spotify access token from localStorage if valid
 * @returns {string|null}
 */
export function getSpotifyToken() {
  const token = localStorage.getItem("spotify_access_token");
  const expiresAt = localStorage.getItem("spotify_token_expires_at");

  if (!token || !expiresAt) return null;

  // Check if token is expired (with a 60-second buffer)
  if (Date.now() > parseInt(expiresAt, 10) - 60000) {
    localStorage.removeItem("spotify_access_token");
    localStorage.removeItem("spotify_token_expires_at");
    return null;
  }

  return token;
}

/**
 * Searches Spotify for a track matching a name and artist
 * @param {string} trackName 
 * @param {string} artistName 
 * @returns {Promise<Object|null>} The first matched track object
 */
export async function searchSpotifyTrack(trackName, artistName) {
  const token = getSpotifyToken();
  if (!token) throw new Error("Spotify not authenticated");

  // Clean names to prevent API search query issues
  const cleanTrack = trackName.replace(/[()\-+]/g, "").trim();
  const cleanArtist = artistName.replace(/[()\-+]/g, "").trim();
  const query = `track:${cleanTrack} artist:${cleanArtist}`;

  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Expired token
        localStorage.removeItem("spotify_access_token");
      }
      throw new Error(`Spotify Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.tracks && data.tracks.items && data.tracks.items.length > 0) {
      return data.tracks.items[0];
    }
    
    // Fallback: search general text search if structured search fails
    const fallbackQuery = `${cleanTrack} ${cleanArtist}`;
    const fbResponse = await fetch(`${SPOTIFY_API_BASE}/search?q=${encodeURIComponent(fallbackQuery)}&type=track&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const fbData = await fbResponse.json();
    if (fbData.tracks && fbData.tracks.items && fbData.tracks.items.length > 0) {
      return fbData.tracks.items[0];
    }

    return null;
  } catch (error) {
    console.error("Error searching Spotify track:", error);
    return null;
  }
}

/**
 * Fetches Spotify recommendations based on seed track IDs and optional tuning parameters
 * @param {string[]} seedTrackIds - Array of up to 5 track IDs
 * @param {Object} params - Tuning parameters (energy, danceability, valence, etc.)
 * @returns {Promise<Array>} List of recommended track objects
 */
export async function getSpotifyRecommendations(seedTrackIds, params = {}) {
  const token = getSpotifyToken();
  if (!token) throw new Error("Spotify not authenticated");
  if (!seedTrackIds || seedTrackIds.length === 0) return [];

  // Spotify limits seeds to 5 total seeds (we'll only use tracks)
  const slicedSeeds = seedTrackIds.slice(0, 5).join(",");
  
  const queryParams = new URLSearchParams({
    seed_tracks: slicedSeeds,
    limit: "15" // Recommend 15 tracks
  });

  // Append optional parameters if provided
  if (params.valence !== undefined) queryParams.append("target_valence", params.valence);
  if (params.energy !== undefined) queryParams.append("target_energy", params.energy);
  if (params.danceability !== undefined) queryParams.append("target_danceability", params.danceability);
  if (params.popularity !== undefined) queryParams.append("target_popularity", params.popularity);

  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/recommendations?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify Recommendations failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tracks || [];
  } catch (error) {
    console.error("Error getting Spotify recommendations:", error);
    return [];
  }
}

/**
 * Fetches user's top tracks from Spotify
 * @returns {Promise<Array>}
 */
export async function getSpotifyTopTracks() {
  const token = getSpotifyToken();
  if (!token) throw new Error("Spotify not authenticated");

  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/top/tracks?limit=10&time_range=medium_term`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error("Failed to get top tracks");
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error getting top tracks:", error);
    return [];
  }
}
