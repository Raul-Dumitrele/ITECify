import { useState } from 'react';

// Culori disponibile pentru avatar
const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#39d0f0', '#a78bfa',
];

export default function AuthScreen({ onAuth }) {
  const [tab, setTab]           = useState('signin'); // 'signin' | 'signup'
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Sign In fields
  const [siUsername, setSiUsername] = useState('');
  const [siPassword, setSiPassword] = useState('');

  // Sign Up fields
  const [suUsername, setSuUsername] = useState('');
  const [suEmail, setSuEmail]       = useState('');
  const [suPhone, setSuPhone]       = useState('');
  const [suPassword, setSuPassword] = useState('');
  const [suConfirm, setSuConfirm]   = useState('');
  const [suColor, setSuColor]       = useState(AVATAR_COLORS[0]);

  const handleSignIn = (socket) => {
    setError('');
    if (!siUsername.trim() || !siPassword.trim()) {
      return setError('Completează toate câmpurile.');
    }
    setLoading(true);
    socket.emit('auth-signin', {
      username: siUsername.trim(),
      password: siPassword,
    });
  };

  const handleSignUp = (socket) => {
    setError('');
    if (!suUsername.trim() || !suEmail.trim() || !suPassword.trim()) {
      return setError('Username, email și parola sunt obligatorii.');
    }
    if (suPassword !== suConfirm) {
      return setError('Parolele nu se potrivesc.');
    }
    if (suPassword.length < 4) {
      return setError('Parola trebuie să aibă minim 4 caractere.');
    }
    setLoading(true);
    socket.emit('auth-signup', {
      username: suUsername.trim(),
      email:    suEmail.trim(),
      phone:    suPhone.trim(),
      password: suPassword,
      color:    suColor,
    });
  };

  // Componenta primește socket ca prop pentru a emite evenimente
  return (
    <AuthScreenInner
      tab={tab} setTab={(t) => { setTab(t); setError(''); setLoading(false); }}
      error={error} setError={setError}
      loading={loading} setLoading={setLoading}
      siUsername={siUsername} setSiUsername={setSiUsername}
      siPassword={siPassword} setSiPassword={setSiPassword}
      suUsername={suUsername} setSuUsername={setSuUsername}
      suEmail={suEmail} setSuEmail={setSuEmail}
      suPhone={suPhone} setSuPhone={setSuPhone}
      suPassword={suPassword} setSuPassword={setSuPassword}
      suConfirm={suConfirm} setSuConfirm={setSuConfirm}
      suColor={suColor} setSuColor={setSuColor}
      handleSignIn={handleSignIn}
      handleSignUp={handleSignUp}
      onAuth={onAuth}
      avatarColors={AVATAR_COLORS}
    />
  );
}

