import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCIYTh7Zii8k93C1EtJnLBy53rvlJrNYG4",
  authDomain: "saeda-dc9ad.firebaseapp.com",
  databaseURL: "https://saeda-dc9ad-default-rtdb.firebaseio.com",
  projectId: "saeda-dc9ad",
  storageBucket: "saeda-dc9ad.firebasestorage.app",
  messagingSenderId: "128934053137",
  appId: "1:128934053137:web:5da4c9158e47ccea6678b0",
  measurementId: "G-14BEE6D9XS"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const storage = getStorage(app);
export default app;
