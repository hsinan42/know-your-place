import { useEffect, useState, type ReactNode } from 'react';
import {
  BadgeCheck, CalendarDays, CreditCard, Download, History, Landmark, Pencil, Repeat, ShoppingBasket, Trash2,
} from 'lucide-react';
import { useSession } from '@/features/auth/session';
import { date, fullDate, money, months } from '@/lib/format';
import type { Entity, Report, State, Statement } from '@/types';
import { DisplayMoney } from './DisplayMoney';
import { FilterableList } from './FilterableList';
import { Button } from './ui/button';

type Props = {
  state: State;
  report: Report;
  year: number;
  month: number;
  busy: boolean;
  onAdd: () => void;
  onEdit: (card: Entity) => void;
  onRemove: (card: Entity) => void;
  onPayment: (statement: Statement) => void;
};

type CardPeriod = { year: number; month: number; statements: Statement[] };
const itemKinds = [
  { kind: 'Harcama', label: 'Günlük Alışverişler', icon: ShoppingBasket },
  { kind: 'Abonelik', label: 'Düzenli Abonelikler', icon: Repeat },
  { kind: 'Taksit', label: 'Dönem Taksitleri', icon: CalendarDays },
];
const chartColors = ['#131b2e', '#006c4a', '#554fba', '#bd4b67', '#2365a1', '#af5b13'];
const sumStatements = (statements: Statement[]) => statements.reduce((sum, item) => sum + item.total, 0);

