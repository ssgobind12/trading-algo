import asyncio
import websockets
import json
import random
import time
import math

async def option_tick_stream(websocket, path=None):
    """
    Simulates a live options chain stream.
    Emits data every 0.5 seconds.
    """
    print("Client connected to Mock Broker.")
    
    spot_price = 100.0
    strike = 100.0
    iv = 0.20
    time_to_expiry = 30.0 / 365.0
    r = 0.05
    
    # Simple Black-Scholes for the mock broker to generate realistic option prices
    def bs_call(S, K, T, r, sigma):
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        from scipy.stats import norm
        return S * norm.cdf(d1) - K * math.exp(-r * T) * norm.cdf(d2)

    tick_count = 0
    try:
        while True:
            tick_count += 1
            
            # Simulate normal market drift
            spot_drift = random.gauss(0, 0.05)
            spot_price += spot_drift
            
            # Simulate a breakout after 30 ticks (15 seconds)
            if 30 < tick_count < 40:
                spot_price += random.uniform(0.1, 0.3)
                iv += 0.005 # IV spikes during a breakout
                
            # Recalculate option price
            option_price = bs_call(spot_price, strike, time_to_expiry, r, iv)
            
            # Add some bid-ask spread noise
            option_last = option_price + random.uniform(-0.02, 0.02)
            
            payload = {
                "symbol": "MOCK_CALL_100",
                "timestamp": time.time(),
                "spot_price": round(spot_price, 2),
                "strike": strike,
                "days_to_expiry": 30,
                "option_price": round(option_last, 4),
                "volume": random.randint(1, 50)
            }
            
            await websocket.send(json.dumps(payload))
            await asyncio.sleep(0.5)  # 2 ticks per second
            
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected.")

async def main():
    print("Starting Mock Broker on ws://localhost:8765")
    async with websockets.serve(option_tick_stream, "localhost", 8765):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
