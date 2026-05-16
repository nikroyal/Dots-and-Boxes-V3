import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { sfx } from '../lib/sound';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | signup | reset
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        await signup(username, email, password);
      } else if (mode === 'reset') {
        await resetPassword(username);
        setInfo('If that username exists, a password reset email has been sent.');
        setLoading(false);
        return;
      } else {
        await login(username, password);
      }
      sfx.click();
      navigate('/');
    } catch (err) {
      const msg = err.message || String(err);
      const code = err.code || '';
      // Translate Firebase errors
      if (code === 'auth/invalid-credential' || msg.includes('auth/invalid-credential')
          || code === 'auth/wrong-password' || msg.includes('auth/wrong-password')
          || code === 'auth/user-not-found' || msg.includes('auth/user-not-found'))
        setError('Wrong username or password');
      else if (code === 'auth/email-already-in-use' || msg.includes('auth/email-already-in-use'))
        setError('That email is already registered');
      else if (code === 'auth/weak-password' || msg.includes('auth/weak-password'))
        setError('Password must be at least 6 characters');
      else if (code === 'auth/invalid-email' || msg.includes('auth/invalid-email'))
        setError('Please enter a valid email address');
      else if (code === 'auth/too-many-requests' || msg.includes('auth/too-many-requests'))
        setError('Too many attempts — please wait a moment and try again');
      else
        setError(msg);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm fade-in">
        <div className="text-center mb-12">
          <div className="font-mono text-[0.65rem] tracking-[0.3em] opacity-50 mb-3">A PARLOR GAME</div>
          <h1 className="font-display text-5xl font-medium tracking-tight leading-none">
            Dots <em className="font-normal">&amp;</em> Boxes
          </h1>
          <div className="mt-6 mx-auto" style={{ width: 40, height: 1, background: 'var(--hairline-strong)' }} />
        </div>

        <div className="flex gap-1 mb-8" role="tablist" aria-label="Authentication mode">
          {[['login', 'Sign In'], ['signup', 'Sign Up']].map(([m, label]) => (
            <button
              type="button"
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(''); setInfo(''); }}
              className="flex-1 py-3 font-mono text-[0.7rem] tracking-widest uppercase transition-all focus-ring"
              style={{
                borderBottom: `1px solid ${mode === m ? 'var(--ink)' : 'var(--hairline)'}`,
                opacity: mode === m ? 1 : 0.5,
                background: 'none', border: 'none', borderBottomWidth: '1px', borderBottomStyle: 'solid',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          <div>
            <label htmlFor="login-username" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Username</label>
            <input
              id="login-username"
              className="input-field"
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 20))}
              placeholder="—"
              autoComplete="username"
              autoFocus={!username}
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="login-email" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Email <span className="opacity-50 normal-case tracking-normal">(for password recovery)</span></label>
              <input
                id="login-email"
                className="input-field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          )}

          {mode !== 'reset' && (
            <div>
              <label htmlFor="login-password" className="font-mono block mb-2 text-[0.65rem] tracking-widest uppercase opacity-55">Password</label>
              <input
                id="login-password"
                className="input-field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="—"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                autoFocus={!!username && mode === 'login'}
              />
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? '…'
              : mode === 'login' ? 'Sign In'
              : mode === 'signup' ? 'Create Account'
              : 'Send Reset Email'}
          </button>
        </div>

        {error && (
          <div role="alert" className="font-mono text-xs text-center mt-6" style={{ color: 'var(--crimson)' }}>
            {error}
          </div>
        )}
        {info && (
          <div role="status" className="font-mono text-xs text-center mt-6" style={{ color: 'var(--forest)' }}>
            {info}
          </div>
        )}

        {mode === 'login' && (
          <div className="text-center mt-6">
            <button type="button" onClick={() => { setMode('reset'); setError(''); setInfo(''); }}
                    className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              Forgot password?
            </button>
          </div>
        )}

        {mode === 'reset' && (
          <div className="text-center mt-6">
            <button type="button" onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                    className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 hover:opacity-100 transition-opacity"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              ← Back to sign in
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <div className="font-mono text-[0.65rem] mt-6 opacity-50 text-center leading-relaxed">
            Username: 3-20 chars, lowercase letters/numbers/underscore.<br/>
            Password: 6+ characters.<br/>
            Email is only used for password reset — never displayed publicly.
          </div>
        )}
      </form>
    </div>
  );
}
