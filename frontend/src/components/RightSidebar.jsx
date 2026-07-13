import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import MarketInsights from './MarketInsights';

export default function RightSidebar({ asset }) {
  const [data, setData] = useState(null);
  const [newsData, setNewsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('asset'); // 'asset' or 'portfolio'
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioError, setPortfolioError] = useState('');
  const [priceBlink, setPriceBlink] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/asset-details?symbol=${asset.id}`);
        const json = await res.json();
        setData(json);
        
        const newsRes = await fetch(`/api/news-sentiment?symbol=${asset.id}`);
        const newsJson = await newsRes.json();
        setNewsData(newsJson);
        
        // Fetch Portfolio if user is logged in
        const storedUsername = localStorage.getItem('auth_username');
        if (storedUsername) {
          const portRes = await fetch(`/api/portfolio?username=${storedUsername}`);
          if (portRes.ok) {
            const portJson = await portRes.json();
            setPortfolio(portJson);
          } else {
            const err = await portRes.json();
            setPortfolioError(err.error || 'Failed to load portfolio');
          }
        } else {
          setPortfolioError('Please login and connect Broker keys in settings.');
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
      }
      setLoading(false);
    };

    fetchDetails();

    // Connect to WebSocket for live price updates
    const socket = io('/');
    
    socket.on('live_price_update', (update) => {
      if (update.symbol === asset.id) {
        setData(prevData => {
          if (!prevData) return prevData;
          if (prevData.currentPrice !== update.price) {
            setPriceBlink(true);
            setTimeout(() => setPriceBlink(false), 300);
          }
          return {
            ...prevData,
            currentPrice: update.price,
            pointChange: update.price - prevData.dayLow, // Very rough approximation since we don't have open here easily
          };
        });
      }
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [asset]);

  if (loading || !data) {
    return (
      <div style={{ width: '340px', minWidth: '340px', borderLeft: '1px solid var(--border-color)', backgroundColor: 'var(--panel-bg)', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>Loading Details...</span>
      </div>
    );
  }

  const formatPrice = (val) => val.toFixed(2);
  const isPositive = data.pointChange >= 0;
  const color = isPositive ? 'var(--up-color)' : 'var(--down-color)';
  
  // Progress bar calculation
  const calculateProgress = (current, min, max) => {
    if (current <= min) return 0;
    if (current >= max) return 100;
    return ((current - min) / (max - min)) * 100;
  };
  
  const dayProgress = calculateProgress(data.currentPrice, data.dayLow, data.dayHigh);
  const yearProgress = calculateProgress(data.currentPrice, data.fiftyTwoWeekLow, data.fiftyTwoWeekHigh);

  const PerfBox = ({ label, value }) => {
    const valColor = value >= 0 ? 'var(--up-color)' : 'var(--down-color)';
    return (
      <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', textAlign: 'center' }}>
        <div style={{ color: valColor, fontSize: '13px', fontWeight: 'bold' }}>
          {value >= 0 ? '+' : ''}{value.toFixed(2)}%
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>{label}</div>
      </div>
    );
  };

  return (
    <div className="right-sidebar-panel">
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <div 
          onClick={() => setActiveTab('asset')}
          style={{ flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: activeTab === 'asset' ? 'var(--accent-color)' : 'var(--text-muted)', borderBottom: activeTab === 'asset' ? '2px solid var(--accent-color)' : '2px solid transparent' }}
        >
          Asset Info
        </div>
        <div 
          onClick={() => setActiveTab('portfolio')}
          style={{ flex: 1, padding: '12px', textAlign: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', color: activeTab === 'portfolio' ? 'var(--accent-color)' : 'var(--text-muted)', borderBottom: activeTab === 'portfolio' ? '2px solid var(--accent-color)' : '2px solid transparent' }}
        >
          My Portfolio
        </div>
      </div>
      
      {activeTab === 'portfolio' && (
        <div style={{ padding: '20px 16px' }}>
          {portfolioError ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>
              {portfolioError}
              <br/><br/>
              To view your live Groww portfolio, open Settings (⚙️), go to Brokerages, and securely enter your API keys.
            </div>
          ) : portfolio ? (
            <div>
              <div style={{ marginBottom: '24px', padding: '16px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Available Balance</div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  ₹{portfolio.balance?.balance ? parseFloat(portfolio.balance.balance).toFixed(2) : '0.00'}
                </div>
              </div>
              
              <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '12px', color: 'var(--text-main)' }}>My Holdings</div>
              {portfolio.holdings && portfolio.holdings.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {portfolio.holdings.map((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)' }}>{h.trading_symbol || h.company_name || 'Unknown'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qty: {h.quantity} | Avg: ₹{h.average_price}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--text-main)' }}>₹{h.last_price || '0.00'}</div>
                        <div style={{ fontSize: '11px', color: (h.last_price > h.average_price) ? 'var(--up-color)' : 'var(--down-color)' }}>
                           {h.last_price > h.average_price ? '+' : ''}{(((h.last_price - h.average_price) / h.average_price) * 100).toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No holdings found.</div>
              )}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>Loading Portfolio...</div>
          )}
        </div>
      )}

      {activeTab === 'asset' && (
        <>
          {/* Header section */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold' }}>
            {asset.id.substring(0,2)}
          </div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-main)' }}>{asset.name}</div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', marginLeft: '32px' }}>{asset.exchange}</div>
        
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-main)', letterSpacing: '-1px' }}>{formatPrice(data.currentPrice)}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{asset.currency || 'INR'}</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', color: color, fontWeight: 'bold', fontSize: '14px' }}>
          <span>{isPositive ? '+' : ''}{formatPrice(data.pointChange)}</span>
          <span>({isPositive ? '+' : ''}{data.pctChange.toFixed(2)}%)</span>
        </div>
      </div>

      {/* Ranges */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            <span>{formatPrice(data.dayLow)}</span>
            <span>DAY'S RANGE</span>
            <span>{formatPrice(data.dayHigh)}</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${dayProgress}%`, backgroundColor: 'var(--accent-color)', borderRadius: '2px' }} />
            <div style={{ position: 'absolute', left: `${dayProgress}%`, top: '-4px', width: '0', height: '0', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '4px solid white', transform: 'translateX(-50%)' }} />
          </div>
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600 }}>
            <span>{formatPrice(data.fiftyTwoWeekLow)}</span>
            <span>52WK RANGE</span>
            <span>{formatPrice(data.fiftyTwoWeekHigh)}</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${yearProgress}%`, backgroundColor: 'var(--accent-color)', borderRadius: '2px' }} />
            <div style={{ position: 'absolute', left: `${yearProgress}%`, top: '-4px', width: '0', height: '0', borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '4px solid white', transform: 'translateX(-50%)' }} />
          </div>
        </div>
      </div>
      
      {/* Market Insights Widget */}
      <div style={{ padding: '16px' }}>
         <MarketInsights symbol={asset.id} />
      </div>

      {/* Options Momentum Recommendation */}
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '16px' }}>Suggested Options Strikes</div>
        
        {(() => {
          let interval = 100;
          if (asset.id === 'NIFTY') interval = 50;
          if (asset.id === 'CRUDEOIL') interval = 10;
          
          const price = data.currentPrice;
          const atm = Math.round(price / interval) * interval;
          
          // ATM = Standard Price
          const callStrikeATM = atm;
          const putStrikeATM = atm;
          
          // OTM = Low Price (3 intervals away)
          const callStrikeOTM = atm + (interval * 3);
          const putStrikeOTM = atm - (interval * 3);
          
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               
               {/* CALL OPTIONS */}
               <div>
                 <div style={{ color: '#089981', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#089981' }}></div>
                   BUY CALL (CE) TARGETS
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {/* Standard Option */}
                   <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 'bold' }}>{callStrikeATM} CE</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Standard Premium (ATM)</div>
                     </div>
                   </div>
                   
                   {/* Low Price Option */}
                   <div style={{ backgroundColor: 'rgba(8, 153, 129, 0.1)', border: '1px dashed #089981', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ color: '#089981', fontSize: '15px', fontWeight: 'bold' }}>{callStrikeOTM} CE</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Low Price / Budget Option (OTM)</div>
                     </div>
                     <div style={{ fontSize: '10px', backgroundColor: '#089981', color: 'white', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold' }}>SUGGESTED</div>
                   </div>
                 </div>
               </div>
               
               {/* PUT OPTIONS */}
               <div>
                 <div style={{ color: '#f23645', fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f23645' }}></div>
                   BUY PUT (PE) TARGETS
                 </div>
                 
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {/* Standard Option */}
                   <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ color: 'var(--text-main)', fontSize: '15px', fontWeight: 'bold' }}>{putStrikeATM} PE</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Standard Premium (ATM)</div>
                     </div>
                   </div>
                   
                   {/* Low Price Option */}
                   <div style={{ backgroundColor: 'rgba(242, 54, 69, 0.1)', border: '1px dashed #f23645', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                       <div style={{ color: '#f23645', fontSize: '15px', fontWeight: 'bold' }}>{putStrikeOTM} PE</div>
                       <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Low Price / Budget Option (OTM)</div>
                     </div>
                     <div style={{ fontSize: '10px', backgroundColor: '#f23645', color: 'white', padding: '3px 6px', borderRadius: '4px', fontWeight: 'bold' }}>SUGGESTED</div>
                   </div>
                 </div>
               </div>

            </div>
          );
        })()}
      </div>
      </>
      )}
    </div>
  );
}
