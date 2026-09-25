import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { Recipe } from '../types/recipe';
import { DEFAULT_RECIPE } from '../data/defaultRecipe';
import { getStoredRecipes, saveRecipes as saveToLocalStorage } from './storage';

const RECIPES_COLLECTION = 'recipes';

/**
 * Real-time listener for the recipes collection.
 * Triggers callback whenever recipes are added, modified, or deleted by any family member.
 * Returns an unsubscribe function.
 */
export function subscribeToRecipes(
  onUpdate: (recipes: Recipe[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    // Fallback to local storage if Firebase is not configured
    const local = getStoredRecipes();
    onUpdate(local);
    return () => {};
  }

  const q = query(
    collection(db, RECIPES_COLLECTION),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const cloudRecipes: Recipe[] = [];
      snapshot.forEach((docSnap) => {
        cloudRecipes.push(docSnap.data() as Recipe);
      });

      // Synchronize canonical default recipe properties if present
      const defaultIdx = cloudRecipes.findIndex(
        (r) => r.id === 'wandas-cheese-bread' || r.isDefault
      );

      if (defaultIdx !== -1) {
        cloudRecipes[defaultIdx] = {
          ...DEFAULT_RECIPE,
          ...cloudRecipes[defaultIdx],
          ingredients: DEFAULT_RECIPE.ingredients,
          steps: DEFAULT_RECIPE.steps,
          laminationDirective: DEFAULT_RECIPE.laminationDirective,
          bakingOptions: DEFAULT_RECIPE.bakingOptions,
          tips: DEFAULT_RECIPE.tips,
          notes: DEFAULT_RECIPE.notes,
          translations: DEFAULT_RECIPE.translations,
          heroImage: DEFAULT_RECIPE.heroImage,
        };
      }

      // If cloud is empty (e.g. brand new database), trigger seeding
      if (cloudRecipes.length === 0) {
        seedInitialRecipesIfEmpty().then((seeded) => {
          onUpdate(seeded);
        });
        return;
      }

      // Also mirror to localStorage for instantaneous offline boots
      saveToLocalStorage(cloudRecipes);
      onUpdate(cloudRecipes);
    },
    (error) => {
      console.warn('Firestore subscription error (falling back to local cache):', error);
      if (onError) onError(error);
      const cached = getStoredRecipes();
      onUpdate(cached);
    }
  );
}

/**
 * Saves a recipe document to Cloud Firestore.
 */
export async function saveRecipeToCloud(recipe: Recipe): Promise<void> {
  // Always update local cache immediately
  const local = getStoredRecipes();
  const existingIdx = local.findIndex((r) => r.id === recipe.id);
  const updatedLocal = existingIdx !== -1
    ? local.map((r) => (r.id === recipe.id ? recipe : r))
    : [recipe, ...local];
  saveToLocalStorage(updatedLocal);

  if (!isFirebaseConfigured || !db) return;

  const docRef = doc(db, RECIPES_COLLECTION, recipe.id);
  await setDoc(docRef, recipe, { merge: true });
}

/**
 * Deletes a recipe document from Cloud Firestore.
 */
export async function deleteRecipeFromCloud(id: string): Promise<void> {
  const local = getStoredRecipes();
  saveToLocalStorage(local.filter((r) => r.id !== id));

  if (!isFirebaseConfigured || !db) return;

  const docRef = doc(db, RECIPES_COLLECTION, id);
  await deleteDoc(docRef);
}

/**
 * Automatically seeds the cloud database with Wanda's Cheese Bread and any existing
 * recipes stored in localStorage so no previous work is lost.
 */
export async function seedInitialRecipesIfEmpty(): Promise<Recipe[]> {
  const local = getStoredRecipes();
  const recipesToSeed = local.length > 0 ? local : [DEFAULT_RECIPE];

  if (!isFirebaseConfigured || !db) {
    return recipesToSeed;
  }

  try {
    const existing = await getDocs(collection(db, RECIPES_COLLECTION));
    if (existing.empty) {
      for (const recipe of recipesToSeed) {
        await setDoc(doc(db, RECIPES_COLLECTION, recipe.id), recipe);
      }
    }
  } catch (err) {
    console.warn('Could not seed initial recipes to Firestore:', err);
  }

  return recipesToSeed;
}
