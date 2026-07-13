import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

const MarketInsights = ({ symbol }) => {
  const [fiiDii, setFiiDii] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchInsights = async () => {
      // Only set loading to true on the very first fetch
      if (!fiiDii && !news) setLoading(true);
      try {
        const [fiiRes, newsRes] = await Promise.all([
          fetch('/api/fii-dii').then(res => res.json()).catch(() => null),
          fetch(`/api/news-sentiment?symbol=${symbol}`).then(res => res.json()).catch(() => null)
        ]);
        
        if (isMounted) {
          if (fiiRes && !fiiRes.error) setFiiDii(fiiRes);
          // If fiiRes has an error, keep the old data or it will be handled by the backend's new fallback
          if (newsRes) setNews(newsRes);
        }
      } catch (err) {
        console.error("Error fetching insights:", err);
      }
      if (isMounted) setLoading(false);
    };

    fetchInsights();
    
    // Auto-refresh every 60 seconds
    const intervalId = setInterval(fetchInsights, 60000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [symbol]);

  const getFiiDiiSentiment = () => {
    if (!fiiDii) return 'Neutral';
    if (fiiDii.fii_net > 0 && fiiDii.dii_net > 0) return 'Strong Bullish';
    if (fiiDii.fii_net > 0 || (fiiDii.fii_net + fiiDii.dii_net > 0)) return 'Bullish';
    if (fiiDii.fii_net < 0 && fiiDii.dii_net < 0) return 'Strong Bearish';
    return 'Bearish';
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#12141c', border: '1px solid #1f2937', borderRadius: '12px', padding: '16px' }}>
        <div style={{ height: '24px', backgroundColor: '#1f2937', borderRadius: '4px', width: '33%', marginBottom: '16px' }}></div>
        <div style={{ height: '80px', backgroundColor: '#1f2937', borderRadius: '4px', marginBottom: '16px' }}></div>
      </div>
    );
  }

  const fiiDiiSentiment = getFiiDiiSentiment();
  const newsSentiment = news?.sentiment || 'Neutral';
  
  let suggestion = 'Hold';
  let color = '#ec4899'; // pink
  let Icon = Minus;

  if (fiiDiiSentiment.includes('Bullish') && newsSentiment === 'Bullish') {
    suggestion = 'Strong Buy';
    color = '#22c55e'; // green
    Icon = TrendingUp;
  } else if (fiiDiiSentiment.includes('Bullish') || newsSentiment === 'Bullish') {
    suggestion = 'Buy';
    color = '#22c55e';
    Icon = TrendingUp;
  } else if (fiiDiiSentiment.includes('Bearish') && newsSentiment === 'Bearish') {
    suggestion = 'Strong Sell';
    color = '#ef4444'; // red
    Icon = TrendingDown;
  } else if (fiiDiiSentiment.includes('Bearish') || newsSentiment === 'Bearish') {
    suggestion = 'Sell';
    color = '#ef4444';
    Icon = TrendingDown;
  }

  return (
    <div style={{ 
      backgroundColor: 'rgba(18, 20, 28, 0.8)', 
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(31, 41, 55, 0.5)', 
      borderRadius: '16px', 
      padding: '24px', 
      boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'white', margin: 0 }}>Market Insights</h2>
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', 
          borderRadius: '9999px', backgroundColor: 'rgba(31, 41, 55, 0.5)', 
          border: '1px solid rgba(55, 65, 81, 0.5)', color: color
        }}>
          <Icon size={16} />
          <span style={{ fontWeight: 'bold', fontSize: '14px', textTransform: 'uppercase' }}>{suggestion}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* FII / DII Data */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Institutional Flow</h3>
            {fiiDii?.date && <span style={{ fontSize: '12px', backgroundColor: '#1f2937', padding: '2px 8px', borderRadius: '6px', border: '1px solid #374151' }}>({fiiDii.date})</span>}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ backgroundColor: '#0f1117', borderRadius: '12px', padding: '12px', border: '1px solid #1f2937' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '4px' }}>FII Net</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: fiiDii?.fii_net > 0 ? '#22c55e' : '#ef4444' }}>
                {fiiDii?.fii_net > 0 ? '+' : ''}{fiiDii?.fii_net || 0} <span style={{ fontSize: '12px', fontFamily: 'sans-serif', color: '#4b5563' }}>Cr</span>
              </div>
            </div>
            <div style={{ backgroundColor: '#0f1117', borderRadius: '12px', padding: '12px', border: '1px solid #1f2937' }}>
              <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', marginBottom: '4px' }}>DII Net</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace', color: fiiDii?.dii_net > 0 ? '#22c55e' : '#ef4444' }}>
                {fiiDii?.dii_net > 0 ? '+' : ''}{fiiDii?.dii_net || 0} <span style={{ fontSize: '12px', fontFamily: 'sans-serif', color: '#4b5563' }}>Cr</span>
              </div>
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', marginTop: '12px', color: '#6b7280', backgroundColor: 'rgba(17, 24, 39, 0.5)', padding: '8px', borderRadius: '8px', border: '1px solid #1f2937' }}>
            <span>Net Sentiment:</span>
            <span style={{ fontWeight: '600', color: fiiDiiSentiment.includes('Bullish') ? '#4ade80' : fiiDiiSentiment.includes('Bearish') ? '#f87171' : '#d1d5db' }}>{fiiDiiSentiment}</span>
          </div>
        </div>

        {/* News & Sentiment */}
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', marginBottom: '12px', margin: 0 }}>Latest News</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {news?.articles?.length > 0 ? (
              news.articles.map((article, i) => (
                <a key={i} href={article.link} target="_blank" rel="noreferrer" style={{ 
                  display: 'block', padding: '10px', borderRadius: '8px', 
                  backgroundColor: '#0f1117', border: '1px solid #1f2937',
                  textDecoration: 'none', transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <p style={{ 
                      fontSize: '12px', color: '#d1d5db', lineHeight: '1.5', 
                      margin: 0, display: '-webkit-box', WebkitLineClamp: 2, 
                      WebkitBoxOrient: 'vertical', overflow: 'hidden' 
                    }}>
                      {article.title || 'Unknown Title'}
                    </p>
                    <div style={{ 
                      width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '4px',
                      backgroundColor: article.score > 0 ? '#22c55e' : article.score < 0 ? '#ef4444' : '#6b7280',
                      boxShadow: article.score > 0 ? '0 0 8px rgba(34, 197, 94, 0.5)' : article.score < 0 ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none'
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', color: '#4b5563', marginTop: '6px', display: 'block' }}>
                    {article.publisher}
                  </span>
                </a>
              ))
            ) : (
              <div style={{ fontSize: '12px', color: '#6b7280', padding: '12px', backgroundColor: '#0f1117', borderRadius: '8px', border: '1px solid #1f2937', textAlign: 'center' }}>
                No recent news found for this asset.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketInsights;
