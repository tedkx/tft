import { useEffect, useState } from 'react';
import type { Macros, TargetPlan } from '../models.js';
import { displayDay, fmt } from '../utils.js';
import { MacroFields } from './MacroFields.js';

export function TargetsEditor({
  plan,
  busy,
  onSave,
}: {
  plan: TargetPlan;
  busy: boolean;
  onSave: (targets: Macros) => void;
}) {
  const [draft, setDraft] = useState<Macros>(plan.targets);
  useEffect(() => setDraft(plan.targets), [plan]);

  return (
    <section className="panel settings-panel targets-editor">
      <div className="panel-title">
        <div>
          <div className="eyebrow">ΗΜΕΡΗΣΙΟ ΠΛΑΝΟ</div>
          <h2>Στόχοι macros</h2>
        </div>
      </div>
      <p className="settings-copy">
        Οι αλλαγές θα ισχύσουν από {displayDay(plan.effectiveDay)} και για κάθε επόμενη ημέρα. Οι
        προηγούμενες ημέρες θα κρατήσουν τους δικούς τους στόχους.
      </p>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <MacroFields macros={draft} setMacros={setDraft} min={1} />
        <div className="targets-preview">
          <span>Τρέχον πλάνο</span>
          <strong>
            {fmt(draft.protein)} g πρωτεΐνη · {fmt(draft.carbs)} g υδατάνθρακες · {fmt(draft.fat)} g
            λιπαρά · {fmt(draft.kcal)} kcal
          </strong>
        </div>
        <button className="primary" disabled={busy}>
          {busy ? 'Αποθήκευση…' : 'Αποθήκευση στόχων'}
        </button>
      </form>
    </section>
  );
}
