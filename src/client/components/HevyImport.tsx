import { useState } from 'react';
import { api } from '../api.js';

type ImportResult = {
  workoutsInFile: number;
  setsInFile: number;
  added: number;
  updated: number;
  unchanged: number;
};

export function HevyImport({ onImported }: { onImported: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Το CSV είναι μεγαλύτερο από 5 MB.');
      const imported = await api<ImportResult>('/hevy/import', {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: file,
      });
      setResult(imported);
      await onImported();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hevy-import">
      <label>
        Hevy CSV export
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setResult(null);
            setError('');
          }}
        />
      </label>
      <button
        className="text-action"
        type="button"
        disabled={!file || busy}
        onClick={() => void upload()}
      >
        {busy ? 'Εισαγωγή…' : 'Εισαγωγή CSV'}
      </button>
      {result && (
        <p className="hevy-import-result" role="status">
          {result.added} νέες · {result.updated} ενημερώθηκαν · {result.unchanged} αμετάβλητες
        </p>
      )}
      {error && (
        <p className="hevy-import-error" role="alert">
          {error}
        </p>
      )}
      <small>
        Μπορείς να ανεβάσεις πλήρες ή περικομμένο export. Όσα λείπουν από το CSV δεν διαγράφονται.
      </small>
    </div>
  );
}
