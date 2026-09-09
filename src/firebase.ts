import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey: 'AIzaSyAnIsGqWTHocB4UB0PshUI4MPX4DknWRHE',
  authDomain: 'leitor-codigo-barras-gg.firebaseapp.com',
  projectId: 'leitor-codigo-barras-gg',
  storageBucket: 'leitor-codigo-barras-gg.firebasestorage.app',
  messagingSenderId: '577165996641',
  appId: '1:577165996641:web:5dea69ffebca555ac3f020',
};

export const firebaseEnabled = true;
const app = getApps()[0] ?? initializeApp(cfg);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
