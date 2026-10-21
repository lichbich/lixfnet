import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getDatabase, Database } from 'firebase-admin/database';
import fs from 'fs';
import path from 'path';

let appInstance: App | null = null;
let dbInstance: Database | null = null;

export interface FirebaseUserRecord {
  username: string;
  passwordHash: string;
  role: 'admin' | 'member';
  displayName?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
}

/**
 * Initializes and returns Firebase Admin Realtime Database instance.
 * Priority 1: Local firebasekey.json (convenient for local development)
 * Priority 2: FIREBASE_SERVICE_ACCOUNT_KEY env variable (for Vercel deployment)
 * Priority 3: Individual env variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 */
export function getFirebaseAdmin(): { app: App; db: Database } {
  if (appInstance && dbInstance) {
    return { app: appInstance, db: dbInstance };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
    dbInstance = getDatabase(appInstance);
    return { app: appInstance, db: dbInstance };
  }

  let serviceAccount: any = null;

  // 1. Try reading local firebasekey.json if present
  try {
    const keyPath = path.join(process.cwd(), 'firebasekey.json');
    if (fs.existsSync(keyPath)) {
      const fileData = fs.readFileSync(keyPath, 'utf8');
      serviceAccount = JSON.parse(fileData);
    }
  } catch {
    // ignore, fall back to environment variables
  }

  // 2. Try FIREBASE_SERVICE_ACCOUNT_KEY env var (JSON string)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY env var:', e);
    }
  }

  // 3. Try individual env variables
  if (!serviceAccount && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
  }

  if (!serviceAccount) {
    throw new Error(
      'Firebase credentials not found. Please provide firebasekey.json locally or set FIREBASE_SERVICE_ACCOUNT_KEY in environment variables.'
    );
  }

  const databaseURL =
    process.env.FIREBASE_DATABASE_URL ||
    `https://${serviceAccount.project_id || serviceAccount.projectId}-default-rtdb.firebaseio.com`;

  appInstance = initializeApp({
    credential: cert(serviceAccount),
    databaseURL,
  });

  dbInstance = getDatabase(appInstance);
  return { app: appInstance, db: dbInstance };
}

/**
 * Helper to get references inside the `lixfnet` table/collection
 */
export function getLixfnetRef(subPath?: string) {
  const { db } = getFirebaseAdmin();
  const fullPath = subPath ? `lixfnet/${subPath.replace(/^\/+/, '')}` : 'lixfnet';
  return db.ref(fullPath);
}

/**
 * Finds user by username in lixfnet/users
 */
export async function findUser(username: string): Promise<FirebaseUserRecord | null> {
  const cleanUsername = username.trim().toLowerCase();
  const userRef = getLixfnetRef(`users/${cleanUsername}`);
  const snap = await userRef.once('value');
  if (!snap.exists()) return null;
  return snap.val() as FirebaseUserRecord;
}

/**
 * Creates or updates user in lixfnet/users
 */
export async function saveUser(userData: FirebaseUserRecord): Promise<void> {
  const cleanUsername = userData.username.trim().toLowerCase();
  const userRef = getLixfnetRef(`users/${cleanUsername}`);
  await userRef.set({
    ...userData,
    username: cleanUsername,
  });
}

/**
 * Lists all users in lixfnet/users (excluding password hashes)
 */
export async function listUsers(): Promise<Omit<FirebaseUserRecord, 'passwordHash'>[]> {
  const usersRef = getLixfnetRef('users');
  const snap = await usersRef.once('value');
  if (!snap.exists()) return [];

  const rawUsers = snap.val() || {};
  return Object.values(rawUsers).map((u: any) => {
    const { passwordHash, ...safeUser } = u;
    return safeUser;
  });
}

/**
 * Deletes user by username from lixfnet/users
 */
export async function deleteUser(username: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const userRef = getLixfnetRef(`users/${cleanUsername}`);
  await userRef.remove();
}

/**
 * Strips undefined values recursively so Firebase Realtime Database does not reject the payload
 */
export function cleanFirebasePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) return obj.map(cleanFirebasePayload) as any;
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        res[key] = cleanFirebasePayload(val);
      }
    }
    return res;
  }
  return obj;
}

/**
 * Gets all watch progress records for a user from lixfnet/users/{username}/watchProgress
 */
export async function getUserWatchProgress(username: string): Promise<Record<string, any>> {
  const cleanUsername = username.trim().toLowerCase();
  const progressRef = getLixfnetRef(`users/${cleanUsername}/watchProgress`);
  const snap = await progressRef.once('value');
  if (!snap.exists()) return {};
  return snap.val() || {};
}

/**
 * Saves or updates a movie's watch progress in lixfnet/users/{username}/watchProgress/{key}
 */
export async function saveUserWatchProgress(
  username: string,
  key: string,
  progressData: any
): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = key.replace(/[\/\.\#\$\[\]]/g, '_');
  const progressRef = getLixfnetRef(`users/${cleanUsername}/watchProgress/${cleanKey}`);
  const safeData = cleanFirebasePayload(progressData);
  await progressRef.set(safeData);
}

/**
 * Removes a movie from user's watch progress
 */
export async function removeUserWatchProgress(username: string, key: string): Promise<void> {
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = key.replace(/[\/\.\#\$\[\]]/g, '_');
  const progressRef = getLixfnetRef(`users/${cleanUsername}/watchProgress/${cleanKey}`);
  await progressRef.remove();
}


