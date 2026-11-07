import {
  CarFront, Clapperboard, House, ReceiptText, Shapes, ShoppingBasket,
  ShoppingBag, SquarePlus, Utensils, type LucideIcon,
} from 'lucide-react';

export function categoryIcon(name: string): LucideIcon {
  const label = name.toLocaleLowerCase('tr');
  if (/market|gıda|mutfak/.test(label)) return ShoppingBasket;
  if (/ulaşım|yakıt|benzin|araç/.test(label)) return CarFront;
  if (/fatura|abonelik/.test(label)) return ReceiptText;
  if (/eğlence|sosyal/.test(label)) return Clapperboard;
  if (/sağlık|eczane/.test(label)) return SquarePlus;
  if (/yemek|restoran/.test(label)) return Utensils;
  if (/kira|barınma|konut/.test(label)) return House;
  if (/alışveriş|giyim/.test(label)) return ShoppingBag;
  return Shapes;
}
