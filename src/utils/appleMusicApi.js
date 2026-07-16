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
  const storefront = localStorage.getItem('apple_music_storefront') || 'us';
  const devToken = localStorage.getItem('apple_music_developer_token');
  if (!devToken) {
    console.warn("No Developer Token found in localStorage.");
    return null;
  }

  const term = `${trackName} ${artistName}`.replace(/[()\-+]/g, "").trim();
  const url = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(term)}&types=songs&limit=1`;

  const makeRequest = async (useUserToken) => {
    const headers = {
      'Authorization': `Bearer ${devToken.trim()}`
    };
    if (useUserToken) {
      const userToken = localStorage.getItem('apple_music_user_token');
      if (userToken) {
        headers['Music-User-Token'] = userToken.trim();
      }
    }
    return fetch(url, { headers });
  };

  try {
    let response = await makeRequest(true);

    if (response.status === 401) {
      console.warn("Catalog search returned 401 with user token, retrying without user token...");
      response = await makeRequest(false);
      
      if (response.ok) {
        console.warn("User token is invalid/expired. Clearing it.");
        localStorage.removeItem('apple_music_user_token');
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.results && data.results.songs) {
      const song = data.results.songs.data[0];
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
    const fbUrl = `https://api.music.apple.com/v1/catalog/${storefront}/search?term=${encodeURIComponent(trackName)}&types=songs&limit=5`;
    const makeFbRequest = async (useUserToken) => {
      const headers = {
        'Authorization': `Bearer ${devToken.trim()}`
      };
      if (useUserToken) {
        const userToken = localStorage.getItem('apple_music_user_token');
        if (userToken) headers['Music-User-Token'] = userToken.trim();
      }
      return fetch(fbUrl, { headers });
    };

    let fbResponse = await makeFbRequest(true);
    if (fbResponse.status === 401) {
      fbResponse = await makeFbRequest(false);
    }

    if (fbResponse.ok) {
      const fbData = await fbResponse.json();
      if (fbData.results && fbData.results.songs) {
        const songs = fbData.results.songs.data;
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
