/**
 * Direct Client-to-Firebase Realtime Database Service.
 * Bypasses Vercel Serverless Functions completely to eliminate Vercel compute & invocations.
 * Direct path: Browser <---> Google Firebase Realtime Database
 */

const FIREBASE_DB_URL =
  process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
  'https://unichat-acfc2-default-rtdb.firebaseio.com';

export function sanitizeFirebaseKey(key: string): string {
  if (!key) return '';
  return key.replace(/[\/\.\#\$\[\]]/g, '_');
}

/**
 * Strips undefined values recursively and cleans keys so Firebase Realtime Database does not reject the payload
 */
export function cleanFirebasePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) return obj.map(cleanFirebasePayload) as any;
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj as any)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        const safeKey = sanitizeFirebaseKey(key);
        res[safeKey] = cleanFirebasePayload(val);
      }
    }
    return res;
  }
  return obj;
}

/**
 * Direct fetch watch progress from Firebase RTDB (with fallback to Vercel API)
 */
export async function directGetUserWatchProgress(username: string): Promise<Record<string, any>> {
  if (!username) return {};
  const cleanUsername = username.trim().toLowerCase();
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/watchProgress.json`;

  try {
    const res = await fetch(directUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !data.error) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[FirebaseDirect] Direct read failed, attempting Vercel API fallback:', err);
  }

  // Graceful fallback to Vercel API route if direct read encountered issues
  try {
    const fallbackRes = await fetch('/api/user/progress');
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return data.progress || {};
    }
  } catch {}

  return {};
}

/**
 * Direct save watch progress to Firebase RTDB (with fallback to Vercel API)
 */
export async function directSaveUserWatchProgress(
  username: string,
  key: string,
  progressData: any
): Promise<void> {
  if (!username || !key) return;
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = sanitizeFirebaseKey(key);
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/watchProgress/${cleanKey}.json`;
  const safeData = cleanFirebasePayload(progressData);

  try {
    const res = await fetch(directUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeData),
      keepalive: true,
    });
    if (res.ok) {
      return;
    }
  } catch (err) {
    console.warn('[FirebaseDirect] Direct write failed, attempting Vercel API fallback:', err);
  }

  // Graceful fallback
  try {
    await fetch('/api/user/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, progress: safeData }),
      keepalive: true,
    });
  } catch {}
}

/**
 * Direct delete watch progress from Firebase RTDB (with fallback to Vercel API)
 */
export async function directRemoveUserWatchProgress(
  username: string,
  key: string
): Promise<void> {
  if (!username || !key) return;
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = sanitizeFirebaseKey(key);
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/watchProgress/${cleanKey}.json`;

  try {
    const res = await fetch(directUrl, {
      method: 'DELETE',
      keepalive: true,
    });
    if (res.ok) {
      return;
    }
  } catch {}

  // Graceful fallback
  try {
    await fetch('/api/user/progress', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      keepalive: true,
    });
  } catch {}
}

/**
 * Direct get My List from Firebase RTDB (with fallback to Vercel API)
 */
export async function directGetUserMyList(username: string): Promise<any[]> {
  if (!username) return [];
  const cleanUsername = username.trim().toLowerCase();
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/myList.json`;

  try {
    const res = await fetch(directUrl);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object' && !data.error) {
        return Object.values(data);
      }
    }
  } catch {}

  // Graceful fallback
  try {
    const fallbackRes = await fetch('/api/user/mylist');
    if (fallbackRes.ok) {
      const data = await fallbackRes.json();
      return data.myList || [];
    }
  } catch {}

  return [];
}

/**
 * Direct save item to My List in Firebase RTDB (with fallback to Vercel API)
 */
export async function directSaveUserMyListItem(
  username: string,
  key: string,
  movieData: any
): Promise<void> {
  if (!username || !key) return;
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = sanitizeFirebaseKey(key);
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/myList/${cleanKey}.json`;
  const safeData = cleanFirebasePayload(movieData);

  try {
    const res = await fetch(directUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeData),
      keepalive: true,
    });
    if (res.ok) {
      return;
    }
  } catch {}

  // Graceful fallback
  try {
    await fetch('/api/user/mylist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movie: safeData }),
      keepalive: true,
    });
  } catch {}
}

/**
 * Direct remove item from My List in Firebase RTDB (with fallback to Vercel API)
 */
export async function directRemoveUserMyListItem(
  username: string,
  key: string
): Promise<void> {
  if (!username || !key) return;
  const cleanUsername = username.trim().toLowerCase();
  const cleanKey = sanitizeFirebaseKey(key);
  const directUrl = `${FIREBASE_DB_URL}/lixfnet/users/${cleanUsername}/myList/${cleanKey}.json`;

  try {
    const res = await fetch(directUrl, {
      method: 'DELETE',
      keepalive: true,
    });
    if (res.ok) {
      return;
    }
  } catch {}

  // Graceful fallback
  try {
    await fetch('/api/user/mylist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      keepalive: true,
    });
  } catch {}
}
