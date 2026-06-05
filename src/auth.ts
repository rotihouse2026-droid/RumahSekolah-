import { db } from './db';

// Simple Event Emitter for Auth state changed
const listeners: Array<(user: any) => void> = [];

function raiseStateChanged(user: any) {
  listeners.forEach(cb => {
    try { cb(user); } catch (e) { console.error(e); }
  });
}

// Get initial user from local storage
let currentSessionUser: any = null;
try {
  const session = localStorage.getItem('rumahsekolah_user_session');
  if (session) {
    currentSessionUser = JSON.parse(session);
  }
} catch (e) {
  console.error("Failed to load user session:", e);
}

export const auth = {
  get currentUser() {
    return currentSessionUser;
  },
  onAuthStateChanged: (callback: (user: any) => void) => {
    listeners.push(callback);
    // Execute immediately with safety
    setTimeout(() => {
      callback(currentSessionUser);
    }, 0);
    return () => {
      const idx = listeners.indexOf(callback);
      if (idx !== -1) {
        listeners.splice(idx, 1);
      }
    };
  },
  signOut: async () => {
    currentSessionUser = null;
    localStorage.removeItem('rumahsekolah_user_session');
    localStorage.removeItem('rumahsekolah_admin_ui_auth');
    raiseStateChanged(null);
    return Promise.resolve();
  }
};

export function getAuth() {
  return auth;
}

export function onAuthStateChanged(_auth: any, callback: (user: any) => void) {
  return auth.onAuthStateChanged(callback);
}

export function signOut(_auth: any) {
  return auth.signOut();
}

export async function signInWithEmailAndPassword(_auth: any, email: string, password: string) {
  const response = await fetch('/api/auth/login-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, isRegister: false })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  }
  
  currentSessionUser = {
    uid: data.userId || `user-${Date.now()}`,
    email: email,
    displayName: data.displayName || email.split('@')[0],
    phoneNumber: data.phoneNumber || '',
    photoURL: data.photoURL || ''
  };
  localStorage.setItem('rumahsekolah_user_session', JSON.stringify(currentSessionUser));
  if (email === "ismael.charu2025@gmail.com" || email === "admin@rumahsekolah.com" || email === "ismael.charu2015@gmail.com") {
    localStorage.setItem('rumahsekolah_admin_ui_auth', 'true');
  }
  raiseStateChanged(currentSessionUser);
  return { user: currentSessionUser };
}

export async function createUserWithEmailAndPassword(_auth: any, email: string, password: string, displayName?: string) {
  const response = await fetch('/api/auth/login-register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, isRegister: true, displayName })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'การสมัครสมาชิกล้มเหลว');
  }
  
  currentSessionUser = {
    uid: data.userId || `user-${Date.now()}`,
    email: email,
    displayName: displayName || email.split('@')[0],
    phoneNumber: '',
    photoURL: ''
  };
  localStorage.setItem('rumahsekolah_user_session', JSON.stringify(currentSessionUser));
  raiseStateChanged(currentSessionUser);
  return { user: currentSessionUser };
}

export async function signInWithCustomToken(_auth: any, token: string) {
  try {
    const parsed = JSON.parse(token);
    currentSessionUser = {
      uid: parsed.uid,
      email: parsed.email,
      displayName: parsed.displayName || parsed.email.split('@')[0],
      photoURL: parsed.photoURL || '',
      phoneNumber: parsed.phoneNumber || ''
    };
    localStorage.setItem('rumahsekolah_user_session', JSON.stringify(currentSessionUser));
    if (parsed.email === "ismael.charu2025@gmail.com" || parsed.email === "admin@rumahsekolah.com" || parsed.email === "ismael.charu2015@gmail.com") {
      localStorage.setItem('rumahsekolah_admin_ui_auth', 'true');
    }
    raiseStateChanged(currentSessionUser);
    return { user: currentSessionUser };
  } catch (e) {
    // If it's a generic token fallback
    currentSessionUser = {
      uid: 'user-imported-' + Math.random().toString(36).substr(2, 9),
      email: 'user@imported.com',
      displayName: 'ลูกค้าผู้มีเกียรติ'
    };
    localStorage.setItem('rumahsekolah_user_session', JSON.stringify(currentSessionUser));
    raiseStateChanged(currentSessionUser);
    return { user: currentSessionUser };
  }
}

export async function updateProfile(_user: any, profileData: { displayName?: string, photoURL?: string }) {
  if (currentSessionUser) {
    currentSessionUser = {
      ...currentSessionUser,
      ...profileData
    };
    localStorage.setItem('rumahsekolah_user_session', JSON.stringify(currentSessionUser));
    raiseStateChanged(currentSessionUser);
  }
  return Promise.resolve();
}

export async function updatePassword(_user: any, _pass: string) {
  return Promise.resolve();
}

export async function updateEmail(_user: any, _email: string) {
  return Promise.resolve();
}

export async function sendPasswordResetEmail(_auth: any, email: string) {
  alert(`ระบบจำลองการกู้คืนรหัสผ่าน: ลิงก์กู้คืนความปลอดภัยกำลังส่งต่อไปยังกล่องจดหมายอีเมล ${email} เรียบร้อยแล้ว!`);
  return Promise.resolve();
}

export async function reauthenticateWithCredential() {
  return Promise.resolve();
}

export class EmailAuthProvider {
  static get credential() {
    return (email: string, pass: string) => ({ email, pass });
  }
}

export class GoogleAuthProvider {}

export async function signInWithPopup() {
  throw new Error("ระบบล็อกอินผ่าน Google ปิดปรับปรุงชั่วคราว มีข้อจำกัดสิทธิ์ใช้งานจาก Google API Console / กรุณาใช้การสมัครง่ายๆ ด้านบนด้วยอีเมลแทนได้ทันทีครับ!");
}
