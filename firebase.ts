import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithRedirect, signOut } from 'firebase/auth';
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

// 1. Inicializar Firebase (Solo una vez)
const app = initializeApp(firebaseConfig);

// 2. Exportar instancias de servicios
export const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);

// 3. Configurar Proveedor de Google
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// 4. Función para iniciar sesión (Optimizado para móviles con Redirect)
export const signInWithGoogle = async () => {
  try {
    // Usamos Redirect para evitar que navegadores móviles bloqueen el popup
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error("Error al iniciar sesión con Google", error);
    throw error;
  }
};

// 5. Función para cerrar sesión
export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión", error);
    throw error;
  }
};