import { newId } from '../../lib/utils';
import { today } from '../../lib/format';
import { withIncomeKind } from '../../lib/income-kind';
import type { Collection, Entity, State } from '../../types';
import { fields, type Field } from './record-fields';

export type RecordDraft = { collection: string; value: Entity; editing: boolean; sourceName?: string };

function initialValue(field: Field): Entity[string] {
  if (field.type === 'checkbox') return false;
  if (field.type === 'date' && !field.optional) return today();
  if (field.type === 'number' || field.type === 'integer') {
    if (field.optional) return '';
    if (field.key === 'dueDays') return 10;
    if (field.key === 'monthlyLimit') return 0;
    return 1;
  }
  return field.options?.[0] ?? '';
}

export function newRecord(collection: string, state: State): Entity {
  const value: Entity = { id: newId() };
  for (const field of fields[collection]) value[field.key] = initialValue(field);
  if (collection === 'expenses') {
    value.categoryId = state.categories[0]?.id || '';
    value.amount = null;
    if (!state.cards.length) value.method = 'Nakit';
  }
  if (collection === 'incomes') value.type = 'Diğer gelir';
  if (collection === 'settings') Object.assign(value, state.settings);
  return value;
}

function readValue(field: Field, form: FormData): Entity[string] {
  if (field.type === 'checkbox') return form.has(field.key);
  const value = String(form.get(field.key) ?? '');
  if (field.type === 'number' || field.type === 'integer')
    return value === '' && field.optional ? null : Number(value);
  if (value === '' && (field.type === 'card' || field.type === 'date')) return null;
  return value;
}

function updateSettings(state: State, value: Entity): State {
  const start = today().slice(0, 7) + '-01';
  const salary = Number(value.salary);
  const baseline = state.salaryPeriods?.length ? state.salaryPeriods : [
    { start: state.settings.trackingStart.slice(0, 7) + '-01', amount: state.settings.salary },
  ];
  const salaryPeriods = salary !== state.settings.salary
    ? [...baseline.filter(period => period.start !== start), { start, amount: salary }]
    : state.salaryPeriods;
  return { ...state, salaryPeriods, settings: { ...state.settings, salary, savingsTarget: Number(value.savingsTarget) } };
}

function replaceSubscriptionPrice(state: State, previous: Entity, next: Entity): State | null {
  const currentDate = today();
  if (previous.end && String(previous.end) < currentDate)
    throw new Error('Biten aboneliğin fiyatını değiştirmek yerine yeni abonelik kaydı açın.');
  if (String(previous.start) >= currentDate) return null;

  const yesterday = new Date(currentDate + 'T12:00:00Z');
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const end = yesterday.toISOString().slice(0, 10);
  return {
    ...state,
    subscriptions: [
      ...state.subscriptions.map(item => item.id === previous.id
        ? { ...item, end: item.end && String(item.end) < end ? item.end : end }
        : item),
      { ...next, id: newId(), start: currentDate, end: null },
    ],
  };
}

export function applyRecordEdit(state: State, draft: RecordDraft, form: FormData): State {
  const { collection } = draft;
  const value = { ...draft.value };
  for (const field of fields[collection]) value[field.key] = readValue(field, form);
  if (collection === 'expenses' && value.method !== 'Kredi Kartı') value.cardId = null;
  if (collection === 'incomes') Object.assign(value, withIncomeKind(value, String(value.type), draft.value));
  if (collection === 'settings') return updateSettings(state, value);

  const rows = state[collection as Collection] ?? [];
  const previous = rows.find(row => row.id === value.id);
  if (collection === 'subscriptions' && previous && previous.amount !== value.amount) {
    const replacement = replaceSubscriptionPrice(state, previous, value);
    if (replacement) return replacement;
  }

  return {
    ...state,
    [collection]: previous ? rows.map(row => row.id === value.id ? value : row) : [...rows, value],
  };
}
