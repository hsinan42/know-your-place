import { incomeKinds } from '../../lib/income-kind';

export type Field = {
  key: string;
  label: string;
  type?: 'date' | 'number' | 'integer' | 'category' | 'card' | 'checkbox';
  options?: readonly string[];
  optional?: boolean;
  min?: number;
  max?: number;
};

export const fields: Record<string, Field[]> = {
  expenses: [
    { key: 'date', label: 'Tarih', type: 'date' },
    { key: 'categoryId', label: 'Kategori', type: 'category' },
    { key: 'description', label: 'Açıklama', optional: true },
    { key: 'amount', label: 'Tutar (TL)', type: 'number' },
    { key: 'method', label: 'Ödeme yöntemi', options: ['Kredi Kartı', 'Banka Kartı', 'Nakit', 'Havale/EFT', 'Diğer'] },
    { key: 'cardId', label: 'Kredi kartı', type: 'card', optional: true },
    { key: 'necessity', label: 'Harcama türü', options: ['Zorunlu', 'İsteğe Bağlı'] },
    { key: 'subcategory', label: 'Alt kategori', optional: true },
    { key: 'note', label: 'Not', optional: true },
    { key: 'isTransfer', label: 'Kendi hesaplarım arası transfer', type: 'checkbox' },
  ],
  incomes: [
    { key: 'type', label: 'Gelir türü', options: incomeKinds },
    { key: 'amount', label: 'Tutar (TL)', type: 'number' },
    { key: 'date', label: 'Tarih', type: 'date' },
    { key: 'description', label: 'Açıklama', optional: true },
  ],
  subscriptions: [
    { key: 'name', label: 'Abonelik adı' },
    { key: 'category', label: 'Kategori', optional: true },
    { key: 'amount', label: 'Aylık tutar (TL)', type: 'number' },
    { key: 'paymentDay', label: 'Ödeme günü', type: 'integer', min: 1, max: 31 },
    { key: 'start', label: 'Başlangıç tarihi', type: 'date' },
    { key: 'end', label: 'Bitiş tarihi (durdurmak için)', type: 'date', optional: true },
    { key: 'cardId', label: 'Kredi kartı', type: 'card', optional: true },
    { key: 'note', label: 'Not', optional: true },
  ],
  installments: [
    { key: 'name', label: 'Taksit adı' },
    { key: 'category', label: 'Kategori', optional: true },
    { key: 'amount', label: 'Aylık taksit (TL)', type: 'number' },
    { key: 'firstDate', label: 'İlk vade tarihi', type: 'date' },
    { key: 'count', label: 'Taksit sayısı', type: 'integer', min: 1, max: 600 },
    { key: 'cardId', label: 'Kredi kartı', type: 'card', optional: true },
    { key: 'note', label: 'Not', optional: true },
  ],
  cards: [
    { key: 'name', label: 'Kart adı' },
    { key: 'closingDay', label: 'Ekstre kesim günü', type: 'integer', min: 1, max: 31 },
    { key: 'dueDays', label: 'Kesimden kaç gün sonra son ödeme?', type: 'integer', min: 0, max: 60 },
  ],
  categories: [
    { key: 'name', label: 'Kategori adı' },
    { key: 'monthlyLimit', label: 'Aylık limit (TL)', type: 'number', min: 0 },
  ],
  payments: [
    { key: 'paidOn', label: 'Ödeme tarihi', type: 'date' },
    { key: 'amount', label: 'Ödenen ekstre tutarı (TL)', type: 'number', min: 0 },
  ],
  cashPayments: [
    { key: 'paidOn', label: 'Gerçek ödeme tarihi', type: 'date' },
    { key: 'amount', label: 'Ödenen vade tutarı (TL)', type: 'number' },
  ],
  settings: [
    { key: 'salary', label: 'Planlanan aylık maaş (TL)', type: 'number', min: 0 },
    { key: 'savingsTarget', label: 'Aylık tasarruf hedefi (TL)', type: 'number', min: 0 },
  ],
};
