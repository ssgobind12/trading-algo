import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

const MarketInsights = ({ symbol }) => {
  const [fiiDii, setFiiDii] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoading(true);
      try {
        const [fiiRes, newsRes] = await Promise.all([
          fetch('/api/fii-dii').then(res => res.json()).catch(() => null),
          fetch(`/api/news-sentiment?symbol=${symbol}`).then(res => res.json()).catch(() => null)
        ]);
        
        setFiiDii(fiiRes);
        setNews(newsRes);
      } catch (err) {
        console.error("Error fetching insights:", err);
      }
      setLoading(false);
    };

    fetchInsights();
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
      <div className="bg-[#12141c] border border-gray-800 rounded-xl p-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-1/3 mb-4"></div>
        <div className="h-20 bg-gray-800 rounded mb-4"></div>
      </div>
    );
  }

  const fiiDiiSentiment = getFiiDiiSentiment();
  const newsSentiment = news?.sentiment || 'Neutral';
  
  // Calculate Overall Suggestion
  let suggestion = 'Hold';
  let color = 'text-pink-500';
  let Icon = Minus;

  if (fiiDiiSentiment.includes('Bullish') && newsSentiment === 'Bullish') {
    suggestion = 'Strong Buy';
    color = 'text-green-500';
    Icon = TrendingUp;
  } else if (fiiDiiSentiment.includes('Bullish') || newsSentiment === 'Bullish') {
    suggestion = 'Buy';
    color = 'text-green-500';
    Icon = TrendingUp;
  } else if (fiiDiiSentiment.includes('Bearish') && newsSentiment === 'Bearish') {
    suggestion = 'Strong Sell';
    color = 'text-red-500';
    Icon = TrendingDown;
  } else if (fiiDiiSentiment.includes('Bearish') || newsSentiment === 'Bearish') {
    suggestion = 'Sell';
    color = 'text-red-500';
    Icon = TrendingDown;
  }

  return (
    <div className="bg-[#12141c]/80 backdrop-blur-md border border-gray-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-gray-700/50 transition-all duration-300">
      
      {/* Background Glow */}
      <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none transition-colors duration-500 ${suggestion.includes('Buy') ? 'bg-green-500' : suggestion.includes('Sell') ? 'bg-red-500' : 'bg-pink-500'}`}></div>

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Market Insights</h2>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800/50 border border-gray-700/50 shadow-inner ${color}`}>
          <Icon size={16} className="drop-shadow-md" />
          <span className="font-bold text-sm tracking-wide uppercase">{suggestion}</span>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* FII / DII Data */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-gray-400 mb-1">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Institutional Flow</h3>
            {fiiDii?.date && <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-md border border-gray-700">({fiiDii.date})</span>}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0f1117] rounded-xl p-3 border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="text-xs text-gray-500 font-medium mb-1">FII Net</div>
              <div className={`text-lg font-bold font-mono ${fiiDii?.fii_net > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fiiDii?.fii_net > 0 ? '+' : ''}{fiiDii?.fii_net || 0} <span className="text-xs font-sans text-gray-600">Cr</span>
              </div>
            </div>
            <div className="bg-[#0f1117] rounded-xl p-3 border border-gray-800 hover:border-gray-700 transition-colors">
              <div className="text-xs text-gray-500 font-medium mb-1">DII Net</div>
              <div className={`text-lg font-bold font-mono ${fiiDii?.dii_net > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {fiiDii?.dii_net > 0 ? '+' : ''}{fiiDii?.dii_net || 0} <span className="text-xs font-sans text-gray-600">Cr</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between items-center text-xs mt-2 text-gray-500 bg-gray-900/50 p-2 rounded-lg border border-gray-800">
            <span>Net Sentiment:</span>
            <span className={`font-semibold ${fiiDiiSentiment.includes('Bullish') ? 'text-green-400' : fiiDiiSentiment.includes('Bearish') ? 'text-red-400' : 'text-gray-300'}`}>{fiiDiiSentiment}</span>
          </div>
        </div>

        {/* News & Sentiment */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-1">Latest News</h3>
          
          <div className="space-y-2">
            {news?.articles?.length > 0 ? (
              news.articles.map((article, i) => (
                <a key={i} href={article.link} target="_blank" rel="noreferrer" className="block p-2.5 rounded-lg bg-[#0f1117] border border-gray-800 hover:border-gray-700 hover:bg-[#151821] transition-all group">
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed group-hover:text-blue-400 transition-colors">{article.title}</p>
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 shadow-glow ${article.score > 0 ? 'bg-green-500 shadow-green-500/50' : article.score < 0 ? 'bg-red-500 shadow-red-500/50' : 'bg-gray-500'}`} />
                  </div>
                  <span className="text-[10px] text-gray-600 mt-1 block">{article.publisher}</span>
                </a>
              ))
            ) : (
              <div className="text-xs text-gray-500 p-3 bg-[#0f1117] rounded-lg border border-gray-800 text-center">
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
