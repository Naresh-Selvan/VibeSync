import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, AlertTriangle, HelpCircle, Check, Key } from 'lucide-react';
import { initMusicKit, isMusicKitInitialized } from '../utils/appleMusicApi';

export default function Settings({ onAppleMusicConnected }) {
  const [lastfmApiKey, setLastfmApiKey] = useState(localStorage.getItem('lastfm_api_key') || '');
  const [amDevToken, setAmDevToken] = useState(localStorage.getItem('apple_music_developer_token') || '');
  const [amUserToken, setAmUserToken] = useState(localStorage.getItem('apple_music_user_token') || '');
  
  const [amStorefront, setAmStorefront] = useState(localStorage.getItem('apple_music_storefront') || 'in');
  const [isAppleConnected, setIsAppleConnected] = useState(isMusicKitInitialized());
  
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrValue, setQrValue] = useState('');
  
  const [amLoading, setAmLoading] = useState(false);
  const [amError, setAmError] = useState('');
  const [showLfmInstructions, setShowLfmInstructions] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    // Check Apple Music Connection Status
    setIsAppleConnected(isMusicKitInitialized());
  }, []);

  const saveLastfmConfig = () => {
    localStorage.setItem('lastfm_api_key', lastfmApiKey);
    alert('Last.fm API Key Saved!');
  };

  const handleAppleConnect = async () => {
    if (!amDevToken) {
      setAmError('Developer Token is required.');
      return;
    }
    
    setAmLoading(true);
    setAmError('');
    
    const cleanDevToken = amDevToken.trim();
    const cleanUserToken = amUserToken ? amUserToken.trim() : '';

    let tokenPayloadDetails = "";
    try {
      const parts = cleanDevToken.split('.');
      if (parts.length === 3) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        const payload = JSON.parse(jsonPayload);
        tokenPayloadDetails = ` [Token Details: exp=${new Date(payload.exp * 1000).toLocaleDateString()}, origin=${JSON.stringify(payload.origin || 'none')}]`;
      }
    } catch (e) {
      console.warn("Could not decode JWT payload", e);
    }

    try {
      localStorage.setItem('apple_music_developer_token', cleanDevToken);
      localStorage.setItem('apple_music_storefront', amStorefront);
      if (cleanUserToken) {
        localStorage.setItem('apple_music_user_token', cleanUserToken);
      }
      
      const music = await initMusicKit(cleanDevToken, cleanUserToken || null, amStorefront);
      
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
      
      if (cleanUserToken) {
        console.warn("Init failed with user token, clearing and retrying...");
        localStorage.removeItem('apple_music_user_token');
        setAmUserToken('');
        try {
          const music = await initMusicKit(cleanDevToken, null, amStorefront);
          const newUserToken = await music.authorize();
          setAmUserToken(newUserToken);
          localStorage.setItem('apple_music_user_token', newUserToken);
          setIsAppleConnected(true);
          if (onAppleMusicConnected) onAppleMusicConnected();
          alert('Apple Music Connected Successfully (Session Refreshed)!');
          return;
        } catch (retryErr) {
          console.error("Retry failed", retryErr);
          const errMsg = retryErr.message || retryErr.statusText || (retryErr.description) || JSON.stringify(retryErr);
          setAmError(`Failed to initialize MusicKit (session refresh failed): ${errMsg}${tokenPayloadDetails}`);
          return;
        }
      }
      
      const errMsg = err.message || err.statusText || (err.description) || JSON.stringify(err);
      setAmError(`Failed to initialize MusicKit: ${errMsg}${tokenPayloadDetails}`);
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

  const handleLastfmDisconnect = () => {
    localStorage.removeItem('lastfm_api_key');
    setLastfmApiKey('');
    alert('Reset Last.fm key to default.');
  };

  const generateSyncQr = () => {
    const config = {
      lastfmApiKey,
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
      
      {/* Last.fm Recommendation Engine Panel */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#E31B23', fontSize: '1.4rem' }}>
            <span style={{ fontSize: '1.8rem' }}>🔴</span> Last.fm Recommendations (Free Engine)
          </h3>
          <span className="glass-panel" style={{ padding: '4px 12px', fontSize: '0.85rem', color: lastfmApiKey ? '#1DB954' : '#E31B23', borderColor: lastfmApiKey ? 'rgba(29, 185, 84, 0.3)' : 'rgba(227, 27, 35, 0.3)', background: lastfmApiKey ? 'rgba(29, 185, 84, 0.1)' : 'rgba(227, 27, 35, 0.05)' }}>
            {lastfmApiKey ? 'Custom Key Active' : 'Using Shared Default Key'}
          </span>
        </div>
        
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.4' }}>
          To avoid Spotify's new paid developer policies, VibeSync uses Last.fm's database to fetch similar tracks. A default public API key is provided, but you can create a free developer key in 30 seconds to avoid shared rate limits.
        </p>

        <button 
          className="btn btn-secondary" 
          style={{ alignSelf: 'flex-start', fontSize: '0.85rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={() => setShowLfmInstructions(!showLfmInstructions)}
        >
          <HelpCircle size={16} /> {showLfmInstructions ? 'Hide Instructions' : 'How to get a Free Last.fm Key'}
        </button>

        {showLfmInstructions && (
          <div className="glass-panel" style={{ padding: '16px', fontSize: '0.9rem', lineHeight: '1.5', background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid #E31B23' }}>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Go to <a href="https://www.last.fm/api/account/create" target="_blank" rel="noreferrer" style={{ color: '#E31B23', fontWeight: 'bold' }}>Last.fm API Account Creation</a> (free signup).</li>
              <li>Enter <b>VibeSync</b> as the Application Name, add your email, and leave other fields blank.</li>
              <li>Click <b>Submit</b>.</li>
              <li>Copy the <b>API Key</b> (you do not need the shared secret) and paste it below!</li>
            </ol>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Last.fm API Key</label>
          <input 
            type="text" 
            placeholder="Paste your Last.fm API Key here..." 
            className="input-field"
            value={lastfmApiKey}
            onChange={(e) => setLastfmApiKey(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button className="btn" style={{ background: '#E31B23' }} onClick={saveLastfmConfig}>
            Save Last.fm Key
          </button>
          {lastfmApiKey && (
            <button className="btn btn-secondary" onClick={handleLastfmDisconnect}>
              Reset to Default Key
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
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Apple Music Storefront Country</label>
          <select 
            className="input-field"
            value={amStorefront}
            onChange={(e) => setAmStorefront(e.target.value)}
            disabled={isAppleConnected}
            style={{ background: 'rgba(0, 0, 0, 0.3)', color: 'white' }}
          >
            <option value="">Auto-Detect (Recommended without VPN)</option>
            <option value="in">India (in)</option>
            <option value="us">United States (us)</option>
            <option value="gb">United Kingdom (gb)</option>
            <option value="ca">Canada (ca)</option>
            <option value="au">Australia (au)</option>
            <option value="de">Germany (de)</option>
            <option value="fr">France (fr)</option>
            <option value="jp">Japan (jp)</option>
          </select>
        </div>

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
          <button 
            className="btn btn-secondary" 
            style={{ borderColor: 'rgba(252, 60, 68, 0.4)', color: '#FC3C44', background: 'rgba(252, 60, 68, 0.05)' }} 
            onClick={async () => {
              if (window.confirm("This will completely clear your cached tokens and restart the application. Continue?")) {
                try {
                  const music = window.MusicKit?.getInstance();
                  if (music) await music.unauthorize();
                } catch(e){}
                localStorage.clear();
                sessionStorage.clear();
                document.cookie.split(";").forEach(c => {
                  const name = c.trim().split("=")[0];
                  if (name) document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
                });
                window.location.reload();
              }
            }}
          >
            Hard Reset App
          </button>
        </div>
      </div>

      {/* Sync Panel (Only visible on PC/Active tokens to sync to mobile) */}
      {(lastfmApiKey || isAppleConnected) && (
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(22, 25, 37, 0.65) 100%)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#8B5CF6', fontSize: '1.4rem' }}>
            <Smartphone size={24} /> Sync configurations to iOS/Android
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Don't want to type this on your phone? Generate a sync QR code. Scan it with your phone's camera to instantly import your Last.fm API Key and Apple Music tokens.
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
