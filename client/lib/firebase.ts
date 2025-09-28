import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  Auth,
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7KlxN05OoSCGHwjXhiiYyKF5bOXianLY",
  authDomain: "keysystem-d0b86-8df89.firebaseapp.com",
  projectId: "keysystem-d0b86-8df89",
  storageBucket: "keysystem-d0b86-8df89.appspot.com",
  messagingSenderId: "1048409565735",
  appId: "1:1048409565735:web:65b368e2b20a74df0dfc02",
  measurementId: "G-N1P4V34PE5",
};

// Only initialize firebase app in the browser runtime to avoid server-side SDK issues
export const app: FirebaseApp | null = typeof window !== "undefined" ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

// Initialize Firestore only in the browser
export const db: Firestore | undefined = typeof window !== "undefined" && app ? initializeFirestore(app, {
  useFetchStreams: false,
  experimentalAutoDetectLongPolling: true,
} as any) : undefined;

// Auth is browser-only: guard initialization so server builds don't initialize auth components
export const auth: Auth | undefined = typeof window !== "undefined" && app ? getAuth(app) : undefined;

// Optional: keep persistence if desired
if (typeof window !== "undefined" && auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export async function initAnalytics() {
  if (typeof window === "undefined" || !app) return null;
  try {
    if (await isSupported()) {
      return getAnalytics(app);
    }
  } catch {
    // no-op
  }
  return null;
}

export async function getStorageClient() {
  if (typeof window === "undefined" || !app) return undefined;
  try {
    const mod = await import("firebase/storage");
    return mod.getStorage(app);
  } catch (e) {
    // Storage not available in this environment or failed to load
    // eslint-disable-next-line no-console
    console.error("getStorageClient failed", e);
    return undefined;
  }
}
