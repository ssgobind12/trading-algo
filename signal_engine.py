import pandas as pd
import numpy as np

class SignalEngine:
    def __init__(self, velocity_window=10, delta_velocity_threshold=0.01, iv_velocity_threshold=0.0005):
        """
        velocity_window: number of ticks to calculate velocity over (e.g., 10 ticks = 5 seconds)
        delta_velocity_threshold: threshold for delta rate of change to trigger alert
        iv_velocity_threshold: threshold for IV rate of change to trigger alert
        """
        self.velocity_window = velocity_window
        self.delta_velocity_threshold = delta_velocity_threshold
        self.iv_velocity_threshold = iv_velocity_threshold
        
    def check_signal(self, df):
        """
        Checks if the momentum of Delta and IV exceeds the thresholds.
        Returns a tuple: (Signal_Triggered (bool), Reason (str))
        """
        if len(df) < self.velocity_window:
            return False, "Not enough data"
            
        # Get the recent window
        recent_data = df.tail(self.velocity_window)
        
        # Calculate velocity (rate of change)
        delta_start = recent_data['delta'].iloc[0]
        delta_end = recent_data['delta'].iloc[-1]
        delta_velocity = (delta_end - delta_start) / self.velocity_window
        
        iv_start = recent_data['iv'].iloc[0]
        iv_end = recent_data['iv'].iloc[-1]
        iv_velocity = (iv_end - iv_start) / self.velocity_window
        
        reasons = []
        if abs(delta_velocity) >= self.delta_velocity_threshold:
            reasons.append(f"Delta Velocity Spike: {delta_velocity:.4f}")
            
        if iv_velocity >= self.iv_velocity_threshold:
            reasons.append(f"IV Velocity Spike: {iv_velocity:.4f}")
            
        if reasons:
            return True, " | ".join(reasons)
            
        return False, "No Signal"
