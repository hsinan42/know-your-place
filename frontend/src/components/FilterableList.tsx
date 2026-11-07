import { ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { useLedgerPage } from '@/features/ledger/useLedgerPage';
import { Button } from './ui/button';

export type ListFilter = {
  key: string;
  label: string;
  options: readonly (readonly [value: string, label: string])[];
};

const pageSizes = [10, 25, 50, 100];

export type SortColumn = { key: string; label: string };
type Sort = { key: string; direction: 'ascending' | 'descending' };
export type ListSort = { current?: Sort; toggle: (key: string) => void };

export function FilterableList<T>({ collection, year, month, revision, fixed, filters = [], search, searchLabel = 'Kayıtlarda ara', pageSize = 10, selectablePageSize, sortColumns = [], initialSort, empty, children }: {
  collection: string;
  year: number;
  month: number;
  revision: unknown;
  fixed?: Record<string, string>;
  filters?: readonly ListFilter[];
  search?: boolean;
  searchLabel?: string;
  pageSize?: number;
  selectablePageSize?: boolean;
  sortColumns?: readonly SortColumn[];
  initialSort?: Sort;
  empty: string;
  children: (page: T[], sort: ListSort) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [requestedPage, setPage] = useState(1);
  const period = year + '-' + month;
  const [lastPeriod, setLastPeriod] = useState(period);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [sort, setSort] = useState(initialSort);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterId = useId();
  const effectiveSize = selectablePageSize ? rowsPerPage : pageSize;
  const result = useLedgerPage<T>(collection, year, month, revision, {
    ...fixed, ...selected, search: query, page: String(period === lastPeriod ? requestedPage : 1), size: String(effectiveSize),
    sort: sort?.key, direction: sort?.direction,
  });
  const page = result.data?.page ?? requestedPage;
  const total = result.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / effectiveSize));
  const start = (page - 1) * effectiveSize;
  const activeFilters = Number(Boolean(query.trim())) + filters.filter(filter => selected[filter.key]).length;
  const hasFilters = activeFilters > 0;
  const hasControls = Boolean(search || filters.length);
  if (lastPeriod !== period) {
    setLastPeriod(period);
    setPage(1);
  }
  function changeSort(next: Sort) { setSort(next); setPage(1); }
  function toggle(key: string) {
    changeSort({ key, direction: sort?.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending' });
  }

  return <>
    {hasControls && <Button type="button" variant="outline" className="list-filter-toggle mobile-only" aria-expanded={filtersOpen} aria-controls={filterId} onClick={() => setFiltersOpen(!filtersOpen)}>
      <SlidersHorizontal size={17}/> Filtreler {hasFilters && <span className="badge badge-neutral">{activeFilters}</span>}<ChevronDown size={16} className="filter-chevron"/>
    </Button>}
    {hasControls && <div id={filterId} className={'list-filter-panel' + (filtersOpen ? ' is-open' : '')}><div className="list-filter-content"><div className="list-controls">
      {search && <label>{searchLabel}<input type="search" aria-label={searchLabel} maxLength={250} value={query} onChange={event => { setQuery(event.target.value); setPage(1); }}/></label>}
      {filters.map(filter => <label key={filter.key}>{filter.label}
        <select aria-label={filter.label} value={selected[filter.key] ?? ''} onChange={event => {
          setSelected({ ...selected, [filter.key]: event.target.value });
          setPage(1);
        }}><option value="">Tümü</option>{filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>)}
      {hasFilters && <Button type="button" variant="ghost" size="sm" onClick={() => {
        setQuery(''); setSelected({}); setPage(1);
      }}>Filtreleri temizle</Button>}
    </div></div></div>}
    {(selectablePageSize || sortColumns.length > 0) && <div className="list-options">
      {sortColumns.length > 0 && <div className="list-mobile-sort mobile-only">
        <label>Sırala<select aria-label="Sıralama kolonu" value={sort?.key ?? ''} onChange={event => changeSort({ key: event.target.value, direction: sort?.direction ?? 'ascending' })}>
          {sortColumns.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select></label>
        <label>Yön<select aria-label="Sıralama yönü" value={sort?.direction ?? 'ascending'} onChange={event => {
          if (sort) changeSort({ key: sort.key, direction: event.target.value === 'descending' ? 'descending' : 'ascending' });
        }}><option value="ascending">Artan</option><option value="descending">Azalan</option></select></label>
      </div>}
      {selectablePageSize && <label>Satır / sayfa<select aria-label="Sayfa başına satır" value={rowsPerPage} onChange={event => { setRowsPerPage(Number(event.target.value)); setPage(1); }}>
        {pageSizes.map(size => <option key={size}>{size}</option>)}
      </select></label>}
    </div>}
    {result.error ? <p role="alert" className="error">{result.error}</p>
      : !result.data ? <p className="empty" role="status">Kayıtlar yükleniyor…</p>
        : total ? children(result.data.items, { current: sort, toggle })
          : <p className="empty">{hasFilters ? 'Filtrelere uyan kayıt yok.' : empty}</p>}
    {total > 0 && <div className="list-pagination">
      <span role="status">{start + 1}–{Math.min(start + effectiveSize, total)} / {total} kayıt</span>
      {pageCount > 1 && <nav aria-label="Sayfalama">
        <Button type="button" size="icon" variant="outline" aria-label="Önceki sayfa" disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17}/></Button>
        <span>Sayfa {page} / {pageCount}</span>
        <Button type="button" size="icon" variant="outline" aria-label="Sonraki sayfa" disabled={page === pageCount} onClick={() => setPage(page + 1)}><ChevronRight size={17}/></Button>
      </nav>}
    </div>}
  </>;
}
