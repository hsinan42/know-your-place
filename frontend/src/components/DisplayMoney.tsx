import { money } from '@/lib/format';

export function DisplayMoney({ value }: { value: number }) {
  const [whole, fraction] = money(value).split(',');
  return <>{whole}<span className="currency-fraction">,{fraction}</span></>;
}
