import { incomeKinds } from '@/lib/income-kind';
import type { State } from '@/types';
import type { ListFilter } from './FilterableList';

const options = (values: readonly string[]) => values.map(value => [value, value] as const);

export function recordFilters(page: string, state: State): ListFilter[] {
  const byDate: ListFilter = {
    key: 'period', label: 'Dönem', options: [['selected', 'Seçili ay'], ['year', 'Seçili yıl']],
  };
  const byCard: ListFilter = {
    key: 'card', label: 'Kredi kartı', options: [['cash', 'Kartsız'], ...state.cards.map(card => ['card:' + card.id, String(card.name)] as const)],
  };
  switch (page) {
    case 'expenses': return [byDate, {
      key: 'category', label: 'Kategori', options: state.categories.map(item => [item.id, String(item.name)]),
    }, {
      key: 'method', label: 'Ödeme yöntemi', options: options(['Kredi Kartı', 'Banka Kartı', 'Nakit', 'Havale/EFT', 'Diğer']),
    }, byCard];
    case 'incomes': return [byDate, { key: 'kind', label: 'Gelir türü', options: options(incomeKinds) }];
    case 'subscriptions': return [{ key: 'status', label: 'Durum', options: options(['Aktif', 'Planlanan', 'Sona erdi']) }, byCard];
    case 'installments': return [{ key: 'status', label: 'Durum', options: options(['Devam ediyor', 'Geciken vade', 'Tamamlandı']) }, byCard];
    default: return [];
  }
}
