
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

// Tu configuración real de Firebase (remespro)
const firebaseConfig = {
  apiKey: "AIzaSyDMby6xcKewRFFsD37guTNvnACCTrfsJXw",
  authDomain: "remespro.firebaseapp.com",
  projectId: "remespro",
  storageBucket: "remespro.firebasestorage.app",
  messagingSenderId: "640472258610",
  appId: "1:640472258610:web:5be467f2c043ed50ab842b",
  measurementId: "G-NKLC3P46F4"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Analytics (opcional)
export const analytics = getAnalytics(app);

// Inicializar Firestore (Base de datos para tus remesas)
export const db = getFirestore(app);

// Inicializar Auth (Autenticación de usuarios)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Configuración para forzar la selección de cuenta al iniciar sesión
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Función para iniciar sesión con Google
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Error al iniciar sesión con Google", error);
    throw error;
  }
};

// Función para cerrar sesión
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión", error);
    throw error;
  }
};