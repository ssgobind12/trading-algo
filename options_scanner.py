from greeks import BlackScholesCalculator
import pandas as pd

class OptionsScanner:
    def __init__(self, max_budget=1.50, max_spread=0.05, min_volume=10, min_pop=0.15):
        self.max_budget = max_budget
        self.max_spread = max_spread
        self.min_volume = min_volume
        self.min_pop = min_pop

    def scan_chain(self, spot_price, chain_data, time_to_expiry_years, risk_free_rate=0.05):
        """
        Scans an options chain and filters for the best contracts based on criteria.
        chain_data: List of dicts e.g., [{'strike': 105, 'type': 'call', 'bid': 1.10, 'ask': 1.15, 'volume': 50, 'iv': 0.25}, ...]
        """
        filtered_options = []
        
        for contract in chain_data:
            # 1. Liquidity Filter
            spread = contract['ask'] - contract['bid']
            # We use round to avoid floating point precision issues (like 0.05000000000000004)
            if round(spread, 3) > self.max_spread:
                continue
            if contract['volume'] < self.min_volume:
                continue
                
            # Assume mid price as current premium
            premium = (contract['bid'] + contract['ask']) / 2
            
            # 2. Budget Filter
            if premium > self.max_budget:
                continue
                
            # 3. Probability of Profit (POP) Filter
            # Calculate Greeks using our BlackScholesCalculator
            calc = BlackScholesCalculator(
                S=spot_price,
                K=contract['strike'],
                T=time_to_expiry_years,
                r=risk_free_rate,
                sigma=contract['iv']
            )
            
            greeks = calc.get_all_greeks(contract['type'])
            pop = greeks['pop']
            
            if pop < self.min_pop:
                continue
                
            # If it passes all filters, add it to our list of viable contracts
            contract_data = contract.copy()
            contract_data['premium'] = premium
            contract_data['spread'] = spread
            contract_data['delta'] = greeks['delta']
            contract_data['theta'] = greeks['theta']
            contract_data['pop'] = pop
            
            filtered_options.append(contract_data)
            
        # Return as a DataFrame sorted by highest Probability of Profit
        if filtered_options:
            df = pd.DataFrame(filtered_options)
            return df.sort_values(by='pop', ascending=False)
        else:
            return pd.DataFrame()

if __name__ == "__main__":
    # Test Simulation
    spot = 100.0
    expiry_years = 30 / 365.0
    
    # Mocking a call options chain around $100 spot price
    mock_chain = [
        # ITM (Fails Budget: Too expensive)
        {'strike': 90, 'type': 'call', 'bid': 10.50, 'ask': 10.60, 'volume': 100, 'iv': 0.25},
        {'strike': 95, 'type': 'call', 'bid': 6.20, 'ask': 6.25, 'volume': 150, 'iv': 0.22},
        # ATM
        {'strike': 100, 'type': 'call', 'bid': 2.45, 'ask': 2.50, 'volume': 5, 'iv': 0.20}, # Fails Liquidity: Low volume
        {'strike': 101, 'type': 'call', 'bid': 1.90, 'ask': 2.05, 'volume': 200, 'iv': 0.19}, # Fails Liquidity: Wide spread (0.15)
        # OTM
        {'strike': 102, 'type': 'call', 'bid': 1.45, 'ask': 1.48, 'volume': 500, 'iv': 0.18}, # Perfect! (Premium=1.465, Spread=0.03, Vol=500)
        {'strike': 103, 'type': 'call', 'bid': 1.10, 'ask': 1.14, 'volume': 450, 'iv': 0.18}, # Perfect!
        {'strike': 104, 'type': 'call', 'bid': 0.80, 'ask': 0.83, 'volume': 300, 'iv': 0.18}, # Perfect!
        {'strike': 105, 'type': 'call', 'bid': 0.55, 'ask': 0.58, 'volume': 200, 'iv': 0.18}, # Perfect!
        # Deep OTM
        {'strike': 110, 'type': 'call', 'bid': 0.05, 'ask': 0.07, 'volume': 1000, 'iv': 0.20}, # Fails POP: Delta too low (Prob < 15%)
        {'strike': 115, 'type': 'call', 'bid': 0.01, 'ask': 0.02, 'volume': 5000, 'iv': 0.25}, # Fails POP
    ]
    
    scanner = OptionsScanner(max_budget=1.50, max_spread=0.05, min_volume=10, min_pop=0.15)
    
    print(f"--- SCANNING OPTIONS CHAIN (Spot: ${spot}) ---")
    print(f"Filters: Max Premium=${scanner.max_budget:.2f}, Max Spread=${scanner.max_spread:.2f}, Min Vol={scanner.min_volume}, Min POP={scanner.min_pop*100}%")
    
    results = scanner.scan_chain(spot, mock_chain, expiry_years)
    
    if not results.empty:
        print("\n[SUCCESS] Valid Contracts Found:")
        # Format the output for readability
        results['pop_percent'] = (results['pop'] * 100).round(2).astype(str) + '%'
        print(results[['strike', 'premium', 'spread', 'volume', 'delta', 'pop_percent']].to_string(index=False))
    else:
        print("\n[FAILED] No contracts met the filtering criteria.")
