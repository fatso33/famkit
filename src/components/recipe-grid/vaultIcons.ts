import {
  CakeSlice,
  CalendarPlus,
  CaseSensitive,
  ChefHat,
  Cherry,
  EggFried,
  Ellipsis,
  GlassWater,
  History,
  Salad,
  Shapes,
  Soup,
  Timer,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { RecipeCategory, VaultSortKey } from '../../types/recipe';

/** Each category's icon, in the filter, its chip and the recipe form. */
export const CATEGORY_ICONS: Record<RecipeCategory, LucideIcon> = {
  breakfast: EggFried,
  soups: Soup,
  mains: UtensilsCrossed,
  sides: Salad,
  breads: Wheat,
  cakes: CakeSlice,
  preserves: Cherry,
  drinks: GlassWater,
  other: Ellipsis,
};

export const SORT_ICONS: Record<VaultSortKey, LucideIcon> = {
  added: CalendarPlus,
  time: Timer,
  name: CaseSensitive,
  changed: History,
  cook: ChefHat,
  category: Shapes,
};
