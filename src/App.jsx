import React, { useState, useEffect } from 'react';
import { Search, ListMusic, Settings as SettingsIcon, Radio } from 'lucide-react';
import Settings from './components/Settings';
import SearchAndPlay from './components/SearchAndPlay';
import Player from './components/Player';
import QueueList from './components/QueueList';

import { getLastfmRecommendations } from './utils/lastfmApi';
import { initMusicKit, searchAppleMusicTrack, enqueueAppleMusicTrack, isMusicKitInitialized } from './utils/appleMusicApi';

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [spotifyRecs, setSpotifyRecs] = useState([]);
  const [matchingStatus, setMatchingStatus] = useState({});
  const [appleInitialized, setAppleInitialized] = useState(false);
  const [lastSeededTrackId, setLastSeededTrackId] = useState(null);

  // 1. Load QR configurations on load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#config=')) {
      try {
        const configData = JSON.parse(atob(hash.substring(8)));
        if (configData.lastfmApiKey) localStorage.setItem('lastfm_api_key', configData.lastfmApiKey);
        if (configData.amDevToken) localStorage.setItem('apple_music_developer_token', configData.amDevToken);
        if (configData.amUserToken) localStorage.setItem('apple_music_user_token', configData.amUserToken);
        
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
        alert('Configuration Synced from QR Code!');
      } catch (e) {
        console.error('Failed to parse sync QR code config', e);
      }
    }

    // Initialize Apple Music if keys exist
    const devToken = localStorage.getItem('apple_music_developer_token');
    const userToken = localStorage.getItem('apple_music_user_token');
    const storefront = localStorage.getItem('apple_music_storefront') || 'in';
    if (devToken) {
      initMusicKit(devToken, userToken || null, storefront)
        .then(() => {
          setAppleInitialized(true);
        })
        .catch(err => {
          console.error('Auto MusicKit load failed, retrying without user token', err);
          if (userToken) {
            localStorage.removeItem('apple_music_user_token');
            initMusicKit(devToken, null, storefront)
              .then(() => setAppleInitialized(true))
              .catch(e => console.error('Auto MusicKit retry failed', e));
          }
        });
    }
  }, []);

  // 2. Track Change Listeners to trigger recommendations
  useEffect(() => {
    if (!appleInitialized) return;
    const music = window.MusicKit.getInstance();

    const handleItemChange = async () => {
      const item = music.player.nowPlayingItem;
      if (!item) return;

      const track = {
        id: item.id,
        name: item.title,
        artist: item.artistName,
        artworkUrl: item.attributes?.artwork?.url
      };
      
      setCurrentTrack(track);

      // Prevent redundant seeding
      if (item.id === lastSeededTrackId) return;
      setLastSeededTrackId(item.id);

      // Fetch recommendations based on this new playing song
      await generateAutoplayQueue(item.title, item.artistName);
    };

    music.addEventListener('nowPlayingItemDidChange', handleItemChange);
    return () => {
      music.removeEventListener('nowPlayingItemDidChange', handleItemChange);
    };
  }, [appleInitialized, lastSeededTrackId]);

  /**
   * Triggers recommendation generation and Apple Music enqueuing
   */
  const generateAutoplayQueue = async (trackName, artistName) => {
    try {
      console.log(`Generating Last.fm recommendations for: ${trackName} - ${artistName}`);
      
      // Get similar tracks from Last.fm
      const recs = await getLastfmRecommendations(trackName, artistName);
      setSpotifyRecs(recs); // Keep name as spotifyRecs to avoid breaking QueueList.jsx reference

      // Initialize matching statuses
      const initialStatus = {};
      recs.forEach(r => { initialStatus[r.id] = 'matching'; });
      setMatchingStatus(initialStatus);

      // Search & match each recommendation on Apple Music, then append to queue
      for (const track of recs) {
        const artist = track.artists[0]?.name || '';
        const match = await searchAppleMusicTrack(track.name, artist);

        if (match) {
          await enqueueAppleMusicTrack(match.id, false); // Append to tail of queue
          setMatchingStatus(prev => ({ ...prev, [track.id]: 'success' }));
        } else {
          setMatchingStatus(prev => ({ ...prev, [track.id]: 'not_found' }));
        }
      }
      
      console.log('Finished enqueuing matched recommendations.');
    } catch (err) {
      console.error('Failed to auto-generate recommendation queue', err);
    }
  };

  /**
   * Action trigger from SearchAndPlay song click
   */
  const handlePlaySong = async (song) => {
    if (!isMusicKitInitialized()) {
      alert('Please connect Apple Music in Settings first!');
      setActiveTab('settings');
      return;
    }

    const playWithId = async (trackId) => {
      const music = window.MusicKit.getInstance();
      // Set player queue and start playing (using startPlaying: true to bypass browser autoplay blocks)
      try {
        await music.setQueue({ song: trackId, startPlaying: true });
      } catch (queueErr) {
        console.warn('setQueue with song failed, trying fallback with songs array', queueErr);
        await music.setQueue({ songs: [trackId], startPlaying: true });
      }

      // Explicit play invocation just in case startPlaying option is not supported or didn't auto-start
      try {
        await music.play();
      } catch (playErr) {
        console.warn('Explicit music.play() call failed or was already playing:', playErr);
      }
    };

    try {
      const music = window.MusicKit.getInstance();
      
      // Reset recommendations visual lists
      setSpotifyRecs([]);
      setMatchingStatus({});
      setLastSeededTrackId(song.id);

      try {
        await playWithId(song.id);
        
        setCurrentTrack({
          id: song.id,
          name: song.name,
          artist: song.artist,
          artworkUrl: song.artworkUrl
        });

        // Fetch recommendations
        await generateAutoplayQueue(song.name, song.artist);
      } catch (err) {
        const errStr = String(err?.message || err?.description || err?.name || err || '');
        if (errStr.includes('CONTENT_EQUIVALENT')) {
          const fallbackRegions = ['us', 'gb', 'ca', 'au', 'in']; // Try these storefront regions sequentially
          const activeStorefront = localStorage.getItem('apple_music_storefront') || 'in';
          const targetRegions = fallbackRegions.filter(r => r !== activeStorefront);

          console.log(`Caught CONTENT_EQUIVALENT error. Attempting public iTunes equivalent lookup in fallback regions: ${targetRegions.join(', ')}`);
          
          try {
            const { findTrack } = await import('./utils/itunesApi.js');
            
            for (const region of targetRegions) {
              try {
                console.log(`Looking up equivalent track for "${song.name}" by "${song.artist}" in region: ${region}`);
                const match = await findTrack(song.name, song.artist, region);
                if (match && match.id) {
                  console.log(`Found equivalent track ID: ${match.id} in region: ${region}. Retrying playback...`);
                  await playWithId(match.id);
                  
                  // If play succeeds without throwing, we're done! Update the states and exit.
                  console.log(`Playback succeeded on retry with region: ${region}`);
                  setLastSeededTrackId(match.id);
                  setCurrentTrack({
                    id: match.id,
                    name: song.name,
                    artist: song.artist,
                    artworkUrl: song.artworkUrl
                  });
                  
                  // Update the storefront in localStorage for future searches
                  localStorage.setItem('apple_music_storefront', region);
                  if (music) {
                    music.storefrontId = region;
                  }
                  
                  await generateAutoplayQueue(song.name, song.artist);
                  return; // Exit successfully!
                }
              } catch (retryErr) {
                const retryErrStr = String(retryErr?.message || retryErr?.description || retryErr?.name || retryErr || '');
                if (retryErrStr.includes('CONTENT_EQUIVALENT')) {
                  console.log(`Equivalent track in region ${region} also returned CONTENT_EQUIVALENT. Continuing to next region...`);
                } else {
                  console.warn(`Retry failed in region ${region} due to error:`, retryErr);
                }
              }
            }
          } catch (importErr) {
            console.error('Failed to import itunesApi dynamically', importErr);
          }
        }
        
        // Re-throw if it wasn't CONTENT_EQUIVALENT or if equivalent lookup/retry failed
        throw err;
      }
    } catch (err) {
      console.error('Play track failed', err);
      const errMsg = err?.message || err?.description || err?.name || JSON.stringify(err);
      alert(`Failed to play track: ${errMsg}\n\nEnsure Apple Music is fully initialized and active.`);
    }
  };

  return (
    <div className="app-container">
      {/* Header Bar */}
      <header 
        className="glass-panel"
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 24px', margin: '24px 24px 0 24px',
          borderBottom: '1px solid var(--glass-border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Radio size={28} color="#FC3C44" />
          <h1 style={{ fontSize: '1.5rem', fontFamily: 'var(--font-heading)', background: 'linear-gradient(to right, #FC3C44, #8B5CF6, #E31B23)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            VibeSync
          </h1>
        </div>

        {/* Tab Controls */}
        <nav style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn ${activeTab === 'search' ? 'btn-apple' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('search')}
          >
            <Search size={16} /> Search & Play
          </button>
          
          <button 
            className={`btn ${activeTab === 'queue' ? 'btn-apple' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('queue')}
          >
            <ListMusic size={16} /> Player Queue
          </button>
          
          <button 
            className={`btn ${activeTab === 'settings' ? 'btn-apple' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} /> Settings
          </button>
        </nav>
      </header>

      {/* Main Tab Panel */}
      <main className="main-content">
        {activeTab === 'search' && (
          <SearchAndPlay onPlayTrack={handlePlaySong} />
        )}
        
        {activeTab === 'queue' && (
          <QueueList spotifyRecs={spotifyRecs} matchingStatus={matchingStatus} />
        )}
        
        {activeTab === 'settings' && (
          <Settings 
            onAppleMusicConnected={() => setAppleInitialized(isMusicKitInitialized())} 
          />
        )}
      </main>

      {/* Sticky Bottom Player */}
      <Player currentTrack={currentTrack} />
    </div>
  );
}
