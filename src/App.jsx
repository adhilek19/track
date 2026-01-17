import { useState, useEffect } from 'react'
import './App.css'

const API_URL = 'https://api.jsonbin.io/v3/b/696b6a5543b1c97be9369c57';

const INITIAL_STATE = {
  p1: { name: 'Player 1', wins: 0, goals: 0 },
  p2: { name: 'Player 2', wins: 0, goals: 0 },
  history: [],
  theme: 'midnight'
};

const Login = ({ onLogin }) => {
  const [id, setId] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (id === '1234' && pass === '1234z') {
      onLogin();
    } else {
      setError('Invalid ID or Password');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      gap: '2rem'
    }}>
      <h1>eFootball Tracker</h1>
      <div className="glass-panel" style={{ width: '100%', maxWidth: '350px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Login</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>ID</label>
            <input
              className="input-field"
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter ID"
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
            <input
              className="input-field"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Enter Password"
            />
          </div>
          {error && <div style={{ color: 'var(--accent-p2)', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
          <button type="submit" className="submit-btn" style={{ marginTop: '1rem' }}>Enter</button>
        </form>
      </div>
    </div>
  );
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem('efootball-auth') === 'true';
  });

  const [data, setData] = useState(INITIAL_STATE);
  const [scores, setScores] = useState({ p1: '', p2: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      setLoading(true);
      fetchData();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    // Sync theme with body
    document.body.setAttribute('data-theme', data.theme || 'midnight');
  }, [data.theme]);

  const handleLogin = () => {
    localStorage.setItem('efootball-auth', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('efootball-auth');
    setIsLoggedIn(false);
    setData(INITIAL_STATE);
  };

  const fetchData = async () => {
    try {
      const [p1, p2, history, theme] = await Promise.all([
        fetch(`${API_URL}/p1`).then(r => r.json()),
        fetch(`${API_URL}/p2`).then(r => r.json()),
        fetch(`${API_URL}/history?_sort=date&_order=desc`).then(r => r.json()),
        fetch(`${API_URL}/theme`).then(r => r.json()).catch(() => 'midnight')
      ]);

      setData({ p1, p2, history: history.reverse(), theme });
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  const updateServer = async (resource, payload, method = 'PUT') => {
    await fetch(`${API_URL}/${resource}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  const changeTheme = (newTheme) => {
    setData(prev => ({ ...prev, theme: newTheme }));
    updateServer('theme', newTheme);
  };

  const handleNameChange = (player, newName) => {
    const updatedPlayer = { ...data[player], name: newName };
    setData(prev => ({ ...prev, [player]: updatedPlayer }));
    updateServer(player, updatedPlayer);
  };

  const handleScoreChange = (player, value) => {
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      setScores(prev => ({ ...prev, [player]: value }));
    }
  };

  const submitMatch = async (e) => {
    e.preventDefault();
    if (scores.p1 === '' || scores.p2 === '') return;

    const s1 = parseInt(scores.p1);
    const s2 = parseInt(scores.p2);

    const p1Wins = s1 > s2 ? 1 : 0;
    const p2Wins = s2 > s1 ? 1 : 0;

    const newMatch = {
      id: Date.now().toString(),
      p1Name: data.p1.name,
      p2Name: data.p2.name,
      p1Score: s1,
      p2Score: s2,
      date: new Date().toLocaleDateString()
    };

    const newP1 = {
      ...data.p1,
      wins: data.p1.wins + p1Wins,
      goals: data.p1.goals + s1
    };

    const newP2 = {
      ...data.p2,
      wins: data.p2.wins + p2Wins,
      goals: data.p2.goals + s2
    };

    // Optimistic Update
    setData(prev => ({
      ...prev,
      p1: newP1,
      p2: newP2,
      history: [newMatch, ...prev.history]
    }));

    setScores({ p1: '', p2: '' });

    // Server Update
    await Promise.all([
      updateServer('p1', newP1),
      updateServer('p2', newP2),
      updateServer('history', newMatch, 'POST')
    ]);
  };

  const resetTracker = async () => {
    if (confirm('Are you sure you want to reset all stats? History will be cleared.')) {
      const resetP1 = { ...data.p1, wins: 0, goals: 0 };
      const resetP2 = { ...data.p2, wins: 0, goals: 0 };

      setData(prev => ({ ...prev, p1: resetP1, p2: resetP2, history: [] }));

      await Promise.all([
        updateServer('p1', resetP1),
        updateServer('p2', resetP2)
      ]);

      // Clear history on server
      data.history.forEach(m => {
        fetch(`${API_URL}/history/${m.id}`, { method: 'DELETE' });
      });
    }
  };

  const totalMatches = data.history.length;

  const getLosses = (playerKey) => {
    return data.history.filter(m => {
      if (playerKey === 'p1') return m.p1Score < m.p2Score;
      return m.p2Score < m.p1Score;
    }).length;
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  if (loading) return <div style={{ textAlign: 'center', marginTop: '4rem' }}>Loading...</div>;

  return (
    <>
      <div className="header glass-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <button onClick={handleLogout} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'transparent' }}>Logout</button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => changeTheme('midnight')} style={{ opacity: data.theme === 'midnight' ? 1 : 0.5 }}>🌙</button>
            <button onClick={() => changeTheme('pitch')} style={{ opacity: data.theme === 'pitch' ? 1 : 0.5 }}>⚽</button>
            <button onClick={() => changeTheme('light')} style={{ opacity: data.theme === 'light' ? 1 : 0.5 }}>☀️</button>
          </div>
        </div>
        <h1>eFootball Tracker</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Head-to-Head Statistics</p>
      </div>

      <div className="stats-container">
        {/* Player 1 */}
        <div className="player-card glass-panel" style={{ borderColor: 'var(--accent-p1)', boxShadow: `0 0 20px -10px var(--accent-p1)` }}>
          <input
            className="player-input"
            value={data.p1.name}
            onChange={(e) => handleNameChange('p1', e.target.value)}
            style={{ color: 'var(--accent-p1)' }}
          />
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-value">{totalMatches}</span>
              <span className="stat-label">Matches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.p1.wins}</span>
              <span className="stat-label">Wins</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{getLosses('p1')}</span>
              <span className="stat-label">Losses</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.p1.goals}</span>
              <span className="stat-label">Goals</span>
            </div>
          </div>
        </div>

        <div className="vs-badge">VS</div>

        {/* Player 2 */}
        <div className="player-card glass-panel" style={{ borderColor: 'var(--accent-p2)', boxShadow: `0 0 20px -10px var(--accent-p2)` }}>
          <input
            className="player-input"
            value={data.p2.name}
            onChange={(e) => handleNameChange('p2', e.target.value)}
            style={{ color: 'var(--accent-p2)' }}
          />
          <div className="stat-row">
            <div className="stat-item">
              <span className="stat-value">{totalMatches}</span>
              <span className="stat-label">Matches</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.p2.wins}</span>
              <span className="stat-label">Wins</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{getLosses('p2')}</span>
              <span className="stat-label">Losses</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{data.p2.goals}</span>
              <span className="stat-label">Goals</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-panel animate-fade-in match-form">
        <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Log New Match</h3>
        <form onSubmit={submitMatch}>
          <div className="score-inputs">
            <div style={{ textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-p1)', marginBottom: '0.5rem' }}>{data.p1.name}</label>
              <input
                className="input-field score-input"
                value={scores.p1}
                onChange={(e) => handleScoreChange('p1', e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>-</span>
            <div style={{ textAlign: 'center' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-p2)', marginBottom: '0.5rem' }}>{data.p2.name}</label>
              <input
                className="input-field score-input"
                value={scores.p2}
                onChange={(e) => handleScoreChange('p2', e.target.value)}
                inputMode="numeric"
                placeholder="0"
              />
            </div>
          </div>
          <button type="submit" className="submit-btn" style={{ marginTop: '1.5rem' }}>
            Record Match
          </button>
        </form>
      </div>

      <div className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Match History <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)', fontWeight: 'normal' }}>({totalMatches})</span></h3>
          <button onClick={resetTracker} style={{ background: 'transparent', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Reset</button>
        </div>

        <div className="history-list">
          {data.history.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No matches recorded yet.</div>
          )}
          {data.history.map(match => (
            <div key={match.id} className="history-item">
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '3px', height: '40px', background: match.p1Score > match.p2Score ? 'var(--accent-p1)' : (match.p2Score > match.p1Score ? 'var(--accent-p2)' : 'var(--text-secondary)') }}></div>
                <div>
                  <div style={{ fontWeight: '600' }}>{match.date}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    {match.p1Score > match.p2Score ? `${match.p1Name} won` : (match.p2Score > match.p1Score ? `${match.p2Name} won` : 'Draw')}
                  </div>
                </div>
              </div>
              <div className="history-score">
                <span style={{ color: match.p1Score > match.p2Score ? 'var(--accent-p1)' : 'inherit' }}>{match.p1Score}</span>
                <span style={{ margin: '0 0.5rem', color: 'var(--text-secondary)' }}>-</span>
                <span style={{ color: match.p2Score > match.p1Score ? 'var(--accent-p2)' : 'inherit' }}>{match.p2Score}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default App
