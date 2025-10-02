// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration (from Vite env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC6rbrFkR1PAkkRhwUVas5ZZ_iDYwhpM6w",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "digital-menu-ordering-system.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "digital-menu-ordering-system",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "digital-menu-ordering-system.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "408240896877",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:408240896877:web:58c30074106e7b58863864",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BJY037YJRC",
};

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