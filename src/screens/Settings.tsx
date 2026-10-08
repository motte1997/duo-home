import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useData } from '../lib/store';
import {
  currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, sendTestPush,
} from '../lib/push';
import { Segmented, Switch } from '../components/ui';
import { ProfilePicker } from './Onboarding';

type Theme = 'auto' | 'light' | 'dark';

function applyTheme(t: Theme) {
  if (t === 'auto') { delete document.documentElement.dataset.theme; localStorage.removeItem('duo-theme'); }
  else { document.documentElement.dataset.theme = t; localStorage.setItem('duo-theme', t); }
}

/** Kleine Layout-Diagnose: zeigt, welche Höhen iOS der App meldet. */
function Diag() {
  const [text, setText] = useState('');
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;visibility:hidden;pointer-events:none;box-sizing:border-box;';
    document.body.appendChild(probe);
    const hh = (v: string) => { probe.style.height = v; return Math.round(probe.getBoundingClientRect().height); };
    const pad = (side: 'top' | 'bottom') => {
      probe.style.height = '0px';
      probe.style.padding = '0';
      probe.style[side === 'top' ? 'paddingTop' : 'paddingBottom'] = `env(safe-area-inset-${side})`;
      const cs = getComputedStyle(probe);
      const v = side === 'top' ? cs.paddingTop : cs.paddingBottom;
      probe.style.padding = '0';
      return v;
    };
    const safeT = pad('top'), safeB = pad('bottom');
    const vv = window.visualViewport;
    const lines = [
      `innerHeight ${window.innerHeight} · screen ${window.screen.height} · visual ${vv ? Math.round(vv.height) : '-'}`,
      `100vh ${hh('100vh')} · 100dvh ${hh('100dvh')} · 100lvh ${hh('100lvh')} · 100svh ${hh('100svh')}`,
      `safe oben ${safeT} · unten ${safeB} · standalone ${isStandalone() ? 'ja' : 'nein'}`,
    ];
    document.body.removeChild(probe);
    setText(lines.join('\n'));
  }, []);
  return <p className="hint center" style={{ whiteSpace: 'pre-line', fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{text}</p>;
}

export function Settings() {
  const d = useData();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('duo-theme') as Theme) || 'auto');
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(d.me?.display_name ?? '');
  const [color, setColor] = useState(d.me?.color ?? '#0A84FF');
  const [emoji, setEmoji] = useState(d.me?.emoji ?? '🙂');
  const [hhName, setHhName] = useState(d.household?.name ?? '');

  useEffect(() => { void currentSubscription().then((s) => setPushOn(Boolean(s))).catch(() => {}); }, []);

  const togglePush = async (on: boolean) => {
    setPushBusy(true);
    try {
      if (on) { await enablePush(d.user.id); setPushOn(true); d.showToast({ text: 'Push aktiviert', kind: 'ok' }); }
      else { await disablePush(); setPushOn(false); }
    } catch (e) {
      d.showToast({ text: (e as Error).message, kind: 'error' });
    } finally { setPushBusy(false); }
  };

  const needInstall = isIOS() && !isStandalone();

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({
      exportedAt: new Date().toISOString(), household: d.household, members: d.members,
      tasks: d.tasks, occurrences: d.occs, pointEvents: d.events,
    }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `duo-home-export-${d.today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const saveProfile = async () => {
    await d.updateProfile({ display_name: name.trim() || d.me?.display_name, color, emoji });
    setEditing(false);
  };

  return (
    <div className="page">
      <h1 className="large">Einstellungen</h1>

      <div className="section-title">Profil</div>
      {!editing ? (
        <div className="group">
          <div className="row" onClick={() => setEditing(true)}>
            <span className="grow">{d.me?.emoji} {d.me?.display_name}</span><span className="link">Bearbeiten</span>
          </div>
        </div>
      ) : (
        <>
          <ProfilePicker name={name} setName={setName} color={color} setColor={setColor} emoji={emoji} setEmoji={setEmoji} />
          <button className="btn primary block" onClick={saveProfile}>Speichern</button>
        </>
      )}

      <div className="section-title">Haushalt</div>
      <div className="group">
        <label className="row"><span className="lbl">Name</span>
          <input value={hhName} onChange={(e) => setHhName(e.target.value)}
            onBlur={() => hhName.trim() && hhName !== d.household?.name && void d.updateHousehold({ name: hhName.trim() })} /></label>
        <div className="row"><span className="grow">Einladungscode</span><b className="code">{d.household?.invite_code}</b></div>
        <div className="row"><span className="grow">Mitglieder</span><span>{d.members.map((m) => m.display_name).join(' & ')}</span></div>
        <div className="row"><span className="grow">Zeitzone</span><span>{d.tz}</span></div>
      </div>
      {d.members.length < 2 && (
        <button className="btn secondary block"
          onClick={() => {
            const text = `Tritt unserem Haushalt in Duo Home bei – Code: ${d.household?.invite_code}`;
            if (navigator.share) void navigator.share({ text }).catch(() => {});
            else void navigator.clipboard?.writeText(text).then(() => d.showToast({ text: 'Kopiert' }));
          }}>Code teilen</button>
      )}

      <div className="section-title">Benachrichtigungen</div>
      <div className="group">
        {!pushSupported || needInstall ? (
          <div className="row col">
            <b>{needInstall ? 'Zuerst installieren' : 'Push nicht verfügbar'}</b>
            <span className="sub">
              {needInstall
                ? 'Tippe in Safari auf Teilen ⬆︎ → „Zum Home-Bildschirm“ und öffne die App von dort. Erst dann sind Push-Nachrichten möglich (iOS 16.4+).'
                : 'Dein Browser unterstützt keine Web-Push-Nachrichten.'}
            </span>
          </div>
        ) : (
          <>
            <div className="row"><span className="grow">Push aktivieren</span>
              <Switch checked={pushOn} onChange={togglePush} disabled={pushBusy} /></div>
            {pushOn && (
              <button className="row link-row" onClick={() => void sendTestPush().then(() => d.showToast({ text: 'Test gesendet' })).catch((e) => d.showToast({ text: (e as Error).message, kind: 'error' }))}>
                Test-Nachricht senden
              </button>
            )}
          </>
        )}
      </div>
      <p className="hint">Du wirst erinnert, wenn Aufgaben fällig oder überfällig sind und wenn dein Partner etwas erledigt.</p>

      <div className="section-title">Erscheinungsbild</div>
      <Segmented<Theme> value={theme} onChange={(t) => { setTheme(t); applyTheme(t); }}
        options={[{ value: 'auto', label: 'System' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]} />

      <div className="section-title">Daten</div>
      <div className="group">
        <button className="row link-row" onClick={exportJson}>Daten exportieren (JSON)</button>
        <button className="row link-row" onClick={() => void d.reload().then(() => d.showToast({ text: 'Aktualisiert' }))}>Jetzt synchronisieren</button>
      </div>

      <div className="group" style={{ marginTop: 24 }}>
        <button className="row danger-row red" onClick={() => void supabase.auth.signOut()}>Abmelden</button>
      </div>
      <p className="hint center">Duo Home 1.1 ·{d.online ? 'online' : 'offline (gecachte Daten)'}</p>
      <Diag />
      <div style={{ height: 30 }} />
    </div>
  );
}
