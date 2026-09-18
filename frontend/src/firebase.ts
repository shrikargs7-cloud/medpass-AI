import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyB_DeKJD0l4sVR4rLkjYM76l9EPPSs_DXA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "medpass-93fd7.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "medpass-93fd7",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "medpass-93fd7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "160228173971",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:160228173971:web:678dfff4291e595774c566",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-J6JRG584YE",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Analytics — initialise lazily to avoid crashes in non-browser contexts
export const analyticsPromise = isSupported().then((yes) =>
  yes ? getAnalytics(app) : null
);
