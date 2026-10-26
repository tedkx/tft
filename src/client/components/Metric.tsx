import { fmt } from '../utils.js';
import { macroColors } from '../constants.js';
import type { Macros } from '../models.js';
import type { CSSProperties } from 'react';

export function Metric({
  name,
  actual,
  target,
  percent,
  unit,
  macro,
}: {
  name: string;
  actual: number;
  target: number;
  percent: number;
  unit: string;
  macro: keyof Macros;
}) {
  const excess = percent > 100;
  return (
    <div className="metric" style={{ '--macro-color': macroColors[macro] } as CSSProperties}>
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
