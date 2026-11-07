export const months = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

const decimal = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const shortDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
const longDate = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const istanbulDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul' });

export const money = (value: number) => (value < 0 ? '−' : '') + '₺' + decimal.format(Math.abs(value));
export const date = (value: string) => shortDate.format(new Date(value + 'T12:00:00'));
export const fullDate = (value: string) => longDate.format(new Date(value + 'T12:00:00'));
export const today = () => istanbulDate.format(new Date());
export const periodKey = (year: number, month: number) => year + '-' + String(month).padStart(2, '0');
