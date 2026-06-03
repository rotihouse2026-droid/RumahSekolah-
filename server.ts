import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from 'fs';

// Load Firebase Config dynamically
const getConfig = () => {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (err) {
    console.error("Error reading firebase-applet-config.json:", err);
  }
  return null;
};

const firebaseConfig = getConfig();
const PROJECT_ID = firebaseConfig?.projectId || "ai-studio-applet-webapp-13fa5";
const DATABASE_ID = firebaseConfig?.firestoreDatabaseId || "ai-studio-ac0e52d9-9d75-4f17-8c74-136ba01c0fdd";

// Initialize Firebase Admin lazily
function initAdmin() {
  if (!admin.apps.length) {
    try {
      const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
      
      if (serviceAccountVar) {
        try {
          const serviceAccount = JSON.parse(serviceAccountVar);
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: PROJECT_ID
          });
          console.log("Firebase Admin initialized with Service Account from env");
          return;
        } catch (parseErr) {
          console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var:", parseErr);
        }
      }

      // Default initialization for professional environments (Cloud Run, GAE, etc.)
      try {
        console.log(`[Firebase Admin] Attempting Application Default Credentials for project: ${PROJECT_ID}`);
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: PROJECT_ID
        });
        console.log(`Firebase Admin initialized with Application Default Credentials`);
      } catch (adcError: any) {
        // Fallback for local dev or limited environments
        console.warn(`[Firebase Admin] ADC failed: ${adcError.message}. Falling back to default project init.`);
        admin.initializeApp({
          projectId: PROJECT_ID
        });
        console.log(`Firebase Admin initialized with project ID fallback: ${PROJECT_ID}`);
      }
    } catch (error) {
      console.error("Firebase Admin initialization failed:", error);
    }
  }
}

