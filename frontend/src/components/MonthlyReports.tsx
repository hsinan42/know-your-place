import { money, months } from '@/lib/format';
import type { Month, Report } from '@/types';

type Column = {
  label: string;
  value: (month: Month) => number | null;
  format?: (value: number) => string;
};

const percent = new Intl.NumberFormat('tr-TR', { style: 'percent', maximumFractionDigits: 1 });
const annualColumns: Column[] = [
  { label: 'Maaş planı', value: month => month.salaryPlan },
  { label: 'Ek gelir', value: month => month.earnedIncome },
  { label: 'Avans', value: month => month.borrowing },
  { label: 'Günlük', value: month => month.daily },
  { label: 'Abonelik', value: month => month.subscriptions },
  { label: 'Taksit', value: month => month.installments },
  { label: 'Gider', value: month => month.expense },
  { label: 'Net plan', value: month => month.net },
  { label: 'Hedef farkı', value: month => month.net - month.savingsTarget },
  { label: 'Nakit tahmini', value: month => month.forecastNet },
];
const savingsColumns: Column[] = [
  { label: 'Tasarruf hedefi', value: month => month.savingsTarget },
  { label: 'Net oranı', value: month => month.savingsRate, format: value => percent.format(value) },
  { label: 'Devreden varlık planı', value: month => month.planClosingBalance },
  { label: 'Bütçeli gider tahmini', value: month => month.forecastExpense },
];

function ReportTable({ rows, columns, selected, totals }: {
  rows: Month[];
  columns: Column[];
  selected: number;
  totals?: boolean;
}) {
  function cells(values: (number | null)[]) {
    return columns.map(({ label, format = money }, index) => {
      const value = values[index];
      return <td className="amount" key={label}>
        <span className="report-cell-label mobile-only">{label}</span>
        <span className={value !== null && value < 0 ? 'negative' : undefined}>{value === null ? 'Hesaplanamıyor' : format(value)}</span>
      </td>;
    });
  }
  return <div className="table-wrap report-table-wrap"><table className="report-table">
    <thead><tr><th scope="col">Ay</th>{columns.map(({ label }) => <th className="amount" key={label} scope="col">{label}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.month} className={row.month === selected ? 'selected-row' : undefined}>
      <th scope="row">{months[row.month - 1]}</th>{cells(columns.map(column => column.value(row)))}
    </tr>)}</tbody>
    {totals && <tfoot><tr><th scope="row">Yıl toplamı</th>{cells(columns.map(column => rows.reduce((sum, row) => sum + (column.value(row) ?? 0), 0)))}</tr></tfoot>}
  </table></div>;
}

export function MonthlyReports({ report, year, month }: { report: Report; year: number; month: number }) {
  return <>
    <section className="panel">
      <div className="section-heading" data-tour="reports"><div><h2>{year} yıllık planı</h2><p>Maaş tahminidir. Borçlanma ek gelirden ayrıdır ve ödeme kaydı harcamayı tekrar artırmaz.</p></div></div>
      <ReportTable rows={report.months} columns={annualColumns} selected={month} totals/>
    </section>
    <section className="panel">
      <div className="section-heading"><div><h2>Tasarruf ve birikim planı</h2><p>Ay bazında tasarruf hedefi ve planlanan bakiye.</p></div></div>
      <ReportTable rows={report.months} columns={savingsColumns} selected={month}/>
    </section>
  </>;
}
