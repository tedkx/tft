import { useEffect, useId, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Meal } from '../models.js';

const caption = (meal: Meal) => `${meal.code} · ${meal.title}`;
const searchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('el-GR');

export function MealAutocomplete({
  meals,
  value,
  onChange,
}: {
  meals: Meal[];
  value: string;
  onChange: (id: string) => void;
}) {
  const listId = useId();
  const initialMeal = meals.find((meal) => meal.id === value) ?? meals[0];
  const [query, setQuery] = useState(initialMeal ? caption(initialMeal) : '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = meals
    .filter((meal) => searchText(caption(meal)).includes(searchText(query.trim())))
    .slice(0, 10);

  useEffect(() => {
    const selected = meals.find((meal) => meal.id === value);
    if (selected) setQuery(caption(selected));
  }, [meals, value]);

  function choose(meal: Meal) {
    onChange(meal.id);
    setQuery(caption(meal));
    setOpen(false);
    setActiveIndex(0);
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        Math.max(0, Math.min(matches.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))),
      );
    }
    if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    }
  }

  return (
    <div className="meal-autocomplete">
      <label htmlFor={`${listId}-input`}>Γεύμα</label>
      <input
        id={`${listId}-input`}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={
          open && matches[activeIndex] ? `${listId}-${matches[activeIndex].id}` : undefined
        }
        autoComplete="off"
        placeholder="Αναζήτηση με κωδικό ή όνομα…"
        value={query}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={keyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange('');
          setOpen(true);
          setActiveIndex(0);
        }}
        required
      />
      {open && (
        <div className="meal-suggestions" id={listId} role="listbox">
          {matches.length ? (
            matches.map((meal, index) => (
              <button
                key={meal.id}
                id={`${listId}-${meal.id}`}
                type="button"
                role="option"
                aria-selected={meal.id === value}
                className={index === activeIndex ? 'active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(meal)}
              >
                <strong>{meal.code}</strong>
                <span>{meal.title}</span>
              </button>
            ))
          ) : (
            <div className="no-suggestions">Δεν βρέθηκε γεύμα</div>
          )}
        </div>
      )}
    </div>
  );
}
