import React, { useState } from 'react';
import { Search, Play, Music } from 'lucide-react';
import { isMusicKitInitialized } from '../utils/appleMusicApi';

export default function SearchAndPlay({ onPlayTrack }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (!isMusicKitInitialized()) {
      setError('Please connect your Apple Music account in Settings first.');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const music = window.MusicKit.getInstance();
      const storefront = music.storefrontId || 'us';
      
      const response = await music.api.music(`/v1/catalog/${storefront}/search`, {
        term: query,
        types: 'songs',
        limit: 18
      });

      if (response.data && response.data.results && response.data.results.songs) {
        const songs = response.data.results.songs.data.map(song => ({
          id: song.id,
          name: song.attributes.name,
          artist: song.attributes.artistName,
          album: song.attributes.albumName,
          duration: song.attributes.durationInMillis,
          artworkUrl: song.attributes.artwork 
            ? song.attributes.artwork.url.replace('{w}', '300').replace('{h}', '300')
            : null
        }));
        setResults(songs);
      } else {
        setResults([]);
        setError('No songs found.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to search Apple Music catalog.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Explore & Seed</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
          Search Apple Music for a song to play. VibeSync will automatically queue Spotify recommendations next!
        </p>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search 
            size={18} 
            style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
          />
          <input 
            type="text" 
            placeholder="Search songs, artists, lyrics..." 
            className="input-field"
            style={{ paddingLeft: '48px' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-apple" disabled={loading} style={{ borderRadius: '12px' }}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {error && (
        <div style={{ textAlign: 'center', color: '#FC3C44', fontSize: '0.95rem', margin: '10px 0' }}>
          {error}
        </div>
      )}

      {/* Grid of Results */}
      {results.length > 0 && (
        <div className="grid-cards">
          {results.map((song) => (
            <div 
              key={song.id} 
              className="glass-panel glass-panel-interactive"
              style={{
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '16px'
              }}
              onClick={() => onPlayTrack(song)}
            >
              {/* Cover Art Image */}
              <div style={{ 
                width: '100%', 
                aspectRatio: '1', 
                borderRadius: '10px', 
                overflow: 'hidden',
                background: 'rgba(0,0,0,0.2)',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {song.artworkUrl ? (
                  <img 
                    src={song.artworkUrl} 
                    alt={song.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  <Music size={40} style={{ color: 'var(--text-muted)' }} />
                )}
                
                {/* Play Button Overlay */}
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center',
                  alignItems: 'center', opacity: 0, transition: 'opacity 0.2s ease',
                  cursor: 'pointer'
                }} className="hover-overlay-play">
                  <div style={{
                    background: 'var(--apple-music-red)', padding: '12px', borderRadius: '50%',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center'
                  }}>
                    <Play size={20} fill="white" color="white" />
                  </div>
                </div>
              </div>

              {/* Meta Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                <div style={{ 
                  fontWeight: '600', 
                  fontSize: '0.95rem', 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  fontFamily: 'var(--font-heading)'
                }}>
                  {song.name}
                </div>
                <div style={{ 
                  fontSize: '0.85rem', 
                  color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {song.artist}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {song.album}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add CSS directly for play button hover effect overlay */}
      <style>{`
        .glass-panel-interactive:hover .hover-overlay-play {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
