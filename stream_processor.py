import asyncio
import websockets
import json
import pandas as pd
from greeks import BlackScholesCalculator
from signal_engine import SignalEngine
import datetime

async def process_stream():
    uri = "ws://localhost:8765"
    print(f"Connecting to Data Stream at {uri}...")
    
    # Initialize Signal Engine
    engine = SignalEngine(velocity_window=10, delta_velocity_threshold=0.01, iv_velocity_threshold=0.001)
    
    # Store rolling history
    history = []
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected! Listening for live option ticks...\n")
            print(f"{'TIME':<12} | {'SPOT':<8} | {'OPT':<6} | {'IV':<8} | {'DELTA':<8} | {'SIGNAL'}")
            print("-" * 65)
            
            while True:
                message = await websocket.recv()
                tick = json.loads(message)
                
                spot_price = tick['spot_price']
                option_price = tick['option_price']
                strike = tick['strike']
                
                # Assume 30 days to expiry and 5% risk free rate for the simulation
                T = 30.0 / 365.0
                r = 0.05
                
                # 1. Reverse Engineer IV
                iv = BlackScholesCalculator.implied_volatility(
                    target_price=option_price,
                    option_type='call',
                    S=spot_price,
                    K=strike,
                    T=T,
                    r=r
                )
                
                # 2. Calculate Greeks based on real-time IV
                calc = BlackScholesCalculator(S=spot_price, K=strike, T=T, r=r, sigma=iv)
                delta = calc.delta('call')
                
                # 3. Store in History
                timestamp = datetime.datetime.fromtimestamp(tick['timestamp']).strftime('%H:%M:%S.%f')[:-3]
                
                data_point = {
                    'time': timestamp,
                    'spot': spot_price,
                    'option': option_price,
                    'iv': iv,
                    'delta': delta
                }
                history.append(data_point)
                
                # Keep only last 100 ticks to prevent memory bloat
                if len(history) > 100:
                    history.pop(0)
                
                df = pd.DataFrame(history)
                
                # 4. Pass to Signal Engine
                signal_triggered, reason = engine.check_signal(df)
                
                signal_text = f"!!! PRE-ALERT: {reason}" if signal_triggered else ""
                
                print(f"{timestamp:<12} | {spot_price:<8.2f} | {option_price:<6.2f} | {iv*100:<7.2f}% | {delta:<8.4f} | {signal_text}")
                
    except Exception as e:
        print(f"Stream disconnected: {e}")

if __name__ == "__main__":
    asyncio.run(process_stream())