function AuthScreenInner({
  tab, setTab, error, setError, loading, setLoading,
  siUsername, setSiUsername, siPassword, setSiPassword,
  suUsername, setSuUsername, suEmail, setSuEmail,
  suPhone, setSuPhone, suPassword, setSuPassword,
  suConfirm, setSuConfirm, suColor, setSuColor,
  handleSignIn, handleSignUp, onAuth, avatarColors,
}) {
  // onAuth({ socket, username, color }) — App.jsx se ocupă de socket
  return (
    <div style={styles.overlay}>
      {/* Scanlines decorative */}
      <div style={styles.scanlines} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoAngle}>&lt;</span>
          <span style={styles.logoText}>iTECify</span>
          <span style={styles.logoAngle}>&gt;</span>
        </div>
        <p style={styles.tagline}>Code together. Ship faster.</p>

        {/* Tab selector */}
        <div style={styles.tabs}>
          <button
            style={{ ...styles.tab, ...(tab === 'signin' ? styles.tabActive : {}) }}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            style={{ ...styles.tab, ...(tab === 'signup' ? styles.tabActive : {}) }}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div style={styles.errorBox}>
            <span style={{ marginRight: 6 }}>⚠</span>{error}
          </div>
        )}

        {/* SIGN IN FORM */}
        {tab === 'signin' && (
          <div style={styles.form}>
            <Field
              label="Username"
              placeholder="ex: ana_dev"
              value={siUsername}
              onChange={setSiUsername}
              icon="◈"
            />
            <Field
              label="Parolă"
              placeholder="••••••••"
              value={siPassword}
              onChange={setSiPassword}
              type="password"
              icon="◉"
            />
            <SubmitBtn
              loading={loading}
              onClick={(socket) => handleSignIn(socket)}
              onAuth={onAuth}
              label="Intră în sesiune →"
            />
            <p style={styles.switchText}>
              Nu ai cont?{' '}
              <span style={styles.switchLink} onClick={() => setTab('signup')}>
                Creează unul
              </span>
            </p>
          </div>
        )}

        {/* SIGN UP FORM */}
        {tab === 'signup' && (
          <div style={styles.form}>
            <Field label="Username *" placeholder="ex: radu_code" value={suUsername} onChange={setSuUsername} icon="◈" />
            <Field label="Email *" placeholder="ana@example.com" value={suEmail} onChange={setSuEmail} type="email" icon="◎" />
            <Field label="Nr. telefon" placeholder="+40 7xx xxx xxx" value={suPhone} onChange={setSuPhone} icon="◷" />
            <Field label="Parolă *" placeholder="minim 4 caractere" value={suPassword} onChange={setSuPassword} type="password" icon="◉" />
            <Field label="Confirmă parola *" placeholder="repetă parola" value={suConfirm} onChange={setSuConfirm} type="password" icon="◉" />

            {/* Color picker */}
            <div style={styles.colorSection}>
              <span style={styles.fieldLabel}>Culoare cursor</span>
              <div style={styles.colorGrid}>
                {avatarColors.map(c => (
                  <button
                    key={c}
                    onClick={() => setSuColor(c)}
                    style={{
                      ...styles.colorSwatch,
                      background: c,
                      boxShadow: suColor === c ? `0 0 0 2px #0a0c10, 0 0 0 4px ${c}` : 'none',
                      transform: suColor === c ? 'scale(1.18)' : 'scale(1)',
                    }}
                    title={c}
                  />
                ))}
              </div>
              {/* Preview */}
              <div style={styles.colorPreview}>
                <span style={{ ...styles.cursorDot, background: suColor }} />
                <span style={{ color: suColor, fontFamily: "'Rajdhani', sans-serif", fontWeight: 700, fontSize: 13 }}>
                  {suUsername || 'tu'}
                </span>
              </div>
            </div>

            <SubmitBtn
              loading={loading}
              onClick={(socket) => handleSignUp(socket)}
              onAuth={onAuth}
              label="Creează cont →"
              color="#a78bfa"
            />
            <p style={styles.switchText}>
              Ai deja cont?{' '}
              <span style={styles.switchLink} onClick={() => setTab('signin')}>
                Intră
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componente ────────────────────────────────────────────

function Field({ label, placeholder, value, onChange, type = 'text', icon }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.fieldLabel}>{icon && <span style={styles.fieldIcon}>{icon}</span>} {label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...styles.input,
          borderColor: focused ? 'var(--accent-cyan, #39d0f0)' : 'var(--border-accent, #30363d)',
          boxShadow: focused ? '0 0 0 2px rgba(57,208,240,.1)' : 'none',
        }}
        autoComplete="off"
      />
    </div>
  );
}

