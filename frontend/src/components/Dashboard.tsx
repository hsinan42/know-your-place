import {
  ArrowDown, ArrowDownLeft, ArrowRight, ArrowUp, ArrowUpRight, BadgeCheck, CalendarDays, Clock,
  CreditCard, Filter, ReceiptText, SlidersHorizontal, TrendingUp, Wallet, Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useLedgerPage } from '@/features/ledger/useLedgerPage';
import { Button } from './ui/button';
import { DisplayMoney } from './DisplayMoney';
import { UpcomingPayments } from './UpcomingPayments';
import { categoryIcon } from '@/lib/category-icon';
import { date, fullDate, money, months, periodKey, today } from '@/lib/format';
import type { CashDue, Entity, Report, State, StatementPayment } from '@/types';

type Props = {
  state: State;
  report: Report;
  year: number;
  month: number;
  onNavigate: (page: string) => void;
  onAdd: (kind: 'expenses' | 'incomes' | 'settings') => void;
  onSalary: () => void;
  onStatement: (statement: StatementPayment) => void;
  onCashDue: (due: CashDue) => void;
  onViewStatement: (statement: StatementPayment) => void;
};

export function Dashboard({ state, report, year, month, onNavigate, onAdd, onSalary, onStatement, onCashDue, onViewStatement }: Props) {
  const [transactionType, setTransactionType] = useState('all');
  const [showFilter, setShowFilter] = useState(false);
  const selected = report.months[month - 1];
  const period = periodKey(year, month);
  const title = months[month - 1] + ' ' + year;
  const categoryTotals = useLedgerPage<Record<string, number>>('category-totals', year, month, report, { period: 'selected' });
  const categoryName = (id: unknown) => String(state.categories.find(category => category.id === id)?.name ?? 'Diğer');
  const cardName = (id: unknown) => state.cards.find(card => card.id === id)?.name;
  const debt = report.installments.reduce((sum, plan) => sum + plan.debt, 0);
  const remainingPlans = report.installments.filter(plan => plan.remaining > 0).length;
  const transactions = useLedgerPage<{ row: Entity; income: boolean }>('transactions', year, month, report, {
    period: 'selected', kind: transactionType === 'all' ? undefined : transactionType, size: '5', sort: 'date', direction: 'descending',
  });
  const recent = useLedgerPage<Entity>('expenses', year, month, report, {
    period: 'selected', size: '5', sort: 'date', direction: 'descending',
  });
  const visibleTransactions = transactions.data?.items ?? [];
  const recentExpenses = recent.data?.items ?? [];
  const salarySaved = selected.salaryPlan > 0 && selected.salaryReceived >= selected.salaryPlan;
  const currentMonth = period === today().slice(0, 7);
  const expenseLabel = (row: Entity) => String(row.description || categoryName(row.categoryId));
  const paymentMethod = (row: Entity) => String(cardName(row.cardId) ?? row.method ?? '—');

  return <>
    <h1 className="sr-only">Genel Bakış</h1>
    <div className="dashboard-overview">
      <section className="panel layer-card layer-cash" data-tour="balance">
        <div className="layer-heading">
          <span className="badge badge-cash desktop-only"><Wallet size={15}/> 1. Katman • Kayıtlı Nakit</span>
          <span className="mobile-only mobile-balance-label"><span className="status-dot"/> Kayıtlı Bakiye</span>
          <BadgeCheck size={24} className="positive desktop-only"/>
          <span className="mobile-only text-xs">{date(report.assets.asOf)}</span>
        </div>
        <p className="desktop-only text-sm">Net Kayıtlı Bakiye</p>
        <div className="balance-value"><DisplayMoney value={report.assets.balance}/> <small className="desktop-only">TL</small></div>
        <p className="balance-date desktop-only"><Clock size={14}/> Bakiye Tarihi: {fullDate(report.assets.asOf)}</p>
        <p className="mobile-only muted">Kayıtlı toplam nakit ve banka bakiyesi</p>
        <div className="cash-flow">
          <div><span><ArrowDownLeft size={15}/> Bu Ay Para Girişi</span><strong className="positive">+{money(selected.cashIncome)}</strong></div>
          <div><span><ArrowUpRight size={15}/> Nakit Çıkışı</span><strong className="negative">{money(-selected.cashOutflow)}</strong></div>
        </div>
      </section>

      <section className="quick-actions" data-tour="quick-actions">
        <div className="quick-heading desktop-only"><Zap size={20}/><strong>Hızlı Operasyonlar</strong><span>•</span><p>Kayıt ekle veya maaşını kaydet</p></div>
        <div className="quick-buttons">
          <Button variant="expense" onClick={() => onAdd('expenses')}><span className="quick-icon" aria-hidden="true"><ArrowUp size={18} className="desktop-only"/><span className="mobile-only quick-sign">−</span></span><span className="desktop-only">Harcama Ekle</span><span className="mobile-only">Harcama</span></Button>
          <Button variant="income" onClick={() => onAdd('incomes')}><span className="quick-icon" aria-hidden="true"><ArrowDown size={18} className="desktop-only"/><span className="mobile-only quick-sign">+</span></span>Gelir Ekle</Button>
          {currentMonth && <Button variant="soft" className="desktop-only" disabled={salarySaved} onClick={onSalary}><BadgeCheck size={18}/>{salarySaved ? 'Maaş Kayıtlı' : 'Maaşı Kaydet'}</Button>}
          <Button variant="soft" className="mobile-only plan-action" onClick={() => onAdd('settings')}><span className="quick-icon" aria-hidden="true"><Wallet size={18}/></span>Maaş Planla</Button>
        </div>
      </section>

      <section className="panel layer-card layer-debt">
        <div className="layer-heading">
          <span className="badge badge-debt desktop-only"><CreditCard size={15}/> 2. Katman • Yükümlülükler</span>
          <span className="mobile-only mobile-debt-label"><span className="status-dot"/> Yükümlülük &amp; Borç</span>
          <span className={'mobile-only badge ' + (debt > 0 || report.assets.cardDebt > 0 ? 'badge-debt' : 'badge-neutral')}>{debt > 0 || report.assets.cardDebt > 0 ? 'Aktif Vade' : 'Borç Yok'}</span>
        </div>
        <div className="debt-metrics">
          <div className="card-debt"><span><span className="desktop-only">Tahmini Kredi Kartı Borcu</span><span className="mobile-only">Kart Borcu</span><CreditCard className="mobile-only negative" size={17}/></span>
            <strong>{money(report.assets.cardDebt)}</strong><small className="mobile-only negative">Kayıtlı kart hareketleri</small></div>
          <div className="installment-debt"><span>Kalan Taksit <CalendarDays className="mobile-only" size={17}/></span>
            <strong>{money(debt)}</strong><small>{remainingPlans} aktif plan</small></div>
        </div>
        <div className="debt-footer desktop-only"><span>Seçili ayın tahmini ekstreleri</span><strong>{money(report.statements.reduce((sum, statement) => sum + statement.total, 0))}</strong></div>
      </section>

      <section className="panel layer-card layer-plan">
        <div className="layer-heading"><span className="badge badge-plan desktop-only"><TrendingUp size={15}/> <span>3. Katman • Plan</span></span><span className="mobile-only badge badge-plan">Plan</span><h2 className="mobile-only">Finansal Projeksiyon</h2><TrendingUp className="mobile-only plan-text ml-auto" size={21}/><span className="badge badge-plan desktop-only">Projeksiyon</span></div>
        <div className="plan-metrics">
          <div className="desktop-only"><span>Maaş Beklentisi</span><strong>{money(selected.salaryPlan)}</strong></div>
          <div><span>Kalan Bütçe</span><strong className={selected.budgetRemaining < 0 ? 'negative' : 'positive'}>{money(selected.budgetRemaining)}</strong><small className="mobile-only">/ {money(selected.budget)} hedef</small></div>
          <div><span>Yıl Sonu Tahmini</span><strong>{money(report.assets.yearEndPlan)}</strong></div>
        </div>
        <p className="plan-note desktop-only"><TrendingUp size={17}/> Maaş ve harcama planına göre tahmin</p>
      </section>
    </div>

    {report.assets.hasEstimatedPayments && <p className="info-note mb-6">Bakiye, eski ödeme kayıtları için tahmin içeriyor. <button className="font-bold underline" onClick={() => onNavigate('assets')}>Ödeme geçmişini incele</button></p>}

    <div className="dashboard-details">
      <section className="panel dashboard-budget">
        <div className="section-heading"><div><h2 className="desktop-only">{title} Kategori Bütçeleri</h2><h2 className="mobile-only">Kategori Harcama Limitleri</h2><p className="desktop-only">Gerçekleşen harcamaların planlanan limitlere oranı</p></div>
          <span className="mobile-only text-xs whitespace-nowrap">{title}</span>
          <div className="budget-total desktop-only"><small>Günlük harcamalar / Limit</small><strong>{money(selected.daily)}</strong> / {money(selected.budget)}</div>
        </div>
        {!selected.tracked && <p className="empty">Bu dönemde bütçe planı yok.</p>}
        {selected.tracked && state.categories.length === 0 && <p className="empty">Henüz bütçe kategorisi yok.</p>}
        {selected.tracked && state.categories.length > 0 && !categoryTotals.data && <p className="empty">
          {categoryTotals.error ?? 'Kategori tutarları yükleniyor…'}
        </p>}
        {selected.tracked && categoryTotals.data && state.categories.map(category => {
          const name = String(category.name);
          const Icon = categoryIcon(name);
          const spent = categoryTotals.data?.items[0]?.[category.id] ?? 0;
          const limit = Number(category.monthlyLimit);
          const percentage = limit > 0 ? Math.round(spent / limit * 100) : null;
          const over = limit > 0 && spent > limit;
          return <div className="budget-row" key={category.id}>
            <div className="budget-label"><strong><Icon size={16}/>{name}</strong><span className={over ? 'negative' : ''}>{money(spent)} <small>/ {money(limit)}</small></span>
              <span className={over ? 'badge badge-debt' : limit > 0 && spent === limit ? 'badge badge-cash' : ''}>{over ? 'Limit Aşıldı (%' + percentage + ')' : percentage === null ? 'Limit tanımlı değil' : '%' + percentage}</span></div>
            <div className="progress" aria-hidden="true"><span className={over ? 'over' : spent === limit && limit > 0 ? 'complete' : ''} style={{ width: Math.min(percentage ?? 0, 100) + '%' }}/></div>
          </div>;
        })}
        <Button variant="soft" className="budget-link desktop-only" onClick={() => onNavigate('categories')}><SlidersHorizontal size={18}/> Limitleri Düzenle <ArrowRight size={15}/></Button>
      </section>

      {report.upcomingPayments && <UpcomingPayments agenda={report.upcomingPayments} onStatement={onStatement} onCashDue={onCashDue} onViewStatement={onViewStatement}/>}
    </div>

    <section className="panel desktop-only">
      <div className="section-heading"><div><h2>Son İşlemler • {title}</h2><p>Son kayıt altına alınan gelir ve gider dökümü</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="soft" size="sm" aria-expanded={showFilter} onClick={() => setShowFilter(!showFilter)}><Filter size={15}/> Filtrele</Button><Button variant="ghost" size="sm" onClick={() => onNavigate(transactionType === 'income' ? 'incomes' : 'expenses')}>Tümünü İncele <ArrowRight size={15}/></Button></div></div>
      {showFilter && <label className="mb-4 w-fit">İşlem türü <select value={transactionType} onChange={event => setTransactionType(event.target.value)}><option value="all">Tüm işlemler</option><option value="expense">Harcamalar</option><option value="income">Gelirler</option></select></label>}
      {visibleTransactions.length ? <div className="table-wrap"><table className="dashboard-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th>Kategori</th><th>Ödeme Türü</th><th className="amount">Tutar</th></tr></thead><tbody>
        {visibleTransactions.map(({ row, income }) => <tr key={String(income) + row.id} className={income && !row.isTransfer && !row.isBorrowing ? 'income-row' : ''}>
          <td>{fullDate(String(row.date))}</td><td><strong>{income ? String(row.description || row.type) : expenseLabel(row)}</strong></td>
          <td><span className={'badge ' + (income && !row.isBorrowing && !row.isTransfer ? 'badge-cash' : 'badge-neutral')}>{row.isTransfer ? 'Transfer' : income ? row.isBorrowing ? 'Borçlanma' : 'Gelir' : categoryName(row.categoryId)}</span></td>
          <td>{income ? String(row.type) : paymentMethod(row)}</td><td className="amount"><strong>{income ? '+' : ''}{money(income ? Number(row.amount) : -Number(row.amount))}</strong></td>
        </tr>)}
      </tbody></table></div> : <p className="empty">{transactions.error ?? (transactions.data ? 'Bu dönem için işlem kaydı yok.' : 'İşlemler yükleniyor…')}</p>}
    </section>

    <section className="recent-expenses mobile-only">
      <div className="section-heading"><h2>Son Harcamalar</h2><Button variant="ghost" size="sm" onClick={() => onNavigate('expenses')}>Tümü <ArrowRight size={15}/></Button></div>
      <div className="panel">{recentExpenses.length ? recentExpenses.map(row => {
        const Icon = categoryIcon(categoryName(row.categoryId));
        return <div className="recent-expense" key={row.id}><span className="icon-tile"><Icon size={19}/></span><div><strong>{expenseLabel(row)}</strong><small>{date(String(row.date))} • {row.isTransfer ? 'Transfer' : categoryName(row.categoryId)}</small></div><div className="amount"><strong>{money(-Number(row.amount))}</strong><small>{paymentMethod(row)}</small></div></div>;
      }) : <p className="empty"><ReceiptText size={23}/> {recent.error ?? (recent.data ? 'Bu dönem için harcama kaydı yok.' : 'Harcamalar yükleniyor…')}</p>}</div>
    </section>
  </>;
}
