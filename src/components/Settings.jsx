import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Key, Globe, Smartphone, RefreshCw, CheckCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import { getSpotifyToken, getSpotifyAuthUrl } from '../utils/spotifyApi';
import { initMusicKit, isMusicKitInitialized } from '../utils/appleMusicApi';

export default function Settings({ onSpotifyConnected, onAppleMusicConnected }) {
  const [spotifyClientId, setSpotifyClientId] = useState(localStorage.getItem('spotify_client_id') || '');
  const [amDevToken, setAmDevToken] = useState(localStorage.getItem('apple_music_developer_token') || '');
  const [amUserToken, setAmUserToken] = useState(localStorage.getItem('apple_music_user_token') || '');
  
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(!!getSpotifyToken());
  const [isAppleConnected, setIsAppleConnected] = useState(isMusicKitInitialized());
  
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrValue, setQrValue] = useState('');
  
  const [amLoading, setAmLoading] = useState(false);
  const [amError, setAmError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check Spotify Connection Status
    setIsSpotifyConnected(!!getSpotifyToken());
    
    // Check Apple Music Connection Status
    setIsAppleConnected(isMusicKitInitialized());
  }, []);

  const saveSpotifyConfig = () => {
    localStorage.setItem('spotify_client_id', spotifyClientId);
    alert('Spotify Client ID Saved!');
  };

  const handleSpotifyLogin = () => {
    if (!spotifyClientId) {
      alert('Please enter a Spotify Client ID first.');
      return;
    }
    localStorage.setItem('spotify_client_id', spotifyClientId);
    
    // Redirect to Spotify Auth
    const redirectUri = window.location.origin + window.location.pathname;
    window.location.href = getSpotifyAuthUrl(spotifyClientId, redirectUri);
  };

  const handleAppleConnect = async () => {
    if (!amDevToken) {
      setAmError('Developer Token is required.');
      return;
    }
    
    setAmLoading(true);
    setAmError('');
    
    try {
      localStorage.setItem('apple_music_developer_token', amDevToken);
      if (amUserToken) {
        localStorage.setItem('apple_music_user_token', amUserToken);
      }
      
      const music = await initMusicKit(amDevToken, amUserToken || null);
      
      // If user token is not set, authorize the user
      if (!music.musicUserToken) {
        const newUserToken = await music.authorize();
        setAmUserToken(newUserToken);
        localStorage.setItem('apple_music_user_token', newUserToken);
      }
      
      setIsAppleConnected(true);
      if (onAppleMusicConnected) onAppleMusicConnected();
      alert('Apple Music Connected Successfully!');
    } catch (err) {
      console.error(err);
      setAmError('Failed to initialize MusicKit. Please check your Developer Token.');
    } finally {
      setAmLoading(false);
    }
  };

  const handleAppleDisconnect = () => {
    localStorage.removeItem('apple_music_developer_token');
    localStorage.removeItem('apple_music_user_token');
    setIsAppleConnected(false);
    setAmDevToken('');
    setAmUserToken('');
    if (onAppleMusicConnected) onAppleMusicConnected();
    alert('Disconnected Apple Music.');
  };

  const handleSpotifyDisconnect = () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_token_expires_at');
    setIsSpotifyConnected(false);
    alert('Disconnected Spotify.');
  };

  const generateSyncQr = () => {
    const config = {
      spotifyClientId,
      amDevToken,
      amUserToken: localStorage.getItem('apple_music_user_token') || ''
    };
    
    // Encode configuration inside URL hash
    const hashData = btoa(JSON.stringify(config));
    const syncUrl = `${window.location.origin}${window.location.pathname}#config=${hashData}`;
    setQrValue(syncUrl);
    setShowQrModal(true);
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <h2 style={{ fontSize: '2rem', textAlign: 'center', marginBottom: '10px' }}>Connection Center</h2>
      
      {/* Spotify Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#1DB954', fontSize: '1.4rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🟢</span> Spotify Recommendation Seed
          </h3>
          <span className="glass-panel" style={{ padding: '4px 12px', fontSize: '0.85rem', color: isSpotifyConnected ? '#1DB954' : '#9CA3AF', borderColor: isSpotifyConnected ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255,255,255,0.08)', background: isSpotifyConnected ? 'rgba(29, 185, 84, 0.1)' : 'rgba(0,0,0,0.2)' }}>
            {isSpotifyConnected ? 'Authenticated' : 'Not Connected'}
          </span>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
          To generate recommendations, you need a free Spotify Developer Account. 
          Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer" style={{ color: '#1DB954', textDecoration: 'underline' }}>Spotify Developer Dashboard</a>, create an App, and copy its <b>Client ID</b>. Add <code>{window.location.origin + window.location.pathname}</code> to your app's <b>Redirect URIs</b> in Spotify settings.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Spotify Client ID</label>
          <input 
            type="text" 
            placeholder="e.g. 4d95b5e7d8..." 
            className="input-field"
            value={spotifyClientId}
            onChange={(e) => setSpotifyClientId(e.target.value)}
            disabled={isSpotifyConnected}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          {!isSpotifyConnected ? (
            <button className="btn btn-spotify" onClick={handleSpotifyLogin}>
              Connect Spotify Account
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleSpotifyDisconnect}>
              Disconnect Spotify
            </button>
          )}
          {!isSpotifyConnected && spotifyClientId && (
            <button className="btn btn-secondary" onClick={saveSpotifyConfig}>
              Save Client ID Only
            </button>
          )}
        </div>
      </div>

      {/* Apple Music Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#FC3C44', fontSize: '1.4rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🍎</span> Apple Music Playback Stream
          </h3>
          <span className="glass-panel" style={{ padding: '4px 12px', fontSize: '0.85rem', color: isAppleConnected ? '#FC3C44' : '#9CA3AF', borderColor: isAppleConnected ? 'rgba(252, 60, 68, 0.3)' : 'rgba(255,255,255,0.08)', background: isAppleConnected ? 'rgba(252, 60, 68, 0.1)' : 'rgba(0,0,0,0.2)' }}>
            {isAppleConnected ? 'Ready' : 'Not Connected'}
          </span>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
          To stream music and manage your queue without a premium Apple Developer account, copy the Developer JWT Token that Apple Music's web player uses.
        </p>

        <button 
          className="btn btn-secondary" 
          style={{ alignSelf: 'flex-start', fontSize: '0.85rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowInstructions(!showInstructions)}
        >
          <HelpCircle size={16} /> {showInstructions ? 'Hide Instructions' : 'Show 1-Step Key Retrieval'}
        </button>

        {showInstructions && (
          <div className="glass-panel" style={{ padding: '16px', fontSize: '0.9rem', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid #FC3C44' }}>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Open <a href="https://music.apple.com" target="_blank" rel="noreferrer" style={{ color: '#FC3C44', fontWeight: 'bold' }}>music.apple.com</a> on your PC and log in.</li>
              <li>Press <b>F12</b> (or right-click and choose <i>Inspect Element</i>) and go to the <b>Console</b> tab.</li>
              <li>Paste the following code line and press Enter:
                <pre style={{ background: '#000', color: '#0f0', padding: '10px', borderRadius: '6px', overflowX: 'auto', marginTop: '6px', fontSize: '0.8rem', userSelect: 'all' }}>
                  console.log(MusicKit.getInstance().developerToken);
                </pre>
              </li>
              <li>Copy that long text block and paste it in the **Developer JWT Token** input below!</li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Apple Music Developer JWT Token</label>
          <textarea 
            rows="3"
            placeholder="Paste your Developer JWT token here..." 
            className="input-field"
            style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            value={amDevToken}
            onChange={(e) => setAmDevToken(e.target.value)}
            disabled={isAppleConnected}
          />
        </div>

        {amError && (
          <div style={{ color: '#FC3C44', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} /> {amError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          {!isAppleConnected ? (
            <button className="btn btn-apple" onClick={handleAppleConnect} disabled={amLoading}>
              {amLoading ? 'Initializing...' : 'Connect Apple Music'}
            </button>
          ) : (
            <button className="btn btn-secondary" onClick={handleAppleDisconnect}>
              Disconnect Apple Music
            </button>
          )}
        </div>
      </div>

      {/* Sync Panel (Only visible on PC/Active tokens to sync to mobile) */}
      {(isSpotifyConnected || isAppleConnected) && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(22, 25, 37, 0.65) 100%)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8B5CF6', fontSize: '1.4rem' }}>
            <Smartphone size={24} /> Sync configurations to iOS/Android
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Don't want to type this on your phone? Generate a sync QR code. Scan it with your phone's camera to instantly import your Spotify Client ID and Apple Music tokens.
          </p>
          <button className="btn" style={{ background: '#8B5CF6', alignSelf: 'flex-start' }} onClick={generateSyncQr}>
            Generate Mobile Sync QR Code
          </button>
        </div>
      )}

      {/* QR Modal */}
      {showQrModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div className="glass-panel" style={{
            padding: '30px', maxWidth: '450px', width: '100%',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            background: 'var(--bg-darker)', position: 'relative'
          }}>
            <h4 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)' }}>Scan with your Phone</h4>
            
            <div style={{ background: 'white', padding: '16px', borderRadius: '12px' }}>
              <QRCodeSVG value={qrValue} size={250} />
            </div>
            
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', lineHeight: '1.4' }}>
              Scan this with your mobile camera. It will launch VibeSync on your phone and copy your settings. Keep your PC running while scanning.
            </p>
            
            <button className="btn btn-secondary" onClick={() => setShowQrModal(false)} style={{ width: '100%' }}>
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
