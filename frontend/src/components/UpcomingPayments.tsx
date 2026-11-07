import { CalendarDays, CreditCard, Wallet } from 'lucide-react';
import { date, money } from '@/lib/format';
import type { CashDue, PaymentAgenda, StatementPayment } from '@/types';
import { Button } from './ui/button';
import { FilterableList } from './FilterableList';

type Props = {
  agenda: PaymentAgenda;
  onStatement: (statement: StatementPayment) => void;
  onCashDue: (due: CashDue) => void;
  onViewStatement: (statement: StatementPayment) => void;
};

export function UpcomingPayments({ agenda, onStatement, onCashDue, onViewStatement }: Props) {
  return <section className="panel payment-agenda">
    <div className="section-heading">
      <div><h2><CalendarDays size={19}/> Yaklaşan ödemeler</h2><p>Vadesi geçmiş kayıtlar ve {date(agenda.through)} tarihine kadarki ödemeler</p></div>
    </div>
    <FilterableList<{ statement?: StatementPayment; due?: CashDue }> collection="upcoming"
      year={Number(agenda.asOf.slice(0, 4))} month={Number(agenda.asOf.slice(5, 7))} revision={agenda}
      pageSize={5} initialSort={{ key: 'date', direction: 'ascending' }} filters={[
      { key: 'kind', label: 'Ödeme türü', options: [['Kart ekstresi', 'Kart ekstresi'], ['Abonelik · Kartsız', 'Kartsız abonelik'], ['Taksit · Kartsız', 'Kartsız taksit']] },
      { key: 'status', label: 'Vade durumu', options: [['late', 'Vadesi geçti'], ['upcoming', 'Bugün ve sonrası']] },
    ]} empty="Bu aralıkta bekleyen ödeme yok.">
    {page => <ul className="agenda-list">
      {page.map(({ statement, due }) => {
        if (!statement && !due) return null;
        const Icon = statement ? CreditCard : Wallet;
        const key = statement ? statement.cardId + statement.closingDate : due!.kind + due!.sourceId + due!.date;
        const kind = statement ? 'Kart ekstresi' : due!.kind + ' · Kartsız';
        const dueDate = statement?.dueDate ?? due!.date;
        const amount = statement?.total ?? due!.amount;
        const estimated = Boolean(statement && statement.closingDate > agenda.asOf);
        function handlePayment() {
          if (statement) {
            if (estimated) onViewStatement(statement);
            else onStatement(statement);
          } else if (due) onCashDue(due);
        }
        const name = statement?.name ?? due!.name;
        return <li key={key} className="agenda-item">
        <span className="icon-tile"><Icon size={19}/></span>
        <div className="agenda-description"><strong>{name}</strong><small>{kind} · <span className={dueDate < agenda.asOf ? 'negative' : ''}>{date(dueDate)}</span></small>
          {dueDate < agenda.asOf && <span className="badge badge-debt">Vadesi geçti</span>}
          {estimated && <span className="badge badge-plan">Tahmini</span>}
        </div>
        <div className="agenda-action"><strong>{money(amount)}</strong>
          <Button size="sm" variant={estimated ? 'soft' : 'outline'} onClick={handlePayment}
            aria-label={name + ' ' + date(dueDate) + (estimated ? ' ekstresini incele' : ' ödemesini kaydet')}>
            {estimated ? 'İncele' : 'Ödedim'}
          </Button>
        </div>
      </li>;
      })}
    </ul>}
    </FilterableList>
  </section>;
}
