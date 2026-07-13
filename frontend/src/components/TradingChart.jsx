import React, { useEffect, useRef, useState } from 'react';
import klinecharts from 'klinecharts';
import { io } from 'socket.io-client';
import Draggable from 'react-draggable';
const { init, dispose } = klinecharts;

export default function TradingChart({ symbol, timeframe = '1D', clearTrigger, activeTool, manualSignal, chartSettings = {} }) {
  const chartContainerRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [zoneSignal, setZoneSignal] = useState(null);
  const [activeTrade, setActiveTrade] = useState(null);
  const [decayState, setDecayState] = useState(null);
  const [heroZeroAlert, setHeroZeroAlert] = useState(null);
  const pivotsRef = useRef(null);
  const lastAlertRef = useRef(null);
  const moodRef = useRef('Neutral');
  const latestPriceRef = useRef(null);

  const [panelPos, setPanelPos] = useState({ x: null, y: 16 });
  const [showChain, setShowChain] = useState(false);
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startLeft: 0, startTop: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragRef.current.isDragging) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        setPanelPos({
          x: dragRef.current.startLeft + dx,
          y: dragRef.current.startTop + dy
        });
      }
    };
    const handleMouseUp = () => {
      dragRef.current.isDragging = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Initialize and cleanup chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    
    console.log("Initializing KLineCharts...");
    try {
      const chart = init(container);
      console.log("Chart initialized:", chart);
      
      chart.setCustomApi({
        formatDate: (dateTimeFormat, timestamp, format, type) => {
          if (!timestamp) return '';
          const date = new Date(Number(timestamp));
          if (isNaN(date.getTime())) return '';
          
          const hh = date.getHours().toString().padStart(2, '0');
          const mm = date.getMinutes().toString().padStart(2, '0');
          const ss = date.getSeconds().toString().padStart(2, '0');
          
          if (type === 'crosshair') {
             const MM = (date.getMonth() + 1).toString().padStart(2, '0');
             const dd = date.getDate().toString().padStart(2, '0');
             return `${MM}-${dd} ${hh}:${mm}:${ss}`;
          }
          return `${hh}:${mm}:${ss}`;
        },
        formatPrice: (price) => {
          if (price === undefined || price === null) return '';
          return '₹' + Number(price).toFixed(2);
        }
      });
      
      chart.setStyles({
        layout: {
          backgroundColor: '#131722', // Deeper TradingView dark
          textColor: '#787b86',
        },
        grid: {
          show: true,
          horizontal: { color: '#2a2e39', size: 1, style: 'solid' },
          vertical: { color: '#2a2e39', size: 1, style: 'solid' },
        },
        candle: {
          type: 'candle_solid',
          bar: {
            upColor: '#089981',
            downColor: '#f23645',
            noChangeColor: '#888888',
            upBorderColor: '#089981',
            downBorderColor: '#f23645',
            noChangeBorderColor: '#888888',
            upWickColor: '#089981',
            downWickColor: '#f23645',
            noChangeWickColor: '#888888'
          }
        },
        watermark: {
          show: false
        }
      });
      chartInstanceRef.current = chart;
      
      // Auto-fit chart to screen size using ResizeObserver to prevent blurry CSS stretching
      const resizeObserver = new ResizeObserver(() => {
        if (chartInstanceRef.current) {
          chartInstanceRef.current.resize();
        }
      });
      
      resizeObserver.observe(container);
      
      // Clean up the observer and chart instance
      return () => {
        resizeObserver.disconnect();
        if (chartInstanceRef.current) {
          try {
            dispose(container);
          } catch (e) {
            console.error("Dispose error:", e);
          }
        }
      };
    } catch (err) {
      console.error("Error initializing chart:", err);
      setError(err.message);
    }
  }, []);

  // Fetch initial data and setup WebSockets
  useEffect(() => {
    let socket;
    
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`Fetching data for ${symbol} on ${timeframe}`);
        const response = await fetch(`/api/chart-data?symbol=${symbol}&timeframe=${timeframe}`);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${response.status} Error`);
        }
        
        const jsonResponse = await response.json();
        if (jsonResponse.error) throw new Error(jsonResponse.error);
        
        try {
          const moodResponse = await fetch(`/api/asset-details?symbol=${symbol}`);
          if (moodResponse.ok) {
            const moodData = await moodResponse.json();
            if (moodData.gauge) {
               moodRef.current = moodData.gauge;
            }
          }
        } catch (e) {
          console.warn("Could not fetch market mood", e);
        }
        
        const chartData = jsonResponse.data || jsonResponse;
        if (!Array.isArray(chartData)) throw new Error("Data from backend is not an array");

        const formattedData = chartData.map(d => ({
          timestamp: d.timestamp || new Date(d.time).getTime(),
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volume || 0,
        }));
        
        if (chartInstanceRef.current) {
          chartInstanceRef.current.removeOverlay();
          chartInstanceRef.current.applyNewData(formattedData);
          setLoading(false);
          
          if (jsonResponse.markers && jsonResponse.markers.length > 0) {
            const annotations = jsonResponse.markers.map(m => {
              const isBuy = m.shape === 'arrowUp';
              const bgColor = isBuy ? '#089981' : '#f23645';
              return {
                point: { timestamp: m.timestamp || new Date(m.time).getTime() },
                styles: {
                  position: m.position === 'belowBar' ? 'bottom' : 'top',
                  offset: [0, 0],
                  symbol: { 
                    type: 'none', // Remove the triangle
                  },
                  text: { 
                    color: '#ffffff',
                    size: 12,
                    family: 'Inter, sans-serif',
                    weight: 'bold',
                    paddingLeft: 6,
                    paddingRight: 6,
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 4,
                    backgroundColor: bgColor,
                    content: m.text 
                  }
                }
              };
            });
            try { chartInstanceRef.current.createAnnotation(annotations); } catch (e) {}
          }
          
          if (jsonResponse.pivots) {
            const p = jsonResponse.pivots;
            pivotsRef.current = p;
            
            const drawTarget = (val, label, color) => {
              try {
                // Calculate how many points up/down this line is from the daily pivot
                const diff = val - p.P;
                const sign = diff > 0 ? '+' : '';
                const diffText = val === p.P ? '' : ` (${sign}${diff.toFixed(0)} pts)`;
                const finalLabel = `${label} @ ${val.toFixed(0)}${diffText}`;
                
                chartInstanceRef.current.createOverlay({
                  name: 'horizontalStraightLine',
                  points: [{ value: val }],
                  lock: true,
                  styles: {
                    line: { color: color, size: 1, style: 'dashed' },
                    text: {
                      style: 'fill',
                      color: '#ffffff',
                      size: 11,
                      family: 'Inter, sans-serif',
                      weight: 'bold',
                      backgroundColor: color,
                      borderRadius: 4,
                      paddingLeft: 6,
                      paddingRight: 6,
                      paddingTop: 3,
                      paddingBottom: 3,
                      content: finalLabel
                    }
                  }
                });
              } catch (e) { console.error("Overlay error", e) }
            };
            drawTarget(p.R2, 'Target Up 2 (Max Resistance)', '#22c55e');
            drawTarget(p.R1, 'Target Up 1', '#16a34a');
            drawTarget(p.P, 'Daily Pivot', '#6b7280');
            drawTarget(p.S1, 'Optimal Expiry Bounce (Buy Zone 1)', '#f59e0b'); // Gold color
            drawTarget(p.S2, 'Deep Expiry Bounce (Buy Zone 2)', '#d97706'); // Darker gold
          }
          
          try {
            chartInstanceRef.current.createIndicator('MACD', false, { id: 'pane_1' });
            chartInstanceRef.current.createIndicator('RSI', false, { id: 'pane_2' });
          } catch(e) { console.error("Indicator error", e) }
        }
      } catch (err) {
        console.error("Fetch Data Error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();

    // Initialize WebSocket
    socket = io('/');
    console.log("Connecting to WebSocket");
    socket.on('connect', () => {
      console.log('Connected to Live Data Stream');
    });

      socket.on('live_price_update', (data) => {

        // Only update if the event matches the current selected asset
        if (data.symbol === symbol && chartInstanceRef.current) {
          const chart = chartInstanceRef.current;
          const dataList = chart.getDataList();
          if (dataList && dataList.length > 0) {
            const lastCandle = dataList[dataList.length - 1];
            
            // Add a tiny realistic micro-jitter so the chart actively ticks every second!
            let jitterMagnitude = 0;
            if (chartSettings.microJitter !== false) {
              if (symbol === 'SENSEX') jitterMagnitude = 4.0;
              else if (symbol === 'NIFTY' || symbol === 'BANKNIFTY') jitterMagnitude = 1.5;
              else jitterMagnitude = 0.02;
            }
            
            const microJitter = (Math.random() - 0.5) * jitterMagnitude;
          const newPrice = data.price + microJitter;
          latestPriceRef.current = newPrice;
          
          // Map timeframe to milliseconds
          const tfToMs = {
            '1m': 60 * 1000,
            '2m': 120 * 1000,
            '5m': 300 * 1000,
            '15m': 900 * 1000,
            '30m': 1800 * 1000,
            '1h': 3600 * 1000,
            '1D': 86400 * 1000,
            '1W': 604800 * 1000,
            '1M': 2592000 * 1000
          };
          const intervalMs = tfToMs[timeframe] || 60000;
          
          // Snap the live timestamp to the current interval block
          // This allows us to bypass Yahoo Finance's 10-15 minute delay and paint REAL TIME candles!
          const snappedTimestamp = Math.floor(data.timestamp / intervalMs) * intervalMs;
          
          if (snappedTimestamp === lastCandle.timestamp) {
            // Update the current active candle
            chart.updateData({
              ...lastCandle,
              close: newPrice,
              high: Math.max(lastCandle.high, newPrice),
              low: Math.min(lastCandle.low, newPrice)
            });
          } else if (snappedTimestamp > lastCandle.timestamp) {
            // Time has rolled over to a new candle block (or we are jumping the 15m delay gap)
            // Append a brand new real-time candle!
            chart.updateData({
              timestamp: snappedTimestamp,
              open: lastCandle.close, // open at previous close
              high: Math.max(lastCandle.close, newPrice),
              low: Math.min(lastCandle.close, newPrice),
              close: newPrice,
              volume: 0
            });
          }
          

          // --- OPTIONS DECAY CALCULATOR (DELTA SIMULATED) ---
          let interval = 100;
          if (symbol === 'NIFTY') interval = 50;
          if (symbol === 'CRUDEOIL') interval = 10;
          
          const atm = Math.round(newPrice / interval) * interval;
          
          const ceBudget = atm + (interval * 2);
          const peBudget = atm - (interval * 2);
          
          const ceHero = atm + (interval * 4);
          const peHero = atm - (interval * 4);
          
          const ceExtreme = atm + (interval * 6);
          const peExtreme = atm - (interval * 6);
          
          let baseAtmEx = atm * 0.0027; // ~208 for ATM
          let baseOtmEx = atm * 0.0012; // ~92 for OTM
          let baseHeroEx = atm * 0.0005; // ~38 for Far OTM
          
          let moodExtremeMulti = 0.00005; // Extremely cheap base (~₹3.8)
          
          // --- SENSEX EXPIRY DAY (0 DTE) THETA CRUSH ---
          if (symbol === 'SENSEX') {
             baseAtmEx = atm * 0.0008;   // ~₹61 for ATM
             baseOtmEx = atm * 0.0003;   // ~₹23 for OTM
             baseHeroEx = atm * 0.0001;  // ~₹7.7 for Deep OTM
             moodExtremeMulti = 0.00002; // ~₹1.5 for Extreme Hero Zero
          }

          if (moodRef.current === 'Strong Buy' || moodRef.current === 'Strong Sell') {
             moodExtremeMulti = moodExtremeMulti * 2.0; // Double the extreme price during massive IV spikes
          }
          const baseExtremeEx = atm * moodExtremeMulti;
          
          // Simulated Delta tracking (Price ticks naturally with Spot movement!)
          const ceAtm = Math.max(0.1, baseAtmEx + (newPrice - atm) * 0.5);
          const peAtm = Math.max(0.1, baseAtmEx - (newPrice - atm) * 0.5);
          
          const ceOtm = Math.max(0.1, baseOtmEx + (newPrice - atm) * 0.3);
          const peOtm = Math.max(0.1, baseOtmEx - (newPrice - atm) * 0.3);
          
          const ceHeroP = Math.max(0.1, baseHeroEx + (newPrice - atm) * 0.15);
          const peHeroP = Math.max(0.1, baseHeroEx - (newPrice - atm) * 0.15);
          
          const ceExtremeP = Math.max(0.1, baseExtremeEx + (newPrice - atm) * 0.05);
          const peExtremeP = Math.max(0.1, baseExtremeEx - (newPrice - atm) * 0.05);
          
          let chain = [];
          for(let i = -3; i <= 3; i++) {
             const strike = atm + (i * interval);
             const ceIntrinsic = Math.max(0, newPrice - strike);
             const peIntrinsic = Math.max(0, strike - newPrice);
             const dist = Math.abs(strike - atm) / interval;
             
             let extrinsic = 0;
             if (dist === 0) extrinsic = baseAtmEx;
             else if (dist === 1) extrinsic = atm * 0.0018;
             else if (dist === 2) extrinsic = baseOtmEx;
             else if (dist === 3) extrinsic = atm * 0.0008;
             else extrinsic = baseHeroEx;

             chain.push({
                strike,
                cePrice: (ceIntrinsic + extrinsic).toFixed(1),
                pePrice: (peIntrinsic + extrinsic).toFixed(1)
             });
          }
          
          setDecayState({
             atmStrike: atm,
             ceBudget: ceBudget,
             peBudget: peBudget,
             ceHero: ceHero,
             peHero: peHero,
             
             ceAtmPrice: ceAtm.toFixed(1),
             ceAtmSL: (ceAtm * 0.75).toFixed(1),
             ceAtmTarget: (ceAtm * 1.50).toFixed(1),
             
             peAtmPrice: peAtm.toFixed(1),
             peAtmSL: (peAtm * 0.75).toFixed(1),
             peAtmTarget: (peAtm * 1.50).toFixed(1),
             
             ceOtmPrice: ceOtm.toFixed(1),
             ceOtmSL: (ceOtm * 0.65).toFixed(1),
             ceOtmTarget: (ceOtm * 1.80).toFixed(1),
             
             peOtmPrice: peOtm.toFixed(1),
             peOtmSL: (peOtm * 0.65).toFixed(1),
             peOtmTarget: (peOtm * 1.80).toFixed(1),
             
             ceHeroPrice: ceHeroP.toFixed(1),
             ceHeroSL: (ceHeroP * 0.50).toFixed(1),
             ceHeroTarget: (ceHeroP * 3.00).toFixed(1),
             
             peHeroPrice: peHeroP.toFixed(1),
             peHeroSL: (peHeroP * 0.50).toFixed(1),
             peHeroTarget: (peHeroP * 3.00).toFixed(1),
             
             ceExtreme: ceExtreme,
             peExtreme: peExtreme,
             
             ceExtremePrice: ceExtremeP.toFixed(1),
             ceExtremeSL: (ceExtremeP * 0.30).toFixed(1),
             ceExtremeTarget: (ceExtremeP * 4.00).toFixed(1),
             
             peExtremePrice: peExtremeP.toFixed(1),
             peExtremeSL: (peExtremeP * 0.30).toFixed(1),
             peExtremeTarget: (peExtremeP * 4.00).toFixed(1),
             
             chain: chain
          });
          
          // --- LIVE FLASH ALERTS ---
          if (pivotsRef.current) {
             const p = pivotsRef.current;
             // Give a 0.05% margin of error for the zone to trigger
             if (newPrice <= p.S1 * 1.0005) {
                 setZoneSignal({ text: `🔥 BUY NOW: ${atm} CE @ ₹${ceAtm.toFixed(1)} (Support Hit)`, color: '#f59e0b', buyTarget: p.S2, sellTarget: p.P });
             } else if (newPrice >= p.R1 * 0.9995) {
                 setZoneSignal({ text: `⚠️ SELL NOW: ${atm} PE @ ₹${peAtm.toFixed(1)} (Resistance Hit)`, color: '#ef4444', buyTarget: p.P, sellTarget: p.R2 });
             } else if (newPrice >= p.P) {
                 setZoneSignal({ text: `🔥 BUY NOW (BULLISH): ${atm} CE @ ₹${ceAtm.toFixed(1)}`, color: '#089981', buyTarget: p.P, sellTarget: p.R1 });
              } else {
                 setZoneSignal({ text: `⚠️ SELL NOW (BEARISH): ${atm} PE @ ₹${peAtm.toFixed(1)}`, color: '#f23645', buyTarget: p.S1, sellTarget: p.P });
             }
          }
          
          // --- HERO ZERO ALERTS (AI SUGGESTION) ---
          const playBeep = () => {
             if (chartSettings.audioAlerts === false) return;
             try {
               const AudioContext = window.AudioContext || window.webkitAudioContext;
               const ctx = new AudioContext();
               const osc = ctx.createOscillator();
               const gain = ctx.createGain();
               osc.connect(gain);
               gain.connect(ctx.destination);
               osc.type = 'sine';
               osc.frequency.setValueAtTime(800, ctx.currentTime); // High pitch beep
               gain.gain.setValueAtTime(0.1, ctx.currentTime);
               osc.start();
               osc.stop(ctx.currentTime + 0.3); // 300ms duration
             } catch(e) {}
          };

          // Removed synthetic alert logic
        }
      }
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [symbol, timeframe]);

  // Poll for Advanced AI Options Signals
  useEffect(() => {
    let intervalId;
    
    const fetchSignal = async () => {
      if (!latestPriceRef.current) return; // Need a price to calculate
      
      try {
        const res = await fetch(`/api/advanced-signals?symbol=${symbol}&price=${latestPriceRef.current}`);
        if (res.ok) {
          const signal = await res.json();
          if (signal && signal.isActive) {
             setHeroZeroAlert(signal);
             
             // Play sound if a new alert just triggered
             if (lastAlertRef.current !== signal.type) {
                lastAlertRef.current = signal.type;
                try {
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  const ctx = new AudioContext();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.type = 'sine';
                  osc.frequency.setValueAtTime(800, ctx.currentTime);
                  gain.gain.setValueAtTime(0.1, ctx.currentTime);
                  osc.start();
                  osc.stop(ctx.currentTime + 0.3);
                } catch(e) {}
             }
          } else {
             setHeroZeroAlert(null);
             lastAlertRef.current = null;
          }
        }
      } catch (err) {
        console.error("Error fetching advanced signal:", err);
      }
    };

    intervalId = setInterval(fetchSignal, 5000);
    return () => clearInterval(intervalId);
  }, [symbol]);

  // Handle Clear Trigger
  useEffect(() => {
    if (clearTrigger > 0) {
      if (chartInstanceRef.current) chartInstanceRef.current.removeOverlay();
      setActiveTrade(null);
    }
  }, [clearTrigger]);

  // Handle Drawing Tool Activation
  useEffect(() => {
    if (activeTool && chartInstanceRef.current) {
      try {
        chartInstanceRef.current.createOverlay(activeTool);
      } catch (e) {
        console.error("Error creating overlay", e);
      }
    }
  }, [activeTool]);

  // Handle Chart Settings (Indicators)
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    const chart = chartInstanceRef.current;
    
    try {
      if (chartSettings.ema) {
        chart.createIndicator({
          name: 'EMA',
          calcParams: [9, 21, 50],
          styles: {
            lines: [
              { color: '#FFD700', size: 2 }, // Golden (Buy)
              { color: '#FF0000', size: 2 }, // Red (Sell)
              { color: '#FFC0CB', size: 2 }  // Pink (Hold)
            ]
          }
        }, false, { id: 'candle_pane' });
      } else {
        chart.removeIndicator('candle_pane', 'EMA');
      }
      
      if (chartSettings.volume) chart.createIndicator('VOL', false, { id: 'pane_vol', height: 100 });
      else chart.removeIndicator('pane_vol');
      
      if (chartSettings.macd) chart.createIndicator('MACD', false, { id: 'pane_macd', height: 100 });
      else chart.removeIndicator('pane_macd');
    } catch (err) {
      console.warn("Error updating indicators", err);
    }
  }, [chartSettings, loading]);

  // Handle Manual Trade Entry Signal
  useEffect(() => {
    if (manualSignal && chartInstanceRef.current) {
      const chart = chartInstanceRef.current;
      const dataList = chart.getDataList();
      if (dataList && dataList.length > 0) {
        const lastCandle = dataList[dataList.length - 1];
        const isBuy = manualSignal.type === 'Buy';
        const lineColor = isBuy ? '#089981' : '#f23645';
        const label = isBuy ? 'MY BUY ENTRY' : 'MY SELL ENTRY';
        
        try {
          chart.createOverlay({
            name: 'horizontalStraightLine',
            points: [{ value: lastCandle.close }],
            lock: true,
            styles: {
              line: { color: lineColor, size: 2, style: 'solid' },
              text: {
                style: 'fill',
                color: '#ffffff',
                size: 12,
                family: 'Inter, sans-serif',
                weight: 'bold',
                backgroundColor: lineColor,
                borderRadius: 4,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 4,
                paddingBottom: 4,
                content: `${label} @ ${lastCandle.close.toFixed(2)}`
              }
            }
          });
          setActiveTrade({ type: isBuy ? 'BUY' : 'SELL', price: lastCandle.close, color: lineColor });
        } catch (e) {
          console.error("Error creating manual overlay", e);
        }
      }
    }
  }, [manualSignal]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: '#0f172a', color: 'white' }}>
      {loading && !error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-muted)', zIndex: 10 }}>
          Loading {symbol}...
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--down-color)', zIndex: 10 }}>
          Error: {error}
        </div>
      )}
      <div 
        ref={chartContainerRef} 
        style={{ width: '100%', height: '100%', visibility: loading ? 'hidden' : 'visible' }} 
      />
      {zoneSignal && !activeTrade && (
        <Draggable bounds="parent">
          <div style={{
            position: 'absolute',
            top: '16px',
            left: 'calc(50% - 150px)',
            backgroundColor: zoneSignal.color,
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '12px',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 100,
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'grab',
            whiteSpace: 'nowrap'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <div>{zoneSignal.text}</div>
              {zoneSignal.buyTarget && zoneSignal.sellTarget && (
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', opacity: 0.95, backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  <span>Buy Suggestion: <b>{zoneSignal.buyTarget.toFixed(2)}</b></span>
                  <span>|</span>
                  <span>Sell Suggestion: <b>{zoneSignal.sellTarget.toFixed(2)}</b></span>
                </div>
              )}
            </div>
          </div>
        </Draggable>
      )}
      {activeTrade && (
        <Draggable bounds="parent">
          <div style={{
            position: 'absolute',
            top: '16px',
            left: 'calc(50% - 150px)',
            backgroundColor: activeTrade.color,
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '12px',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            zIndex: 100,
            border: '1px solid rgba(255,255,255,0.3)',
            cursor: 'grab',
            whiteSpace: 'nowrap'
          }}>
            {activeTrade.type === 'BUY' ? '🟢' : '🔴'} ACTIVE POSITION: {activeTrade.type} @ {activeTrade.price.toFixed(2)}
          </div>
        </Draggable>
      )}
      
      {heroZeroAlert && (
        <Draggable bounds="parent">
          <div style={{
            position: 'absolute',
            top: activeTrade ? '70px' : zoneSignal ? '70px' : '16px',
            left: 'calc(50% - 160px)',
            backgroundColor: heroZeroAlert.type === 'BUY' ? '#f5a623' : '#f23645',
            padding: '8px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 100,
            cursor: 'grab',
            minWidth: '320px',
            animation: 'pulse 1.5s infinite'
          }}>
            <div style={{ textAlign: 'center', color: '#fff', fontWeight: 'bold', fontSize: '13px', marginBottom: '6px', textTransform: 'uppercase' }}>
               🔥 {heroZeroAlert.type} NOW: {heroZeroAlert.contract} @ ₹{heroZeroAlert.estPrice} ({heroZeroAlert.reason})
            </div>
            <div style={{ 
                backgroundColor: heroZeroAlert.type === 'BUY' ? '#c6841b' : '#b91c1c', 
                borderRadius: '4px', 
                padding: '4px 8px', 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                color: '#fff', 
                fontSize: '11px', 
                fontWeight: 'bold' 
            }}>
               <span>Buy Suggestion: {heroZeroAlert.buySuggestion}</span>
               <span style={{ margin: '0 8px' }}>|</span>
               <span>Sell Suggestion: {heroZeroAlert.sellSuggestion}</span>
            </div>
          </div>
        </Draggable>
      )}
      
      {decayState && (
        <div style={{
          position: 'absolute',
          top: `${panelPos.y}px`,
          left: panelPos.x !== null ? `${panelPos.x}px` : 'auto',
          right: panelPos.x === null ? '16px' : 'auto',
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #334155',
          borderRadius: '8px',
          color: 'white',
          zIndex: 100,
          boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
          minWidth: showChain ? '320px' : '260px'
        }}>
          {/* Draggable Header */}
          <div 
            onMouseDown={(e) => {
              const el = e.currentTarget.parentElement;
              dragRef.current = {
                isDragging: true,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: el.offsetLeft,
                startTop: el.offsetTop
              };
            }}
            style={{ 
              padding: '12px', 
              cursor: 'grab', 
              borderBottom: '1px solid #334155',
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
              ⏳ {showChain ? 'LIVE OPTION CHAIN' : 'PREMIUM DECAY LOGIC'}
            </div>
            <button 
              onClick={() => setShowChain(!showChain)}
              style={{ background: 'transparent', border: '1px solid #475569', color: '#cbd5e1', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', cursor: 'pointer' }}
            >
              {showChain ? 'Hide Chain' : 'Full Chain'}
            </button>
          </div>
          
          <div style={{ padding: '12px' }}>
            {showChain ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                <thead>
                  <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155' }}>
                    <th style={{ paddingBottom: '6px' }}>CALL (CE)</th>
                    <th style={{ paddingBottom: '6px' }}>STRIKE</th>
                    <th style={{ paddingBottom: '6px' }}>PUT (PE)</th>
                  </tr>
                </thead>
                <tbody>
                  {decayState.chain.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(51, 65, 85, 0.5)', backgroundColor: row.strike === decayState.atmStrike ? 'rgba(51, 65, 85, 0.3)' : 'transparent' }}>
                      <td style={{ padding: '6px 0', color: row.strike < decayState.atmStrike ? '#089981' : '#94a3b8', fontWeight: row.strike < decayState.atmStrike ? 'bold' : 'normal' }}>₹{row.cePrice}</td>
                      <td style={{ padding: '6px 0', fontWeight: 'bold', color: row.strike === decayState.atmStrike ? 'white' : '#cbd5e1' }}>{row.strike}</td>
                      <td style={{ padding: '6px 0', color: row.strike > decayState.atmStrike ? '#f23645' : '#94a3b8', fontWeight: row.strike > decayState.atmStrike ? 'bold' : 'normal' }}>₹{row.pePrice}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ borderLeft: '3px solid #089981', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>STANDARD BUY (ATM)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#089981' }}>{decayState.atmStrike} CE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#089981' }}>₹{decayState.ceAtmPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.ceAtmSL} | TGT: ₹{decayState.ceAtmTarget}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f23645' }}>{decayState.atmStrike} PE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#f23645' }}>₹{decayState.peAtmPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.peAtmSL} | TGT: ₹{decayState.peAtmTarget}</div>
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>LOW BUDGET BUY (OTM)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#3b82f6' }}>{decayState.ceBudget} CE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#3b82f6' }}>₹{decayState.ceOtmPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.ceOtmSL} | TGT: ₹{decayState.ceOtmTarget}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f23645' }}>{decayState.peBudget} PE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#f23645' }}>₹{decayState.peOtmPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.peOtmSL} | TGT: ₹{decayState.peOtmTarget}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ borderLeft: '3px solid #a855f7', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>HERO ZERO BUY (Deep OTM)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#a855f7' }}>{decayState.ceHero} CE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#a855f7' }}>₹{decayState.ceHeroPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.ceHeroSL} | TGT: ₹{decayState.ceHeroTarget}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f23645' }}>{decayState.peHero} PE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#f23645' }}>₹{decayState.peHeroPrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.peHeroSL} | TGT: ₹{decayState.peHeroTarget}</div>
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '8px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>EXTREME HERO ZERO (Out of Money)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f59e0b' }}>{decayState.ceExtreme} CE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#f59e0b' }}>₹{decayState.ceExtremePrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.ceExtremeSL} | TGT: ₹{decayState.ceExtremeTarget}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f23645' }}>{decayState.peExtreme} PE</div>
                      <div style={{ fontSize: '11px', color: 'white', marginTop: '2px' }}>Est: <b style={{ color: '#f23645' }}>₹{decayState.peExtremePrice}</b></div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>SL: ₹{decayState.peExtremeSL} | TGT: ₹{decayState.peExtremeTarget}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
