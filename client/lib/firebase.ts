import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD7KlxN05OoSCGHwjXhiiYyKF5bOXianLY",
  authDomain: "keysystem-d0b86-8df89.firebaseapp.com",
  projectId: "keysystem-d0b86-8df89",
  storageBucket: "keysystem-d0b86-8df89.appspot.com",
  messagingSenderId: "1048409565735",
  appId: "1:1048409565735:web:65b368e2b20a74df0dfc02",
  measurementId: "G-N1P4V34PE5",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore only on the client. Initializing Firestore on the server
// during the dev server middleware can cause the SDK to attempt streaming
// operations using the environment's fetch/streams support which can lead to
// errors like "ReadableStreamDefaultReader constructor can only accept
// readable streams that are not yet locked to a reader". Guarding ensures
// Firestore is only created in the browser runtime.
export const db = initializeFirestore(app, {
  useFetchStreams: false,
  experimentalAutoDetectLongPolling: true,
} as any);

// Auth is browser-only: guard initialization so server builds don't initialize auth components
export const auth = getAuth(app);
// Optional: keep persistence if desired
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export async function initAnalytics() {
  if (typeof window === "undefined") return null;
  // Opt-in only: avoid noisy network errors in restricted environments
  const enabled = (import.meta as any).env?.VITE_ENABLE_ANALYTICS === "true";
  if (!enabled) return null;
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
  if (typeof window === "undefined") return undefined;
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