export function CardsPanel({ state, report, year, month, busy, onAdd, onEdit, onRemove, onPayment }: Props) {
  const { request } = useSession();
  const { statements } = report;
  const [outlook, setOutlook] = useState<CardPeriod[] | null>(null);
  const [outlookError, setOutlookError] = useState(false);
  const hasCards = state.cards.length > 0;

  useEffect(() => {
    setOutlook(null);
    setOutlookError(false);
    if (!hasCards) return;
    const controller = new AbortController();
    request('/api/card-outlook/' + year + '/' + month, { signal: controller.signal })
      .then(response => response.json())
      .then(periods => { if (!controller.signal.aborted) setOutlook(periods); })
      .catch(() => { if (!controller.signal.aborted) setOutlookError(true); });
    return () => controller.abort();
  }, [state, year, month, hasCards, request]);

  const pending = sumStatements(statements.filter(statement => !statement.paid));
  return <>
    <div className="cards-intro" data-tour="cards">
      <div><p className="eyebrow"><span className="status-dot"/> Finansal Yükümlülük Katmanı / {months[month - 1]} {year} Ekstreleri</p><h1>Kredi Kartları &amp; Ekstre Takibi</h1><p className="muted">Dönem içi harcamalar, taksit yükümlülükleri ve hesap kesim döngüleri.</p></div>
      <div className="cards-intro-actions"><div className="statement-summary panel"><span>Bu Ay Toplam Ekstre Yükü<strong>{money(sumStatements(statements))}</strong></span><span>Kalan Ödeme<strong className="negative">{money(pending)}</strong></span></div><Button onClick={onAdd}><CreditCard size={20}/> Yeni Kart Tanımla</Button></div>
    </div>
    <FilterableList<{ statement: Statement; payment: Entity | null; status: string }>
      collection="statements" year={year} month={month} revision={report} pageSize={6}
      filters={[
        { key: 'card', label: 'Kart', options: state.cards.map(card => ['card:' + card.id, String(card.name)]) },
        { key: 'status', label: 'Ekstre durumu', options: ['Tamamı Ödendi', 'İleri Tarihli Ödeme', 'Vadesi Geçti', 'Ödeme Bekliyor', 'Hareket Yok'].map(value => [value, value]) },
      ]}
      empty="İlk kartını tanımlayarak ekstre takibine başla.">
      {visible => <div className="statement-grid">{visible.map(({ statement, payment, status }) => {
        const card = state.cards.find(item => item.id === statement.cardId);
        const missing = payment && (payment.amount == null || payment.paidOn == null);
        const groups = itemKinds.map(item => ({ ...item, items: statement.items.filter(entry => entry.kind === item.kind) })).filter(group => group.items.length);
        const overdue = status === 'Vadesi Geçti';
        return <section key={statement.cardId} className={'panel statement-card ' + (statement.paid ? 'statement-paid' : '')}>
          <div className="statement-heading">
            <span className="icon-tile"><CreditCard size={26}/></span>
            <div><h2>{statement.name}</h2><p className="muted">Standart kesim: Her ayın {String(card?.closingDay ?? '—')}. günü · Standart vade: Kesim + {String(card?.dueDays ?? '—')} gün</p></div>
            <span className={'badge ' + (statement.paid ? 'badge-cash' : overdue ? 'badge-debt' : statement.total ? 'badge-warning' : 'badge-neutral')}>{status}</span>
          </div>
          <div className="statement-facts">
            <div><span>{statement.paid ? 'Kapanan Ekstre' : 'Dönem Ekstresi'}</span><strong><DisplayMoney value={statement.total}/></strong><small className={overdue ? 'negative' : ''}>Son Gün: {fullDate(statement.dueDate)}</small></div>
            <div><span>Kesim Tarihi</span><strong>{date(statement.closingDate)}</strong><small>Tahmini ekstre</small></div>
            <div><span>Harcama Kalemleri</span><strong>{statement.items.length}</strong><small>{groups.length} kayıt türü</small></div>
          </div>

          {payment && <div className="statement-item mb-4"><span className="icon-tile"><Landmark size={18}/></span><div><strong>Kayıtlı Ekstre Ödemesi</strong><small>{payment.paidOn ? fullDate(String(payment.paidOn)) : 'Ödeme tarihi eksik'}</small></div><strong className="positive">{payment.amount == null ? 'Tutar eksik' : money(Number(payment.amount))}</strong></div>}
          <div className="section-heading mb-2"><h3>Ekstre Harcama Kalemleri</h3><small>{groups.length} Kategori Ayrımı</small></div>
          {groups.length === 0 && <p className="muted">Bu döneme ait harcama kalemi yok.</p>}
          <div className="space-y-2">{groups.map(({ kind, label, icon: Icon, items }) => {
            const total = items.reduce((sum, item) => sum + item.amount, 0);
            return <StatementGroup key={kind} title={<><span className="icon-tile"><Icon size={18}/></span>
              <div><strong>{label}</strong><small>{items.length} kayıt</small></div>
              <div className="amount"><strong>{money(total)}</strong>{statement.total > 0 && <small>%{Math.round(total / statement.total * 100)} pay</small>}</div></>}>
              <StatementItems cardId={statement.cardId} kind={kind} year={year} month={month} revision={report}/>
            </StatementGroup>;
          })}</div>
          <div className="statement-footer">
            <div className="statement-edit">{card && <><Button variant="ghost" size="icon" aria-label={statement.name + ' düzenle'} onClick={() => onEdit(card)}><Pencil size={17}/></Button><Button variant="ghost" size="icon" aria-label={statement.name + ' sil'} onClick={() => onRemove(card)}><Trash2 size={17}/></Button></>}</div>
            {missing && <small className="negative">Geçmiş ödeme bilgileri eksik.</small>}
            {(payment || statement.total > 0) && <Button disabled={busy} variant={payment ? 'soft' : 'default'} onClick={() => onPayment(statement)}>{payment ? <History size={19}/> : <BadgeCheck size={19}/>} {payment ? 'Kayıtlı Ödemeyi Geri Al' : 'Tamamı Ödendi Olarak İşle'}</Button>}
          </div>
        </section>;
      })}</div>}
    </FilterableList>

    {hasCards && <div className="outlook-grid">
      <section className="panel">
        <div className="section-heading"><div><h2>Aylık Ekstre Hacmi Karşılaştırması</h2><p>Kart bazında son beş dönemin tahmini ekstre toplamı.</p></div><span className="badge badge-neutral">Son 5 Dönem Trendi</span></div>
        {outlook ? <StatementChart periods={outlook.slice(0, 5)} cards={state.cards}/> : <p className="empty" role="status">{outlookError ? 'Ekstre geçmişi yüklenemedi.' : 'Ekstre geçmişi yükleniyor…'}</p>}
      </section>
      <section className="panel">
        <div className="section-heading"><div><h2><Download size={20} className="positive"/> Taksit Yükü Projeksiyonu</h2><p>Sonraki üç ekstre dönemine yansıyan ödenmemiş kart taksitleri.</p></div><span className="badge badge-plan">Plan / Tahmin</span></div>
        {outlook ? <InstallmentOutlook periods={outlook.slice(5)}/> : <p className="empty" role="status">{outlookError ? 'Taksit planı yüklenemedi.' : 'Taksit planı yükleniyor…'}</p>}
      </section>
    </div>}
  </>;
}

