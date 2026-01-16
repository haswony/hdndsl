import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUser(userDoc.data() as User);
          } else {
            const newUser: User = {
              uid: fbUser.uid,
              displayName: fbUser.displayName || 'مستخدم جديد',
              email: fbUser.email || '',
              photoURL: fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName}&background=d946ef&color=fff`,
              bio: '',
              followers: 0,
              following: 0,
              createdAt: Date.now(),
            };
            try {
              await setDoc(userDocRef, newUser);
            } catch (writeErr) {
              console.warn('Could not save user to Firestore (check security rules):', writeErr);
            }
            setUser(newUser);
          }
        } catch (err) {
          console.warn('Firestore read error (check security rules):', err);
          // Create user object from Firebase Auth data even if Firestore fails
          const fallbackUser: User = {
            uid: fbUser.uid,
            displayName: fbUser.displayName || 'مستخدم جديد',
            email: fbUser.email || '',
            photoURL: fbUser.photoURL || `https://ui-avatars.com/api/?name=${fbUser.displayName}&background=d946ef&color=fff`,
            bio: '',
            followers: 0,
            following: 0,
            createdAt: Date.now(),
          };
          setUser(fallbackUser);
        }
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
