import { CalendarDays, CheckCircle2, ChevronDown, ReceiptText } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from './ui/button';
import { categoryIcon } from '@/lib/category-icon';
import { fullDate, money, today } from '@/lib/format';
import type { Entity, State } from '@/types';

const methods = ['Kredi Kartı', 'Banka Kartı', 'Nakit', 'Havale/EFT', 'Diğer'];
const amountFormat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parseAmount(input: string) {
  const value = input.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) return Number(value.replaceAll('.', '').replace(',', '.'));
  if (/^\d+([.,]\d{1,2})?$/.test(value)) return Number(value.replace(',', '.'));
  return NaN;
}

type Props = {
  value: Entity;
  state: State;
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function ExpenseEditor({ value, state, busy, error, onSubmit }: Props) {
  const [amountInput, setAmountInput] = useState(value.amount == null ? '' : amountFormat.format(Number(value.amount)));
  const [amountError, setAmountError] = useState('');
  const [expenseDate, setExpenseDate] = useState(String(value.date));
  const [category, setCategory] = useState(String(value.categoryId ?? ''));
  const [method, setMethod] = useState(String(value.method));
  const [card, setCard] = useState(String(value.cardId ?? ''));
  const [isTransfer, setIsTransfer] = useState(Boolean(value.isTransfer));
  const [detailsOpen, setDetailsOpen] = useState(Boolean(
    value.subcategory || value.note || value.description || value.isTransfer || value.necessity === 'İsteğe Bağlı',
  ));
  const dateInput = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const amount = parseAmount(amountInput);
  const selectedCategory = state.categories.find(item => item.id === category);

  function submit(event: FormEvent<HTMLFormElement>) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) {
      event.preventDefault();
      setAmountError(amount > 1_000_000_000 ? 'Tutar en fazla ₺1.000.000.000 olabilir.' : 'Tutar sıfırdan büyük olmalı ve en fazla iki ondalık basamak içermeli.');
      amountInputRef.current?.focus();
      return;
    }
    if (!selectedCategory) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  }

  return <form onSubmit={submit} className="expense-editor">
    <section className="expense-section expense-amount">
      <label htmlFor="expense-amount">Harcama Tutarı</label>
      <div className="amount-input"><strong aria-hidden="true">₺</strong><input id="expense-amount" ref={amountInputRef} required inputMode="decimal" maxLength={24} placeholder="0,00"
        value={amountInput} onChange={event => { setAmountInput(event.target.value); setAmountError(''); }}
        onBlur={() => { if (Number.isFinite(amount)) setAmountInput(amountFormat.format(amount)); }}
        aria-invalid={Boolean(amountError)} aria-describedby={amountError ? 'amount-error' : undefined}/></div>
      <input type="hidden" name="amount" value={Number.isFinite(amount) ? amount : ''}/>
      {amountError && <p id="amount-error" role="alert" className="error">{amountError}</p>}
    </section>

    <fieldset className="expense-section">
      <div className="section-heading"><h3 id="expense-category">Kategori</h3></div>
      {state.categories.length ? <div className="category-choices" role="radiogroup" aria-labelledby="expense-category">
        {state.categories.map(item => {
          const Icon = categoryIcon(String(item.name));
          return <label key={item.id} className="choice category-choice"><input name="categoryId" type="radio" required value={item.id} checked={category === item.id} onChange={() => setCategory(item.id)}/>
            <Icon size={18}/><span>{String(item.name)}</span>
          </label>;
        })}
      </div> : <p className="info-note">Harcama eklemek için Bütçe Planı ekranından bir kategori oluştur.</p>}
    </fieldset>

    <section className="expense-section space-y-3">
      <label>Ödeme yöntemi<select name="method" value={method} onChange={event => setMethod(event.target.value)}>
        {methods.map(option => <option key={option} disabled={option === 'Kredi Kartı' && (isTransfer || !state.cards.length)}>{option}</option>)}
      </select></label>
      {method === 'Kredi Kartı' && <label>Kredi kartı<select name="cardId" value={card} required onChange={event => setCard(event.target.value)}>
        <option value="">Kart seçiniz</option>{state.cards.map(item => <option key={item.id} value={item.id}>{String(item.name)}</option>)}
      </select></label>}
    </section>

    <section className="expense-section expense-date">
      <span className="icon-tile"><CalendarDays size={20}/></span>
      <div><label htmlFor="expense-date">Harcama tarihi</label><strong>{expenseDate === today() ? 'Bugün' : fullDate(expenseDate)}</strong></div>
      <label className="expense-date-button">Değiştir
        <input id="expense-date" aria-label="Harcama tarihini değiştir" name="date" type="date" min="2000-01-01" max="2100-12-31" required ref={dateInput}
          value={expenseDate} onChange={event => { if (event.target.value) setExpenseDate(event.target.value); }}
          onClick={() => { try { dateInput.current?.showPicker?.(); } catch { /* The native field remains usable. */ } }}/>
      </label>
    </section>

    <details className="expense-section expense-details" open={detailsOpen} onToggle={event => setDetailsOpen(event.currentTarget.open)}>
      <summary>Detay ekle <ChevronDown size={17}/></summary>
      <div className="expense-detail-fields">
        <label>Açıklama<input name="description" defaultValue={String(value.description ?? '')} maxLength={500}/></label>
        <label>Alt kategori<input name="subcategory" defaultValue={String(value.subcategory ?? '')} maxLength={500}/></label>
        <label>Harcama niteliği<select name="necessity" defaultValue={String(value.necessity || 'Zorunlu')}>
          <option>Zorunlu</option><option>İsteğe Bağlı</option>
        </select></label>
        <label>Not<textarea name="note" defaultValue={String(value.note ?? '')} maxLength={500} rows={2}/></label>
        <label className="expense-transfer"><input type="checkbox" name="isTransfer" checked={isTransfer} onChange={event => {
          const checked = event.target.checked;
          setIsTransfer(checked);
          if (checked && method === 'Kredi Kartı') setMethod('Nakit');
        }}/><span>Hesaplar arası transfer<small>Toplam harcamayı ve kayıtlı bakiyeyi değiştirmez.</small></span></label>
      </div>
    </details>
    {error && <p role="alert" className="error">{error}</p>}
    <Button type="submit" className="expense-save" disabled={busy || !selectedCategory}><CheckCircle2 size={21}/>{busy ? 'Kaydediliyor…' : Number.isFinite(amount) && amount > 0 ? 'Harcamayı Kaydet (' + money(amount) + ')' : 'Harcamayı Kaydet'}</Button>
  </form>;
}

export function ExpenseEditorTitle({ editing }: { editing: boolean }) {
  return <span className="expense-dialog-title"><span className="icon-tile"><ReceiptText size={19}/></span><span>{editing ? 'Harcamayı Düzenle' : 'Yeni Harcama Ekle'}<small>Tutarı, kategoriyi ve ödeme yöntemini gir</small></span></span>;
}
