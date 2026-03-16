import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Reemplaza estos valores con los de tu consola de Firebase
// (Project Settings > General > Your apps)
const firebaseConfig = {
  apiKey: "AIzaSyDMby6xcKewRFFsD37guTNvnACCTrfsJXw",
  authDomain: "remespro.firebaseapp.com",
  projectId: "remespro",
  storageBucket: "remespro.firebasestorage.app",
  messagingSenderId: "640472258610",
  appId: "1:640472258610:web:5be467f2c043ed50ab842b",
  measurementId: "G-NKLC3P46F4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
