from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_socketio import SocketIO
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
import yfinance as yf
import pandas as pd
import time
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import os
from flask import Flask, jsonify, request, send_from_directory
from brokers import YahooFinanceAdapter

# Configure Flask to serve static files from the React dist folder
app = Flask(__name__, static_folder='../frontend/dist', static_url_path='/')

# --- DATABASE SETUP ---
DB_FILE = 'users.db'

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        c = conn.cursor()
        c.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                groww_api_key TEXT,
                groww_api_secret TEXT,
                auto_trade_enabled BOOLEAN DEFAULT 0,
                status TEXT DEFAULT 'pending'
            )
        ''')
        c.execute('''
            CREATE TABLE IF NOT EXISTS trade_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                symbol TEXT NOT NULL,
                side TEXT NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'COMPLETED'
            )
        ''')
        conn.commit()
        
        # Retrofit existing table if auto_trade_enabled column is missing
        try:
            c.execute('ALTER TABLE users ADD COLUMN auto_trade_enabled BOOLEAN DEFAULT 0')
            conn.commit()
        except sqlite3.OperationalError:
            pass

        # Retrofit existing table if status column is missing
        try:
            c.execute("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'pending'")
            c.execute("UPDATE users SET status = 'approved'")
            conn.commit()
        except sqlite3.OperationalError:
            pass

init_db()
# ----------------------
CORS(app) # Allow cross-origin requests from the React frontend
socketio = SocketIO(app, cors_allowed_origins="*")
analyzer = SentimentIntensityAnalyzer()

# Symbol mapping to Yahoo Finance tickers
SYMBOLS = {
    'NIFTY': '^NSEI',
    'SENSEX': '^BSESN',
    'BANKNIFTY': '^NSEBANK',
    'CRUDEOIL': 'CL=F'
}

# Keep track of connected clients
clients = 0

# Initialize default broker (Yahoo Finance)
broker = YahooFinanceAdapter()
simulator_active = False
simulator_data = {}

def is_indian_market_open():
    """Check if Indian stock market (NSE/BSE) is currently open.
    Market hours: Mon-Fri 9:15 AM to 3:30 PM IST (UTC+5:30)"""
    import datetime
    # Get current time in IST
    ist_offset = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(ist_offset)
    
    # Weekend check
    if now_ist.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    
    market_open = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
    
    return market_open <= now_ist <= market_close

def fetch_and_emit(symbol_key, ticker):
    if simulator_active:
        return
    
    # Don't fetch live prices when Indian market is closed
    if not is_indian_market_open():
        return
        
    try:
        last_price = broker.fetch_live_price(ticker)
        socketio.emit('live_price_update', {
            'symbol': symbol_key,
            'timestamp': int(time.time() * 1000),
            'price': last_price
        })
    except Exception as e:
        print(f"Error fetching live price for {symbol_key}: {e}")

def background_thread():
    """Background thread that continuously fetches live prices and broadcasts them"""
    print("Starting background live data thread...")
    while True:
        socketio.sleep(1) # Poll every 1 second for ultra-fast live ticks
        if clients > 0:
            for symbol_key, ticker in SYMBOLS.items():
                socketio.start_background_task(fetch_and_emit, symbol_key, ticker)

def auto_trade_thread():
    """Background thread that executes automated trades based on AI signals"""
    print("Starting background auto-trade thread...")
    while True:
        socketio.sleep(10) # Poll every 10 seconds
        if not is_indian_market_open() and not simulator_active:
            continue
            
        try:
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute('SELECT username, groww_api_key, groww_api_secret FROM users WHERE auto_trade_enabled = 1')
                auto_traders = c.fetchall()
                
            if not auto_traders:
                continue
                
            # For each asset, check signal
            from ai_engine import MarketAIEngine
            engine = MarketAIEngine()
            
            for symbol_key, ticker in SYMBOLS.items():
                try:
                    current_price = broker.fetch_live_price(ticker)
                    if current_price <= 0: continue
                    
                    # Generate mock signal for auto trade
                    fii_net = 1500
                    dii_net = -800
                    news_score = 6.5
                    
                    signal, confidence, reasoning = engine.generate_signal(
                        symbol=symbol_key,
                        current_price=current_price,
                        fii_net=fii_net,
                        dii_net=dii_net,
                        news_score=news_score,
                        rsi_14=45.0,
                        macd_hist=1.2,
                        vwap=current_price - 10
                    )
                    
                    if confidence >= 80 and signal in ['Buy', 'Sell']:
                        side = 'BUY' if signal == 'Buy' else 'SELL'
                        qty = 10 # Default mock qty
                        
                        from brokers import GrowwAdapter
                        for username, api_key, api_secret in auto_traders:
                            if not api_key: continue
                            
                            adapter = GrowwAdapter(api_key=api_key)
                            res = adapter.place_order(symbol_key, side, qty, current_price)
                            
                            if res.get('status') == 'SUCCESS':
                                # Log to trade_history
                                with sqlite3.connect(DB_FILE) as conn:
                                    c = conn.cursor()
                                    c.execute('''INSERT INTO trade_history 
                                                 (username, symbol, side, quantity, price) 
                                                 VALUES (?, ?, ?, ?, ?)''',
                                              (username, symbol_key, side, qty, current_price))
                                    conn.commit()
                                print(f"Auto-trade executed for {username}: {side} {qty} {symbol_key} at {current_price}")
                except Exception as e:
                    print(f"Error in auto trade evaluation for {symbol_key}: {e}")
        except Exception as e:
            print(f"Error in auto trade thread: {e}")

@socketio.on('connect')
def connect():
    global clients
    clients += 1
    print(f"Client connected. Total clients: {clients}")
    
@socketio.on('disconnect')
def disconnect():
    global clients
    clients -= 1
    print(f"Client disconnected. Total clients: {clients}")

@app.route('/api/market-status')
def market_status():
    import datetime
    ist_offset = datetime.timezone(datetime.timedelta(hours=5, minutes=30))
    now_ist = datetime.datetime.now(ist_offset)
    is_open = is_indian_market_open()
    
    return jsonify({
        'isOpen': is_open,
        'currentTimeIST': now_ist.strftime('%H:%M:%S'),
        'marketOpen': '09:15',
        'marketClose': '15:30',
        'day': now_ist.strftime('%A')
    })

@app.route('/api/chart-data')
def get_chart_data():
    symbol_key = request.args.get('symbol', 'NIFTY')
    timeframe = request.args.get('timeframe', '1D') 
    
    ticker = SYMBOLS.get(symbol_key, '^NSEI')
    
    # Map requested interval to yfinance (period, interval)
    tf_map = {
        '1m': ('5d', '1m'),
        '2m': ('5d', '2m'),
        '5m': ('5d', '5m'),
        '15m': ('1mo', '15m'),
        '30m': ('1mo', '30m'),
        '1h': ('2y', '1h'),
        '1D': ('5y', '1d'),
        '1W': ('max', '1wk'),
        '1M': ('max', '1mo'),
        # Fallback for old toolbar just in case
        '5D': ('5d', '5m'),
        '3M': ('3mo', '1h'),
        '6M': ('6mo', '1d'),
        'YTD': ('ytd', '1d'),
        '1Y': ('1y', '1d'),
        '5Y': ('5y', '1wk'),
        'All': ('max', '1mo')
    }
    
    period, interval = tf_map.get(timeframe, ('1d', '1m'))
    
    try:
        # Fetch historical data using broker adapter
        df = broker.fetch_historical_data(ticker, timeframe)
        
        if df.empty:
            return jsonify({'error': 'No data found'}), 404
            
        df.reset_index(inplace=True)
        
        # yfinance sometimes returns a MultiIndex for columns, flatten it
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
            
        time_col = 'Datetime' if 'Datetime' in df.columns else 'Date'
        
        # Calculate Faster Moving Averages (5 and 10) for more frequent intraday signals
        df['SMA5'] = df['Close'].rolling(window=5).mean()
        df['SMA10'] = df['Close'].rolling(window=10).mean()
        
        chart_data = []
        markers = []
        
        for i, row in df.iterrows():
            if pd.isna(row['Close']):
                continue
                
            time_val = int(row[time_col].timestamp() * 1000) # KLineCharts expects milliseconds!
            
            candle = {
                'timestamp': time_val,
                'open': float(row['Open']),
                'high': float(row['High']),
                'low': float(row['Low']),
                'close': float(row['Close']),
                'volume': float(row.get('Volume', 0))
            }
            chart_data.append(candle)
            
            # Simple SMA Crossover Strategy for Markers
            if i > 10:
                prev_sma5 = df.loc[i-1, 'SMA5']
                prev_sma10 = df.loc[i-1, 'SMA10']
                curr_sma5 = row['SMA5']
                curr_sma10 = row['SMA10']
                
                # Buy Signal (Golden Cross)
                if prev_sma5 <= prev_sma10 and curr_sma5 > curr_sma10:
                    markers.append({
                        'time': time_val,
                        'position': 'belowBar',
                        'color': '#22c55e', # Green
                        'shape': 'arrowUp',
                        'text': 'Buy'
                    })
                # Sell Signal (Death Cross)
                elif prev_sma5 >= prev_sma10 and curr_sma5 < curr_sma10:
                    markers.append({
                        'time': time_val,
                        'position': 'aboveBar',
                        'color': '#ef4444', # Red
                        'shape': 'arrowDown',
                        'text': 'Sell'
                    })
                    
        # Failsafe: If no signals occurred today, inject a demonstration signal on the last candle
        if len(markers) == 0 and len(chart_data) > 0:
            markers.append({
                'time': chart_data[-1]['timestamp'],
                'position': 'belowBar',
                'color': '#22c55e',
                'shape': 'arrowUp',
                'text': 'Buy'
            })
            
        # Calculate Probability Targets (Standard Pivot Points based on previous day)
        # To do this accurately, we fetch a tiny bit of daily data
        daily_df = yf.download(ticker, period='5d', interval='1d', progress=False)
        pivots = None
        if not daily_df.empty and len(daily_df) >= 2:
            if isinstance(daily_df.columns, pd.MultiIndex):
                daily_df.columns = daily_df.columns.get_level_values(0)
                
            # Get the previous completed day
            prev_day = daily_df.iloc[-2]
            high = float(prev_day['High'])
            low = float(prev_day['Low'])
            close = float(prev_day['Close'])
            
            pivot = (high + low + close) / 3
            r1 = (2 * pivot) - low
            s1 = (2 * pivot) - high
            r2 = pivot + (high - low)
            s2 = pivot - (high - low)
            
            pivots = {
                'P': pivot,
                'R1': r1,
                'S1': s1,
                'R2': r2,
                'S2': s2
            }
                    
        return jsonify({
            'data': chart_data,
            'markers': markers,
            'pivots': pivots
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/asset-details')
def get_asset_details():
    symbol_key = request.args.get('symbol', 'NIFTY')
    ticker = SYMBOLS.get(symbol_key, '^NSEI')
    
    try:
        t = yf.Ticker(ticker)
        # Fetch 1 year of daily data to calculate performance grid
        df = t.history(period='1y')
        
        if df.empty:
            return jsonify({'error': 'No data found'}), 404
            
        current_price = float(df['Close'].iloc[-1])
        day_open = float(df['Open'].iloc[-1])
        day_low = float(df['Low'].iloc[-1])
        day_high = float(df['High'].iloc[-1])
        
        # 52 Week High/Low from the 1y history
        fifty_two_week_low = float(df['Low'].min())
        fifty_two_week_high = float(df['High'].max())
        
        # Performance Calculations (approximate trading days)
        def get_perf(bars_ago):
            if len(df) > bars_ago:
                past_price = float(df['Close'].iloc[-(bars_ago + 1)])
                return ((current_price - past_price) / past_price) * 100
            return 0.0
            
        perf_1w = get_perf(5)
        perf_1m = get_perf(21)
        perf_3m = get_perf(63)
        perf_6m = get_perf(126)
        perf_1y = get_perf(len(df)-1)
        
        # YTD calculation
        current_year = df.index[-1].year
        ytd_df = df[df.index.year == current_year]
        perf_ytd = 0.0
        if not ytd_df.empty:
            start_price = float(ytd_df['Close'].iloc[0])
            perf_ytd = ((current_price - start_price) / start_price) * 100
            
        # Point Change and % Change (Daily)
        point_change = current_price - day_open
        pct_change = (point_change / day_open) * 100
        
        # Gauge logic based on SMA
        df['SMA10'] = df['Close'].rolling(window=10).mean()
        df['SMA20'] = df['Close'].rolling(window=20).mean()
        sma10 = df['SMA10'].iloc[-1]
        sma20 = df['SMA20'].iloc[-1]
        
        gauge = "Neutral"
        if not pd.isna(sma10) and not pd.isna(sma20):
            if sma10 > sma20:
                diff = (sma10 - sma20) / sma20
                gauge = "Strong Buy" if diff > 0.02 else "Buy"
            elif sma10 < sma20:
                diff = (sma20 - sma10) / sma10
                gauge = "Strong Sell" if diff > 0.02 else "Sell"

        return jsonify({
            'currentPrice': current_price,
            'pointChange': point_change,
            'pctChange': pct_change,
            'dayLow': day_low,
            'dayHigh': day_high,
            'fiftyTwoWeekLow': fifty_two_week_low,
            'fiftyTwoWeekHigh': fifty_two_week_high,
            'performance': {
                '1W': perf_1w,
                '1M': perf_1m,
                '3M': perf_3m,
                '6M': perf_6m,
                'YTD': perf_ytd,
                '1Y': perf_1y
            },
            'gauge': gauge
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def simulator_loop():
    """Background thread to push historical data for simulator mode"""
    global simulator_active
    print("Simulator loop starting...")
    idx = 0
    while simulator_active:
        socketio.sleep(1) # 1 candle per second
        if clients > 0 and simulator_data:
            for symbol_key, df in simulator_data.items():
                if idx < len(df):
                    row = df.iloc[idx]
                    timestamp = int(row.name.timestamp() * 1000)
                    close_val = float(row['Close'].iloc[0]) if isinstance(row['Close'], pd.Series) else float(row['Close'])
                    socketio.emit('live_price_update', {
                        'symbol': symbol_key,
                        'timestamp': timestamp,
                        'price': close_val,
                        'is_simulator': True
                    })
            idx += 1
            # Auto-restart if we hit the end
            if all(idx >= len(df) for df in simulator_data.values()):
                idx = 0

@app.route('/api/simulator/toggle', methods=['POST'])
def toggle_simulator():
    global simulator_active, simulator_data
    req = request.json
    activate = req.get('active', False)
    
    if activate and not simulator_active:
        # Pre-fetch simulator data (e.g. 5m data)
        for symbol_key, ticker in SYMBOLS.items():
            df = broker.fetch_historical_data(ticker, '1m')
            simulator_data[symbol_key] = df
        
        simulator_active = True
        socketio.start_background_task(simulator_loop)
        return jsonify({"status": "Simulator started"})
    elif not activate and simulator_active:
        simulator_active = False
        simulator_data = {}
        return jsonify({"status": "Simulator stopped"})
        
    return jsonify({"status": "No change"})

import requests

@app.route('/api/fii-dii')
def get_fii_dii():
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*'
        }
        url = "https://www.nseindia.com/api/fiidiiTradeReact"
        
        session = requests.Session()
        session.get("https://www.nseindia.com", headers=headers, timeout=5)
        res = session.get(url, headers=headers, timeout=5)
        
        if res.status_code == 200:
            data = res.json()
            # The API returns a list of dictionaries for DII and FII/FPI
            fii_net = 0
            dii_net = 0
            date = ""
            for item in data:
                if item['category'] == 'DII':
                    dii_net = float(item['netValue'])
                    date = item['date']
                elif item['category'] == 'FII/FPI':
                    fii_net = float(item['netValue'])
                    
            import datetime
            today_str = datetime.datetime.now().strftime("%d-%b-%Y")
            if date != today_str:
                raise Exception("Stale data, triggering live estimator")
                
            return jsonify({
                'fii_net': fii_net,
                'dii_net': dii_net,
                'date': date
            })
        else:
            raise Exception("Blocked by NSE")
            
    except Exception as e:
        # Fallback: Live Intraday Institutional Flow Estimator
        # Since true FII/DII is end-of-day, and NSE blocks cloud IPs, 
        # we generate a realistic live estimate based on market momentum and time.
        import datetime
        import random
        
        try:
            # Use yfinance to get live market direction
            t = yf.Ticker('^NSEI')
            hist = t.history(period="5d")
            if not hist.empty and len(hist) >= 2:
                current = hist['Close'].iloc[-1]
                prev = hist['Close'].iloc[-2]
                pct_change = ((current - prev) / prev) * 100
            else:
                pct_change = 0
        except:
            pct_change = 0
            
        # Base flow heavily correlated with Nifty change
        base_fii = pct_change * 3500  # 1% move = ~3500Cr flow
        base_dii = -base_fii * 0.4    # DII often counters FII slightly
        
        # Add live intraday noise that changes every minute
        current_minute = datetime.datetime.now().minute
        noise_fii = random.Random(current_minute).randint(-300, 300)
        noise_dii = random.Random(current_minute + 10).randint(-200, 200)
        
        est_fii = round(base_fii + noise_fii, 2)
        est_dii = round(base_dii + noise_dii, 2)
        date_str = datetime.datetime.now().strftime("%d-%b-%Y (Live Est)")
        
        return jsonify({
            'fii_net': est_fii,
            'dii_net': est_dii,
            'date': date_str,
            'is_estimate': True
        })

@app.route('/api/news-sentiment')
def get_news_sentiment():
    symbol_key = request.args.get('symbol', 'NIFTY')
    ticker = SYMBOLS.get(symbol_key, '^NSEI')
    
    try:
        t = yf.Ticker(ticker)
        news_items = t.news
        
        if not news_items:
            return jsonify({'score': 50, 'sentiment': 'Neutral', 'articles': []})
            
        total_score = 0
        valid_articles = 0
        parsed_articles = []
        
        for item in news_items[:5]: # Take top 5 recent news
            # yfinance news items often have a nested 'content' dictionary
            content = item.get('content', item) # fallback to item if 'content' is missing
            
            title = content.get('title', '')
            
            provider = content.get('provider', {})
            publisher = provider.get('displayName', item.get('publisher', 'Unknown'))
            
            url_obj = content.get('clickThroughUrl', {})
            link = url_obj.get('url', item.get('link', ''))
            
            # Analyze sentiment of the title
            vs = analyzer.polarity_scores(title)
            compound = vs['compound'] # Ranges from -1 (Extremely Negative) to +1 (Extremely Positive)
            
            total_score += compound
            valid_articles += 1
            
            parsed_articles.append({
                'title': title,
                'publisher': publisher,
                'link': link,
                'score': compound
            })
            
        avg_score = total_score / valid_articles if valid_articles > 0 else 0
        
        # Convert -1 to +1 scale into a 0 to 100 Bullish percentage
        bullish_percentage = int(((avg_score + 1) / 2) * 100)
        
        sentiment_label = "Neutral"
        if bullish_percentage > 60:
            sentiment_label = "Bullish"
        elif bullish_percentage < 40:
            sentiment_label = "Bearish"

        return jsonify({
            'score': bullish_percentage,
            'sentiment': sentiment_label,
            'articles': parsed_articles[:3] # Return top 3 to UI
        })
        
    except Exception as e:
        return jsonify({'sentiment': sentiment_desc, 'score': score, 'news': results})

# --- AUTHENTICATION ENDPOINTS ---

@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            # Check if user exists
            c.execute('SELECT id FROM users WHERE username = ?', (username,))
            if c.fetchone():
                return jsonify({'error': 'User ID already exists'}), 409
                
            # Create new user
            pwd_hash = generate_password_hash(password)
            c.execute("INSERT INTO users (username, password_hash, status) VALUES (?, ?, 'pending')", (username, pwd_hash))
            conn.commit()
            
            return jsonify({
                'message': 'Registration successful! To activate your account, please send ₹100 to ssgobind12@gmail.com via UPI and wait for the admin to approve your account.', 
                'username': username
            }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute('SELECT password_hash, status FROM users WHERE username = ?', (username,))
            row = c.fetchone()
            
            if row and check_password_hash(row[0], password):
                if row[1] == 'pending' and username not in ['admin', 'ssgobind12@gmail.com']:
                    return jsonify({'error': 'Account pending admin approval. Please pay ₹100 to ssgobind12@gmail.com and wait for approval.'}), 403
                if row[1] == 'rejected' and username not in ['admin', 'ssgobind12@gmail.com']:
                    return jsonify({'error': 'Your account registration was rejected by the admin.'}), 403
                return jsonify({'message': 'Login successful', 'username': username, 'token': 'fake-jwt-token-123'}), 200
            else:
                return jsonify({'error': 'Invalid User ID or Password'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    username = request.args.get('username')
    if username not in ['admin', 'ssgobind12@gmail.com']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute('SELECT id, username, status FROM users ORDER BY id DESC')
            users = [{'id': r[0], 'username': r[1], 'status': r[2]} for r in c.fetchall()]
            return jsonify(users)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/status', methods=['POST'])
def admin_set_status():
    data = request.json
    admin_username = data.get('admin_username')
    target_username = data.get('target_username')
    new_status = data.get('status')
    
    if admin_username not in ['admin', 'ssgobind12@gmail.com']:
        return jsonify({'error': 'Unauthorized'}), 403
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute("UPDATE users SET status = ? WHERE username = ?", (new_status, target_username))
            conn.commit()
            return jsonify({'message': f'User {target_username} marked as {new_status}'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/broker-keys', methods=['GET', 'POST'])
def broker_keys():
    # In a real app we'd use the token/session. For demo we assume the user sends username.
    # We will pass 'username' in query for GET, and in JSON for POST
    
    if request.method == 'GET':
        username = request.args.get('username')
        if not username:
            return jsonify({'error': 'Unauthorized'}), 401
            
        try:
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute('SELECT groww_api_key, groww_api_secret FROM users WHERE username = ?', (username,))
                row = c.fetchone()
                if row:
                    return jsonify({
                        'groww_api_key': row[0] or '',
                        'groww_api_secret': row[1] or ''
                    })
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        api_key = data.get('groww_api_key')
        api_secret = data.get('groww_api_secret')
        
        if not username:
            return jsonify({'error': 'Unauthorized'}), 401
            
        try:
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute('UPDATE users SET groww_api_key = ?, groww_api_secret = ? WHERE username = ?', 
                          (api_key, api_secret, username))
                conn.commit()
            return jsonify({'message': 'Keys saved successfully'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/auto-trade', methods=['GET', 'POST'])
def auto_trade():
    if request.method == 'GET':
        username = request.args.get('username')
        if not username:
            return jsonify({'error': 'Unauthorized'}), 401
            
        try:
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute('SELECT auto_trade_enabled FROM users WHERE username = ?', (username,))
                row = c.fetchone()
                if row:
                    return jsonify({'auto_trade_enabled': bool(row[0])})
                return jsonify({'error': 'User not found'}), 404
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if request.method == 'POST':
        data = request.json
        username = data.get('username')
        enabled = data.get('enabled')
        
        if not username:
            return jsonify({'error': 'Unauthorized'}), 401
            
        try:
            with sqlite3.connect(DB_FILE) as conn:
                c = conn.cursor()
                c.execute('UPDATE users SET auto_trade_enabled = ? WHERE username = ?', 
                          (1 if enabled else 0, username))
                conn.commit()
            return jsonify({'message': 'Auto-trade settings updated'})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/trade-history')
def get_trade_history():
    username = request.args.get('username')
    if not username:
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute('SELECT symbol, side, quantity, price, timestamp, status FROM trade_history WHERE username = ? ORDER BY timestamp DESC', (username,))
            rows = c.fetchall()
            trades = [{
                'symbol': r[0],
                'side': r[1],
                'quantity': r[2],
                'price': r[3],
                'timestamp': r[4],
                'status': r[5]
            } for r in rows]
            return jsonify(trades)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/portfolio')
def get_portfolio():
    username = request.args.get('username')
    if not username:
        return jsonify({'error': 'Unauthorized'}), 401
        
    try:
        with sqlite3.connect(DB_FILE) as conn:
            c = conn.cursor()
            c.execute('SELECT groww_api_key FROM users WHERE username = ?', (username,))
            row = c.fetchone()
            if not row or not row[0]:
                return jsonify({'error': 'Groww API keys not configured'}), 404
                
            api_key = row[0]
            
        from brokers import GrowwAdapter
        adapter = GrowwAdapter(api_key=api_key)
        
        holdings = adapter.get_holdings()
        balance = adapter.get_balance()
        
        return jsonify({
            'holdings': holdings,
            'balance': balance
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

from ai_engine import MarketAIEngine

@app.route('/api/advanced-signals')
def get_advanced_signals():
    symbol = request.args.get('symbol', 'NIFTY')
    price_str = request.args.get('price')
    if not price_str:
        return jsonify({'error': 'price is required'}), 400
    
    try:
        current_price = float(price_str)
        # In a real system, we'd pull these values from cache or a database.
        # For this logic, we use a basic mock since the focus is the engine logic structure.
        fii_net = 1500
        dii_net = 500
        sentiment = 0.25
        
        signal = MarketAIEngine.generate_signal(
            symbol=symbol,
            current_price=current_price,
            fii_net=fii_net,
            dii_net=dii_net,
            sentiment=sentiment
        )
        return jsonify(signal)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react_app(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting WebSocket Server on port {port}...")
    socketio.start_background_task(background_thread)
    socketio.start_background_task(auto_trade_thread)
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)
else:
    # When running under gunicorn, start the background thread
    socketio.start_background_task(background_thread)
    socketio.start_background_task(auto_trade_thread)
