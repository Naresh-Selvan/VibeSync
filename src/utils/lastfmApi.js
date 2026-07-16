/**
 * Last.fm Web API Utility for fetching track recommendations
 */

const LASTFM_API_BASE = "https://ws.audioscrobbler.com/2.0/";

// Common public key for zero-config testing. Users can also enter their own.
const DEFAULT_LASTFM_API_KEY = "4a95b0728c460021c356f6c91a0b3d68";

/**
 * Fetches similar tracks from Last.fm based on a seed track and artist
 * @param {string} trackName 
 * @param {string} artistName 
 * @param {number} limit 
 * @returns {Promise<Array>} List of recommended tracks formatted similar to Spotify tracks
 */
export async function getLastfmRecommendations(trackName, artistName, limit = 15) {
  const apiKey = localStorage.getItem('lastfm_api_key') || DEFAULT_LASTFM_API_KEY;
  if (!apiKey) throw new Error("Last.fm API key not configured");

  const params = new URLSearchParams({
    method: 'track.getSimilar',
    artist: artistName,
    track: trackName,
    api_key: apiKey,
    format: 'json',
    limit: limit.toString()
  });

  try {
    const response = await fetch(`${LASTFM_API_BASE}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Last.fm request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Last.fm API Error: ${data.message}`);
    }

    if (data.similartracks && data.similartracks.track) {
      // Map Last.fm track object format to match our Spotify schema
      return data.similartracks.track.map((t, index) => {
        // Last.fm returns images in an array: [small, medium, large, extralarge, megabytes]
        const images = t.image ? t.image.map(img => ({ url: img['#text'] || '' })).filter(img => img.url !== '') : [];
        
        return {
          id: `lastfm-${index}-${t.name.replace(/\s+/g, '-')}`,
          name: t.name,
          artists: [{ name: t.artist.name }],
          album: {
            images: images.length > 0 ? images : [{ url: '' }]
          }
        };
      });
    }
    
    return [];
  } catch (error) {
    console.error("Error getting Last.fm recommendations:", error);
    // If our default key fails, let's clear it or pass it up
    throw error;
  }
}
