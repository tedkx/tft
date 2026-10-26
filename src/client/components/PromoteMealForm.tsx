import { useState } from 'react';
import type { Entry, Meal } from '../models.js';
import { categories } from '../constants.js';

type Category = Meal['categories'][number];
const prefixes: Record<Category, string> = {
  breakfast: 'B',
  lunch: 'L',
  snack: 'S',
  dinner: 'D',
};

export function PromoteMealForm({
  entry,
  meals,
  busy,
  onSave,
}: {
  entry: Entry;
  meals: Meal[];
  busy: boolean;
  onSave: (body: unknown) => void;
}) {
  const [category, setCategory] = useState<Category>('dinner');
  const nextCode = (value: Category) => {
    const prefix = prefixes[value];
    const used = new Set(meals.map((meal) => meal.code.toUpperCase()));
    let number = 1;
    while (used.has(`${prefix}${number}`)) number++;
    return `${prefix}${number}`;
  };
  const [code, setCode] = useState(nextCode('dinner'));
  const [title, setTitle] = useState(entry.label.slice(0, 200));
  const [ingredientsText, setIngredientsText] = useState(entry.label);
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ code, title, categories: [category], ingredientsText });
      }}
    >
      <p className="form-help">
        Θα δημιουργηθεί γνωστό γεύμα με τα καταγεγραμμένα macros ({entry.snapshot.protein} g Π ·{' '}
        {entry.snapshot.carbs} g Υ · {entry.snapshot.fat} g Λ · {entry.snapshot.kcal} kcal). Η
        αρχική καταχώρηση δεν θα αλλάξει.
      </p>
      <div className="two-fields">
        <label>
          Κατηγορία
          <select
            value={category}
            onChange={(event) => {
              const value = event.target.value as Category;
              setCategory(value);
              setCode(nextCode(value));
            }}
          >
            {Object.entries(categories).map(([key, value]) => (
              <option key={key} value={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Κωδικός
          <input value={code} onChange={(event) => setCode(event.target.value)} required />
        </label>
      </div>
      <label>
        Τίτλος
        <input
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      <label>
        Υλικά / περιγραφή για αναζήτηση
        <textarea
          rows={3}
          maxLength={5000}
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
        />
      </label>
      <button className="primary" disabled={busy}>
        Προσθήκη στα γνωστά γεύματα
      </button>
    </form>
  );
}
