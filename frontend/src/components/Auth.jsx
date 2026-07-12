import React, { useState } from 'react';
import { Activity, Lock, User, ArrowRight } from 'lucide-react';

export default function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/login' : '/api/register';
    try {
      const response = await fetch(`${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (response.ok) {
        if (isLogin) {
          localStorage.setItem('auth_token', data.token);
          localStorage.setItem('auth_username', data.username);
          onLogin(data.username);
        } else {
          // Successfully registered
          setIsLogin(true);
          setError('User ID created successfully! Please log in.');
          setPassword(''); // clear password for login
        }
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Network error. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', width: '100vw', backgroundColor: '#0f172a',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', backgroundColor: '#1e293b',
        borderRadius: '16px', padding: '40px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
          <div style={{ backgroundColor: 'rgba(47, 137, 252, 0.1)', padding: '16px', borderRadius: '50%', marginBottom: '16px' }}>
             <Activity size={32} color="#2f89fc" />
          </div>
          <h1 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
            Trading Algo UI
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {isLogin ? 'Sign in to access your dashboard' : 'Create your secure User ID'}
          </p>
        </div>

        {error && (
          <div style={{ 
            backgroundColor: error.includes('successfully') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
            color: error.includes('successfully') ? '#10b981' : '#ef4444', 
            padding: '12px', borderRadius: '8px', marginBottom: '24px', fontSize: '14px',
            textAlign: 'center', border: `1px solid ${error.includes('successfully') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
              User ID
            </label>
            <div style={{ position: 'relative' }}>
              <User size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your User ID"
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', backgroundColor: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px', color: 'white',
                  fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2f89fc'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: '13px', marginBottom: '8px', fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="#64748b" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '12px 12px 12px 40px', backgroundColor: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px', color: 'white',
                  fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#2f89fc'}
                onBlur={(e) => e.target.style.borderColor = '#334155'}
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              backgroundColor: '#2f89fc', color: 'white', border: 'none', borderRadius: '8px',
              padding: '14px', fontSize: '15px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
              transition: 'background-color 0.2s', opacity: loading ? 0.7 : 1
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#1d70d6'; }}
            onMouseOut={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#2f89fc'; }}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>

        <div style={{ marginTop: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          {isLogin ? "Don't have an account? " : "Already have a User ID? "}
          <span 
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ color: '#2f89fc', cursor: 'pointer', fontWeight: 600 }}
          >
            {isLogin ? 'Create User ID' : 'Sign In'}
          </span>
        </div>

      </div>
    </div>
  );
}
