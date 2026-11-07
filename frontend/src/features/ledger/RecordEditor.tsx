import type { FormEvent } from 'react';
import { navigation } from '../../components/AppShell';
import { ExpenseEditor, ExpenseEditorTitle } from '../../components/ExpenseEditor';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { date } from '../../lib/format';
import { incomeKind } from '../../lib/income-kind';
import type { State } from '../../types';
import { fields, type Field } from './record-fields';
import type { RecordDraft } from './record-editing';

type Props = {
  draft: RecordDraft;
  state: State;
  error: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function RecordInput({ field, draft, state }: { field: Field; draft: RecordDraft; state: State }) {
  const value = draft.value[field.key];
  if (field.type === 'checkbox') {
    return <label className="checkbox-field">{field.label}
      <input type="checkbox" name={field.key} defaultChecked={Boolean(value)}/>
    </label>;
  }

  if (field.options || field.type === 'card' || field.type === 'category') {
    const options = field.options?.map(name => ({ id: name, name })) ?? state[field.type === 'card' ? 'cards' : 'categories'];
    const selected = draft.collection === 'incomes' && field.key === 'type' ? incomeKind(draft.value) : String(value ?? '');
    return <label>{field.label}
      <select name={field.key} defaultValue={selected} required={!field.optional}>
        <option value="">Seçiniz</option>
        {options.map(option => <option key={option.id} value={option.id}>{String(option.name)}</option>)}
      </select>
    </label>;
  }

  return <label>{field.label}
    <input name={field.key} type={field.type === 'integer' ? 'number' : field.type ?? 'text'}
      defaultValue={String(value ?? '')} required={!field.optional} min={field.min ?? (field.type === 'number' ? 0.01 : undefined)}
      max={field.max} step={field.type === 'number' ? '0.01' : field.type === 'integer' ? '1' : undefined} maxLength={500}/>
  </label>;
}

function RecordNote({ draft, state }: { draft: RecordDraft; state: State }) {
  const { collection, value } = draft;
  if (collection === 'payments') {
    const card = state.cards.find(item => item.id === value.cardId);
    return <p className="info-note"><strong>{String(card?.name ?? '—')}</strong> · {date(String(value.closingDate))} ekstresi</p>;
  }
  if (collection === 'cashPayments') {
    return <p className="info-note"><strong>{String(draft.sourceName ?? value.kind)}</strong> · {date(String(value.dueDate))} vadesi</p>;
  }
  if (collection === 'subscriptions')
    return <p className="info-note">Mevcut aboneliğin fiyatını değiştirirsen geçmiş dönem kapanır, yeni fiyat bugünden başlar. Pasife almak için bitiş tarihi gir.</p>;
  return null;
}

function editorTitle(draft: RecordDraft) {
  if (draft.collection === 'expenses')
    return <ExpenseEditorTitle editing={draft.editing}/>;
  if (draft.collection === 'settings') return 'Planlama ayarları';
  if (['payments', 'cashPayments'].includes(draft.collection)) return 'Ödeme Kaydı';
  return navigation.find(item => item[0] === draft.collection)?.[1] ?? 'Kayıt';
}

export function RecordEditor({ draft, state, error, busy, onClose, onSubmit }: Props) {
  const expense = draft.collection === 'expenses';
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }} expense={expense} title={editorTitle(draft)}>
    {expense ? <ExpenseEditor value={draft.value} state={state} busy={busy} error={error} onSubmit={onSubmit}/> :
      <form onSubmit={onSubmit} className="editor">
        <RecordNote draft={draft} state={state}/>
        {fields[draft.collection].map(field => <RecordInput key={field.key} field={field} draft={draft} state={state}/>)}
        {error && <p role="alert" className="error">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">{busy ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </form>}
  </Dialog>;
}
