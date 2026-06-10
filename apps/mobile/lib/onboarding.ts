import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Role, TimeSlotId } from "@zeitbruecke/shared";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";

export type OnboardingStep =
  | "welcome"
  | "signin"
  | "role"
  | "basics"
  | "interests"
  | "children"
  | "availability"
  | "wishes"
  | "district"
  | "summary";

export interface AvailabilitySelection {
  weekday: number;
  slotId: TimeSlotId;
}

export interface OnboardingState {
  /** Schritt, an dem nach App-Kill fortgesetzt wird. */
  step: OnboardingStep;
  email: string;
  role: Role | null;
  displayName: string;
  birthYear: number | null;
  interests: string[];
  childrenCount: number;
  ageMin: number;
  ageMax: number;
  careWishes: string;
  district: string | null;
  postalCode: string;
  bio: string;
  availability: AvailabilitySelection[];
  /** Nur Demo-Modus: Abschluss-Zeitpunkt, Profil bleibt lokal. */
  demoCompletedAt: string | null;
}

export const initialOnboardingState: OnboardingState = {
  step: "welcome",
  email: "",
  role: null,
  displayName: "",
  birthYear: null,
  interests: [],
  childrenCount: 1,
  ageMin: 0,
  ageMax: 0,
  careWishes: "",
  district: null,
  postalCode: "",
  bio: "",
  availability: [],
  demoCompletedAt: null,
};

export type OnboardingAction =
  | { type: "HYDRATE"; state: OnboardingState }
  | { type: "SET_STEP"; step: OnboardingStep }
  | { type: "SET_EMAIL"; email: string }
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_BASICS"; displayName: string; birthYear: number }
  | { type: "SET_INTERESTS"; interests: string[] }
  | { type: "SET_CHILDREN"; childrenCount: number; ageMin: number; ageMax: number }
  | { type: "SET_AVAILABILITY"; availability: AvailabilitySelection[] }
  | { type: "SET_CARE_WISHES"; careWishes: string }
  | { type: "SET_KIEZ"; district: string; postalCode: string; bio: string }
  | { type: "COMPLETE_DEMO" }
  | { type: "RESET" };

function reducer(state: OnboardingState, action: OnboardingAction): OnboardingState {
  switch (action.type) {
    case "HYDRATE":
      return action.state;
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_EMAIL":
      return { ...state, email: action.email, step: "signin" };
    case "SET_ROLE": {
      // Rollenwechsel verwirft rollenspezifische Eingaben des anderen Pfads.
      const cleared =
        state.role && state.role !== action.role
          ? {
              interests: initialOnboardingState.interests,
              availability: initialOnboardingState.availability,
              childrenCount: initialOnboardingState.childrenCount,
              ageMin: initialOnboardingState.ageMin,
              ageMax: initialOnboardingState.ageMax,
              careWishes: initialOnboardingState.careWishes,
            }
          : null;
      return { ...state, ...cleared, role: action.role, step: "basics" };
    }
    case "SET_BASICS":
      return {
        ...state,
        displayName: action.displayName,
        birthYear: action.birthYear,
        step: state.role === "family" ? "children" : "interests",
      };
    case "SET_INTERESTS":
      return { ...state, interests: action.interests, step: "availability" };
    case "SET_CHILDREN":
      return {
        ...state,
        childrenCount: action.childrenCount,
        ageMin: action.ageMin,
        ageMax: action.ageMax,
        step: "wishes",
      };
    case "SET_AVAILABILITY":
      return { ...state, availability: action.availability, step: "district" };
    case "SET_CARE_WISHES":
      return { ...state, careWishes: action.careWishes, step: "district" };
    case "SET_KIEZ":
      return {
        ...state,
        district: action.district,
        postalCode: action.postalCode,
        bio: action.bio,
        step: "summary",
      };
    case "COMPLETE_DEMO":
      return { ...state, demoCompletedAt: new Date().toISOString() };
    case "RESET":
      return initialOnboardingState;
    default:
      return state;
  }
}

/** Schrittfolge je Rolle – „Schritt X von Y" zählt ab Anmelden (1) bis Fertig (7). */
export function stepsForRole(role: Role | null): OnboardingStep[] {
  const rolePath: OnboardingStep[] =
    role === "family" ? ["children", "wishes"] : ["interests", "availability"];
  return ["signin", "role", "basics", ...rolePath, "district", "summary"];
}

export function stepProgress(
  step: OnboardingStep,
  role: Role | null,
): { current: number; total: number } | null {
  const steps = stepsForRole(role);
  const index = steps.indexOf(step);
  if (index === -1) return null;
  return { current: index + 1, total: steps.length };
}

export function stepRoute(step: OnboardingStep): string {
  return `/onboarding/${step}`;
}

const STORAGE_KEY = "zeitbruecke.onboarding.v1";

interface OnboardingContextValue {
  state: OnboardingState;
  dispatch: Dispatch<OnboardingAction>;
  /** true, sobald der gespeicherte Zustand aus AsyncStorage geladen wurde. */
  hydrated: boolean;
  clear: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialOnboardingState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const stored = JSON.parse(raw) as Partial<OnboardingState>;
          dispatch({ type: "HYDRATE", state: { ...initialOnboardingState, ...stored } });
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state, hydrated]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      state,
      dispatch,
      hydrated,
      clear: async () => {
        dispatch({ type: "RESET" });
        await AsyncStorage.removeItem(STORAGE_KEY).catch(() => undefined);
      },
    }),
    [state, hydrated],
  );

  return createElement(OnboardingContext.Provider, { value }, children);
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding muss innerhalb von OnboardingProvider verwendet werden.");
  }
  return context;
}
