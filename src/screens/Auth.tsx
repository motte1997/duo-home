import { useState } from 'react';
import { supabase, configured } from '../lib/supabase';

export function ConfigMissing() {
  return (
    <div className="center-screen">
      <div className="hero-emoji">🔧</div>
      <h1 className="large">Konfiguration fehlt</h1>
      <p className="muted">
        Lege eine Datei <code>.env</code> mit <code>VITE_SUPABASE_URL</code> und{' '}
        <code>VITE_SUPABASE_ANON_KEY</code> an (siehe <code>.env.example</code> und README) und starte die App neu.
      </p>
    </div>
  );
}

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  if (!configured) return <ConfigMissing />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) setMsg({ text: 'Bitte bestätige deine E-Mail-Adresse und melde dich dann an.', ok: true });
      }
    } catch (err) {
      const m = (err as Error).message;
      setMsg({ text: m === 'Invalid login credentials' ? 'E-Mail oder Passwort ist falsch.' : m });
    } finally { setBusy(false); }
  };

  return (
    <div className="center-screen">
      <img src="./icons/icon-192.png" alt="" className="app-icon" />
      <h1 className="large">Duo Home</h1>
      <p className="muted">Haushalt fair teilen – für zwei.</p>
      <form className="group form" onSubmit={submit}>
        <label className="row">
          <span className="lbl">E-Mail</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="du@beispiel.de" />
        </label>
        <label className="row">
          <span className="lbl">Passwort</span>
          <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6}
            value={pw} onChange={(e) => setPw(e.target.value)} placeholder="mind. 6 Zeichen" />
        </label>
      </form>
      {msg && <p className={msg.ok ? 'note ok' : 'note err'}>{msg.text}</p>}
      <button className="btn primary block" disabled={busy || !email || pw.length < 6} onClick={submit}>
        {busy ? '…' : mode === 'in' ? 'Anmelden' : 'Konto erstellen'}
      </button>
      <button className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); }}>
        {mode === 'in' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
      </button>
    </div>
  );
}
