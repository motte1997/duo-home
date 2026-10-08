// Leichtgewichtige SVG-Diagramme ohne externe Bibliothek.

type BarsProps = { axis: string[]; series: number[][]; colors: string[]; height?: number };

export function StackedBars({ axis, series, colors, height = 150 }: BarsProps) {
  const n = axis.length;
  const W = 320, padL = 22, padB = 20, padT = 8;
  const H = height;
  const totals = axis.map((_, i) => series.reduce((a, s) => a + (s[i] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const plotH = H - padB - padT;
  const slot = (W - padL) / n;
  const bw = Math.max(3, Math.min(26, slot * 0.62));
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Erledigte Aufgaben">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="var(--sep)" strokeWidth="0.6" />
          <text x={padL - 4} y={y(niceMax * f) + 3} textAnchor="end" className="ax">{Math.round(niceMax * f)}</text>
        </g>
      ))}
      {axis.map((lab, i) => {
        const x = padL + slot * i + (slot - bw) / 2;
        let acc = 0;
        return (
          <g key={i}>
            {series.map((s, si) => {
              const v = s[i] ?? 0;
              if (!v) return null;
              const y1 = y(acc + v), y0 = y(acc);
              acc += v;
              return <rect key={si} x={x} y={y1} width={bw} height={Math.max(0, y0 - y1 - 0.6)} rx={Math.min(3, bw / 2)} fill={colors[si]} />;
            })}
            <text x={x + bw / 2} y={H - 5} textAnchor="middle" className="ax">{lab}</text>
          </g>
        );
      })}
    </svg>
  );
}

type LineProps = { axis: string[]; series: number[][]; colors: string[]; height?: number };

export function LineChart({ axis, series, colors, height = 150 }: LineProps) {
  const W = 320, padL = 28, padB = 20, padT = 10, padR = 8;
  const H = height;
  const n = axis.length;
  const max = Math.max(4, ...series.flat());
  const niceMax = Math.ceil(max / 4) * 4;
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const y = (v: number) => padT + (H - padB - padT) * (1 - v / niceMax);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Punkteentwicklung">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={padL} x2={W - padR} y1={y(niceMax * f)} y2={y(niceMax * f)} stroke="var(--sep)" strokeWidth="0.6" />
          <text x={padL - 4} y={y(niceMax * f) + 3} textAnchor="end" className="ax">{Math.round(niceMax * f)}</text>
        </g>
      ))}
      {axis.map((lab, i) => lab ? <text key={i} x={x(i)} y={H - 5} textAnchor="middle" className="ax">{lab}</text> : null)}
      {series.map((s, si) => (
        <g key={si}>
          <polyline fill="none" stroke={colors[si]} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round"
            points={s.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
          {s.length > 0 && <circle cx={x(s.length - 1)} cy={y(s[s.length - 1])} r="3.6" fill={colors[si]} />}
        </g>
      ))}
    </svg>
  );
}

export function Donut({ values, colors, size = 120, stroke = 18, center }:
  { values: number[]; colors: string[]; size?: number; stroke?: number; center?: React.ReactNode }) {
  const total = values.reduce((a, b) => a + b, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth={stroke} />
        {total > 0 && values.map((v, i) => {
          const len = (v / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors[i]} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - (values.filter((x) => x > 0).length > 1 ? 2 : 0))} ${c}`}
              strokeDashoffset={-offset} />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="ring-in">{center}</div>
    </div>
  );
}
