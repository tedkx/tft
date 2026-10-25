import { useState } from 'react';

export function SleepForm({
  day,
  initial,
  busy,
  onSave,
}: {
  day: string;
  initial?: number;
  busy: boolean;
  onSave: (body: unknown) => void;
}) {
  const [hours, setHours] = useState(Math.floor((initial ?? 0) / 60)),
    [minutes, setMinutes] = useState((initial ?? 0) % 60);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ minutes: hours * 60 + minutes, source: 'manual' });
      }}
    >
      <p className="form-help">Ο ύπνος ανήκει στην ημέρα που ξύπνησες: {day}.</p>
      <div className="two-fields">
        <label>
          Ώρες
          <input
            type="number"
            min="0"
            max="24"
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
          />
        </label>
        <label>
          Λεπτά
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </label>
      </div>
      <button className="primary" disabled={busy}>
        Αποθήκευση
      </button>
    </form>
  );
}
