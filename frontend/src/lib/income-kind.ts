import type { Entity } from '@/types';

export const incomeKinds = ['Maaş', 'Diğer gelir', 'Avans / kredi', 'Hesaplar arası transfer'] as const;
type IncomeKind = typeof incomeKinds[number];

export function incomeKind(income: Entity): IncomeKind {
  if (income.isTransfer) return 'Hesaplar arası transfer';
  if (income.isBorrowing) return 'Avans / kredi';
  const type = String(income.type ?? '').trim().toLocaleLowerCase('tr');
  if (income.isSalary || type === 'maaş' || type === 'maas') return 'Maaş';
  return 'Diğer gelir';
}

export function withIncomeKind(income: Entity, kind: string, previous: Entity): Entity {
  return {
    ...income,
    type: previous.type && incomeKind(previous) === kind ? previous.type : kind,
    isSalary: kind === 'Maaş',
    isBorrowing: kind === 'Avans / kredi',
    isTransfer: kind === 'Hesaplar arası transfer',
  };
}
