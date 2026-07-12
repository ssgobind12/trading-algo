import numpy as np
from scipy.stats import norm

class BlackScholesCalculator:
    """
    A class to calculate Option Prices and Greeks using the Black-Scholes-Merton model.
    """
    def __init__(self, S, K, T, r, sigma, q=0):
        """
        S: Current stock/underlying price
        K: Strike price
        T: Time to expiration (in years)
        r: Risk-free interest rate (annualized, e.g., 0.05 for 5%)
        sigma: Implied volatility (annualized, e.g., 0.20 for 20%)
        q: Continuous dividend yield (annualized, default 0)
        """
        self.S = float(S)
        self.K = float(K)
        self.T = float(T)
        self.r = float(r)
        self.sigma = float(sigma)
        self.q = float(q)
        
        # Calculate d1 and d2
        if self.T > 0:
            self.d1 = (np.log(self.S / self.K) + (self.r - self.q + 0.5 * self.sigma ** 2) * self.T) / (self.sigma * np.sqrt(self.T))
            self.d2 = self.d1 - self.sigma * np.sqrt(self.T)
        else:
            self.d1 = float('inf') if self.S >= self.K else float('-inf')
            self.d2 = float('inf') if self.S >= self.K else float('-inf')

    def call_price(self):
        if self.T <= 0:
            return max(0.0, self.S - self.K)
        return (self.S * np.exp(-self.q * self.T) * norm.cdf(self.d1) - 
                self.K * np.exp(-self.r * self.T) * norm.cdf(self.d2))

    def put_price(self):
        if self.T <= 0:
            return max(0.0, self.K - self.S)
        return (self.K * np.exp(-self.r * self.T) * norm.cdf(-self.d2) - 
                self.S * np.exp(-self.q * self.T) * norm.cdf(-self.d1))

    def delta(self, option_type='call'):
        if self.T <= 0:
            if option_type == 'call':
                return 1.0 if self.S > self.K else 0.0
            else:
                return -1.0 if self.S < self.K else 0.0
                
        if option_type == 'call':
            return np.exp(-self.q * self.T) * norm.cdf(self.d1)
        elif option_type == 'put':
            return np.exp(-self.q * self.T) * (norm.cdf(self.d1) - 1)
        else:
            raise ValueError("option_type must be 'call' or 'put'")

    def gamma(self):
        if self.T <= 0:
            return 0.0
        return (np.exp(-self.q * self.T) * norm.pdf(self.d1)) / (self.S * self.sigma * np.sqrt(self.T))

    def theta(self, option_type='call'):
        if self.T <= 0:
            return 0.0
            
        term1 = -(self.S * norm.pdf(self.d1) * self.sigma * np.exp(-self.q * self.T)) / (2 * np.sqrt(self.T))
        
        if option_type == 'call':
            term2 = self.q * self.S * norm.cdf(self.d1) * np.exp(-self.q * self.T)
            term3 = self.r * self.K * np.exp(-self.r * self.T) * norm.cdf(self.d2)
            return term1 + term2 - term3
        elif option_type == 'put':
            term2 = self.q * self.S * norm.cdf(-self.d1) * np.exp(-self.q * self.T)
            term3 = self.r * self.K * np.exp(-self.r * self.T) * norm.cdf(-self.d2)
            return term1 - term2 + term3
        else:
            raise ValueError("option_type must be 'call' or 'put'")

    def vega(self):
        if self.T <= 0:
            return 0.0
        # Vega is the same for calls and puts
        return self.S * np.exp(-self.q * self.T) * norm.pdf(self.d1) * np.sqrt(self.T)

    def rho(self, option_type='call'):
        if self.T <= 0:
            return 0.0
            
        if option_type == 'call':
            return self.K * self.T * np.exp(-self.r * self.T) * norm.cdf(self.d2)
        elif option_type == 'put':
            return -self.K * self.T * np.exp(-self.r * self.T) * norm.cdf(-self.d2)
        else:
            raise ValueError("option_type must be 'call' or 'put'")

    def probability_of_profit(self, option_type='call'):
        """
        Returns the risk-neutral probability that the option will expire In-The-Money.
        This is mathematically equivalent to N(d2) for calls and N(-d2) for puts.
        """
        if self.T <= 0:
            if option_type == 'call':
                return 1.0 if self.S > self.K else 0.0
            else:
                return 1.0 if self.S < self.K else 0.0
                
        if option_type == 'call':
            return norm.cdf(self.d2)
        elif option_type == 'put':
            return norm.cdf(-self.d2)
        else:
            raise ValueError("option_type must be 'call' or 'put'")

    @classmethod
    def implied_volatility(cls, target_price, option_type, S, K, T, r, q=0, max_iterations=100, precision=1.0e-5):
        """
        Calculates implied volatility using the Newton-Raphson method.
        """
        if T <= 0:
            return 0.0
            
        # Initial guess for volatility
        sigma = 0.5
        for i in range(max_iterations):
            calculator = cls(S, K, T, r, sigma, q)
            price = calculator.call_price() if option_type == 'call' else calculator.put_price()
            vega = calculator.vega()
            
            diff = target_price - price
            
            if abs(diff) < precision:
                return sigma
                
            if vega == 0.0:
                break
                
            sigma = sigma + diff / vega  # Newton-Raphson step
            
            if sigma <= 0.0:
                sigma = 0.001
                
        return sigma

    def get_all_greeks(self, option_type='call'):
        """
        Returns a dictionary of all greeks and the theoretical price.
        """
        return {
            'price': self.call_price() if option_type == 'call' else self.put_price(),
            'delta': self.delta(option_type),
            'gamma': self.gamma(),
            'theta': self.theta(option_type) / 365,  # Usually expressed per day
            'vega': self.vega() / 100,             # Usually expressed per 1% change in volatility
            'rho': self.rho(option_type) / 100,      # Usually expressed per 1% change in interest rate
            'pop': self.probability_of_profit(option_type)
        }

if __name__ == "__main__":
    # Example usage:
    # Underlying Price = 100, Strike = 100, Time to Expiry = 30 days (30/365 years)
    # Risk-free rate = 5%, Implied Volatility = 20%, Dividend yield = 0%
    
    spot_price = 100.0
    strike_price = 100.0
    time_to_expiry_years = 30.0 / 365.0
    risk_free_rate = 0.05
    implied_volatility = 0.20
    
    calculator = BlackScholesCalculator(
        S=spot_price, 
        K=strike_price, 
        T=time_to_expiry_years, 
        r=risk_free_rate, 
        sigma=implied_volatility
    )
    
    print("--- CALL OPTION ---")
    call_greeks = calculator.get_all_greeks('call')
    for k, v in call_greeks.items():
        print(f"{k.capitalize():<6}: {v:.4f}")
        
    print("\n--- PUT OPTION ---")
    put_greeks = calculator.get_all_greeks('put')
    for k, v in put_greeks.items():
        print(f"{k.capitalize():<6}: {v:.4f}")

    # Example 2: Reverse Engineering Implied Volatility
    print("\n--- IMPLIED VOLATILITY (NEWTON-RAPHSON) ---")
    market_call_price = 2.50  # Suppose the market is trading the Call at $2.50
    calculated_iv = BlackScholesCalculator.implied_volatility(
        target_price=market_call_price,
        option_type='call',
        S=spot_price,
        K=strike_price,
        T=time_to_expiry_years,
        r=risk_free_rate
    )
    print(f"Target Call Price: ${market_call_price:.2f}")
    print(f"Calculated IV:     {calculated_iv * 100:.2f}%")
