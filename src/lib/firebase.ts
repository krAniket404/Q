import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { supabase } from './supabase';

export const getFirebaseAuth = () => {
  try {
    if (auth && typeof (auth as any).signInWithEmailAndPassword === 'function') {
      return auth as any;
    }
    if (auth && (auth as any).default && typeof (auth as any).default.signInWithEmailAndPassword === 'function') {
      return (auth as any).default;
    }
    if (typeof auth === 'function') {
      const instance = (auth as any)();
      if (instance && (typeof instance.signInWithEmailAndPassword === 'function' || typeof instance.createUserWithEmailAndPassword === 'function')) {
        return instance;
      }
    }
    if (auth && typeof (auth as any).default === 'function') {
      const instance = (auth as any).default();
      if (instance && (typeof instance.signInWithEmailAndPassword === 'function' || typeof instance.createUserWithEmailAndPassword === 'function')) {
        return instance;
      }
    }
  } catch (e) {
    console.warn("getFirebaseAuth unavailable:", e);
  }
  return null;
};

export const getFirebaseFirestore = () => {
  try {
    if (firestore && typeof (firestore as any).collection === 'function') {
      return firestore as any;
    }
    if (firestore && (firestore as any).default && typeof (firestore as any).default.collection === 'function') {
      return (firestore as any).default;
    }
    if (typeof firestore === 'function') {
      const instance = (firestore as any)();
      if (instance && typeof instance.collection === 'function') {
        return instance;
      }
    }
    if (firestore && typeof (firestore as any).default === 'function') {
      const instance = (firestore as any).default();
      if (instance && typeof instance.collection === 'function') {
        return instance;
      }
    }
  } catch (e) {
    console.warn("getFirebaseFirestore unavailable:", e);
  }
  return null;
};

export const getServerTimestamp = () => {
  try {
    if ((firestore as any)?.FieldValue?.serverTimestamp) {
      return (firestore as any).FieldValue.serverTimestamp();
    }
    if ((firestore as any)?.default?.FieldValue?.serverTimestamp) {
      return (firestore as any).default.FieldValue.serverTimestamp();
    }
    const db = getFirebaseFirestore();
    if (db?.FieldValue?.serverTimestamp) {
      return db.FieldValue.serverTimestamp();
    }
  } catch (e) {}
  return new Date().toISOString();
};

// Provide stable references / functions for backward compatibility
export const firebaseAuth = getFirebaseAuth;
export const firebaseFirestore = getFirebaseFirestore;

// Helper function for user signup with profile creation
export const signUp = async (email: string, password: string) => {
  const cleanEmail = email.trim();
  const authInst = getFirebaseAuth();

  let firebaseError: any = null;

  if (authInst && typeof authInst.createUserWithEmailAndPassword === 'function') {
    try {
      const userCredential = await authInst.createUserWithEmailAndPassword(cleanEmail, password);

      // Create a profile for the user in Firestore if available
      try {
        const db = getFirebaseFirestore();
        if (db && typeof db.collection === 'function') {
          await db.collection('profiles').doc(userCredential.user.uid).set({
            subscription_status: 'trialing',
            trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: getServerTimestamp()
          });
        }
      } catch (e) {
        console.warn("Firestore Profile Creation Failed:", e);
      }

      return userCredential;
    } catch (e: any) {
      console.warn("Firebase Auth SignUp error:", e?.code, e?.message);
      firebaseError = e;
      if (e?.code === 'auth/email-already-in-use' || e?.code === 'auth/weak-password' || e?.code === 'auth/invalid-email') {
        throw e;
      }
    }
  }

  // Fallback to Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email: cleanEmail,
    password: password
  });

  if (error) {
    throw error || firebaseError;
  }

  if (data?.user && !data?.session) {
    return {
      requiresConfirmation: true,
      user: {
        uid: data.user.id,
        email: data.user.email || cleanEmail
      }
    };
  }

  return {
    user: {
      uid: data.user?.id || '',
      email: data.user?.email || cleanEmail,
    }
  };
};

// Helper function for user signin
export const signIn = async (email: string, password: string) => {
  const cleanEmail = email.trim();
  const authInst = getFirebaseAuth();

  let firebaseError: any = null;

  if (authInst && typeof authInst.signInWithEmailAndPassword === 'function') {
    try {
      return await authInst.signInWithEmailAndPassword(cleanEmail, password);
    } catch (e: any) {
      console.warn("Firebase Auth SignIn error:", e?.code, e?.message);
      firebaseError = e;
    }
  }

  // Fallback to Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: password
  });

  if (error) {
    throw firebaseError && firebaseError.code ? firebaseError : error;
  }

  return {
    user: {
      uid: data.user?.id || '',
      email: data.user?.email || cleanEmail,
    }
  };
};

// Utility to split large operations into batches
export const runInBatches = async (items: any[], operation: (batch: any, item: any) => void) => {
  const BATCH_SIZE = 450;
  const db = getFirebaseFirestore();
  if (!db || typeof db.batch !== 'function') return;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = items.slice(i, i + BATCH_SIZE);
    chunk.forEach(item => operation(batch, item));
    await batch.commit();
  }
};
