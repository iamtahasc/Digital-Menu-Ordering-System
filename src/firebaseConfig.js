// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (from Vite env)
// Prioritize environment variables, fallback to hardcoded defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Check if all required config values are present
const isConfigValid = Object.values(firebaseConfig).every(value => value !== undefined);

// Fallback to hardcoded defaults if env variables are missing
if (!isConfigValid) {
  console.warn("Some Firebase config values are missing. Using fallback values.");
  firebaseConfig.apiKey = firebaseConfig.apiKey || "AIzaSyC6rbrFkR1PAkkRhwUVas5ZZ_iDYwhpM6w";
  firebaseConfig.authDomain = firebaseConfig.authDomain || "digital-menu-ordering-system.firebaseapp.com";
  firebaseConfig.projectId = firebaseConfig.projectId || "digital-menu-ordering-system";
  firebaseConfig.storageBucket = firebaseConfig.storageBucket || "digital-menu-ordering-system.firebasestorage.app";
  firebaseConfig.messagingSenderId = firebaseConfig.messagingSenderId || "408240896877";
  firebaseConfig.appId = firebaseConfig.appId || "1:408240896877:web:58c30074106e7b58863864";
  firebaseConfig.measurementId = firebaseConfig.measurementId || "G-BJY037YJRC";
}

// Initialize Firebase app once
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

// Auth instance
const auth = getAuth(app);
// Firestore instance
const db = getFirestore(app);

// Analytics (guard for environment support)
let analytics;
if (typeof window !== "undefined") {
  try {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    });
  } catch (_) {
    // no-op: analytics not supported
  }
}

export { app, auth, analytics, db };
export default firebaseConfig;