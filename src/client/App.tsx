import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Dumbbell,
  Footprints,
  MoonStar,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from 'lucide-react';
import type { Day, Entry, Meal, Overview, Page, Product, TargetPlan } from './models.js';
import { keys, labels, macroColors } from './constants.js';
import type { CSSProperties } from 'react';
import { displayDay, fmt, localDay, shiftDay } from './utils.js';
import { api } from './api.js';
import { Metric } from './components/Metric.js';
import { EntryForm } from './components/EntryForm.js';
import { SleepForm } from './components/SleepForm.js';
import { MeasurementForm } from './components/MeasurementForm.js';
import { LibraryEditor } from './components/LibraryEditor.js';
import { TargetsEditor } from './components/TargetsEditor.js';
import { HevyImport } from './components/HevyImport.js';
import { PromoteMealForm } from './components/PromoteMealForm.js';

export function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null),
    [password, setPassword] = useState(''),
    [error, setError] = useState('');
  const [day, setDay] = useState(localDay()),
    [page, setPage] = useState<Page>('today'),
    [settingsOpen, setSettingsOpen] = useState(false),
    [modal, setModal] = useState<'entry' | 'sleep' | 'measurement' | 'promote' | null>(null),
    [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [data, setData] = useState<Day | null>(null),
    [overview, setOverview] = useState<Overview | null>(null),
    [targetPlan, setTargetPlan] = useState<TargetPlan | null>(null),
    [meals, setMeals] = useState<Meal[]>([]),
    [products, setProducts] = useState<Product[]>([]);
  const [busy, setBusy] = useState(false);
  async function load() {
    try {
      const [d, o, m, p, plan] = await Promise.all([
        api<Day>(`/days/${day}`),
        api<Overview>(`/overview?end=${day}`),
        api<Meal[]>('/meals'),
        api<Product[]>('/products'),
        api<TargetPlan>('/settings/targets/current'),
      ]);
      setData(d);
      setOverview(o);
      setTargetPlan(plan);
      setMeals(m);
      setProducts(p);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const isSettings = page.startsWith('settings');
  useEffect(() => {
    api('/auth/me')
      .then(() => setLoggedIn(true))
      .catch(() => setLoggedIn(false));
  }, []);
  useEffect(() => {
    if (loggedIn) void load();
  }, [loggedIn, day]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      setLoggedIn(true);
      setPassword('');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(fn: () => Promise<unknown>, close = true) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
      if (close) setModal(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loggedIn === null) return <div className="loading">Φόρτωση…</div>;
  if (!loggedIn)
    return (
      <div className="login-wrap">
        <form className="login-card" onSubmit={login}>
          <div className="logo">
            <span>T</span>
            <div className="logo-name">
              <strong>TFT</strong>
              <small>Ted&apos;s Fitness Tracker</small>
            </div>
          </div>
          <h1>Καλώς ήρθες</h1>
          <p>Το προσωπικό σου ημερολόγιο διατροφής και προπόνησης.</p>
          <label>
            Κωδικός πρόσβασης
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button className="primary" disabled={busy}>
            Σύνδεση
          </button>
        </form>
      </div>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo">
          <span>T</span>
          <div className="logo-name">
            <strong>TFT</strong>
            <small>Ted&apos;s Fitness Tracker</small>
          </div>
        </div>
        <nav aria-label="Κύρια πλοήγηση">
          <button className={page === 'today' ? 'selected' : ''} onClick={() => setPage('today')}>
            <CalendarDays size={17} /> Σήμερα
          </button>
          <button
            className={page === 'overview' ? 'selected' : ''}
            onClick={() => setPage('overview')}
          >
            <ChartNoAxesCombined size={17} /> Επισκόπηση
          </button>
          <button
            className={isSettings ? 'selected' : ''}
            aria-expanded={settingsOpen}
            onClick={() => {
              if (isSettings) setSettingsOpen((open) => !open);
              else {
                setSettingsOpen(true);
                setPage('settings-library');
              }
            }}
          >
            <Settings2 size={17} /> Ρυθμίσεις
          </button>
          {settingsOpen && (
            <div className="sidebar-subnav">
              <button
                className={page === 'settings-library' ? 'selected' : ''}
                onClick={() => setPage('settings-library')}
              >
                Βιβλιοθήκη
              </button>
              <button
                className={page === 'settings-targets' ? 'selected' : ''}
                onClick={() => setPage('settings-targets')}
              >
                Στόχοι macros
              </button>
            </div>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-title">ΠΗΓΕΣ ΔΕΔΟΜΕΝΩΝ</div>
          <div className="source">
            <CircleDashed size={13} />
            <div>
              <strong>Garmin</strong>
              <small>Σύνδεση εκκρεμεί</small>
            </div>
          </div>
          <div className="source">
            <CircleDashed size={13} />
            <div>
              <strong>Withings</strong>
              <small>Σύνδεση εκκρεμεί</small>
            </div>
          </div>
          <div className="source">
            <CircleDashed size={13} />
            <div>
              <strong>Hevy CSV</strong>
              <small>Χειροκίνητη εισαγωγή</small>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="page-header">
          <div>
            <div className="eyebrow">
              {isSettings ? 'ΠΡΟΣΑΡΜΟΓΗ ΠΛΑΝΟΥ' : 'ΗΜΕΡΗΣΙΟ ΗΜΕΡΟΛΟΓΙΟ'}
            </div>
            <h1>{isSettings ? 'Ρυθμίσεις' : page === 'today' ? 'Σήμερα' : 'Επισκόπηση'}</h1>
            <p>
              {isSettings
                ? 'Η βιβλιοθήκη και οι στόχοι του προσωπικού σου πλάνου.'
                : page === 'today'
                  ? 'Γεύματα, ύπνος και κίνηση σε ένα μέρος.'
                  : 'Η τάση έχει μεγαλύτερη σημασία από μία μέρα.'}
            </p>
          </div>
          {!isSettings && (
            <div className="date-controls">
              <button aria-label="Προηγούμενη ημέρα" onClick={() => setDay(shiftDay(day, -1))}>
                <ChevronLeft size={17} />
              </button>
              <label>
                <span className="sr-only">Ημερομηνία</span>
                <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
              </label>
              <button aria-label="Επόμενη ημέρα" onClick={() => setDay(shiftDay(day, 1))}>
                <ChevronRight size={17} />
              </button>
            </div>
          )}
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => setError('')} aria-label="Κλείσιμο">
              <X size={14} />
            </button>
          </div>
        )}
        {!isSettings && (
          <div className="mobile-sources">
            <span>
              <CircleDashed size={12} /> Garmin
            </span>
            <span>
              <CircleDashed size={12} /> Withings
            </span>
            <span>
              <CircleDashed size={12} /> Hevy CSV
            </span>
          </div>
        )}
        {isSettings && (
          <div className="settings-page">
            <nav className="settings-tabs" aria-label="Υπομενού ρυθμίσεων">
              <button
                className={page === 'settings-library' ? 'selected' : ''}
                onClick={() => setPage('settings-library')}
              >
                Βιβλιοθήκη γευμάτων & προϊόντων
              </button>
              <button
                className={page === 'settings-targets' ? 'selected' : ''}
                onClick={() => setPage('settings-targets')}
              >
                Στόχοι macros
              </button>
            </nav>
            {page === 'settings-library' && (
              <section className="panel settings-panel">
                <div className="panel-title">
                  <div>
                    <div className="eyebrow">ΓΝΩΣΤΑ ΓΕΥΜΑΤΑ</div>
                    <h2>Βιβλιοθήκη</h2>
                  </div>
                </div>
                <p className="settings-copy">
                  Πρόσθεσε ή επεξεργάσου γεύματα, παραλλαγές και γνωστά προϊόντα.
                </p>
                <LibraryEditor meals={meals} products={products} busy={busy} save={action} />
              </section>
            )}
            {page === 'settings-targets' && targetPlan && (
              <TargetsEditor
                plan={targetPlan}
                busy={busy}
                onSave={(value) =>
                  void action(
                    () => api('/settings/targets', { method: 'PUT', body: JSON.stringify(value) }),
                    false,
                  )
                }
              />
            )}
          </div>
        )}
        {page === 'today' && data?.checkinStale && (
          <div className="stale-alert" role="status">
            Η ανάλυση agent αφορά παλιότερη έκδοση των καταχωρήσεων. Τα macros είναι ενημερωμένα·
            ζήτησε νέο check-in όταν θέλεις.
          </div>
        )}
        {page === 'today' && data && (
          <>
            <div className="day-title">
              <span>{displayDay(day)}</span>
              <span>{day === localDay() ? 'Ημέρα σε εξέλιξη' : 'Αναδρομική καταχώρηση'}</span>
            </div>
            <div className="metrics">
              {keys.map((key) => (
                <Metric
                  key={key}
                  name={labels[key]}
                  actual={data.total[key]}
                  target={data.targets[key]}
                  percent={data.percentages[key]}
                  unit={key === 'kcal' ? 'kcal' : 'g'}
                  macro={key}
                />
              ))}
            </div>
            {data.pendingCount > 0 && (
              <div className="pending-alert" role="status">
                {data.pendingCount} γεύμα{data.pendingCount === 1 ? '' : 'τα'} περιμέν
                {data.pendingCount === 1 ? 'ει' : 'ουν'} εκτίμηση. Τα σύνολα της ημέρας δεν είναι
                ακόμη πλήρη.
              </div>
            )}
            <div className="content-grid">
              <div className="column">
                <section className="panel meals-panel">
                  <div className="panel-title">
                    <h2>Γεύματα</h2>
                  </div>
                  {data.items.length ? (
                    <div className="entry-list">
                      {data.items.map((item) => (
                        <div className="entry" key={item.id}>
                          <div className="entry-copy">
                            <strong>{item.label}</strong>
                            <small>
                              {item.macro_status === 'pending'
                                ? 'Σε αναμονή εκτίμησης από agent'
                                : `${fmt(item.snapshot.protein, 1)} g πρωτεΐνη · ${fmt(item.amount, 1)} ${item.kind === 'product' ? (item.snapshot_detail?.unit ?? 'g') : 'μερίδα'}`}
                            </small>
                            {item.macro_source === 'agent' && (
                              <small>
                                Εκτίμηση agent
                                {item.snapshot_detail?.assumptions
                                  ? ` · ${item.snapshot_detail.assumptions}`
                                  : ''}
                              </small>
                            )}
                            {['custom', 'freetext'].includes(item.kind) &&
                              item.macro_status === 'ready' &&
                              !item.promoted_meal_id && (
                                <button
                                  className="text-action lower"
                                  onClick={() => {
                                    setEditingEntry(item);
                                    setModal('promote');
                                  }}
                                >
                                  Προσθήκη στα γνωστά γεύματα
                                </button>
                              )}
                            {item.promoted_meal_id && <small>Στα γνωστά γεύματα</small>}
                          </div>
                          <span>
                            {item.macro_status === 'pending'
                              ? '—'
                              : `${fmt(item.snapshot.kcal)} kcal`}
                          </span>
                          <button
                            className="icon-button"
                            aria-label={`Επεξεργασία ${item.label}`}
                            onClick={() => {
                              setEditingEntry(item);
                              setModal('entry');
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Διαγραφή ${item.label}`}
                            onClick={() => {
                              if (confirm(`Να αφαιρεθεί το ${item.label};`))
                                void action(
                                  () => api(`/entries/${item.id}`, { method: 'DELETE' }),
                                  false,
                                );
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty">Δεν έχουν καταχωρηθεί γεύματα για αυτή την ημέρα.</div>
                  )}
                  <button
                    className="dashed-action"
                    onClick={() => {
                      setEditingEntry(null);
                      setModal('entry');
                    }}
                  >
                    <Plus size={16} /> Προσθήκη γεύματος ή extra
                  </button>
                </section>
                <section className="agent-note">
                  <div className="eyebrow">CHECK-IN</div>
                  {data.checkin ? (
                    <p>{data.checkin.text}</p>
                  ) : (
                    <p>
                      Δεν υπάρχει ακόμη ανάλυση agent για αυτή την ημέρα. Τα αριθμητικά στοιχεία
                      ενημερώνονται αυτόματα.
                    </p>
                  )}
                </section>
              </div>
              <div className="column">
                <section className="panel">
                  <div className="panel-title">
                    <h2>Ύπνος</h2>
                    <span className="subtle">{data.sleep?.source ?? 'Δεν καταχωρήθηκε'}</span>
                  </div>
                  <div className="feature">
                    <span className="feature-icon">
                      <MoonStar size={19} />
                    </span>
                    <div>
                      <strong>
                        {data.sleep
                          ? `${Math.floor(data.sleep.minutes / 60)}ω ${String(data.sleep.minutes % 60).padStart(2, '0')}λ`
                          : '—'}
                      </strong>
                      <small>
                        η νύχτα που τελείωσε {day === localDay() ? 'σήμερα' : displayDay(day)}
                      </small>
                    </div>
                  </div>
                  <button className="text-action lower" onClick={() => setModal('sleep')}>
                    {data.sleep ? 'Επεξεργασία' : 'Καταχώρηση ύπνου'}
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <h2>Μετρήσεις</h2>
                    <span className="subtle">Withings / χειροκίνητα</span>
                  </div>
                  <div className="mini-row">
                    <Footprints size={17} />
                    <div>
                      <strong>Βάρος, μέση και βήματα</strong>
                      <small>Μπορείς να τα προσθέσεις αναδρομικά.</small>
                    </div>
                  </div>
                  <button className="text-action lower" onClick={() => setModal('measurement')}>
                    Νέα μέτρηση →
                  </button>
                </section>
                <section className="panel">
                  <div className="panel-title">
                    <h2>Προπόνηση</h2>
                    <span className="subtle">Hevy CSV</span>
                  </div>
                  {data.workouts.length ? (
                    data.workouts.map((workout) => (
                      <details className="hevy-workout" key={workout.id}>
                        <summary>
                          <Dumbbell size={16} />
                          <span>
                            {workout.title} · {workout.start_time.slice(11)} · {workout.sets.length}{' '}
                            σετ
                          </span>
                        </summary>
                        <div className="hevy-sets">
                          {workout.sets.map((set) => (
                            <div key={set.id}>
                              <span>
                                {set.exercise_title} · {set.set_index + 1}
                              </span>
                              <span>
                                {set.weight_kg == null ? '—' : `${fmt(set.weight_kg, 1)} kg`} ·{' '}
                                {set.reps == null ? '—' : `${set.reps} επ.`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))
                  ) : (
                    <div className="empty">Δεν υπάρχει προπόνηση Hevy για αυτή την ημέρα.</div>
                  )}
                  <HevyImport onImported={load} />
                </section>
              </div>
            </div>
          </>
        )}
        {page === 'overview' && overview && (
          <>
            <div className="overview-heading">
              <div>
                <h2>Macros · τελευταίες 7 ημέρες</h2>
                <span>Κάθε στήλη περιέχει πρωτεΐνη, υδατάνθρακες, λιπαρά και kcal.</span>
              </div>
              <span>
                {overview.days[0]?.day} – {overview.days[6]?.day}
              </span>
            </div>
            <div className="seven-days">
              {overview.days.map((d) => (
                <div className="day-card" key={d.day}>
                  <div className="day-card-head">
                    <span>
                      {new Intl.DateTimeFormat('el-GR', {
                        weekday: 'short',
                        timeZone: 'UTC',
                      }).format(new Date(`${d.day}T12:00:00Z`))}
                    </span>
                    <strong>{d.day.slice(-2)}</strong>
                  </div>
                  {d.pendingCount > 0 && (
                    <small className="day-pending" title="Τα macros της ημέρας είναι ελλιπή">
                      {d.pendingCount} εκκρεμ{d.pendingCount === 1 ? 'εί' : 'ούν'}
                    </small>
                  )}
                  {keys.map((key) => (
                    <div
                      className="daily-bar"
                      key={key}
                      style={{ '--macro-color': macroColors[key] } as CSSProperties}
                    >
                      <div>
                        <span>{key === 'kcal' ? 'kcal' : labels[key].slice(0, 1)}</span>
                        <span>{d.percentages[key]}%</span>
                      </div>
                      <div className="bar-track">
                        <span
                          style={{
                            width: `${d.percentages[key] > 100 ? 10000 / d.percentages[key] : Math.max(0, d.percentages[key])}%`,
                          }}
                        />
                        {d.percentages[key] > 100 && (
                          <span
                            className="over"
                            style={{ width: `${100 - 10000 / d.percentages[key]}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="overview-bottom">
              <section className="panel">
                <span className="subtle">Βάρος · τελευταία μέτρηση</span>
                <strong>
                  {overview.measurements.find((m) => m.weight_kg != null)?.weight_kg?.toString() ??
                    '—'}{' '}
                  <small>kg</small>
                </strong>
              </section>
              <section className="panel">
                <span className="subtle">Βήματα · τελευταία μέτρηση</span>
                <strong>
                  {overview.measurements.find((m) => m.steps != null)?.steps?.toString() ?? '—'}
                </strong>
              </section>
              <section className="panel">
                <span className="subtle">Προπονήσεις · τελευταίες 7 ημέρες</span>
                <strong>{overview.workouts.length}</strong>
                <small>Από Hevy CSV</small>
              </section>
            </div>
          </>
        )}
      </main>
      <nav className="bottom-nav" aria-label="Κύρια πλοήγηση κινητού">
        <button className={page === 'today' ? 'selected' : ''} onClick={() => setPage('today')}>
          <CalendarDays size={18} />
          Σήμερα
        </button>
        <button
          className={page === 'overview' ? 'selected' : ''}
          onClick={() => setPage('overview')}
        >
          <ChartNoAxesCombined size={18} />
          Επισκόπηση
        </button>
        <button
          className={isSettings ? 'selected' : ''}
          onClick={() => {
            setPage('settings-library');
            setSettingsOpen(true);
          }}
        >
          <Settings2 size={18} />
          Ρυθμίσεις
        </button>
      </nav>
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              modal === 'entry'
                ? 'Γεύμα'
                : modal === 'promote'
                  ? 'Γνωστό γεύμα'
                  : modal === 'sleep'
                    ? 'Ύπνος'
                    : 'Μέτρηση'
            }
          >
            <div className="modal-head">
              <h2>
                {modal === 'entry'
                  ? editingEntry
                    ? 'Επεξεργασία γεύματος'
                    : 'Προσθήκη γεύματος'
                  : modal === 'promote'
                    ? 'Προσθήκη στα γνωστά γεύματα'
                    : modal === 'sleep'
                      ? 'Καταχώρηση ύπνου'
                      : 'Νέα μέτρηση'}
              </h2>
              <button className="icon-button" onClick={() => setModal(null)} aria-label="Κλείσιμο">
                <X size={19} />
              </button>
            </div>
            {modal === 'entry' && (
              <EntryForm
                day={day}
                initial={editingEntry}
                meals={meals}
                products={products}
                busy={busy}
                onSave={(body) =>
                  action(() =>
                    api(editingEntry ? `/entries/${editingEntry.id}` : '/entries', {
                      method: editingEntry ? 'PATCH' : 'POST',
                      body: JSON.stringify(body),
                    }),
                  )
                }
              />
            )}
            {modal === 'promote' && editingEntry && (
              <PromoteMealForm
                entry={editingEntry}
                meals={meals}
                busy={busy}
                onSave={(body) =>
                  void action(() =>
                    api(`/entries/${editingEntry.id}/promote`, {
                      method: 'POST',
                      body: JSON.stringify(body),
                    }),
                  )
                }
              />
            )}
            {modal === 'sleep' && (
              <SleepForm
                day={day}
                initial={data?.sleep?.minutes}
                busy={busy}
                onSave={(body) =>
                  action(() =>
                    api(`/days/${day}/sleep`, { method: 'PUT', body: JSON.stringify(body) }),
                  )
                }
              />
            )}
            {modal === 'measurement' && (
              <MeasurementForm
                day={day}
                busy={busy}
                onSave={(body) =>
                  action(() => api('/measurements', { method: 'POST', body: JSON.stringify(body) }))
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
