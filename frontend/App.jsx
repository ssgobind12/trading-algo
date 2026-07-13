import React, { useState, useEffect } from 'react';
import TradingChart from './components/TradingChart';
import RightSidebar from './components/RightSidebar';
import Auth from './components/Auth';
import AdminPanel from './components/AdminPanel';
import { 
  Activity, Settings, Maximize2, Layout, 
  Crosshair, Minus, AlignRight, Share2, 
  Type, Smile, Ruler, ZoomIn, Magnet, 
  Lock, EyeOff, Trash2, PenLine, Calendar,
  ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';
import './index.css';

const EQUITY_ASSETS = [
  { id: 'NIFTY', name: 'Nifty 50 Index', exchange: 'NSE' },
  { id: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'NSE' },
  { id: 'SENSEX', name: 'Sensex Index', exchange: 'BSE' },
];

const COMMODITY_ASSETS = [
  { id: 'CRUDEOIL', name: 'Crude Oil Futures', exchange: 'MCX' },
  { id: 'GOLD', name: 'Gold Futures', exchange: 'MCX' },
  { id: 'SILVER', name: 'Silver Futures', exchange: 'MCX' },
];

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return !!localStorage.getItem('auth_token');
  });
  const [username, setUsername] = useState(() => localStorage.getItem('auth_username') || '');

  const [assetCategory, setAssetCategory] = useState(() => {
    const saved = localStorage.getItem('assetCategory');
    return saved || 'Equity';
  });

  const activeAssets = assetCategory === 'Equity' ? EQUITY_ASSETS : COMMODITY_ASSETS;

  const [selectedAsset, setSelectedAsset] = useState(() => {
    const saved = localStorage.getItem('selectedAssetId');
    if (saved) {
      const found = [...EQUITY_ASSETS, ...COMMODITY_ASSETS].find(a => a.id === saved);
      if (found) return found;
    }
    return EQUITY_ASSETS[0];
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
  const [autoTradeEnabled, setAutoTradeEnabled] = useState(false);
  const [marketStatus, setMarketStatus] = useState(null);

  // Fetch market status every 30 seconds
  useEffect(() => {
    const fetchStatus = () => {
      fetch(`/api/market-status?type=${assetCategory}`)
        .then(res => res.json())
        .then(data => setMarketStatus(data))
        .catch(err => console.error(err));
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [assetCategory]);

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
        
      fetch(`/api/auto-trade?username=${storedUsername}`)
        .then(res => res.json())
        .then(data => {
          if (data.auto_trade_enabled !== undefined) {
             setAutoTradeEnabled(data.auto_trade_enabled);
          }
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

  const toggleAutoTrade = async (enabled) => {
    const storedUsername = localStorage.getItem('auth_username');
    if (!storedUsername) return alert('Please login first');
    
    setAutoTradeEnabled(enabled);
    try {
      await fetch('/api/auto-trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: storedUsername, enabled })
      });
    } catch (err) {
      console.error('Error toggling auto trade', err);
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
    const found = activeAssets.find(a => a.id === e.target.value);
    if (found) {
      setSelectedAsset(found);
      localStorage.setItem('selectedAssetId', found.id);
    }
  };

  const handleCategoryChange = (category) => {
    setAssetCategory(category);
    localStorage.setItem('assetCategory', category);
    
    // Switch to the first asset in the new category
    const newAssets = category === 'Equity' ? EQUITY_ASSETS : COMMODITY_ASSETS;
    setSelectedAsset(newAssets[0]);
    localStorage.setItem('selectedAssetId', newAssets[0].id);
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

  const isAdmin = username === 'admin' || username === 'ssgobind12@gmail.com';

  return (
    <div className="app-container">
      {/* Top Toolbar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', fontWeight: 600 }}>
            <Activity size={20} color={isSimulatorMode ? "#f23645" : "var(--accent-color)"} />
            <span>Trading Algo UI</span>
            {isSimulatorMode && (
              <span style={{ backgroundColor: '#f23645', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                SIMULATOR
              </span>
            )}
          </div>
          
          <div className="toolbar-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hello, {username}</span>
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-muted)', borderRadius: '4px', padding: '4px 8px', fontSize: '12px', cursor: 'pointer' }}>Logout</button>
          <div className="toolbar-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          
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
        </div>
        
        <div className="top-bar-right">
          <div style={{ display: 'flex', gap: '4px', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px', borderRadius: '6px' }}>
            <button 
              onClick={() => handleCategoryChange('Equity')}
              style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: assetCategory === 'Equity' ? 'var(--accent-color)' : 'transparent', color: assetCategory === 'Equity' ? 'white' : 'var(--text-muted)' }}
            >
              Equity
            </button>
            <button 
              onClick={() => handleCategoryChange('Commodity')}
              style={{ padding: '4px 12px', fontSize: '12px', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: assetCategory === 'Commodity' ? 'var(--accent-color)' : 'transparent', color: assetCategory === 'Commodity' ? 'white' : 'var(--text-muted)' }}
            >
              Commodity
            </button>
          </div>
          
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
            {activeAssets.map(asset => (
              <option key={asset.id} value={asset.id} style={{ backgroundColor: 'var(--panel-bg)' }}>
                {asset.name}
              </option>
            ))}
          </select>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedAsset.exchange}</span>
          
          <div className="toolbar-divider" style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />
          
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

          <div style={{ display: 'flex', gap: '16px', color: 'var(--text-muted)', marginLeft: '8px' }}>
            <Layout size={20} style={{ cursor: 'pointer' }} title="Layout Settings" onClick={() => { setSettingsTab('layout'); setIsSettingsOpen(true); }} />
            <Settings size={20} style={{ cursor: 'pointer' }} title="Chart Settings" onClick={() => { setSettingsTab('chart'); setIsSettingsOpen(true); }} />
            <Maximize2 size={20} style={{ cursor: 'pointer' }} title="Toggle Fullscreen" onClick={toggleFullScreen} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        
        {/* Drawing Toolbar (Sidebar) */}
        {layoutSettings.showLeftToolbar && (
          <div className="left-toolbar">
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
            
            <div className="toolbar-divider" style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
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
            
            <div className="toolbar-divider" style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
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
            
            <div className="toolbar-divider" style={{ width: '24px', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
            
            <button 
              onClick={() => {
                setActiveTool(null);
                setClearTrigger(prev => prev + 1);
              }} 
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 'auto' }}
              title="Wipe ALL Drawings"
            >
              <Trash2 size={20} />
            </button>
          </div>
        )}

        {/* Chart Area with Timeframe Toolbar */}
        <div className="chart-container">
          <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
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
        {layoutSettings.showRightSidebar && (
          <div className="right-sidebar-container">
            <RightSidebar asset={selectedAsset} />
          </div>
        )}
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
               {isAdmin && (
                 <button 
                    onClick={() => setSettingsTab('admin')}
                    style={{ flex: 1, padding: '8px', backgroundColor: settingsTab === 'admin' ? '#10b981' : 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer' }}
                 >
                   Admin Panel
                 </button>
               )}
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
                  
                  <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)', margin: '8px 0' }} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: 'white' }}>🤖 AI Auto-Trading</span>
                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: autoTradeEnabled ? '#10b981' : 'var(--text-muted)' }}>{autoTradeEnabled ? 'ACTIVE' : 'OFF'}</span>
                        <input type="checkbox" checked={autoTradeEnabled} onChange={(e) => toggleAutoTrade(e.target.checked)} style={{ transform: 'scale(1.2)' }} />
                      </label>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>When active, the AI engine will automatically place Buy/Sell orders using your broker API keys based on real-time market signals. Check your portfolio for a summary of executed trades.</span>
                  </div>
                </div>
            )}
            
            {settingsTab === 'admin' && isAdmin && (
                <AdminPanel username={username} />
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