function StatementChart({ periods, cards }: { periods: CardPeriod[]; cards: Entity[] }) {
  const max = Math.max(1, ...periods.flatMap(period => period.statements.map(statement => statement.total)));
  const ceiling = Math.ceil(max / (10 ** Math.floor(Math.log10(max)))) * (10 ** Math.floor(Math.log10(max)));
  return <figure className="statement-chart" aria-label="Son beş dönemin kart bazında ekstre toplamları">
    <div className="chart">
      <div className="chart-lines" aria-hidden="true">{[1, 0.66, 0.33, 0].map(tick => <span key={tick}>{new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(Math.round(ceiling * tick))}</span>)}</div>
      <div className="chart-periods">{periods.map(({ year, month, statements }) => <div key={year + '-' + month}>
        <div className="chart-bars">{cards.map((card, index) => {
          const total = statements.find(statement => statement.cardId === card.id)?.total ?? 0;
          const label = months[month - 1] + ' ' + year + ' · ' + String(card.name) + ': ' + money(total);
          return <div role="img" aria-label={label} title={label} key={card.id} style={{ height: total / ceiling * 100 + '%', backgroundColor: chartColors[index % chartColors.length] }}/>;
        })}</div><span>{months[month - 1].slice(0, 3)}</span>
      </div>)}</div>
    </div>
    <figcaption className="chart-legend">{cards.map((card, index) => <span key={card.id}><i style={{ backgroundColor: chartColors[index % chartColors.length] }}/>{String(card.name)}</span>)}</figcaption>
  </figure>;
}

function InstallmentOutlook({ periods }: { periods: CardPeriod[] }) {
  const rows = periods.map(({ month, year, statements }) => {
    const items = statements.filter(statement => !statement.paid).flatMap(statement => statement.items.filter(item => item.kind === 'Taksit'));
    return { month, year, items, total: items.reduce((sum, item) => sum + item.amount, 0) };
  });
  return <div className="space-y-3">
    {rows.map(row => <div key={row.year + '-' + row.month} className="statement-item outlook-row"><div><strong>{months[row.month - 1]} {row.year}</strong><small>{row.items.length ? row.items.map(item => item.name).join(', ') : 'Bekleyen kart taksiti yok'}</small></div><strong>{money(row.total)}</strong></div>)}
    <div className="due-total"><span>3 Aylık Toplam Taahhüt</span><strong>{money(rows.reduce((sum, row) => sum + row.total, 0))}</strong></div>
  </div>;
}

function StatementItems({ cardId, kind, year, month, revision }: {
  cardId: string; kind: string; year: number; month: number; revision: Report;
}) {
  return <FilterableList<Statement['items'][number]> collection="statement-items" year={year} month={month}
    revision={revision} fixed={{ card: 'card:' + cardId, kind }} pageSize={5}
    search searchLabel="Kalemlerde ara" empty="Bu grupta kayıt yok.">
    {page => <ul>{page.map((item, index) => <li key={index}><span>{item.name}<small>{date(item.date)}</small></span><strong>{money(item.amount)}</strong></li>)}</ul>}
  </FilterableList>;
}

function StatementGroup({ title, children }: { title: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="statement-group" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="statement-item">{title}</summary>
    {open && children}
  </details>;
}
