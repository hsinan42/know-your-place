import { money } from '../../lib/format';
import type { Report, State } from '../../types';
import { useLedgerPage } from './useLedgerPage';

const percent = new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 1 });

export function BudgetUsage({ state, report, year }: { state: State; report: Report; year: number }) {
  const trackedMonths = report.months.filter(month => month.tracked).length;
  const totals = useLedgerPage<Record<string, number>>('category-totals', year, 1, state, { period: 'year' });
  if (!totals.data) return <p className="panel empty" role={totals.error ? 'alert' : 'status'}>
    {totals.error ?? 'Kategori tutarları yükleniyor…'}
  </p>;
  const actualByCategory = totals.data.items[0];

  return <section className="panel">
    <div className="section-heading"><div>
      <h2>{year} kategori kullanımı</h2>
      <p>Yıllık limitler ve günlük harcamaların gerçekleşen toplamı</p>
    </div></div>
    <div className="table-wrap"><table>
      <thead><tr>
        <th scope="col">Kategori</th>
        <th scope="col" className="amount">Yıllık limit</th>
        <th scope="col" className="amount">Gerçekleşen</th>
        <th scope="col" className="amount">Kalan</th>
        <th scope="col" className="amount">Kullanım</th>
      </tr></thead>
      <tbody>{state.categories.map(category => {
        const limit = Number(category.monthlyLimit) * trackedMonths;
        const actual = actualByCategory?.[category.id] ?? 0;
        return <tr key={category.id}>
          <td>{String(category.name)}</td>
          <td className="amount">{money(limit)}</td>
          <td className="amount">{money(actual)}</td>
          <td className={limit < actual ? 'amount negative' : 'amount'}>{money(limit - actual)}</td>
          <td className="amount">{limit > 0 ? percent.format(actual / limit) : 'Limit yok'}</td>
        </tr>;
      })}</tbody>
    </table></div>
  </section>;
}
