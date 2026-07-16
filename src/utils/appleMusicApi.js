/**
 * Apple MusicKit JS SDK Wrapper and API Helpers
 */

/**
 * Initializes the MusicKit JS instance with a developer token
 * @param {string} developerToken - The Apple Music Developer JWT
 * @param {string|null} musicUserToken - Existing user token if available
 * @returns {Promise<Object>} The configured MusicKit instance
 */
export async function initMusicKit(developerToken, musicUserToken = null, storefrontId = 'in') {
  if (typeof window.MusicKit === 'undefined') {
    throw new Error('MusicKit SDK not loaded in HTML');
  }

  const cleanToken = developerToken.trim();
  const effectiveStorefront = storefrontId || 'us';

  // Try to get an existing instance first
  let music = null;
  try {
    music = window.MusicKit.getInstance();
  } catch (e) {
    // No instance exists yet, that's fine
  }

  // Check if we need to reconfigure
  const needsConfigure = !music || music.developerToken !== cleanToken;

  if (needsConfigure) {
    // Configure MusicKit - it may throw "Storefront Country Code error"
    // but the singleton instance is still created internally
    try {
      music = await window.MusicKit.configure({
        developerToken: cleanToken,
        storefrontId: effectiveStorefront,
        app: {
          name: 'VibeSync',
          build: '1.0.0'
        }
      });
    } catch (configError) {
      const errStr = String(configError?.message || configError?.description || configError || '');
      console.warn('MusicKit.configure() threw:', errStr);

      // MusicKit v3 still creates the singleton even on storefront errors
      // Try to recover it
      try {
        music = window.MusicKit.getInstance();
      } catch (e) {
        // getInstance also failed - truly broken
        throw configError;
      }

      if (!music) {
        throw configError;
      }

      console.log('Recovered MusicKit instance after storefront error');
    }
  }

  // Set the developer token and storefront directly on the instance to prevent VPN geo-ip errors
  if (music && !music.developerToken) {
    music.developerToken = cleanToken;
  }
  
  if (music) {
    music.storefrontId = effectiveStorefront;
  }

  // Apply user token if provided
  if (music && musicUserToken) {
    music.musicUserToken = musicUserToken.trim();
  }

  // Save configuration in localStorage for reload persistence
  localStorage.setItem('apple_music_developer_token', cleanToken);
  if (musicUserToken) {
    localStorage.setItem('apple_music_user_token', musicUserToken.trim());
  }

  return music;
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

export async function searchAppleMusicTrack(trackName, artistName) {
  const { findTrack } = await import('./itunesApi.js');
  const country = localStorage.getItem('apple_music_storefront') || 'in';
  return findTrack(trackName, artistName, country);
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
