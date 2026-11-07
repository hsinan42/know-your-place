import { useRef, type ReactNode } from 'react';
import {
  ArrowDownLeft, Bell, CalendarDays, CalendarCheck, ChartColumn, ChartPie, ChevronDown, CreditCard,
  LayoutDashboard, LayoutGrid, Plus, Repeat, Settings, ShoppingBag, UserRound, WalletCards,
} from 'lucide-react';
import { months, today } from '@/lib/format';
import { Button } from './ui/button';

export const navigation = [
  ['dashboard', 'Genel Bakış', LayoutDashboard],
  ['assets', 'Varlıklar ve Devir', WalletCards],
  ['expenses', 'Harcamalar', ShoppingBag],
  ['incomes', 'Gelirler', ArrowDownLeft],
  ['subscriptions', 'Abonelikler', Repeat],
  ['installments', 'Taksitler', CalendarCheck],
  ['cards', 'Kartlar ve Ekstreler', CreditCard],
  ['categories', 'Bütçe Planı', ChartPie],
  ['reports', 'Aylık Rapor', ChartColumn],
  ['settings', 'Ayarlar', Settings],
] as const;

type Props = {
  page: string;
  title: string;
  year: number;
  month: number;
  balance: string | null;
  onNavigate: (page: string) => void;
  onPeriod: (year: number, month: number) => void;
  onExpense: () => void;
  onIncome: () => void;
  onMenu: () => void;
  children: ReactNode;
};

export function Navigation({ page, onNavigate }: Pick<Props, 'page' | 'onNavigate'>) {
  return <nav className="app-navigation" aria-label="Sayfalar">
    {navigation.map(([key, title, Icon]) => <Button key={key} variant="ghost" aria-current={page === key ? 'page' : undefined} onClick={() => onNavigate(key)}><Icon size={19}/>{title}</Button>)}
  </nav>;
}

function PeriodSelector({ year, month, onPeriod }: Pick<Props, 'year' | 'month' | 'onPeriod'>) {
  const details = useRef<HTMLDetailsElement>(null);
  return <details className="period-picker" data-tour="period" ref={details} onKeyDown={event => {
    if (event.key === 'Escape' && details.current?.open) {
      details.current.open = false;
      details.current.querySelector('summary')?.focus();
    }
  }}>
    <summary aria-label="Rapor dönemi"><CalendarDays size={17}/><span>{months[month - 1]} {year}</span><ChevronDown size={15}/></summary>
    <form className="period-options" key={year + '-' + month} onSubmit={event => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      onPeriod(Number(fields.get('year')), Number(fields.get('month')));
      if (details.current) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    }}>
      <label>Ay<select name="month" defaultValue={month}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      <label>Yıl<input name="year" type="number" min={2000} max={2100} defaultValue={year} required/></label>
      <Button size="sm" type="submit">Uygula</Button>
      <Button size="sm" type="button" variant="ghost" onClick={() => {
        const date = today();
        onPeriod(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
        if (details.current) {
          details.current.open = false;
          details.current.querySelector('summary')?.focus();
        }
      }}>Bu aya dön</Button>
    </form>
  </details>;
}

export function AppShell({ page, title, year, month, balance, onNavigate, onPeriod, onExpense, onIncome, onMenu, children }: Props) {
  return <div className="shell">
    <aside className="sidebar">
      <Button variant="ghost" className="brand" onClick={() => onNavigate('dashboard')}><img src="/icon-192.png" alt="" width={33} height={33}/> Know Your Place</Button>
      <Navigation page={page} onNavigate={onNavigate}/>
      <Button variant="ghost" className="sidebar-profile" onClick={() => onNavigate('settings')}>
        <span className="profile-icon"><UserRound size={18}/></span><span><strong>Kişisel Alan</strong><small><CalendarDays size={13}/> {year} · {months[month - 1]} Dönemi</small></span>
      </Button>
    </aside>
    <div className="main">
      <header className="topbar">
        <Button variant="ghost" className="brand mobile-only" onClick={() => onNavigate('dashboard')}><img src="/icon-192.png" alt="" width={33} height={33}/><span><strong>Know Your Place</strong><small>{title}</small></span></Button>
        <PeriodSelector year={year} month={month} onPeriod={onPeriod}/>
        {balance && <div className="top-balance desktop-only"><WalletCards size={18}/> Net Kayıtlı Bakiye: <strong>{balance}</strong></div>}
        <div className="header-actions">
          <Button variant="income" className="desktop-only" onClick={onIncome}><Plus size={19}/> Gelir Ekle</Button>
          <Button className="desktop-only" onClick={onExpense}><Plus size={19}/> Harcama Ekle</Button>
          <Button className="mobile-only header-bell" variant="ghost" size="icon" aria-label="Ekstre ödemeleri" onClick={() => onNavigate('cards')}><Bell size={20}/></Button>
          <Button size="icon" className="profile-icon" aria-label="Kişisel alan ayarları" onClick={() => onNavigate('settings')}><UserRound size={19}/></Button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
    <nav className="bottom-nav mobile-only" aria-label="Mobil gezinme">
      <Button variant="ghost" aria-current={page === 'dashboard' ? 'page' : undefined} onClick={() => onNavigate('dashboard')}><LayoutDashboard size={20}/> Panel</Button>
      <Button variant="ghost" aria-current={page === 'assets' ? 'page' : undefined} onClick={() => onNavigate('assets')}><WalletCards size={20}/> Varlıklar</Button>
      <Button className="bottom-add" aria-label="Harcama ekle" onClick={onExpense}><Plus size={29}/></Button>
      <Button variant="ghost" aria-current={page === 'cards' ? 'page' : undefined} onClick={() => onNavigate('cards')}><CreditCard size={20}/> Kartlar</Button>
      <Button variant="ghost" onClick={onMenu}><LayoutGrid size={20}/> Menü</Button>
    </nav>
  </div>;
}