// SubmitBtn are nevoie de socket → îl ia din App prin onAuth pattern
// Folosim un trick: onAuth e apelat cu un callback care primește socket-ul
function SubmitBtn({ loading, onClick, onAuth, label, color = '#39d0f0' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{
        ...styles.submitBtn,
        borderColor: color,
        color: hovered ? '#0a0c10' : color,
        background: hovered ? color : 'transparent',
        boxShadow: hovered ? `0 0 24px ${color}55` : 'none',
        opacity: loading ? 0.6 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !loading && onAuth(onClick)}
      disabled={loading}
    >
      {loading ? (
        <span style={styles.loadingDots}>
          <span style={{ animationDelay: '0ms' }}>·</span>
          <span style={{ animationDelay: '160ms' }}>·</span>
          <span style={{ animationDelay: '320ms' }}>·</span>
        </span>
      ) : label}
    </button>
  );
}

// ── Styles ────────────────────────────────────────────────────
const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: '#0a0c10',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    fontFamily: "'JetBrains Mono', monospace",
  },
  scanlines: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(57,208,240,0.015) 2px, rgba(57,208,240,0.015) 4px)',
  },
  card: {
    position: 'relative', zIndex: 1,
    width: 420, maxWidth: '94vw',
    background: '#0f1117',
    border: '1px solid #21262d',
    borderRadius: 10,
    padding: '40px 44px 36px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(57,208,240,0.06)',
  },
  logo: {
    textAlign: 'center', marginBottom: 6,
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 34, fontWeight: 700, letterSpacing: '0.06em',
  },
  logoAngle: { color: '#39d0f0' },
  logoText:  { color: '#e6edf3', margin: '0 4px' },
  tagline: {
    textAlign: 'center', color: '#484f58',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 12, letterSpacing: '0.14em',
    textTransform: 'uppercase', marginBottom: 28,
  },
  tabs: {
    display: 'flex', marginBottom: 22,
    background: '#0a0c10', borderRadius: 6, padding: 3,
    border: '1px solid #21262d',
  },
  tab: {
    flex: 1, padding: '7px 0',
    background: 'transparent', border: 'none',
    color: '#7d8590', cursor: 'pointer',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 13, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', borderRadius: 4,
    transition: 'all 0.15s',
  },
  tabActive: {
    background: '#161b22', color: '#39d0f0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
  errorBox: {
    background: 'rgba(248,81,73,0.08)',
    border: '1px solid rgba(248,81,73,0.3)',
    borderRadius: 5, padding: '9px 14px',
    color: '#f85149', fontSize: 12, marginBottom: 16,
    fontFamily: "'JetBrains Mono', monospace",
  },
  form: { display: 'flex', flexDirection: 'column', gap: 14 },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 5 },
  fieldLabel: {
    color: '#7d8590', fontSize: 11, letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontFamily: "'Rajdhani', sans-serif", fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 5,
  },
  fieldIcon: { color: '#39d0f0', fontSize: 12 },
  input: {
    width: '100%', padding: '9px 13px',
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 5, outline: 'none',
    color: '#e6edf3',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxSizing: 'border-box',
  },
  colorSection: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  colorGrid: {
    display: 'flex', flexWrap: 'wrap', gap: 8,
  },
  colorSwatch: {
    width: 24, height: 24, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  colorPreview: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 10px',
    background: '#0a0c10', borderRadius: 4,
    border: '1px solid #21262d',
  },
  cursorDot: {
    width: 8, height: 8, borderRadius: '50%', display: 'inline-block',
  },
  submitBtn: {
    width: '100%', padding: '11px 0', marginTop: 6,
    background: 'transparent',
    border: '1px solid',
    borderRadius: 5, cursor: 'pointer',
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: 14, fontWeight: 700, letterSpacing: '0.08em',
    textTransform: 'uppercase',
    transition: 'all 0.18s',
  },
  loadingDots: {
    display: 'inline-flex', gap: 2, fontSize: 20,
  },
  switchText: {
    textAlign: 'center', color: '#484f58', fontSize: 12,
    fontFamily: "'Rajdhani', sans-serif",
  },
  switchLink: {
    color: '#39d0f0', cursor: 'pointer', textDecoration: 'underline',
    fontWeight: 600,
  },
};