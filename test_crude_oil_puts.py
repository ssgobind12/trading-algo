from options_scanner import OptionsScanner

spot = 73.99
expiry_years = 30 / 365.0

# Mocking a PUT options chain around $73.99 spot price for a Crude Oil drop
mock_chain = [
    # ITM Puts (Too expensive or close)
    {'strike': 76, 'type': 'put', 'bid': 2.50, 'ask': 2.60, 'volume': 100, 'iv': 0.25},
    {'strike': 75, 'type': 'put', 'bid': 1.60, 'ask': 1.65, 'volume': 150, 'iv': 0.22}, # Premium $1.625 > $1.50 Budget
    
    # ATM Puts
    {'strike': 74, 'type': 'put', 'bid': 0.90, 'ask': 1.05, 'volume': 5, 'iv': 0.20}, # Fails Liquidity: Low volume and wide spread ($0.15)
    
    # OTM Puts (The Sweet Spot for a breakdown)
    {'strike': 73, 'type': 'put', 'bid': 0.45, 'ask': 0.48, 'volume': 500, 'iv': 0.18}, # Perfect!
    {'strike': 72.5, 'type': 'put', 'bid': 0.30, 'ask': 0.32, 'volume': 450, 'iv': 0.18}, # Perfect!
    {'strike': 72, 'type': 'put', 'bid': 0.18, 'ask': 0.20, 'volume': 300, 'iv': 0.18}, # Perfect!
    {'strike': 71, 'type': 'put', 'bid': 0.08, 'ask': 0.10, 'volume': 200, 'iv': 0.18}, # Perfect!
    
    # Deep OTM Puts
    {'strike': 70, 'type': 'put', 'bid': 0.02, 'ask': 0.04, 'volume': 1000, 'iv': 0.20}, # Fails POP: Mathematical probability too low
    {'strike': 65, 'type': 'put', 'bid': 0.01, 'ask': 0.02, 'volume': 5000, 'iv': 0.25}, # Fails POP
]

# Using our strict rules
scanner = OptionsScanner(max_budget=1.50, max_spread=0.05, min_volume=10, min_pop=0.15)

print(f"--- SIMULATING 'SELL' SIGNAL ON CRUDE OIL (Spot: ${spot}) ---")
print("Scanning PUT Options Chain for a short trade...")
print(f"Filters: Max Premium=${scanner.max_budget:.2f}, Max Spread=${scanner.max_spread:.2f}, Min Vol={scanner.min_volume}, Min POP={scanner.min_pop*100}%")

results = scanner.scan_chain(spot, mock_chain, expiry_years)

if not results.empty:
    print("\n[SUCCESS] The Algorithm Selected These Optimal Contracts to Buy:")
    results['pop_percent'] = (results['pop'] * 100).round(2).astype(str) + '%'
    print(results[['strike', 'premium', 'spread', 'volume', 'delta', 'pop_percent']].to_string(index=False))
else:
    print("\n[FAILED] No contracts met the strict filtering criteria. Trade aborted.")
