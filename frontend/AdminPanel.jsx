import React, { useState, useEffect } from 'react';

export default function AdminPanel({ username }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?username=${username}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [username]);

  const handleStatusChange = async (targetUsername, newStatus) => {
    if (!window.confirm(`Mark user ${targetUsername} as ${newStatus}?`)) return;
    
    try {
      const res = await fetch('/api/admin/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_username: username, target_username: targetUsername, status: newStatus })
      });
      
      if (res.ok) {
        alert(`${targetUsername} ${newStatus} successfully!`);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update status');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleDelete = async (targetUsername) => {
    if (!window.confirm(`Are you sure you want to permanently delete user ${targetUsername}?`)) return;
    
    try {
      const res = await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_username: username, target_username: targetUsername })
      });
      
      if (res.ok) {
        alert(`User ${targetUsername} deleted successfully!`);
        fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  const handleResetPaper = async (targetUsername) => {
    if (!window.confirm(`Are you sure you want to reset the fake money for ${targetUsername} back to ₹5000? All paper trade history will be cleared.`)) return;
    
    try {
      const res = await fetch('/api/admin/reset-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_username: username, target_username: targetUsername })
      });
      
      if (res.ok) {
        alert(`Fake money reset to ₹5000 for ${targetUsername}!`);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to reset paper money');
      }
    } catch (err) {
      alert('Network error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
        Manage user registrations. Users must pay ₹100 before approval.
      </div>
      
      {error && <div style={{ color: '#ef4444', fontSize: '12px' }}>{error}</div>}
      
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Loading users...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {users.map(u => (
            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: 'white' }}>{u.username}</div>
                <div style={{ fontSize: '12px', color: u.status === 'approved' ? '#10b981' : (u.status === 'rejected' ? '#ef4444' : '#f59e0b') }}>
                  Status: {u.status.toUpperCase()}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '6px' }}>
                {u.status === 'pending' && (
                  <>
                    <button 
                      onClick={() => handleStatusChange(u.username, 'approved')}
                      style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => handleStatusChange(u.username, 'rejected')}
                      style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {u.status !== 'approved' && (
                  <button 
                    onClick={() => handleDelete(u.username)}
                    style={{ padding: '6px 12px', backgroundColor: 'transparent', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                )}
                {u.status === 'approved' && (
                  <button 
                    onClick={() => handleResetPaper(u.username)}
                    style={{ padding: '6px 12px', backgroundColor: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginLeft: '6px' }}
                    title="Reset fake money to ₹5000"
                  >
                    Reset Fake ₹
                  </button>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>No users found.</div>
          )}
        </div>
      )}
    </div>
  );
}
