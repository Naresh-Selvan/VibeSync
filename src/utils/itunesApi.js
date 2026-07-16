const ITUNES_BASE = 'https://itunes.apple.com';

/**
 * Searches the public iTunes Search API for songs.
 * Bypasses all Developer Token (401) and Origin restrictions.
 * 
 * @param {string} query - Search terms (song title, artist, etc.)
 * @param {number} limit - Number of results to return
 * @param {string} country - ISO country code (e.g., 'in', 'us')
 * @returns {Promise<Array>} List of songs
 */
export async function searchSongs(query, limit = 25, country = 'in') {
  try {
    const url = `${ITUNES_BASE}/search?term=${encodeURIComponent(query)}&limit=${limit}&entity=song&country=${country}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`iTunes Search failed: ${response.status}`);
    
    const data = await response.json();
    if (!data.results) return [];

    return data.results.map(track => ({
      id: String(track.trackId),
      name: track.trackName,
      artist: track.artistName,
      album: track.collectionName,
      artworkUrl: track.artworkUrl100 ? track.artworkUrl100.replace('100x100bb', '300x300bb') : null,
      previewUrl: track.previewUrl,
      trackViewUrl: track.trackViewUrl,
      duration: track.trackTimeMillis
    }));
  } catch (error) {
    console.error('iTunes API search error:', error);
    return [];
  }
}

/**
 * Matches a song name and artist to the closest Apple Music catalog track using iTunes API.
 * 
 * @param {string} trackName 
 * @param {string} artistName 
 * @param {string} country 
 * @returns {Promise<Object|null>} Matched song details or null
 */
export async function findTrack(trackName, artistName, country = 'in') {
  // Clean up common query-breaking symbols but keep it safe for JS regex parser
  const query = `${trackName} ${artistName}`.replace(/[()+-]/g, '').trim();

  try {
    const results = await searchSongs(query, 5, country);
    if (results.length > 0) {
      // Direct match check (artist substring match)
      const matched = results.find(track => 
        track.artist.toLowerCase().includes(artistName.toLowerCase()) ||
        artistName.toLowerCase().includes(track.artist.toLowerCase())
      );
      if (matched) return matched;
      
      // Fallback to first result if no exact artist match
      return results[0];
    }

    // Fallback: search song name only
    const fallbackResults = await searchSongs(trackName, 5, country);
    if (fallbackResults.length > 0) {
      const matched = fallbackResults.find(track => 
        track.artist.toLowerCase().includes(artistName.toLowerCase()) ||
        artistName.toLowerCase().includes(track.artist.toLowerCase())
      );
      if (matched) return matched;
    }

    return null;
  } catch (error) {
    console.error('iTunes matching error:', error);
    return null;
  }
}
