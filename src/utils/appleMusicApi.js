/**
 * Apple MusicKit JS SDK Wrapper and API Helpers
 */

/**
 * Initializes the MusicKit JS instance with a developer token
 * @param {string} developerToken - The Apple Music Developer JWT
 * @param {string|null} musicUserToken - Existing user token if available
 * @returns {Promise<Object>} The configured MusicKit instance
 */
export async function initMusicKit(developerToken, musicUserToken = null) {
  if (typeof window.MusicKit === 'undefined') {
    throw new Error('MusicKit SDK not loaded in HTML');
  }

  try {
    const music = await window.MusicKit.configure({
      developerToken: developerToken,
      app: {
        name: 'VibeSync',
        build: '1.0.0'
      }
    });

    if (musicUserToken) {
      music.musicUserToken = musicUserToken;
    }

    // Save configuration in localStorage for reload persistence
    localStorage.setItem('apple_music_developer_token', developerToken);
    if (musicUserToken) {
      localStorage.setItem('apple_music_user_token', musicUserToken);
    }

    return music;
  } catch (error) {
    console.error('Error configuring MusicKit:', error);
    throw error;
  }
}

/**
 * Checks if MusicKit is configured and initialized
 * @returns {boolean}
 */
export function isMusicKitInitialized() {
  try {
    return !!window.MusicKit && !!window.MusicKit.getInstance();
  } catch {
    return false;
  }
}

/**
 * Prompts user to authorize Apple Music and saves user token
 * @returns {Promise<string>} The user token
 */
export async function authorizeAppleMusic() {
  if (!isMusicKitInitialized()) throw new Error('MusicKit not initialized');
  
  const music = window.MusicKit.getInstance();
  try {
    const userToken = await music.authorize();
    localStorage.setItem('apple_music_user_token', userToken);
    return userToken;
  } catch (error) {
    console.error('Apple Music authorization failed:', error);
    throw error;
  }
}

/**
 * Disconnects Apple Music and clears user token
 */
export async function unauthorizeAppleMusic() {
  if (!isMusicKitInitialized()) return;
  const music = window.MusicKit.getInstance();
  await music.unauthorize();
  localStorage.removeItem('apple_music_user_token');
}

/**
 * Searches the Apple Music Catalog for a track matching query terms
 * @param {string} trackName 
 * @param {string} artistName 
 * @returns {Promise<Object|null>} Match object { id, name, artist, album }
 */
export async function searchAppleMusicTrack(trackName, artistName) {
  if (!isMusicKitInitialized()) return null;
  const music = window.MusicKit.getInstance();
  
  const storefront = music.storefrontId || 'us';
  // Standardize and clean query term
  const term = `${trackName} ${artistName}`.replace(/[()\-+]/g, "").trim();

  try {
    const response = await music.api.music(`/v1/catalog/${storefront}/search`, {
      term: term,
      types: 'songs',
      limit: 1
    });

    if (response.data && response.data.results && response.data.results.songs) {
      const song = response.data.results.songs.data[0];
      if (song) {
        return {
          id: song.id,
          name: song.attributes.name,
          artist: song.attributes.artistName,
          album: song.attributes.albumName,
          artworkUrl: song.attributes.artwork ? song.attributes.artwork.url : null,
          duration: song.attributes.durationInMillis
        };
      }
    }
    
    // Fallback: search just the song name
    const fbResponse = await music.api.music(`/v1/catalog/${storefront}/search`, {
      term: trackName,
      types: 'songs',
      limit: 5
    });
    
    if (fbResponse.data && fbResponse.data.results && fbResponse.data.results.songs) {
      const songs = fbResponse.data.results.songs.data;
      // Try to find a song where the artist matches (case-insensitive substring)
      const matchedSong = songs.find(s => 
        s.attributes.artistName.toLowerCase().includes(artistName.toLowerCase()) ||
        artistName.toLowerCase().includes(s.attributes.artistName.toLowerCase())
      );
      if (matchedSong) {
        return {
          id: matchedSong.id,
          name: matchedSong.attributes.name,
          artist: matchedSong.attributes.artistName,
          album: matchedSong.attributes.albumName,
          artworkUrl: matchedSong.attributes.artwork ? matchedSong.attributes.artwork.url : null,
          duration: matchedSong.attributes.durationInMillis
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error searching Apple Music catalog:', error);
    return null;
  }
}

/**
 * Enqueues an Apple Music track to the active player queue
 * @param {string} songId 
 * @param {boolean} playNext - If true, inserts right after active track. If false, appends to tail.
 * @returns {Promise<void>}
 */
export async function enqueueAppleMusicTrack(songId, playNext = true) {
  if (!isMusicKitInitialized()) throw new Error('MusicKit not initialized');
  const music = window.MusicKit.getInstance();

  try {
    if (playNext) {
      await music.playNext({ song: songId });
    } else {
      await music.playLater({ song: songId });
    }
  } catch (error) {
    console.error(`Error enqueuing track ${songId}:`, error);
    throw error;
  }
}

/**
 * Creates an Apple Music playlist inside user's library and populates it with track IDs
 * @param {string} name - Playlist name
 * @param {string} description - Playlist description
 * @param {string[]} trackIds - Array of Apple Music track IDs
 * @returns {Promise<Object>} Created playlist details
 */
export async function createAppleMusicPlaylist(name, description, trackIds = []) {
  if (!isMusicKitInitialized()) throw new Error('MusicKit not initialized');
  const music = window.MusicKit.getInstance();

  try {
    const playlistData = {
      attributes: {
        name: name,
        description: description
      }
    };

    if (trackIds.length > 0) {
      playlistData.relationships = {
        tracks: {
          data: trackIds.map(id => ({ id: id, type: 'songs' }))
        }
      };
    }

    const response = await music.api.music('/v1/me/library/playlists', {}, {
      method: 'POST',
      body: JSON.stringify(playlistData),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error creating Apple Music playlist:', error);
    throw error;
  }
}
