import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Trash2 } from 'lucide-react';
import { FilterableList, type SortColumn } from '../../components/FilterableList';
import { recordFilters } from '../../components/record-filters';
import { Button } from '../../components/ui/button';
import { date, money, today } from '../../lib/format';
import { BudgetUsage } from './BudgetUsage';
import { incomeKind } from '../../lib/income-kind';
import type { Collection, Entity, Report, State } from '../../types';

type Props = {
  collection: Collection;
  title: string;
  year: number;
  month: number;
  state: State;
  report: Report | null;
  add: (collection: string) => void;
  openEditor: (collection: string, value: Entity) => void;
  remove: (collection: Collection, row: Entity) => void;
};

export function RecordsPage({ collection, title, year, month, state, report, add, openEditor, remove }: Props) {
 const page = collection;
 const categoryName = (id: unknown) => String(state.categories.find(item => item.id === id)?.name ?? '—');
 const cardName = (id: unknown) => String(state.cards.find(item => item.id === id)?.name ?? '—');
 const sortable = ['expenses', 'incomes', 'subscriptions', 'installments'].includes(page);
 const planProgress = new Map(report?.installments.map(item => [item.id, item]));
 const recordName = (row: Entity) => String(row.description || row.name || row.type || 'Harcama');
 const recordKind = (row: Entity) => page === 'expenses' ? categoryName(row.categoryId) : page === 'incomes' ? incomeKind(row) : String(row.category || '—');
 const columns: SortColumn[] = [
   { key: 'name', label: 'Kayıt' },
   { key: 'date', label: page === 'installments' ? 'Vade' : page === 'subscriptions' ? 'Başlangıç tarihi' : 'Tarih / dönem' },
   { key: 'kind', label: 'Tür / kategori' },
   { key: 'amount', label: page === 'installments' ? 'Sıradaki ödeme' : 'Tutar' },
 ];
 function renderRow(row: Entity) {
   const plan = page === 'installments' ? planProgress.get(row.id) : undefined;
   const nextDue = plan?.nextDue;
   const nextLabel = nextDue && nextDue.date < (report?.assets.asOf ?? today()) ? 'Geciken vade' : 'Sonraki vade';
   const fallbackDate = page === 'expenses' || page === 'incomes' ? date(String(row.date))
     : page === 'subscriptions' ? row.paymentDay + '. gün · ' + date(String(row.start))
     : page === 'installments' ? date(String(row.firstDate)) : '—';
   const kind = recordKind(row);
   return <tr key={row.id}>
     <td><strong>{recordName(row)}</strong><small>{String(row.note || row.subcategory || '')}</small></td>
     <td>{nextDue ? <><strong>{date(nextDue.date)}</strong><small className={nextLabel === 'Geciken vade' ? 'negative' : ''}>{nextLabel}</small></>
       : plan?.remaining === 0 ? '—' : fallbackDate}</td>
     <td>{kind}</td>
     <td className="amount">
       {plan ? plan.remaining ? <><strong>{nextDue ? money(nextDue.amount) : money(Number(row.amount))}</strong><small>{plan.remaining} taksit kaldı</small><small>Toplam kalan {money(plan.debt)}</small></>
         : <span className="badge badge-cash">Tamamlandı</span>
         : money(Number(row.amount ?? row.monthlyLimit ?? 0))}
       {page === 'expenses' && <small>{row.method} {row.cardId ? '· ' + cardName(row.cardId) : ''}</small>}
       {page === 'subscriptions' && <small>{row.end ? 'Bitiş: ' + date(String(row.end)) : cardName(row.cardId)}</small>}
     </td>
     <td><div className="row-actions">
       <Button size="icon" variant="ghost" aria-label="Düzenle" onClick={() => openEditor(page, row)}><Pencil size={15}/></Button>
       <Button size="icon" variant="ghost" aria-label="Sil" onClick={() => remove(collection, row)}><Trash2 size={15}/></Button>
     </div></td>
   </tr>;
 }
 return <><section className="panel">
   <div className="section-heading" data-tour="records"><h2>{title}</h2><Button onClick={() => add(page)}><Plus size={17}/> Yeni kayıt</Button></div>
   {page === 'installments' && <p className="info-note mb-3">Devam eden bir taksit planı ekliyorsan ilk ödenmemiş vadenin tarihini ve kalan taksit sayısını gir.</p>}
   <FilterableList<Entity> collection={collection} year={year} month={month} revision={state}
     selectablePageSize={sortable} sortColumns={sortable ? columns : []}
     initialSort={sortable ? { key: 'date', direction: page === 'installments' ? 'ascending' : 'descending' } : undefined}
     filters={recordFilters(page, state)} search
     empty="Henüz kayıt yok. Yeni kayıt düğmesiyle başlayabilirsin.">
     {(rows, sort) => <div className="table-wrap"><table className="records-table">
       <thead><tr>{columns.map(column => {
         const direction = sort.current?.key === column.key ? sort.current.direction : undefined;
         const Icon = direction === 'ascending' ? ArrowUp : direction === 'descending' ? ArrowDown : ArrowUpDown;
         return <th scope="col" key={column.key} className={column.key === 'amount' ? 'amount' : undefined} aria-sort={direction}>
           {sortable ? <button type="button" className="column-sort" onClick={() => sort.toggle(column.key)}>{column.label}<Icon size={14} aria-hidden="true"/></button> : column.label}
         </th>;
       })}<th scope="col"><span className="sr-only">İşlemler</span></th></tr></thead>
       <tbody>{rows.map(renderRow)}</tbody>
     </table></div>}
   </FilterableList>
 {page==='categories'&&<div className="category-totals">Aylık toplam limit <strong>{money(state.categories.reduce((a,c)=>a+Number(c.monthlyLimit),0))}</strong> · Yıllık limit, planın açık olduğu ayların toplamıdır.</div>}
 </section>
 {page === 'categories' && report && <BudgetUsage state={state} report={report} year={year}/>}

 </>;
}
