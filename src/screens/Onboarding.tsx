import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/store';
import { Avatar, Segmented } from '../components/ui';

export const COLORS = ['#0A84FF', '#FF9F0A', '#30D158', '#FF375F', '#BF5AF2', '#40C8E0'];
export const EMOJIS = ['🙂', '😎', '🦊', '🐻', '🐼', '🦁', '🐸', '🦄', '🌻', '🍀', '🚀', '⭐'];

export function ProfilePicker({ name, setName, color, setColor, emoji, setEmoji }: {
  name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void;
  emoji: string; setEmoji: (v: string) => void;
}) {
  return (
    <>
      <div className="center"><Avatar p={{ color, emoji }} size={72} /></div>
      <div className="group">
        <label className="row">
          <span className="lbl">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dein Name" maxLength={24} />
        </label>
      </div>
      <div className="section-title">Symbol</div>
      <div className="chips">
        {EMOJIS.map((e) => (
          <button key={e} className={'chip emoji' + (e === emoji ? ' on' : '')} onClick={() => setEmoji(e)}>{e}</button>
        ))}
      </div>
      <div className="section-title">Farbe</div>
      <div className="chips">
        {COLORS.map((c) => (
          <button key={c} aria-label={c} className={'swatch' + (c === color ? ' on' : '')}
            style={{ background: c }} onClick={() => setColor(c)} />
        ))}
      </div>
    </>
  );
}

export function Onboarding() {
  const d = useData();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🙂');
  const [color, setColor] = useState(COLORS[0]);
  const [hhName, setHhName] = useState('Unser Zuhause');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const go = async () => {
    setBusy(true); setErr(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';
    const { error } = mode === 'create'
      ? await supabase.rpc('create_household', { p_name: hhName, p_display_name: name, p_color: color, p_emoji: emoji, p_tz: tz })
      : await supabase.rpc('join_household', { p_code: code, p_display_name: name, p_color: color, p_emoji: emoji });
    if (error) { setErr(error.message); setBusy(false); return; }
    await d.reload();
    setBusy(false);
  };

  const valid = name.trim().length > 0 && (mode === 'create' || code.trim().length >= 4);

  return (
    <div className="page pad">
      <h1 className="large">Willkommen 👋</h1>
      <p className="muted">Erstelle dein Profil und richte euren gemeinsamen Haushalt ein.</p>
      <ProfilePicker name={name} setName={setName} color={color} setColor={setColor} emoji={emoji} setEmoji={setEmoji} />

      <div className="section-title">Haushalt</div>
      <Segmented value={mode} onChange={setMode}
        options={[{ value: 'create', label: 'Neu erstellen' }, { value: 'join', label: 'Beitreten' }]} />
      <div className="group" style={{ marginTop: 12 }}>
        {mode === 'create' ? (
          <label className="row"><span className="lbl">Name</span>
            <input value={hhName} onChange={(e) => setHhName(e.target.value)} maxLength={32} /></label>
        ) : (
          <label className="row"><span className="lbl">Code</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="z. B. A1B2C3"
              autoCapitalize="characters" maxLength={8} /></label>
        )}
      </div>
      <p className="hint">
        {mode === 'create'
          ? 'Danach bekommst du einen Einladungscode für deinen Partner.'
          : 'Den Code findet dein Partner unter Einstellungen → Haushalt.'}
      </p>
      {err && <p className="note err">{err}</p>}
      <button className="btn primary block" disabled={!valid || busy} onClick={go}>
        {busy ? '…' : mode === 'create' ? 'Haushalt erstellen' : 'Beitreten'}
      </button>
      <button className="link center-link" onClick={() => void supabase.auth.signOut()}>Abmelden</button>
    </div>
  );
}
