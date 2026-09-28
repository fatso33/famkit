import {
  ArrowDownAZ,
  CakeSlice,
  Cherry,
  Clock,
  EggFried,
  Ellipsis,
  GlassWater,
  History,
  Salad,
  Shapes,
  Soup,
  Sparkles,
  User,
  UtensilsCrossed,
  Wheat,
  type LucideIcon,
} from 'lucide-react';
import { RecipeCategory, VaultSort } from '../../types/recipe';

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

export const SORT_ICONS: Record<VaultSort, LucideIcon> = {
  newest: Sparkles,
  az: ArrowDownAZ,
  quickest: Clock,
  updated: History,
  cook: User,
  category: Shapes,
};
