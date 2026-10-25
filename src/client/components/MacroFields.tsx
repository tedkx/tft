import type { Macros } from '../models.js';
import { keys, labels } from '../constants.js';

export function MacroFields({
  macros,
  setMacros,
  min = 0,
}: {
  macros: Macros;
  setMacros: (value: Macros) => void;
  min?: number;
}) {
  return (
    <div className="macro-fields">
      {keys.map((key) => (
        <label key={key}>
          {labels[key]}
          <input
            type="number"
            min={min}
            step="0.1"
            value={macros[key]}
            onChange={(e) => setMacros({ ...macros, [key]: Number(e.target.value) })}
            required
          />
        </label>
      ))}
    </div>
  );
}
