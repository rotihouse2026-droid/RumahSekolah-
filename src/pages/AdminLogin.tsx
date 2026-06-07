import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ShieldAlert, LogIn, Eye, EyeOff } from 'lucide-react';
import { auth, db } from '../firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const defaultAdminEmails = ['ismael.charu2015@gmail.com', 'ismael.charu2025@gmail.com', 'ismael.charu2018@gmail.com', 'admin@rumahsekolah.com'];

  useEffect(() => {
    const checkAdmin = async () => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          const allowedAdmins = await getAdminEmails();
          if (allowedAdmins.includes(user.email || '') || allowedAdmins.includes(user.phoneNumber || '') || user.uid === 'HIsfiO4Vh6MTUYT6QZToCWjqpHn1') {
            localStorage.setItem('rumahsekolah_admin_ui_auth', 'true');
            navigate('/admin/dashboard');
          }
        }
      });
      return unsubscribe;
    };
    
    const unsubPromise = checkAdmin();
    return () => {
      unsubPromise.then(unsub => unsub());
    };
  }, [navigate]);

  const getAdminEmails = async () => {
    try {
      const settingsSnap = await getDoc(doc(db, 'settings', 'shop')).catch(e => {
        handleFirestoreError(e, OperationType.GET, 'settings/shop');
        throw e;
      });
      if (settingsSnap.exists() && settingsSnap.data().adminEmails) {
        return settingsSnap.data().adminEmails;
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'settings/shop');
    }
    return defaultAdminEmails;
  };

  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email) {
      setError('กรุณากรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError('');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/quota-exceeded') {
        setError('ขออภัย: อีเมลรีเซ็ตรหัสผ่านเกินโควตาสำหรับวันนี้แล้ว โปรดลองอีกครั้งในภายหลัง');
      } else if (err.code === 'auth/too-many-requests') {
        setError('คุณส่งคำขอมากเกินไปชั่วคราว โปรดรอสักครู่แล้วลองใหม่อีกครั้ง');
      } else {
        setError('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ' + (err.message || 'โปรดลองอีกครั้ง'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');

    try {
      // Use signInWithEmailAndPassword helper which has built-in client-side LocalStorage DB fallback
      const result = await signInWithEmailAndPassword(auth, email, password);
      const allowedAdmins = await getAdminEmails();
      
      if (allowedAdmins.includes(result.user.email || '') || allowedAdmins.includes(result.user.phoneNumber || '') || result.user.uid === 'HIsfiO4Vh6MTUYT6QZToCWjqpHn1') {
        localStorage.setItem('rumahsekolah_admin_ui_auth', 'true');
        navigate('/admin/dashboard');
      } else {
        await auth.signOut();
        setError('อีเมลนี้ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแลระบบ');
      }
    } catch (err: any) {
      console.error(err);
      setErrorCode(err.code || '');
      if (err.code === 'auth/operation-not-allowed') {
        setError('ไม่สามารถเข้าสู่ระบบด้วยอีเมลได้ เนื่องจากโปรเจกต์ไม่ได้เปิดใช้งานระบบ "อีเมล/รหัสผ่าน" ใน Firebase Console / กรุณาเข้าสู่ระบบด้วยปุ่ม Google หรือให้แอดมินเปิดใช้งานด้วยขั้นตอนด่วนด้านล่างครับ');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      } else if (err.code === 'auth/invalid-email') {
        setError('รูปแบบอีเมลไม่ถูกต้อง');
      } else if (err.code === 'auth/network-request-failed') {
        setError('ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ หรือปิดตัวบล็อกโฆษณา (Ad-blocker) แล้วลองใหม่อีกครั้ง');
      } else {
        setError('เข้าสู่ระบบล้มเหลว: ' + (err.message || 'โปรดลองอีกครั้ง'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-200/50 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">แผงควบคุมผู้ดูแลระบบ</h1>
          <p className="text-gray-500">กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินของคุณ</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex flex-col gap-2 text-sm font-medium border border-red-100">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} />
              <div>{error}</div>
            </div>
          </div>
        )}

        {resetSent && (
          <div className="bg-green-50 text-green-600 p-4 rounded-xl flex flex-col gap-2 text-sm font-medium border border-green-100">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="text-green-600" />
              ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบกล่องจดหมายของคุณ
            </div>
          </div>
        )}

        <div className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">อีเมลแอดมิน</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-gray-700">รหัสผ่าน</label>
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input 
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-2xl font-bold transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? 'กำลังตรวจสอบ...' : (
                <>
                  <LogIn size={20} />
                  เข้าสู่ระบบแอดมิน
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;