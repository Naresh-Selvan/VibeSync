import React, { useState, useEffect } from 'react';
import { Play, ListMusic, Music, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { isMusicKitInitialized } from '../utils/appleMusicApi';

export default function QueueList({ spotifyRecs = [], matchingStatus = {} }) {
  const [appleQueue, setAppleQueue] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(0);

  useEffect(() => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();

    const updateQueue = () => {
      if (music.player.queue) {
        setAppleQueue(music.player.queue.items || []);
        setCurrentPosition(music.player.queue.position || 0);
      }
    };

    updateQueue();

    // Listen to queue changes
    music.addEventListener('queueItemsDidChange', updateQueue);
    music.addEventListener('queuePositionDidChange', updateQueue);
    music.addEventListener('nowPlayingItemDidChange', updateQueue);

    return () => {
      music.removeEventListener('queueItemsDidChange', updateQueue);
      music.removeEventListener('queuePositionDidChange', updateQueue);
      music.removeEventListener('nowPlayingItemDidChange', updateQueue);
    };
  }, []);

  const formatDuration = (ms) => {
    if (!ms) return '';
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = Math.floor(totalSecs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const upcomingQueue = appleQueue.slice(currentPosition + 1);
  const currentItem = appleQueue[currentPosition];

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', width: '100%' }}>
      {/* Left: Spotify Recommendations Bridge */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.4rem', color: '#1DB954', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListMusic /> Spotify Recommendation Seeds
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Tracks generated from your current vibes. VibeSync matches these in the Apple Music catalog and inserts them next.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
          {spotifyRecs.length === 0 ? (
            <div style={{ padding: '40px 0', textSelf: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              <Music size={32} style={{ marginBottom: '10px', opacity: 0.5 }} /><br/>
              No recommendations generated yet.<br/>Play a song to trigger autoplay!
            </div>
          ) : (
            spotifyRecs.map((track) => {
              const status = matchingStatus[track.id];
              return (
                <div 
                  key={track.id} 
                  className="glass-panel" 
                  style={{
                    padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.15)', borderColor: 'rgba(255,255,255,0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '70%' }}>
                    <img 
                      src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url} 
                      alt={track.name} 
                      style={{ width: '40px', height: '40px', borderRadius: '4px' }} 
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', textAlign: 'left' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {track.artists?.map(a => a.name).join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Matching Indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                    {status === 'matching' && (
                      <span style={{ color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <RefreshCw size={12} className="spin-animation" /> Matching
                      </span>
                    )}
                    {status === 'success' && (
                      <span style={{ color: '#1DB954', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle size={12} /> Synced
                      </span>
                    )}
                    {status === 'not_found' && (
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }} title="Song not found in Apple Music catalog">
                        <AlertCircle size={12} /> Not Found
                      </span>
                    )}
                    {!status && (
                      <span style={{ color: 'var(--text-muted)' }}>Pending</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Apple Music Active Playback Queue */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '1.4rem', color: '#FC3C44', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ListMusic /> Apple Music Active Queue
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          The real-time queue running in your Apple Music player session.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
          {/* Now Playing Item */}
          {currentItem && (
            <div 
              className="glass-panel" 
              style={{
                padding: '14px', display: 'flex', alignItems: 'center', gap: '12px',
                background: 'rgba(252, 60, 68, 0.08)', borderColor: 'rgba(252, 60, 68, 0.3)'
              }}
            >
              <div style={{
                width: '12px', height: '12px', borderRadius: '50%', background: '#FC3C44',
                boxShadow: '0 0 10px #FC3C44'
              }} className="active-pulse-apple"></div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentItem.title}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentItem.artistName} • Now Playing
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Items */}
          {upcomingQueue.length === 0 ? (
            <div style={{ padding: '40px 0', textSelf: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
              Queue is empty.<br/>It will automatically fill with recommendations.
            </div>
          ) : (
            upcomingQueue.map((item, index) => (
              <div 
                key={`${item.id}-${index}`} 
                className="glass-panel" 
                style={{
                  padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '80%', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', width: '20px' }}>{index + 1}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden', textAlign: 'left' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.artistName}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {formatDuration(item.attributes?.durationInMillis)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-animation {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
