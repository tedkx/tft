import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { Ingredient, Meal, Product } from '../models.js';
import { categories, initialMacros } from '../constants.js';
import { api } from '../api.js';
import { MacroFields } from './MacroFields.js';

export function LibraryEditor({
  meals,
  products,
  busy,
  save,
}: {
  meals: Meal[];
  products: Product[];
  busy: boolean;
  save: (fn: () => Promise<unknown>, close?: boolean) => void;
}) {
  const [tab, setTab] = useState<'meals' | 'products'>('meals'),
    [mealId, setMealId] = useState(''),
    [variantId, setVariantId] = useState(''),
    [productId, setProductId] = useState(''),
    [mealDraft, setMealDraft] = useState({
      code: '',
      title: '',
      category: 'breakfast',
      description: '',
      active: true,
    }),
    [variantDraft, setVariantDraft] = useState({
      name: '',
      macroMode: 'manual' as 'manual' | 'computed',
      ingredients: [] as Ingredient[],
      macros: { ...initialMacros },
      isDefault: false,
      active: true,
    }),
    [productDraft, setProductDraft] = useState({
      alias: '',
      name: '',
      referenceAmount: 100,
      unit: 'g',
      protein: 0,
      carbs: 0,
      fat: 0,
      kcal: 0,
      salt: 0,
      source: '',
      notes: '',
      active: true,
    });
  const selectedMeal = meals.find((m) => m.id === mealId),
    selectedVariant = selectedMeal?.variants.find((v) => v.id === variantId);
  const activeProducts = products.filter((p) => p.active);
  const chooseMeal = (id: string) => {
    setMealId(id);
    setVariantId('');
    const m = meals.find((x) => x.id === id);
    setMealDraft(
      m
        ? {
            code: m.code,
            title: m.title,
            category: m.category,
            description: m.description ?? '',
            active: !!m.active,
          }
        : { code: '', title: '', category: 'breakfast', description: '', active: true },
    );
    setVariantDraft({
      name: '',
      macroMode: 'manual',
      ingredients: [],
      macros: { ...initialMacros },
      isDefault: false,
      active: true,
    });
  };
  const chooseVariant = (id: string) => {
    setVariantId(id);
    const v = selectedMeal?.variants.find((x) => x.id === id);
    if (v)
      setVariantDraft({
        name: v.name,
        macroMode: v.macro_mode,
        ingredients: (v.ingredients as Ingredient[]).filter((i) => 'productId' in i),
        macros: { protein: v.protein, carbs: v.carbs, fat: v.fat, kcal: v.kcal },
        isDefault: !!v.is_default,
        active: !!v.active,
      });
  };
  const chooseProduct = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setProductDraft(
      p
        ? {
            alias: p.alias,
            name: p.name,
            referenceAmount: p.reference_amount,
            unit: p.unit,
            protein: p.protein,
            carbs: p.carbs,
            fat: p.fat,
            kcal: p.kcal,
            salt: p.salt ?? 0,
            source: p.source ?? '',
            notes: p.notes ?? '',
            active: !!p.active,
          }
        : {
            alias: '',
            name: '',
            referenceAmount: 100,
            unit: 'g',
            protein: 0,
            carbs: 0,
            fat: 0,
            kcal: 0,
            salt: 0,
            source: '',
            notes: '',
            active: true,
          },
    );
  };
  const variantPayload = {
    ...variantDraft,
    macroMode: variantDraft.macroMode,
    ingredients: variantDraft.ingredients,
    macros: variantDraft.macros,
  };
  return (
    <div className="library-editor">
      <div className="segment">
        <button className={tab === 'meals' ? 'selected' : ''} onClick={() => setTab('meals')}>
          Γεύματα ({meals.length})
        </button>
        <button className={tab === 'products' ? 'selected' : ''} onClick={() => setTab('products')}>
          Προϊόντα ({products.length})
        </button>
      </div>
      {tab === 'meals' ? (
        <>
          <label className="form-label">
            Γεύμα
            <select value={mealId} onChange={(e) => chooseMeal(e.target.value)}>
              <option value="">＋ Νέο γεύμα</option>
              {meals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} · {m.title}
                  {m.active ? '' : ' (ανενεργό)'}
                </option>
              ))}
            </select>
          </label>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                () =>
                  api(mealId ? `/meals/${mealId}` : '/meals', {
                    method: mealId ? 'PATCH' : 'POST',
                    body: JSON.stringify(mealDraft),
                  }),
                false,
              );
            }}
          >
            <div className="two-fields">
              <label>
                Κωδικός
                <input
                  value={mealDraft.code}
                  onChange={(e) => setMealDraft({ ...mealDraft, code: e.target.value })}
                  placeholder="B9"
                  required
                />
              </label>
              <label>
                Κατηγορία
                <select
                  value={mealDraft.category}
                  onChange={(e) => setMealDraft({ ...mealDraft, category: e.target.value })}
                >
                  {Object.entries(categories).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Τίτλος
              <input
                value={mealDraft.title}
                onChange={(e) => setMealDraft({ ...mealDraft, title: e.target.value })}
                required
              />
            </label>
            <label>
              Περιγραφή
              <textarea
                rows={3}
                value={mealDraft.description}
                onChange={(e) => setMealDraft({ ...mealDraft, description: e.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={mealDraft.active}
                onChange={(e) => setMealDraft({ ...mealDraft, active: e.target.checked })}
              />{' '}
              Ενεργό γεύμα
            </label>
            <button className="primary" disabled={busy}>
              Αποθήκευση γεύματος
            </button>
          </form>
          {selectedMeal && (
            <div className="variant-section">
              <h3>Παραλλαγές</h3>
              <label className="form-label">
                Επιλογή
                <select value={variantId} onChange={(e) => chooseVariant(e.target.value)}>
                  <option value="">＋ Νέα παραλλαγή</option>
                  {selectedMeal.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                      {v.active ? '' : ' (ανενεργή)'}
                    </option>
                  ))}
                </select>
              </label>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(
                    () =>
                      api(variantId ? `/variants/${variantId}` : `/meals/${mealId}/variants`, {
                        method: variantId ? 'PATCH' : 'POST',
                        body: JSON.stringify(variantPayload),
                      }),
                    false,
                  );
                }}
              >
                <label>
                  Όνομα παραλλαγής
                  <input
                    value={variantDraft.name}
                    onChange={(e) => setVariantDraft({ ...variantDraft, name: e.target.value })}
                    required
                  />
                </label>
                <label>
                  Υπολογισμός
                  <select
                    value={variantDraft.macroMode}
                    onChange={(e) =>
                      setVariantDraft({
                        ...variantDraft,
                        macroMode: e.target.value as 'manual' | 'computed',
                      })
                    }
                  >
                    <option value="manual">Εκτιμώμενα macros</option>
                    <option value="computed">Από γνωστά προϊόντα</option>
                  </select>
                </label>
                {variantDraft.macroMode === 'manual' ? (
                  <MacroFields
                    macros={variantDraft.macros}
                    setMacros={(m) => setVariantDraft({ ...variantDraft, macros: m })}
                  />
                ) : (
                  <div className="ingredients">
                    <div className="muted-label">Υλικά από τη βιβλιοθήκη προϊόντων</div>
                    {variantDraft.ingredients.map((ingredient, index) => (
                      <div className="ingredient" key={index}>
                        <select
                          value={ingredient.productId}
                          onChange={(e) =>
                            setVariantDraft({
                              ...variantDraft,
                              ingredients: variantDraft.ingredients.map((x, i) =>
                                i === index ? { ...x, productId: e.target.value } : x,
                              ),
                            })
                          }
                        >
                          {activeProducts.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.alias}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={ingredient.amount}
                          onChange={(e) =>
                            setVariantDraft({
                              ...variantDraft,
                              ingredients: variantDraft.ingredients.map((x, i) =>
                                i === index ? { ...x, amount: Number(e.target.value) } : x,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() =>
                            setVariantDraft({
                              ...variantDraft,
                              ingredients: variantDraft.ingredients.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-action"
                      onClick={() => {
                        if (activeProducts[0])
                          setVariantDraft({
                            ...variantDraft,
                            ingredients: [
                              ...variantDraft.ingredients,
                              {
                                productId: activeProducts[0].id,
                                amount: activeProducts[0].reference_amount,
                              },
                            ],
                          });
                      }}
                    >
                      <Plus size={15} /> Υλικό
                    </button>
                  </div>
                )}
                <div className="two-fields">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={variantDraft.isDefault}
                      onChange={(e) =>
                        setVariantDraft({ ...variantDraft, isDefault: e.target.checked })
                      }
                    />{' '}
                    Προεπιλεγμένη
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={variantDraft.active}
                      onChange={(e) =>
                        setVariantDraft({ ...variantDraft, active: e.target.checked })
                      }
                    />{' '}
                    Ενεργή
                  </label>
                </div>
                <button className="primary" disabled={busy}>
                  Αποθήκευση παραλλαγής
                </button>
              </form>
            </div>
          )}
        </>
      ) : (
        <>
          <label className="form-label">
            Προϊόν
            <select value={productId} onChange={(e) => chooseProduct(e.target.value)}>
              <option value="">＋ Νέο προϊόν</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.alias}
                  {p.active ? '' : ' (ανενεργό)'}
                </option>
              ))}
            </select>
          </label>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              save(
                () =>
                  api(productId ? `/products/${productId}` : '/products', {
                    method: productId ? 'PATCH' : 'POST',
                    body: JSON.stringify({ ...productDraft, source: productDraft.source || null }),
                  }),
                false,
              );
            }}
          >
            <div className="two-fields">
              <label>
                Alias
                <input
                  value={productDraft.alias}
                  onChange={(e) => setProductDraft({ ...productDraft, alias: e.target.value })}
                  required
                />
              </label>
              <label>
                Όνομα
                <input
                  value={productDraft.name}
                  onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })}
                  required
                />
              </label>
            </div>
            <div className="two-fields">
              <label>
                Μερίδα αναφοράς
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={productDraft.referenceAmount}
                  onChange={(e) =>
                    setProductDraft({ ...productDraft, referenceAmount: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Μονάδα
                <select
                  value={productDraft.unit}
                  onChange={(e) => setProductDraft({ ...productDraft, unit: e.target.value })}
                >
                  <option value="g">g</option>
                  <option value="ml">ml</option>
                  <option value="serving">μερίδα</option>
                </select>
              </label>
            </div>
            <MacroFields
              macros={productDraft}
              setMacros={(m) => setProductDraft({ ...productDraft, ...m })}
            />
            <div className="two-fields">
              <label>
                Αλάτι (g)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productDraft.salt}
                  onChange={(e) =>
                    setProductDraft({ ...productDraft, salt: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Πηγή URL
                <input
                  type="url"
                  value={productDraft.source}
                  onChange={(e) => setProductDraft({ ...productDraft, source: e.target.value })}
                />
              </label>
            </div>
            <label>
              Σημειώσεις
              <textarea
                rows={2}
                value={productDraft.notes}
                onChange={(e) => setProductDraft({ ...productDraft, notes: e.target.value })}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={productDraft.active}
                onChange={(e) => setProductDraft({ ...productDraft, active: e.target.checked })}
              />{' '}
              Ενεργό προϊόν
            </label>
            <button className="primary" disabled={busy}>
              Αποθήκευση προϊόντος
            </button>
          </form>
        </>
      )}
    </div>
  );
}
