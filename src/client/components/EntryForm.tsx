import React, { useState } from 'react';
import type { Entry, Macros, Meal, Product } from '../models.js';
import { initialMacros, keys } from '../constants.js';
import { fmt } from '../utils.js';
import { MacroFields } from './MacroFields.js';
import { MealAutocomplete } from './MealAutocomplete.js';

export function EntryForm({
  day,
  initial,
  meals,
  products,
  busy,
  onSave,
}: {
  day: string;
  initial: Entry | null;
  meals: Meal[];
  products: Product[];
  busy: boolean;
  onSave: (body: unknown) => void;
}) {
  const activeMeals = meals.filter((meal) => meal.active);
  const activeProducts = products.filter((product) => product.active);
  const [kind, setKind] = useState<'meal' | 'product' | 'custom'>(
      (initial?.kind as 'meal' | 'product' | 'custom') ?? 'meal',
    ),
    [mealId, setMealId] = useState(
      initial?.kind === 'meal' ? (initial.ref_id ?? '') : (activeMeals[0]?.id ?? ''),
    ),
    [variantId, setVariantId] = useState(initial?.variant_id ?? ''),
    [productId, setProductId] = useState(initial?.kind === 'product' ? (initial.ref_id ?? '') : ''),
    [amount, setAmount] = useState(initial?.amount ?? 1),
    [label, setLabel] = useState(initial?.label ?? ''),
    [macros, setMacros] = useState<Macros>(
      initial?.kind === 'custom'
        ? (Object.fromEntries(
            keys.map((key) => [key, initial.snapshot[key] / initial.amount]),
          ) as Macros)
        : initialMacros,
    ),
    [notes, setNotes] = useState(initial?.notes ?? '');
  const selectedMeal = activeMeals.find((m) => m.id === mealId);
  const variants = selectedMeal?.variants.filter((v) => v.active) ?? [];
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0];
  const selectedProduct = activeProducts.find((p) => p.id === productId) ?? activeProducts[0];
  const preview =
    kind === 'meal'
      ? selectedVariant && {
          protein: selectedVariant.protein * amount,
          carbs: selectedVariant.carbs * amount,
          fat: selectedVariant.fat * amount,
          kcal: selectedVariant.kcal * amount,
        }
      : kind === 'product'
        ? selectedProduct && {
            protein: (selectedProduct.protein * amount) / selectedProduct.reference_amount,
            carbs: (selectedProduct.carbs * amount) / selectedProduct.reference_amount,
            fat: (selectedProduct.fat * amount) / selectedProduct.reference_amount,
            kcal: (selectedProduct.kcal * amount) / selectedProduct.reference_amount,
          }
        : {
            protein: macros.protein * amount,
            carbs: macros.carbs * amount,
            fat: macros.fat * amount,
            kcal: macros.kcal * amount,
          };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      day,
      kind,
      amount,
      notes,
      ...(kind === 'meal'
        ? { variantId: selectedVariant?.id }
        : kind === 'product'
          ? { refId: selectedProduct?.id }
          : { label, macros }),
    });
  };
  return (
    <form className="form" onSubmit={submit}>
      <label>
        Τύπος
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setAmount(e.target.value === 'product' ? (selectedProduct?.reference_amount ?? 1) : 1);
          }}
        >
          <option value="meal">Γνωστό γεύμα</option>
          <option value="product">Γνωστό προϊόν</option>
          <option value="custom">Εκτίμηση / extra</option>
        </select>
      </label>
      {kind === 'meal' && (
        <>
          <MealAutocomplete
            meals={activeMeals}
            value={mealId}
            onChange={(id) => {
              setMealId(id);
              setVariantId('');
            }}
          />
          <label>
            Παραλλαγή
            <select
              value={selectedVariant?.id ?? ''}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {kind === 'product' && (
        <label>
          Προϊόν
          <select
            value={selectedProduct?.id ?? ''}
            onChange={(e) => {
              setProductId(e.target.value);
              setAmount(activeProducts.find((p) => p.id === e.target.value)?.reference_amount ?? 1);
            }}
          >
            {activeProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.alias})
              </option>
            ))}
          </select>
        </label>
      )}
      {kind === 'custom' && (
        <>
          <label>
            Περιγραφή
            <input value={label} onChange={(e) => setLabel(e.target.value)} required />
          </label>
          <MacroFields macros={macros} setMacros={setMacros} />
        </>
      )}
      <label>
        {kind === 'product' ? `Ποσότητα (${selectedProduct?.unit ?? 'g'})` : 'Μερίδες'}
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          required
        />
      </label>
      <label>
        Σημείωση (προαιρετικά)
        <input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {preview && (
        <div className="preview-line">
          {fmt(preview.protein, 1)} g Π · {fmt(preview.carbs, 1)} g Υ · {fmt(preview.fat, 1)} g Λ ·{' '}
          {fmt(preview.kcal)} kcal
        </div>
      )}
      <button className="primary" disabled={busy || (kind === 'meal' && !selectedVariant)}>
        Αποθήκευση για {day}
      </button>
    </form>
  );
}
