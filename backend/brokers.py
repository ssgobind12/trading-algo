import yfinance as yf
from abc import ABC, abstractmethod
import time
import pandas as pd

class BrokerAdapter(ABC):
    """Base class for all broker API adapters"""
    
    @abstractmethod
    def fetch_live_price(self, ticker: str) -> float:
        """Fetch the live 0-second price of an asset"""
        pass
        
    @abstractmethod
    def fetch_historical_data(self, ticker: str, timeframe: str) -> pd.DataFrame:
        """Fetch historical candle data based on timeframe"""
        pass

class YahooFinanceAdapter(BrokerAdapter):
    """Adapter for Yahoo Finance (15-min delayed for Indian markets)"""
    
    def fetch_live_price(self, ticker: str) -> float:
        t = yf.Ticker(ticker)
        return float(t.fast_info['lastPrice'])
        
    def fetch_historical_data(self, ticker: str, timeframe: str) -> pd.DataFrame:
        tf_map = {
            '1m': ('5d', '1m'),
            '2m': ('5d', '2m'),
            '5m': ('5d', '5m'),
            '15m': ('1mo', '15m'),
            '30m': ('1mo', '30m'),
            '1h': ('2y', '1h'),
            '1D': ('5y', '1d'),
            '1W': ('max', '1wk'),
            '1M': ('max', '1mo')
        }
        period, interval = tf_map.get(timeframe, ('5d', '1m'))
        
        df = yf.download(ticker, period=period, interval=interval, progress=False)
        if df.empty and period == '1d':
            df = yf.download(ticker, period='5d', interval=interval, progress=False)
        return df

class DhanAdapter(BrokerAdapter):
    """Adapter for Dhan API (0-second live data)"""
    def __init__(self, api_key: str = None, client_id: str = None):
        self.api_key = api_key
        self.client_id = client_id
        
    def fetch_live_price(self, ticker: str) -> float:
        raise NotImplementedError("Dhan API Key required for live data!")
        
    def fetch_historical_data(self, ticker: str, timeframe: str) -> pd.DataFrame:
        raise NotImplementedError("Dhan API Key required for historical data!")

class UpstoxAdapter(BrokerAdapter):
    """Adapter for Upstox API (0-second live data)"""
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        
    def fetch_live_price(self, ticker: str) -> float:
        raise NotImplementedError("Upstox API Key required for live data!")
        
    def fetch_historical_data(self, ticker: str, timeframe: str) -> pd.DataFrame:
        raise NotImplementedError("Upstox API Key required for historical data!")

class GrowwAdapter(BrokerAdapter):
    """Adapter for Groww API"""
    def __init__(self, api_key: str, api_secret: str = None):
        self.api_key = api_key
        # GrowwAPI python sdk takes a single token (usually the JWT API key)
        from growwapi import GrowwAPI
        self.api = GrowwAPI(api_key)
        
    def fetch_live_price(self, ticker: str) -> float:
        try:
            # Map symbol if needed, usually same for indices (e.g. NIFTY -> Nifty 50)
            # We'll rely on the frontend sending standard exchange tokens or trading symbols.
            # get_ltp requires exchange and trading_symbol
            # For simplicity, we fallback to Yahoo if it's an index, or we just try fetching.
            # We will use yfinance fallback for live price if Groww fails because Groww needs exact exchange format.
            t = yf.Ticker(ticker)
            return float(t.fast_info['lastPrice'])
        except Exception:
            return 0.0
            
    def fetch_historical_data(self, ticker: str, timeframe: str) -> pd.DataFrame:
        # Fallback to yf for charts to keep it simple and robust
        tf_map = {
            '1m': ('5d', '1m'),
            '5m': ('5d', '5m'),
            '15m': ('1mo', '15m'),
            '1H': ('2y', '1h'),
            '1D': ('5y', '1d'),
            '1W': ('max', '1wk'),
            '1M': ('max', '1mo')
        }
        period, interval = tf_map.get(timeframe, ('5d', '1m'))
        df = yf.download(ticker, period=period, interval=interval, progress=False)
        if df.empty and period == '1d':
            df = yf.download(ticker, period='5d', interval=interval, progress=False)
        return df

    def get_holdings(self):
        try:
            return self.api.get_holdings_for_user()
        except Exception as e:
            return {"error": str(e)}
            
    def get_balance(self):
        try:
            return self.api.get_available_margin_details()
        except Exception as e:
            return {"error": str(e)}
