import { ArrowDown, ArrowUp, BadgeCheck, CalendarCheck, CalendarDays, CreditCard, History, Landmark, ListChecks, PiggyBank, Wallet } from 'lucide-react';
import type { CashDue, Entity, Report, State } from '../types';
import { Button } from './ui/button';
import { FilterableList } from './FilterableList';
import { useLedgerPage } from '@/features/ledger/useLedgerPage';

import { date, money, months, periodKey, today } from '../lib/format';

type Props = {
  state: State;
  report: Report;
  month: number;
  year: number;
  onEdit: (collection: string, value: Entity) => void;
  onRemoveCashPayment: (id: string) => Promise<void>;
  onSalary: () => void;
  onCashDue: (due: CashDue) => void;
  busy: boolean;
};

export function AssetsPanel({ state, report, month, year, onEdit, onRemoveCashPayment, onSalary, onCashDue, busy }: Props) {
  const selected = report.months[month - 1];
  const title = months[month - 1] + ' ' + year;
  const currentDate = today();
  const currentPeriod = currentDate.slice(0, 7);
  const currentMonth = periodKey(year, month) === currentPeriod;
  const { assets } = report;
  const salarySaved = selected.salaryPlan > 0 && selected.salaryReceived >= selected.salaryPlan;
  const warnings = state.payments.filter(payment => payment.paidOn == null || payment.amount == null).length;
  const periods = useLedgerPage<string[]>('payment-periods', year, month, state, {});
  const historyPeriods = (periods.data?.items[0] ?? []).map(value => {
    const [year, month] = value.split('-').map(Number);
    return [value, months[month - 1] + ' ' + year] as const;
  });
  const metrics = [
    { label: 'Önceki Aydan Devir', amount: selected.openingBalance, note: 'Devreden kayıtlı bakiye', icon: History, tone: 'neutral' },
    { label: 'Bu Ay Giriş', amount: selected.cashIncome, note: 'Kaydedilen para girişi', icon: ArrowDown, tone: 'cash' },
    { label: 'Bu Ay Çıkış', amount: -selected.cashOutflow, note: 'Gerçekleşen nakit çıkışı', icon: ArrowUp, tone: 'debt' },
    { label: 'Toplam Likit', amount: assets.balance, note: 'Nakit + banka toplamı', icon: PiggyBank, tone: 'cash' },
    { label: 'Tahmini Kart Borcu', amount: assets.cardDebt, note: 'Kayıtlı kart hareketleri', icon: CreditCard, tone: 'plan' },
    { label: 'Net Pozisyon', amount: assets.balance - assets.cardDebt, note: 'Likit tutar − tahmini kart borcu', icon: Wallet, tone: 'net' },
  ];

  return <>
    <section className="panel assets-intro" data-tour="assets">
      <div><p className="eyebrow"><span className="status-dot"/> Dönem Durumu: {title} · {date(assets.asOf)} itibarıyla</p>
        <h1>Varlıklar ve Devir Projeksiyonu</h1><p className="muted">Nakit akışı, aylar arası kümülatif devirler ve yıl sonu varlık planı.</p></div>
      <div className="assets-salary"><div className="salary-expectation"><span className="icon-tile"><Landmark size={18}/></span><div><small>{months[month - 1]} Maaş Beklentisi</small><strong>{money(selected.salaryPlan)}</strong></div></div>
        {currentMonth && <Button disabled={busy || salarySaved} onClick={onSalary}><BadgeCheck size={19}/><span>{salarySaved ? 'Bu Ayın Maaşı Kayıtlı' : 'Aldığım Maaşı Kaydet'}</span></Button>}</div>
    </section>

    {assets.hasEstimatedPayments && <p className="info-note mb-6">Eski ödemelerdeki eksik bilgiler nedeniyle bakiye tahmin içeriyor. Gerçek tutar ve tarihleri ödeme geçmişinden tamamlayabilirsin.</p>}
    <div className="asset-grid">{metrics.map(({ label, amount, note, icon: Icon, tone }) => <section key={label} className={'panel asset-metric metric-' + tone}>
      <div><span>{label}</span><Icon size={16}/></div><strong>{money(amount)}</strong><small>{note}</small>
    </section>)}</div>

    <section className="panel asset-table-panel">
      <div className="section-heading"><div><h2>12 Aylık Devir ve Likidite Akışı <span className="badge badge-neutral">{year} Takvimi</span></h2><p>Geçmiş yıllardan devreden nakit ve gelecek ayların varlık planı.</p></div>
        <div className="table-legend"><span><i/> Gerçekleşen</span><span><i/> Plan / Projeksiyon</span></div></div>
      <div className="table-wrap"><table><thead><tr><th>Ay</th><th className="amount">Devreden Bakiye</th><th className="amount">Gerçekleşen Giriş</th><th className="amount">Gerçekleşen Çıkış</th><th className="amount">Gerçekleşen Bakiye</th><th className="amount plan-column">Ay Sonu Planı</th><th>Fark / Durum</th></tr></thead><tbody>
        {report.months.map(item => {
          const future = periodKey(year, item.month) > currentPeriod;
          const current = periodKey(year, item.month) === currentPeriod;
          const difference = item.closingBalance - item.planClosingBalance;
          return <tr key={item.month} className={item.month === month ? 'selected-row' : ''}>
            <td>{months[item.month - 1]} {future && <span className="badge badge-plan">Plan</span>}{current && <span className="badge badge-dark">Cari Ay</span>}</td>
            <td className="amount">{money(item.openingBalance)}</td><td className="amount positive">{future ? '—' : money(item.cashIncome)}</td><td className="amount negative">{future ? '—' : money(-item.cashOutflow)}</td>
            <td className="amount"><strong>{future ? '—' : money(item.closingBalance)}</strong></td><td className="amount plan-column">{money(item.planClosingBalance)}</td>
            <td><span className={'badge ' + (future || current ? 'badge-plan' : difference < 0 ? 'badge-debt' : 'badge-cash')}>{future ? 'Projeksiyon' : current ? 'Dönem İçi Akış' : difference === 0 ? 'Dengede' : money(difference)}</span></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>

    <div className="asset-details">
      <section className="panel due-panel">
        <div className="section-heading"><div><h2><CalendarCheck size={20} className="positive"/> Kartsız Sabit Vadeler</h2><p>Nakit veya banka üzerinden ödediğin periyodik vadeler.</p></div><span className="badge badge-neutral">{months[month - 1]} Dönemi</span></div>
        <FilterableList<CashDue> collection="cash-dues" year={year} month={month} revision={report} pageSize={5}
          initialSort={{ key: 'date', direction: 'ascending' }}
          filters={[{ key: 'kind', label: 'Vade türü', options: [['Abonelik', 'Abonelik'], ['Taksit', 'Taksit']] }]}
          empty="Bu tarihe kadar bekleyen kartsız ödeme yok.">
        {dues => <div className="space-y-2">{dues.map(due => <div className="cash-due" key={due.kind + due.sourceId + due.date}>
          <span className="icon-tile"><CalendarDays size={17}/></span><div><strong>{due.name}</strong><small>{due.kind} · Vade: {date(due.date)}</small></div><strong>{money(due.amount)}</strong>
          <Button size="sm" variant="income" disabled={busy} onClick={() => onCashDue(due)}><BadgeCheck size={15}/> Ödedim</Button>
        </div>)}</div>}
        </FilterableList>
        <div className="due-total"><span>Kalan Kartsız Borç</span><strong>{money(assets.unpaidCashDues.reduce((sum, due) => sum + due.amount, 0))}</strong></div>
      </section>

      <section className="panel">
        <div className="section-heading"><div><h2><ListChecks size={20}/> Ödeme Geçmişi</h2><p>Kayıtlı ekstre ve kartsız vade ödemeleri.</p></div>{warnings > 0 && <span className="badge badge-debt">{warnings} Eksik Kayıt</span>}</div>
        <FilterableList<{ payment: Entity; kind: string; name: string }> collection="payment-history"
          year={year} month={month} revision={state} pageSize={8} initialSort={{ key: 'date', direction: 'descending' }}
          search searchLabel="Ödemelerde ara"
          filters={[
            { key: 'kind', label: 'Ödeme türü', options: [['Ekstre', 'Ekstre'], ['Abonelik', 'Kartsız abonelik'], ['Taksit', 'Kartsız taksit']] },
            { key: 'status', label: 'Kayıt durumu', options: [['complete', 'Tamamlandı'], ['missing', 'Bilgisi eksik']] },
            { key: 'period', label: 'Ödeme dönemi', options: historyPeriods },
          ]}
          empty="Henüz ödeme kaydı yok.">
          {rows => <div className="table-wrap"><table className="history-table"><thead><tr><th>Hareket</th><th>Ödeme Tarihi</th><th className="amount">Tutar</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
            {rows.map(({ payment, kind, name }) => {
              const missingAmount = payment.amount == null;
              const missingDate = payment.paidOn == null;
              return <tr key={kind + payment.id}>
                <td><strong>{name}</strong><small>{kind === 'Ekstre' ? 'Ekstre · ' + date(String(payment.closingDate)) : kind}</small></td>
                <td>{missingDate ? '—' : date(String(payment.paidOn))}</td><td className="amount">{missingAmount ? '—' : money(Number(payment.amount))}</td>
                <td><span className={'badge ' + (missingAmount || missingDate ? 'badge-debt' : 'badge-cash')}>{missingAmount && missingDate ? 'Tutar ve Tarih Eksik' : missingAmount ? 'Tutar Eksik' : missingDate ? 'Ödeme Tarihi Eksik' : 'Tamamlandı'}</span></td>
                <td>{kind === 'Ekstre'
                  ? <Button size="sm" variant="soft" disabled={busy} onClick={() => onEdit('payments', payment)}>Düzelt</Button>
                  : <Button size="sm" variant="soft" disabled={busy} onClick={() => {
                    if (window.confirm('Ödeme kaydı geri alınsın mı?')) void onRemoveCashPayment(payment.id);
                  }}>Geri Al</Button>}</td>
              </tr>;
            })}
          </tbody></table></div>}
        </FilterableList>
      </section>
    </div>
  </>;
}
