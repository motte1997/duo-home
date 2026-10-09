import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import type { Profile } from '../lib/types';
import { useData } from '../lib/store';

export const cv = (color: string): CSSProperties => ({ ['--c' as string]: color } as CSSProperties);

/* ---------- Icons ---------- */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
export const Icon = {
  check: (p: { size?: number }) => (
    <svg width={p.size ?? 16} height={p.size ?? 16} viewBox="0 0 24 24" {...S} strokeWidth={3.2}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
  ),
  plus: () => <svg width="22" height="22" viewBox="0 0 24 24" {...S} strokeWidth={2.6}><path d="M12 5v14M5 12h14" /></svg>,
  today: () => <svg width="26" height="26" viewBox="0 0 24 24" {...S}><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>,
  list: () => <svg width="26" height="26" viewBox="0 0 24 24" {...S}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>,
  chart: () => <svg width="26" height="26" viewBox="0 0 24 24" {...S}><path d="M5 20V11M12 20V4M19 20v-6" /></svg>,
  gear: () => <svg width="26" height="26" viewBox="0 0 24 24" {...S}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>,
  chevron: () => <svg width="9" height="15" viewBox="0 0 9 15" {...S} strokeWidth={2.4}><path d="M1.5 1.5l6 6-6 6" /></svg>,
  back: () => <svg width="12" height="20" viewBox="0 0 12 20" {...S} strokeWidth={2.6}><path d="M10 2L2 10l8 8" /></svg>,
  repeat: () => <svg width="13" height="13" viewBox="0 0 24 24" {...S} strokeWidth={2.4}><path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" /></svg>,
  flame: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5 5 5.5 5 10.5A5 5 0 0112 18a5 5 0 01-5-5.5c0-1.7.8-3 1.8-4 .2 1.4 1 2.2 1.7 2.5C10 8 10.8 4.5 12 2z" /></svg>,
  trophy: () => <svg width="20" height="20" viewBox="0 0 24 24" {...S}><path d="M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3M12 14v4M8 21h8M10 18h4" /></svg>,
};

/* ---------- Avatar ---------- */
export function Avatar({ p, size = 32 }: { p: Pick<Profile, 'color' | 'emoji'> | null | undefined; size?: number }) {
  const color = p?.color ?? '#8E8E93';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.55, background: color + '33', boxShadow: `inset 0 0 0 2px ${color}` }}>
      {p?.emoji ?? '👥'}
    </span>
  );
}

/* ---------- Fortschrittsring ---------- */
export function Ring({ value, size = 64, stroke = 8, color = 'var(--blue)', children }:
  { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`} style={{ transition: 'stroke-dasharray .6s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}

/* ---------- Bedienelemente ---------- */
export function Segmented<T extends string>({ value, onChange, options }:
  { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button className={'switch' + (checked ? ' on' : '')} role="switch" aria-checked={checked} disabled={disabled}
      onClick={() => onChange(!checked)}><span /></button>
  );
}

export function Stepper({ value, onChange, min = 0, max = 1000, step = 1 }:
  { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label="weniger">−</button>
      <span>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + step))} aria-label="mehr">+</button>
    </div>
  );
}

/* ---------- Sheet (Bottom Sheet) ---------- */
export function Sheet({ title, onClose, onSave, saveLabel = 'Sichern', saving, children }:
  { title: string; onClose: () => void; onSave?: () => void; saveLabel?: string; saving?: boolean; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Sichtbaren Bereich verfolgen: Bei geöffneter Tastatur schrumpft das Sheet,
  // sodass alle Felder darüber erreichbar (scrollbar) bleiben.
  const [vp, setVp] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVp({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update); };
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}
      style={vp ? { top: vp.top, bottom: 'auto', height: vp.height } : undefined}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <button className="link" onClick={onClose}>Abbrechen</button>
          <h2>{title}</h2>
          {onSave ? <button className="link bold" disabled={saving} onClick={onSave}>{saving ? '…' : saveLabel}</button> : <span style={{ width: 70 }} />}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="navbar">
      <button className="link back" onClick={onBack}><Icon.back /> Zurück</button>
      <h1>{title}</h1>
      <div className="navbar-right">{right}</div>
    </div>
  );
}

export function Toast() {
  const { toast, dismissToast } = useData();
  if (!toast) return null;
  return (
    <div className={'toast ' + (toast.kind ?? '')} key={toast.id} onClick={dismissToast}>
      <span>{toast.text}</span>
      {toast.onAction && (
        <button onClick={(e) => { e.stopPropagation(); toast.onAction?.(); }}>{toast.actionLabel}</button>
      )}
    </div>
  );
}

export function Empty({ emoji, title, text }: { emoji: string; title: string; text?: string }) {
  return (
    <div className="empty">
      <div className="empty-emoji">{emoji}</div>
      <strong>{title}</strong>
      {text && <p>{text}</p>}
    </div>
  );
}