const getDbInstance = () => {
  initAdmin();
  try {
    return getFirestore(DATABASE_ID);
  } catch (error) {
    console.error(`Failed to get Firestore instance for database ${DATABASE_ID}:`, error);
    throw new Error(`Firestore Initialization Error: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// Safe recursive deserialization helper to cleanse Firestore DB values of circular dependencies and non-serializable objects (like DocumentReferences)
function sanitizeDbData(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  // 1. If it has a toDate function (Firestore Timestamp or admin.firestore.Timestamp), convert to ISO string
  if (typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }

  // 2. Fallback for Timestamp-like flat structure from the admin SDK JSON representation
  if (typeof obj === 'object' && '_seconds' in obj && '_nanoseconds' in obj) {
    try {
      return new Date(obj._seconds * 1000).toISOString();
    } catch (e) {
      return obj;
    }
  }

  // 3. DocumentReference identification (Admin SDK reference has id, path, firestore)
  if (typeof obj === 'object' && 'id' in obj && 'path' in obj && 'firestore' in obj) {
    return { id: obj.id, path: obj.path };
  }

  // 4. Handle array recursively
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeDbData(item));
  }

  // 5. Recursively cleanse custom and standard JSON objects safely
  if (typeof obj === 'object' && obj.constructor && (obj.constructor.name === 'Object' || !obj.constructor.name)) {
    const clean: any = {};
    for (const key of Object.keys(obj)) {
      try {
        const val = obj[key];
        if (typeof val === 'function') continue;
        clean[key] = sanitizeDbData(val);
      } catch (err) {
        // Safe skip non-readable properties
      }
    }
    return clean;
  }

  // Primitive value or fallback
  if (typeof obj === 'object') {
    // If it's another non-plain class instance, convert it to a string / plain object to avoid circular reference
    try {
      return String(obj);
    } catch {
      return '[Unserializable Object]';
    }
  }

  return obj;
}

const app = express();
app.use(express.json());
export default app;

// Auth middleware to check if the user is an admin
const verifyAdmin = async (req: any, res: any, next: any) => {
  initAdmin();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const email = decodedToken.email;

    // Admin logic matching firestore.rules
    const isAdmin = 
      uid === "6WkoIIyNCZef1NP6aoHtMKOoeSo1" ||
      uid === "HIsfiO4Vh6MTUYT6QZToCWjqpHn1" ||
      (email === "ismael.charu2015@gmail.com" ||
       email === "ismael.charu2018@gmail.com" ||
       email === "admin@rumahsekolah.com"
      );

    if (!isAdmin) {
      console.warn(`Unauthorized admin access attempt by UID: ${uid}, Email: ${email}`);
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// API Route to delete a user from Auth and Firestore
const handleDeleteUser = async (req: any, res: any) => {
  const { uid } = req.params;
  
  console.log(`[API] Delete User Request - Method: ${req.method}, Target UID: ${uid}, Admin UID: ${req.user?.uid}`);

  if (req.user && uid === req.user.uid) {
    return res.status(400).json({ error: "Cannot delete your own account" });
  }

  try {
    console.log(`[API] Admin ${req.user?.email} is deleting user ${uid}`);

    let authDeleted = false;
    let authErrorMsg = '';
    try {
      console.log(`[API] Deleting user ${uid} from Auth...`);
      await admin.auth().deleteUser(uid);
      authDeleted = true;
      console.log(`[API] User ${uid} deleted from Auth`);
    } catch (authErr: any) {
      if (authErr.code === 'auth/user-not-found') {
        console.log(`[API] User ${uid} not found in Auth, continuing to Firestore deletion`);
        authDeleted = true; // Consider it "done" if not there
      } else {
        authErrorMsg = authErr.message;
        console.error(`[API] CRITICAL: Auth deletion failed for ${uid}. Code: ${authErr.code}, Message: ${authErr.message}`);
        
        // If Auth deletion fails with permission issues, we should inform the user
        if (authErr.code === 'auth/insufficient-permission' || authErr.code === 'auth/operation-not-allowed') {
          return res.status(500).json({ 
            success: false,
            error: "ไม่มีสิทธิ์ลบบัญชีผู้ใช้ในระบบ Auth", 
            details: "โปรดตรวจสอบการตั้งค่า Service Account หรือสิทธิ์ของ Service Account ใน Firebase Console"
          });
        }
        // For other errors, we continue but with flag false
      }
    }

    // 2. Delete from Firestore
    let firestoreDeleted = false;
    try {
      const dbInstance = getDbInstance();
      const userDoc = dbInstance.collection('users').doc(uid);
      const docSnapshot = await userDoc.get();
      
      console.log(`[API] Checking Firestore document users/${uid}... Exists: ${docSnapshot.exists}`);
      
      if (docSnapshot.exists) {
        await userDoc.delete();
        firestoreDeleted = true;
        console.log(`[API] Document users/${uid} successfully deleted from Firestore`);
      } else {
        firestoreDeleted = true; // Still "success" if it's already gone
        console.log(`[API] Document users/${uid} was already missing from Firestore`);
      }
    } catch (fsError: any) {
      console.error(`[API] Firestore deletion error for ${uid}:`, fsError.message);
      if (!authDeleted) {
        return res.status(500).json({ 
          error: "Delete failed", 
          details: `Auth: ${authErrorMsg}, Firestore: ${fsError.message}. Ensure FIREBASE_SERVICE_ACCOUNT is set on Vercel.` 
        });
      }
    }
    
    res.json({ 
      success: true, 
      authDeleted, 
      firestoreDeleted,
      message: `User ${uid} deletion processed (Auth Success: ${authDeleted}, Firestore Success: ${firestoreDeleted})` 
    });
  } catch (error: any) {
    console.error(`[API] Error deleting user ${uid}:`, error);
    res.status(500).json({ error: error.message || "Failed to delete user" });
  }
};

app.post("/api/admin/delete-user/:uid", verifyAdmin, handleDeleteUser);
app.delete("/api/admin/delete-user/:uid", verifyAdmin, handleDeleteUser);

// API Route to list all users from Auth and include Firestore data
app.get("/api/admin/list-users", verifyAdmin, async (req: any, res: any) => {
  try {
    console.log(`[API] Listing all users for admin: ${req.user?.email}`);
    
    let authUsers: admin.auth.UserRecord[] = [];
    let authError = null;

    // 1. Try to list from Auth
    try {
      const authUsersResult = await admin.auth().listUsers(1000);
      authUsers = authUsersResult.users;
    } catch (e: any) {
      console.log("[Auth] Auth listing is bypassed or not supported/enabled. (Using database records only)");
      authError = "Auth listing is not enabled in this project console.";
    }
    
    // 2. Fetch all from Firestore 'users' collection
    let usersSnapshot: any = null;
    let firestoreError = null;
    try {
      const dbInstance = getDbInstance();
      usersSnapshot = await dbInstance.collection('users').get();
    } catch (e: any) {
      console.warn("[API] Could not list Firestore users (ignore if Service Account is missing or lacks Firestore Admin roles):", e.message);
      firestoreError = e.message;
    }
    
    // 3. Robust Merge logic
    const userMap = new Map<string, any>();

    // Start with Firestore users (to ensure we have baseline data)
    if (usersSnapshot && typeof usersSnapshot.forEach === 'function') {
      usersSnapshot.forEach((doc: any) => {
        const rawData = doc.data() || {};
        const cleanData = sanitizeDbData(rawData);
        userMap.set(doc.id, {
          id: doc.id,
          uid: doc.id,
          displayName: cleanData.displayName || cleanData.name || 'ไม่มีชื่อ',
          email: cleanData.email || '',
          photoURL: cleanData.photoURL || '',
          phoneNumber: cleanData.phoneNumber || '',
          createdAt: cleanData.createdAt || null,
          fromFirestore: true,
          ...cleanData
        });
      });
    }

    // Merge or Add Auth users
    authUsers.forEach(user => {
      const existing = userMap.get(user.uid) || {};
      userMap.set(user.uid, {
        ...existing,
        id: user.uid,
        uid: user.uid,
        email: user.email || existing.email,
        displayName: user.displayName || existing.displayName || 'ไม่มีชื่อ',
        photoURL: user.photoURL || existing.photoURL || '',
        phoneNumber: user.phoneNumber || existing.phoneNumber || '',
        createdAt: user.metadata.creationTime || existing.createdAt,
        lastSignInTime: user.metadata.lastSignInTime,
        disabled: user.disabled,
        fromAuth: true
      });
    });

    const mergedUsers = Array.from(userMap.values());

    // Sort by creation time descending
    mergedUsers.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });
    
    res.json({ 
      success: true, 
      users: mergedUsers,
      totalCount: mergedUsers.length,
      authError: authError, // Optional: send back a warning if Auth list failed
      firestoreError: firestoreError // Optional: send back a warning if Firestore list failed
    });
  } catch (error: any) {
    console.error(`[API] Error listing users:`, error);
    res.status(500).json({ error: error.message || "Failed to list users" });
  }
});

// API Route to update a user in Firebase Auth
app.patch("/api/admin/update-user/:uid", verifyAdmin, async (req: any, res: any) => {
  const { uid } = req.params;
  const { email, displayName, phoneNumber } = req.body;

  try {
    const updateData: any = {};
    if (email) updateData.email = email;
    if (displayName) updateData.displayName = displayName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    if (Object.keys(updateData).length > 0) {
      await admin.auth().updateUser(uid, updateData);
    }

    res.json({ success: true, message: `User ${uid} updated successfully in Auth` });
  } catch (error: any) {
    console.error("Error updating user in Auth:", error);
    res.status(500).json({ error: error.message || "Failed to update user" });
  }
});

// API Route to debug Firebase Admin status
app.get("/api/admin/debug-auth", verifyAdmin, async (req: any, res: any) => {
  try {
    const listUsers = await admin.auth().listUsers(1);
    res.json({ 
      success: true, 
      initialized: admin.apps.length > 0,
      canListUsers: true 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: "Auth verification is not active on this environment.",
      code: error.code || "unknown",
      initialized: admin.apps.length > 0
    });
  }
});

// Dynamic Web App Manifest Endpoint to support phone installation with the custom shop logo
app.get(['/manifest.webmanifest', '/manifest.json'], async (req: any, res: any) => {
  try {
    const db = getDbInstance();
    const shopDoc = await db.collection('settings').doc('shop').get();
    const shopData = shopDoc.exists ? shopDoc.data() : null;
    const name = shopData?.name || 'RumahSekolah';
    const description = shopData?.description || 'แพลตฟอร์มอีคอมเมิร์ซที่ทันสมัยและครบวงจร';
    let logoUrl = '/icon.svg';
    
    if (shopData?.logoUrl) {
      const url = shopData.logoUrl;
      if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        let fileId = '';
        const dMatch = url.match(/\/d\/([^/?]+)/);
        if (dMatch && dMatch[1]) {
          fileId = dMatch[1];
        } else {
          const idMatch = url.match(/[?&]id=([^&]+)/);
          if (idMatch && idMatch[1]) {
            fileId = idMatch[1];
          }
        }
        if (fileId) {
          logoUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
        } else {
          logoUrl = url;
        }
      } else {
        logoUrl = url;
      }
    }

    res.json({
      name: name,
      short_name: name,
      description: description,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#F97316',
      icons: [
        {
          src: logoUrl,
          sizes: '192x192',
          purpose: 'any'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          purpose: 'any'
        },
        {
          src: logoUrl,
          sizes: '192x192',
          purpose: 'maskable'
        },
        {
          src: logoUrl,
          sizes: '512x512',
          purpose: 'maskable'
        }
      ]
    });
  } catch (error) {
    console.error("Error generating manifest:", error);
    res.json({
      name: 'RumahSekolah',
      short_name: 'RumahSekolah',
      description: 'แพลตฟอร์มอีคอมเมิร์ซที่ทันสมัยและครบวงจร',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#F97316',
      icons: [
        {
          src: '/icon.svg',
          sizes: '512x512',
          purpose: 'any maskable'
        }
      ]
    });
  }
});

// Health check
app.get("/api/health", (req: any, res: any) => {
  res.json({ status: "ok", vercel: !!process.env.VERCEL });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else if (!process.env.VERCEL) {
    // Standard Node production environment (like Cloud Run)
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Serve index.html for any non-API routes
    app.get('*', (req: any, res: any) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

startServer();
