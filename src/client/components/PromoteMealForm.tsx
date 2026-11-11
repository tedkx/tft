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
  const [destination, setDestination] = useState<'meal' | 'product'>('meal');
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
  const [referenceAmount, setReferenceAmount] = useState(1);
  const [unit, setUnit] = useState<'g' | 'ml' | 'serving'>('serving');
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          destination === 'meal'
            ? { destination, code, title, categories: [category], ingredientsText }
            : { destination, name: title, referenceAmount, unit, notes: ingredientsText },
        );
      }}
    >
      <p className="form-help">
        Θα αποθηκευτούν τα καταγεγραμμένα macros ({entry.snapshot.protein} g Π ·{' '}
        {entry.snapshot.carbs} g Υ · {entry.snapshot.fat} g Λ · {entry.snapshot.kcal} kcal). Η
        αρχική καταχώρηση δεν θα αλλάξει.
      </p>
      <label>
        Προσθήκη στα γνωστά
        <select
          value={destination}
          onChange={(event) => setDestination(event.target.value as 'meal' | 'product')}
        >
          <option value="meal">Γεύματα</option>
          <option value="product">Προϊόντα</option>
        </select>
      </label>
      {destination === 'meal' ? (
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
      ) : (
        <div className="two-fields">
          <label>
            Ποσότητα αναφοράς
            <input
              type="number"
              min="0.01"
              step="any"
              value={referenceAmount}
              onChange={(event) => setReferenceAmount(Number(event.target.value))}
              required
            />
          </label>
          <label>
            Μονάδα
            <select
              value={unit}
              onChange={(event) => setUnit(event.target.value as 'g' | 'ml' | 'serving')}
            >
              <option value="serving">μερίδα</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
            </select>
          </label>
        </div>
      )}
      <label>
        {destination === 'meal' ? 'Τίτλος' : 'Όνομα προϊόντος'}
        <input
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </label>
      <label>
        {destination === 'meal' ? 'Υλικά / περιγραφή για αναζήτηση' : 'Σημειώσεις'}
        <textarea
          rows={3}
          maxLength={5000}
          value={ingredientsText}
          onChange={(event) => setIngredientsText(event.target.value)}
        />
      </label>
      <button className="primary" disabled={busy}>
        Προσθήκη στα γνωστά {destination === 'meal' ? 'γεύματα' : 'προϊόντα'}
      </button>
    </form>
  );
}
