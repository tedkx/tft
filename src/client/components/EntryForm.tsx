import React, { useState } from 'react';
import type { Entry, Macros, Meal, Product } from '../models.js';
import { initialMacros } from '../constants.js';
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
  const [kind, setKind] = useState<'meal' | 'product' | 'custom' | 'freetext'>(
      initial?.kind ?? 'meal',
    ),
    [mealId, setMealId] = useState(
      initial?.kind === 'meal' ? (initial.ref_id ?? '') : (activeMeals[0]?.id ?? ''),
    ),
    [variantId, setVariantId] = useState(initial?.variant_id ?? ''),
    [productId, setProductId] = useState(initial?.kind === 'product' ? (initial.ref_id ?? '') : ''),
    [quantity, setQuantity] = useState(
      initial?.kind === 'product'
        ? initial.amount / (initial.snapshot_detail?.referenceAmount ?? 1)
        : initial?.kind === 'meal'
          ? initial.amount
          : 1,
    ),
    [label, setLabel] = useState(initial?.label ?? ''),
    [macros, setMacros] = useState<Macros>(
      initial?.kind === 'custom' ? initial.snapshot : initialMacros,
    ),
    [notes, setNotes] = useState(initial?.notes ?? '');
  const selectedMeal = activeMeals.find((m) => m.id === mealId);
  const variants = selectedMeal?.variants.filter((v) => v.active) ?? [];
  const selectedVariant = variants.find((v) => v.id === variantId) ?? variants[0];
  const selectedProduct = activeProducts.find((p) => p.id === productId) ?? activeProducts[0];
  const mealDescription =
    selectedMeal?.description?.trim() || selectedMeal?.ingredients_text?.trim();
  const freetextChanged = initial?.kind === 'freetext' && label !== initial.label;
  const preview =
    kind === 'meal'
      ? selectedVariant && {
          protein: selectedVariant.protein * quantity,
          carbs: selectedVariant.carbs * quantity,
          fat: selectedVariant.fat * quantity,
          kcal: selectedVariant.kcal * quantity,
        }
      : kind === 'product'
        ? selectedProduct && {
            protein: selectedProduct.protein * quantity,
            carbs: selectedProduct.carbs * quantity,
            fat: selectedProduct.fat * quantity,
            kcal: selectedProduct.kcal * quantity,
          }
        : kind === 'custom'
          ? {
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
              kcal: macros.kcal,
            }
          : initial?.kind === 'freetext' && initial.macro_status === 'ready' && !freetextChanged
            ? initial.snapshot
            : null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      day,
      kind,
      amount:
        kind === 'product'
          ? quantity * (selectedProduct?.reference_amount ?? 1)
          : kind === 'meal'
            ? quantity
            : 1,
      notes,
      ...(kind === 'meal'
        ? { variantId: selectedVariant?.id }
        : kind === 'product'
          ? { refId: selectedProduct?.id }
          : kind === 'custom'
            ? { label, macros }
            : { label }),
    });
  };
  const quantityField = (
    <label>
      Ποσότητα
      <input
        type="number"
        min="0.01"
        step="0.01"
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        required
      />
      <small className="form-help">
        {kind === 'product'
          ? `1 = ${selectedProduct?.reference_amount ?? 1} ${selectedProduct?.unit ?? 'g'} · 0,5 = η μισή ποσότητα`
          : '1 = ολόκληρη μερίδα · 0,5 = μισή μερίδα'}
      </small>
    </label>
  );
  return (
    <form className="form" onSubmit={submit}>
      <label>
        Τύπος
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setQuantity(1);
          }}
        >
          <option value="meal">Γνωστό γεύμα</option>
          <option value="product">Γνωστό προϊόν</option>
          <option value="custom">Εκτίμηση / extra</option>
          <option value="freetext">Περιγραφή γεύματος · εκτίμηση από agent</option>
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
          {selectedMeal && (
            <div className="meal-description">
              <strong>Περιγραφή γεύματος</strong>
              <p>{mealDescription || 'Δεν έχει καταχωρηθεί περιγραφή για αυτό το γεύμα.'}</p>
            </div>
          )}
          <div className="meal-controls">
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
            {quantityField}
          </div>
        </>
      )}
      {kind === 'product' && (
        <>
          <label>
            Προϊόν
            <select
              value={selectedProduct?.id ?? ''}
              onChange={(e) => {
                setProductId(e.target.value);
                setQuantity(1);
              }}
            >
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.alias})
                </option>
              ))}
            </select>
          </label>
          {quantityField}
        </>
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
      {kind === 'freetext' && (
        <>
          <label>
            Τι έφαγες και πόσο περίπου;
            <textarea
              rows={3}
              maxLength={1000}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="π.χ. 2 καλαμάκια κοτόπουλο και μια μικρή μερίδα πατάτες"
              required
            />
          </label>
          <p className="form-help">
            Αποθηκεύεται τώρα ως εκκρεμές. Ο agent θα συμπληρώσει macros όταν τρέξει από το PC.
            {freetextChanged && ' Η αλλαγή περιγραφής θα ακυρώσει την παλιά εκτίμηση.'}
          </p>
        </>
      )}
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
