import { newId } from './lib/utils';
import { AssetsPanel } from './components/AssetsPanel';
import { AppShell, Navigation, navigation as nav } from './components/AppShell';
import { CardsPanel } from './components/CardsPanel';
import { Dashboard } from './components/Dashboard';
import { MonthlyReports } from './components/MonthlyReports';
import { money, periodKey, today } from './lib/format';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from './components/ui/button';
import { Dialog } from './components/ui/dialog';
import { stateRevision } from './api';
import type { CashDue,State,Entity,Collection,Report,StatementPayment } from './types';
import { useSession } from './features/auth/session';
import { RecordEditor } from './features/ledger/RecordEditor';
import { applyRecordEdit, newRecord, type RecordDraft } from './features/ledger/record-editing';
import { RecordsPage } from './features/ledger/RecordsPage';
import { fields } from './features/ledger/record-fields';
import { SettingsPage } from './features/settings/SettingsPage';
import { OnboardingTour } from './features/tour/OnboardingTour';
import { tourSteps } from './features/tour/steps';

export default function FinanceWorkspace() {
 const { account, request, signOut } = useSession();
 const [state, setState] = useState<State | null>(null);
 const [report, setReport] = useState<Report | null>(null);
 const [page, setPage] = useState('dashboard');
 const [error, setError] = useState('');
 const [busy, setBusy] = useState(false);
 const [sidebar, setSidebar] = useState(false);
 const [edit, setEdit] = useState<RecordDraft | null>(null);
 const [year, setYear] = useState(Number(today().slice(0, 4)));
 const [month, setMonth] = useState(Number(today().slice(5, 7)));
 const etag = useRef('');
 const [tourIndex, setTourIndex] = useState<number | null>(null);
 const tourRequested = useRef(false);

 useEffect(() => {
   if (!report || !account.tourPending || tourRequested.current) return;
   tourRequested.current = true;
   request('/api/tour/start', { method: 'POST' })
     .then(response => response.json())
     .then(({ started }) => {
       if (!started) return;
       setPage('dashboard');
       setSidebar(false);
       setEdit(null);
       setTourIndex(0);
     })
     .catch(() => { tourRequested.current = false; });
 }, [report, account.tourPending, request]);

 useEffect(() => {
   const abort = new AbortController();
   async function load() {
     try {
       const response = await request('/api/workspace', { signal: abort.signal });
       const data: State = await response.json();
       if (abort.signal.aborted) return;
       etag.current = stateRevision(response);
       setState(data);
     } catch (failure) {
       if (!abort.signal.aborted) setError((failure as Error).message);
     }
   }
   void load();
   return () => abort.abort();
 }, [request]);

 useEffect(() => {
   if (!state) return;
   setReport(null);
   const abort = new AbortController();
   request('/api/report/' + year + '/' + month, { signal: abort.signal })
     .then(response => response.json()).then(data => {
       if (!abort.signal.aborted) setReport(data);
     }).catch(failure => {
       if (!abort.signal.aborted) setError((failure as Error).message);
     });
   return () => abort.abort();
 }, [state, year, month, request]);

 async function save(change: State | ((snapshot: State) => State)) {
   setBusy(true);
   setError('');
   try {
     let next: State;
     if (typeof change === 'function') {
       const snapshot = await request('/api/state');
       if (stateRevision(snapshot) !== etag.current)
         throw new Error('Veriler başka bir sekmede değişti. Sayfayı yenileyin; son değişikliğiniz kaydedilmedi.');
       next = change(await snapshot.json());
     } else {
       next = change;
     }
     const response = await request('/api/state', {
       method: 'PUT',
       body: JSON.stringify(next),
       headers: { 'If-Match': etag.current },
     });
     etag.current = stateRevision(response);
     setState({ ...next, expenses: [], incomes: [], installments: [], subscriptions: [] });
     setEdit(null);
   } catch (failure) {
     setError((failure as Error).message);
   } finally {
     setBusy(false);
   }
 }
 async function importData(file: File) {
   try {
     const imported: State = JSON.parse(await file.text());
     if (window.confirm('Mevcut verilerin tamamı bu dosyayla değiştirilecek. Önce yedek aldınız mı?'))
       await save(imported);
   } catch {
     setError('Dosya geçerli bir Know Your Place JSON yedeği değil.');
   }
 }

 async function exportData() {
   try {
     const response = await request('/api/state');
     const data = await response.json();
     const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
     const link = document.createElement('a');
     link.href = url;
     link.download = 'know-your-place-' + today() + '.json';
     link.click();
     URL.revokeObjectURL(url);
   } catch (failure) {
     setError((failure as Error).message);
   }
 }

 function add(collection: string) {
   if (state) openEditor(collection, newRecord(collection, state), false);
 }

 function submit(event: FormEvent<HTMLFormElement>) {
   event.preventDefault();
   if (!edit || !state || busy) return;
   const fields = new FormData(event.currentTarget);
   void save(snapshot => applyRecordEdit(snapshot, edit, fields));
 }

 function remove(collection: Collection, row: Entity) {
   if (!state || busy || !window.confirm('Bu kayıt silinsin mi? Bağlı kayıtlar varsa önce onları güncellemelisiniz.')) return;
   void deleteRecord(collection, row.id);
 }

 async function deleteRecord(collection: Collection, id: string) {
   await save(snapshot => ({ ...snapshot, [collection]: (snapshot[collection] ?? []).filter(item => item.id !== id) }));
 }

 if (!state) return <div className="loading">
   {error ? <><p role="alert">{error}</p><Button onClick={() => window.location.reload()}>Tekrar dene</Button></>
     : <p role="status">Finans kayıtların açılıyor…</p>}
 </div>;

 function navigate(next: string) {
   setPage(next);
   setSidebar(false);
   window.scrollTo(0, 0);
 }

 function advanceTour(skipGroup: boolean) {
   if (tourIndex === null) return;
   const next = skipGroup
     ? tourSteps.findIndex((step, index) => index > tourIndex && step.group !== tourSteps[tourIndex].group)
     : tourIndex + 1;
   if (next < 0 || next >= tourSteps.length) {
     setTourIndex(null);
     return;
   }
   if (page !== tourSteps[next].page) navigate(tourSteps[next].page);
   setTourIndex(next);
 }
 function openEditor(collection: string, value: Entity, editing = true, sourceName?: string) {
   setError('');
   setEdit({ collection, value, editing, sourceName });
 }
 function recordSalary() {
   const currentDate = today();
   if (!report || periodKey(year, month) !== currentDate.slice(0, 7)) return;
   const selected = report.months[month - 1];
   if (selected.salaryPlan > 0 && selected.salaryReceived >= selected.salaryPlan) return;
   openEditor('incomes', {
     id: newId(), date: currentDate, type: 'Maaş', description: 'Maaş ödemesi',
     amount: Math.max(0, selected.salaryPlan - selected.salaryReceived), isBorrowing: false, isSalary: true,
   });
 }
 function recordStatement(statement: StatementPayment, allowUndo = true) {
   if (!state || busy) return;
   const existing = state.payments.find(payment => payment.cardId === statement.cardId && payment.closingDate === statement.closingDate);
   if (existing) {
     if (allowUndo && window.confirm('Ödeme onayı geri alınsın mı?')) void deleteRecord('payments', existing.id);
     return;
   }
   openEditor('payments', { id: newId(), cardId: statement.cardId, closingDate: statement.closingDate, paidOn: today(), amount: statement.total });
 }
 function recordCashDue(due: CashDue) {
   if (!state || busy) return;
   if (state.cashPayments?.some(payment => payment.kind === due.kind && payment.sourceId === due.sourceId && payment.dueDate === due.date)) {
     setError('Bu vade için ödeme kaydı zaten var.');
     return;
   }
   openEditor('cashPayments', { id: newId(), kind: due.kind, sourceId: due.sourceId, dueDate: due.date, paidOn: today(), amount: due.amount },
     false, due.name);
 }
 function changePeriod(nextYear: number, nextMonth: number) {
   if (nextYear === year && nextMonth === month) return;
   setError('');
   setReport(null);
   setYear(nextYear);
   setMonth(nextMonth);
 }
 function viewStatement(statement: StatementPayment) {
   const [statementYear, statementMonth] = statement.closingDate.split('-').map(Number);
   changePeriod(statementYear, statementMonth);
   navigate('cards');
 }

 async function logout() {
   setBusy(true);
   try {
     await signOut();
   } catch (failure) {
     setError((failure as Error).message);
   } finally {
     setBusy(false);
   }
 }

 const title = nav.find(item => item[0] === page)?.[1] ?? '';
 const showRecords = page in fields && page !== 'settings' && page !== 'cards';
 return <>
 <AppShell page={page} title={title} year={year} month={month} balance={report ? money(report.assets.balance) : null}
   onNavigate={navigate} onPeriod={changePeriod}
   onExpense={() => add('expenses')} onIncome={() => add('incomes')} onMenu={() => setSidebar(true)}>
 {!['dashboard', 'assets', 'cards'].includes(page) && <div className="page-heading"><h1>{title}</h1><p>Kayıtlarını yönet, planını güncel tut.</p></div>}
 {error && !edit && <div role="alert" className="error alert">{error}<button aria-label="Mesajı kapat" onClick={() => setError('')}><X size={16}/></button></div>}
 {!report && !error && ['dashboard', 'assets', 'cards', 'reports'].includes(page) && <p className="panel empty" role="status">Rapor yükleniyor…</p>}
 {page === 'dashboard' && report && <Dashboard state={state} report={report} year={year} month={month} onNavigate={navigate} onAdd={add} onSalary={recordSalary} onStatement={statement => recordStatement(statement, false)} onCashDue={recordCashDue} onViewStatement={viewStatement}/>}
 {page === 'assets' && report && <AssetsPanel state={state} report={report} year={year} month={month} onEdit={openEditor}
   onRemoveCashPayment={id => deleteRecord('cashPayments', id)} onSalary={recordSalary} onCashDue={recordCashDue} busy={busy}/>}
 {page === 'cards' && report && <CardsPanel state={state} report={report} year={year} month={month} busy={busy} onAdd={() => add('cards')}
   onEdit={card => openEditor('cards', card)} onRemove={card => remove('cards', card)} onPayment={recordStatement}/>}
 {showRecords && <RecordsPage key={page} collection={page as Collection} title={title} year={year} month={month}
   state={state} report={report} add={add} openEditor={openEditor} remove={remove}/>}
 {page === 'reports' && report && <MonthlyReports report={report} year={year} month={month}/>}
 {page === 'settings' && <SettingsPage state={state} busy={busy} onEdit={() => add('settings')}
   onImport={importData} onExport={exportData} onLogout={logout}/>}
 </AppShell>
 {tourIndex !== null && <OnboardingTour index={tourIndex} page={page}
   onAdvance={advanceTour} onClose={() => setTourIndex(null)}/>}
 <Dialog open={sidebar} onOpenChange={setSidebar} title="Menü"><Navigation page={page} onNavigate={navigate}/></Dialog>
 {edit && <RecordEditor key={edit.value.id} draft={edit} state={state} busy={busy} error={error}
   onClose={() => { setEdit(null); setError(''); }} onSubmit={submit}/>}
 </>
}
