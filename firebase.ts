
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect, // Cambiado para mejor compatibilidad móvil
  getRedirectResult, 
  signOut 
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

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
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Función para iniciar sesión optimizada para móviles
export const signInWithGoogle = async () => {
  try {
    // En móviles, esto redirigirá la pestaña actual en lugar de abrir una nueva
    await signInWithRedirect(auth, googleProvider);
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