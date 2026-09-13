import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedApp: FirebaseApp | undefined;
let cachedAuth: Auth | undefined;

/**
 * Lazily creates the Firebase app/auth instance on first use, in the browser
 * only. Firebase's getAuth() throws immediately on an invalid/missing API
 * key, so calling it eagerly at module scope broke Next.js's server-side
 * prerendering of every page (including /_not-found) whenever Firebase env
 * vars weren't set at build time. Deferring to first client-side call keeps
 * builds green even before a Firebase project is wired up.
 */
export function getFirebaseAuth(): Auth {
  if (!cachedAuth) {
    if (!cachedApp) {
      cachedApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    }
    cachedAuth = getAuth(cachedApp);
  }
  return cachedAuth;
}

export const googleProvider = new GoogleAuthProvider();
