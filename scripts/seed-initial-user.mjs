import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const keyPath = path.resolve('firebasekey.json');
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
    databaseURL: 'https://unichat-acfc2-default-rtdb.firebaseio.com'
  });
}

const db = getDatabase();

async function seedAdmin() {
  const username = 'tronglich';
  const rawPassword = '389363';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const userRef = db.ref(`lixfnet/users/${username}`);
  const snap = await userRef.once('value');

  if (!snap.exists()) {
    console.log(`Seeding user '${username}'...`);
    await userRef.set({
      username,
      passwordHash: hashedPassword,
      role: 'admin',
      displayName: 'Trọng Lịch',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    });
    console.log(`User '${username}' seeded successfully!`);
  } else {
    console.log(`User '${username}' already exists. Updating credentials to ensure latest...`);
    await userRef.update({
      passwordHash: hashedPassword,
      updatedAt: new Date().toISOString()
    });
    console.log(`User '${username}' credentials refreshed!`);
  }

  // Also ensure table lixfnet has metadata
  await db.ref('lixfnet/metadata').set({
    appName: 'LIXFNET Streaming & Entertainment',
    databaseVersion: '1.0.0',
    lastSync: new Date().toISOString()
  });

  const check = await userRef.once('value');
  console.log('Verified user data in lixfnet/users:', check.val());
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
