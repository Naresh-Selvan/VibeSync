import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, Music, Shuffle } from 'lucide-react';
import { isMusicKitInitialized } from '../utils/appleMusicApi';

export default function Player({ currentTrack, onTrackEnd }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [activeItem, setActiveItem] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    if (!isMusicKitInitialized()) return;

    const music = window.MusicKit.getInstance();
    
    // Set initial values
    setIsPlaying(music.player.isPlaying);
    setVolume(music.player.volume);
    if (music.player.nowPlayingItem) {
      setActiveItem(music.player.nowPlayingItem);
      setDuration(music.player.currentPlaybackDuration || 0);
      setCurrentTime(music.player.currentPlaybackTime || 0);
    }

    // State Change Handlers
    const handleStateChange = (event) => {
      setIsPlaying(music.player.isPlaying);
    };

    const handleItemChange = (event) => {
      const item = music.player.nowPlayingItem;
      setActiveItem(item);
      setDuration(music.player.currentPlaybackDuration || 0);
      setCurrentTime(music.player.currentPlaybackTime || 0);
    };

    const handleTimeChange = () => {
      setCurrentTime(music.player.currentPlaybackTime || 0);
    };

    const handleDurationChange = () => {
      setDuration(music.player.currentPlaybackDuration || 0);
    };

    // Add event listeners
    music.addEventListener('playbackStateDidChange', handleStateChange);
    music.addEventListener('nowPlayingItemDidChange', handleItemChange);
    music.addEventListener('playbackTimeDidChange', handleTimeChange);
    music.addEventListener('playbackDurationDidChange', handleDurationChange);

    // Continuous backup polling for time updates (sometimes events are throttled)
    timerRef.current = setInterval(() => {
      if (music.player.isPlaying) {
        setCurrentTime(music.player.currentPlaybackTime || 0);
      }
    }, 500);

    return () => {
      music.removeEventListener('playbackStateDidChange', handleStateChange);
      music.removeEventListener('nowPlayingItemDidChange', handleItemChange);
      music.removeEventListener('playbackTimeDidChange', handleTimeChange);
      music.removeEventListener('playbackDurationDidChange', handleDurationChange);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentTrack]);

  const handlePlayPause = async () => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();
    try {
      if (isPlaying) {
        await music.player.pause();
      } else {
        await music.player.play();
      }
    } catch (e) {
      console.error('Play/Pause toggle failed', e);
    }
  };

  const handleSkipNext = async () => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();
    try {
      await music.player.skipToNextItem();
    } catch (e) {
      console.error('Skip next failed', e);
    }
  };

  const handleSkipPrev = async () => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();
    try {
      await music.player.skipToPreviousItem();
    } catch (e) {
      console.error('Skip previous failed', e);
    }
  };

  const handleSeek = async (e) => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    try {
      await music.player.seekToTime(time);
    } catch (err) {
      console.error('Seek failed', err);
    }
  };

  const handleVolumeChange = (e) => {
    if (!isMusicKitInitialized()) return;
    const music = window.MusicKit.getInstance();
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    music.player.volume = vol;
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === undefined) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Get track details from MusicKit active item or props fallback
  const title = activeItem?.title || currentTrack?.name || 'Not Playing';
  const artist = activeItem?.artistName || currentTrack?.artist || 'Select a song to start';
  const rawArtworkUrl = activeItem?.attributes?.artwork?.url || currentTrack?.artworkUrl;
  const artworkUrl = rawArtworkUrl 
    ? rawArtworkUrl.replace('{w}', '120').replace('{h}', '120')
    : null;

  return (
    <div 
      className="glass-panel"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '24px',
        right: '24px',
        height: '96px',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 100,
        boxShadow: '0 15px 40px rgba(0, 0, 0, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 17, 26, 0.85)'
      }}
    >
      {/* Left: Track Metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%', minWidth: '220px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '8px', overflow: 'hidden',
          background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {artworkUrl ? (
            <img src={artworkUrl} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Music size={24} style={{ color: 'var(--text-muted)' }} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', textAlign: 'left' }}>
          <div style={{ 
            fontWeight: '600', fontSize: '0.95rem', whiteSpace: 'nowrap', 
            overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)',
            fontFamily: 'var(--font-heading)'
          }}>
            {title}
          </div>
          <div style={{ 
            fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', 
            overflow: 'hidden', textOverflow: 'ellipsis' 
          }}>
            {artist}
          </div>
        </div>
      </div>

      {/* Center: Controls and Seek Bar */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        width: '40%', maxWidth: '600px'
      }}>
        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button 
            className="btn btn-secondary btn-icon-only" 
            style={{ border: 'none', background: 'transparent' }}
            onClick={handleSkipPrev}
          >
            <SkipBack size={20} color="white" />
          </button>
          
          <button 
            className="btn btn-apple btn-icon-only" 
            style={{ width: '48px', height: '48px' }}
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause size={22} fill="white" color="white" />
            ) : (
              <Play size={22} style={{ marginLeft: '2px' }} fill="white" color="white" />
            )}
          </button>
          
          <button 
            className="btn btn-secondary btn-icon-only" 
            style={{ border: 'none', background: 'transparent' }}
            onClick={handleSkipNext}
          >
            <SkipForward size={20} color="white" />
          </button>
        </div>

        {/* Progress Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>{formatTime(currentTime)}</span>
          <input 
            type="range" 
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            style={{ flex: 1 }}
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Autoplay Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '30%', justifyContent: 'flex-end', minWidth: '180px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <Volume2 size={16} />
          <input 
            type="range" 
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={handleVolumeChange}
            style={{ width: '80px' }}
          />
        </div>
        
        {/* Spotify Sync Mode Indicator */}
        <div 
          className="glass-panel" 
          style={{
            padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.75rem', color: '#1DB954', borderColor: 'rgba(29, 185, 84, 0.2)',
            background: 'rgba(29, 185, 84, 0.05)', borderRadius: '8px'
          }}
          title="Spotify Autoplay Recommendations Enabled"
        >
          <Shuffle size={12} />
          <span>Vibe Autoplay</span>
        </div>
      </div>
    </div>
  );
}
