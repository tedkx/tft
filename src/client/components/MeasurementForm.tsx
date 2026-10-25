import { useState } from 'react';

export function MeasurementForm({
  day,
  busy,
  onSave,
}: {
  day: string;
  busy: boolean;
  onSave: (body: unknown) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    weightKg: '',
    waistCm: '',
    fatKg: '',
    muscleKg: '',
    boneKg: '',
    steps: '',
  });
  const fields = [
    ['weightKg', 'Βάρος (kg)'],
    ['waistCm', 'Μέση (cm)'],
    ['fatKg', 'Λίπος (kg)'],
    ['muscleKg', 'Μυϊκή μάζα (kg)'],
    ['boneKg', 'Οστική μάζα (kg)'],
    ['steps', 'Βήματα'],
  ];
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          day,
          source: 'manual',
          ...Object.fromEntries(
            Object.entries(values)
              .filter(([, v]) => v !== '')
              .map(([k, v]) => [k, Number(v)]),
          ),
        });
      }}
    >
      <div className="two-fields">
        {fields.map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              min="0"
              step={key === 'steps' ? '1' : '0.1'}
              value={values[key]}
              onChange={(e) => setValues({ ...values, [key]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button className="primary" disabled={busy}>
        Αποθήκευση για {day}
      </button>
    </form>
  );
}
