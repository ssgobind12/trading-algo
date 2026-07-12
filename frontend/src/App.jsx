import React, { useState, useEffect } from 'react';
import TradingChart from './components/TradingChart';
import RightSidebar from './components/RightSidebar';
import Auth from './components/Auth';
import { 
  Activity, Settings, Maximize2, Layout, 
  Crosshair, Minus, AlignRight, Share2, 
  Type, Smile, Ruler, ZoomIn, Magnet, 
  Lock, EyeOff, Trash2, PenLine, Calendar,
  ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import './index.css';

const ASSETS = [
  { id: 'NIFTY', name: 'Nifty 50 Index', exchange: 'NSE' },
  { id: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'NSE' },
  { id: 'SENSEX', name: 'Sensex Index', exchange: 'BSE' },
  { id: 'CRUDEOIL', name: 'Crude Oil Futures', exchange: 'NYMEX' },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('auth_token');
  });
  const [username, setUsername] = useState(() => localStorage.getItem('auth_username') || '');

  const [selectedAsset, setSelectedAsset] = useState(() => {
    const saved = localStorage.getItem('selectedAssetId');
    if (saved) {
      return ASSETS.find(a => a.id === saved) || ASSETS[0];
    }
    return ASSETS[0];
  });
  
  const [timeframe, setTimeframe] = useState(() => {
    const saved = localStorage.getItem('selectedTimeframe');
    return saved || '1D';
  });
  
  const [clearTrigger, setClearTrigger] = useState(0);
  const [activeTool, setActiveTool] = useState(null);
  const [manualSignal, setManualSignal] = useState(null);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('chart'); // 'chart' or 'layout'
  const [chartSettings, setChartSettings] = useState(() => {
    const saved = localStorage.getItem('chartSettings');
    return saved ? JSON.parse(saved) : { ema: true, volume: true, macd: false, microJitter: true, audioAlerts: true };
  });
  
  const [layoutSettings, setLayoutSettings] = useState(() => {
    const saved = localStorage.getItem('layoutSettings');
    return saved ? JSON.parse(saved) : { showLeftToolbar: true, showRightSidebar: true };
  });
  
  const [isSimulatorMode, setIsSimulatorMode] = useState(false);
  const [growwKeys, setGrowwKeys] = useState({ groww_api_key: '', groww_api_secret: '' });
  const [marketStatus, setMarketStatus] = useState(null);

  // Fetch market status every 30 seconds
  useEffect(() => {
    const fetchStatus = () => {
      fetch('/api/market-status')
        .then(res => res.json())
        .then(data => setMarketStatus(data))
        .catch(err => console.error(err));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  // Add effect to load broker keys on mount
  useEffect(() => {
    const storedUsername = localStorage.getItem('auth_username');
    if (storedUsername) {
      fetch(`/api/broker-keys?username=${storedUsername}`)
        .then(res => res.json())
        .then(data => {
          if (data.groww_api_key) setGrowwKeys(data);
        })
        .catch(err => console.error(err));
    }
  }, []);

  const saveBrokerKeys = async () => {
    const storedUsername = localStorage.getItem('auth_username');
    if (!storedUsername) return alert('Please login first');
    
    try {
      const res = await fetch('/api/broker-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: storedUsername, ...growwKeys })
      });
      if (res.ok) alert('Broker keys saved successfully!');
      else alert('Failed to save broker keys');
    } catch (err) {
      alert('Error saving keys');
    }
  };

  const toggleSimulator = async (active) => {
    setIsSimulatorMode(active);
    try {
      await fetch('/api/simulator/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      });
    } catch (e) {
      console.error("Failed to toggle simulator", e);
    }
  };

  const updateSetting = (key, value) => {
    const newSettings = { ...chartSettings, [key]: value };
    setChartSettings(newSettings);
    localStorage.setItem('chartSettings', JSON.stringify(newSettings));
  };
  
  const updateLayout = (key, value) => {
    const newLayout = { ...layoutSettings, [key]: value };
    setLayoutSettings(newLayout);
    localStorage.setItem('layoutSettings', JSON.stringify(newLayout));
  };

  const handleAssetChange = (e) => {
    const newAsset = ASSETS.find(a => a.id === e.target.value);
    setSelectedAsset(newAsset);
    localStorage.setItem('selectedAssetId', newAsset.id);
  };
  
  const handleTimeframeChange = (e) => {
    const newTf = e.target.value;
    setTimeframe(newTf);
    localStorage.setItem('selectedTimeframe', newTf);
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_username');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return <Auth onLogin={(user) => { setUsername(user); setIsAuthenticated(true); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      {/* Top Toolbar */}
      <div style={{ 
        height: '48px', 
        backgroundColor: 'var(--panel-bg)', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 600 }}>
            <Activity size={20} color={isSimulatorMode ? "#f23645" : "var(--accent-color)"} />
            <span>Trading Algo UI</span>
            {isSimulatorMode && (
              <span style={{ backgroundColor: '#f23645', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                SIMULATOR
              </span>
            )}
          </div>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hello, {username}</span>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Logout</button>
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          
          {/* Market Status Badge */}
          {marketStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: marketStatus.isOpen ? '#10b981' : '#ef4444', boxShadow: marketStatus.isOpen ? '0 0 6px #10b981' : 'none' }} />
              <span style={{ fontSize: '11px', color: marketStatus.isOpen ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                {marketStatus.isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}
              </span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                IST {marketStatus.currentTimeIST}
              </span>
            </div>
          )}
          <select 
            value={selectedAsset.id}
            onChange={handleAssetChange}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {ASSETS.map(asset => (
              <option key={asset.id} value={asset.id} style={{ backgroundColor: 'var(--panel-bg)' }}>
                {asset.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedAsset.exchange}</span>
          
          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          
          {/* Interval Dropdown matched to TradingView styles */}
          <select 
            value={timeframe}
            onChange={handleTimeframeChange}
            style={{
              backgroundColor: 'transparent',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              padding: '6px 12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <optgroup label="MINUTES" style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--text-muted)' }}>
              <option value="1m" style={{ color: 'var(--text-main)' }}>1 minute</option>
              <option value="2m" style={{ color: 'var(--text-main)' }}>2 minutes</option>
              <option value="5m" style={{ color: 'var(--text-main)' }}>5 minutes</option>
              <option value="15m" style={{ color: 'var(--text-main)' }}>15 minutes</option>
              <option value="30m" style={{ color: 'var(--text-main)' }}>30 minutes</option>
            </optgroup>
            <optgroup label="HOURS" style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--text-muted)' }}>
              <option value="1h" style={{ color: 'var(--text-main)' }}>1 hour</option>
            </optgroup>
            <optgroup label="DAYS" style={{ backgroundColor: 'var(--panel-bg)', color: 'var(--text-muted)' }}>
              <option value="1D" style={{ color: 'var(--text-main)' }}>1 day</option>
              <option value="1W" style={{ color: 'var(--text-main)' }}>1 week</option>
              <option value="1M" style={{ color: 'var(--text-main)' }}>1 month</option>
            </optgroup>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)' }}>
          <Layout size={20} style={{ cursor: 'pointer' }} title="Layout Settings" onClick={() => { setSettingsTab('layout'); setIsSettingsOpen(true); }} />
          <Settings size={20} style={{ cursor: 'pointer' }} title="Chart Settings" onClick={() => { setSettingsTab('chart'); setIsSettingsOpen(true); }} />
          <Maximize2 size={20} style={{ cursor: 'pointer' }} title="Toggle Fullscreen" onClick={toggleFullScreen} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Drawing Toolbar (Sidebar) */}
        {layoutSettings.showLeftToolbar && (
          <div style={{ width: '48px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '20px', backgroundColor: 'var(--panel-bg)' }}>
            <button 
              onClick={() => setManualSignal({ type: 'Buy', id: Date.now() })} 
              style={{ background: 'transparent', border: 'none', color: '#089981', cursor: 'pointer' }}
              title="Mark My Buy Entry Here"
            >
              <ArrowUpCircle size={24} />
            </button>
            <button 
              onClick={() => setManualSignal({ type: 'Sell', id: Date.now() })} 
              style={{ background: 'transparent', border: 'none', color: '#f23645', cursor: 'pointer' }}
              title="Mark My Sell Entry Here"
            >
              <ArrowDownCircle size={24} />
            </button>
            <button 
              onClick={() => setActiveTool('horizontalSegment')} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              title="Draw S/R Line"
            >
              <PenLine size={20} />
            </button>
            
            <div style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
            <button onClick={() => setActiveTool('rayLine')} style={{ background: 'transparent', border: 'none', color: activeTool === 'rayLine' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <Crosshair size={20} />
            </button>
            <button onClick={() => setActiveTool('segment')} style={{ background: 'transparent', border: 'none', color: activeTool === 'segment' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <Minus size={20} />
            </button>
            <button onClick={() => setActiveTool('horizontalStraightLine')} style={{ background: 'transparent', border: 'none', color: activeTool === 'horizontalStraightLine' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <Activity size={20} />
            </button>
            <button onClick={() => setActiveTool('fibonacciLine')} style={{ background: 'transparent', border: 'none', color: activeTool === 'fibonacciLine' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <AlignRight size={20} />
            </button>
            <button onClick={() => setActiveTool('priceChannelLine')} style={{ background: 'transparent', border: 'none', color: activeTool === 'priceChannelLine' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <Share2 size={20} />
            </button>
            <button onClick={() => setActiveTool('simpleAnnotation')} style={{ background: 'transparent', border: 'none', color: activeTool === 'simpleAnnotation' ? 'var(--accent-color)' : 'var(--text-muted)', cursor: 'pointer' }}>
              <Type size={20} />
            </button>
            
            <div style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <ZoomIn size={20} />
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Magnet size={20} />
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <Lock size={20} />
            </button>
            <button style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <EyeOff size={20} />
            </button>
            
            <div style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
            <button 
              onClick={() => {
                setActiveTool(null);
                setClearTrigger(prev => prev + 1);
              }} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 'auto' }}
              title="Wipe ALL Drawings (To delete just ONE line, click the line on the chart and press the Delete key on your keyboard)"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}

        {/* Chart Area with Timeframe Toolbar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <TradingChart 
              symbol={selectedAsset.id} 
              timeframe={timeframe} 
              clearTrigger={clearTrigger}
              activeTool={activeTool}
              manualSignal={manualSignal}
              chartSettings={chartSettings}
            />
          </div>
        </div>

        {/* Details Panel (Right Sidebar) */}
        {layoutSettings.showRightSidebar && <RightSidebar asset={selectedAsset} />}
      </div>
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: '400px', backgroundColor: 'var(--panel-bg)',
            border: '1px solid var(--border-color)', borderRadius: '12px',
            padding: '24px', color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                {settingsTab === 'chart' ? 'Chart Settings' : 'Layout Settings'}
              </h2>
              {settingsTab === 'chart' ? <Settings size={20} color="var(--text-muted)" /> : <Layout size={20} color="var(--text-muted)" />}
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
               <button 
                  onClick={() => setSettingsTab('chart')}
                  style={{ flex: 1, padding: '8px', backgroundColor: settingsTab === 'chart' ? 'var(--accent-color)' : 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
               >
                 Chart
               </button>
               <button 
                  onClick={() => setSettingsTab('layout')}
                  style={{ flex: 1, padding: '8px', backgroundColor: settingsTab === 'layout' ? 'var(--accent-color)' : 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
               >
                 Layout
               </button>
               <button 
                  onClick={() => setSettingsTab('broker')}
                  style={{ flex: 1, padding: '8px', backgroundColor: settingsTab === 'broker' ? 'var(--accent-color)' : 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
               >
                 Brokerages
               </button>
            </div>
            
            {settingsTab === 'chart' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>EMA (6, 12, 20) Indicator</span>
                    <input type="checkbox" checked={chartSettings.ema} onChange={(e) => updateSetting('ema', e.target.checked)} />
                  </label>
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Volume Bar Chart</span>
                    <input type="checkbox" checked={chartSettings.volume} onChange={(e) => updateSetting('volume', e.target.checked)} />
                  </label>
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>MACD (12, 26, 9) Indicator</span>
                    <input type="checkbox" checked={chartSettings.macd} onChange={(e) => updateSetting('macd', e.target.checked)} />
                  </label>
                  
                  <hr style={{ borderColor: 'var(--border-color)', margin: '8px 0' }} />
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Micro-Jitter Algorithm (Live Feel)</span>
                    <input type="checkbox" checked={chartSettings.microJitter} onChange={(e) => updateSetting('microJitter', e.target.checked)} />
                  </label>
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Audio Alerts (Hero Zero Beeps)</span>
                    <input type="checkbox" checked={chartSettings.audioAlerts} onChange={(e) => updateSetting('audioAlerts', e.target.checked)} />
                  </label>
                  
                  <hr style={{ borderColor: 'var(--border-color)', margin: '8px 0' }} />
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', color: '#f23645', fontWeight: 'bold' }}>
                    <span>Simulator Mode (Replay Data)</span>
                    <input type="checkbox" checked={isSimulatorMode} onChange={(e) => toggleSimulator(e.target.checked)} />
                  </label>
                </div>
            )}
            
            {settingsTab === 'layout' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Show Left Drawing Toolbar</span>
                    <input type="checkbox" checked={layoutSettings.showLeftToolbar} onChange={(e) => updateLayout('showLeftToolbar', e.target.checked)} />
                  </label>
                  
                  <label style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Show Right Options Panel</span>
                    <input type="checkbox" checked={layoutSettings.showRightSidebar} onChange={(e) => updateLayout('showRightSidebar', e.target.checked)} />
                  </label>
                </div>
            )}
            
            {settingsTab === 'broker' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Connect your Groww account to trade directly and view your live portfolio.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Groww API Key</label>
                    <input 
                      type="password" 
                      value={growwKeys.groww_api_key} 
                      onChange={e => setGrowwKeys({...growwKeys, groww_api_key: e.target.value})}
                      placeholder="eyJraWQi..."
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'white' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Groww API Secret</label>
                    <input 
                      type="password" 
                      value={growwKeys.groww_api_secret} 
                      onChange={e => setGrowwKeys({...growwKeys, groww_api_secret: e.target.value})}
                      placeholder="Z_nQ!p..."
                      style={{ padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'transparent', color: 'white' }}
                    />
                  </div>
                  <button onClick={saveBrokerKeys} style={{ padding: '8px', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    Save Broker Keys
                  </button>
                </div>
            )}
            
            <button 
              onClick={() => setIsSettingsOpen(false)}
              style={{
                marginTop: '24px', width: '100%', padding: '10px',
                backgroundColor: 'var(--accent-color)', color: 'white',
                border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
