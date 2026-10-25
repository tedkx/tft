import { fmt } from '../utils.js';

export function Metric({
  name,
  actual,
  target,
  percent,
  unit,
}: {
  name: string;
  actual: number;
  target: number;
  percent: number;
  unit: string;
}) {
  const excess = percent > 100;
  return (
    <div className="metric">
      <div className="metric-head">
        <span>{name.toUpperCase()}</span>
        <span>{percent}%</span>
      </div>
      <strong>
        {fmt(actual, 1)}{' '}
        <small>
          / {fmt(target)} {unit}
        </small>
      </strong>
      <div className="track">
        <span className={excess ? 'excess' : ''} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
    </div>
  );
}
