import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Mail, Lock, LogIn, ShieldAlert, UserPlus, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const UserLogin: React.FC<{ settings: any }> = ({ settings }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && !loading) {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate, loading]);

  const claimGuestPoints = async (user: any) => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('customer.email', '==', user.email),
        where('customer.uid', '==', null)
      );
      
      const querySnapshot = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'orders');
        throw e;
      });
      if (querySnapshot.empty) return;

      let totalPointsToClaim = 0;
      const claimPromises = querySnapshot.docs.map(async (orderDoc) => {
        const orderData = orderDoc.data();
        totalPointsToClaim += (orderData.pointsEarned || 0);
        
        // Update order with user UID
        return updateDoc(doc(db, 'orders', orderDoc.id), {
          'customer.uid': user.uid,
          updatedAt: serverTimestamp()
        }).catch(e => {
          handleFirestoreError(e, OperationType.UPDATE, `orders/${orderDoc.id}`);
          throw e;
        });
      });

      await Promise.all(claimPromises);

      if (totalPointsToClaim > 0) {
        await updateDoc(doc(db, 'users', user.uid), {
          points: increment(totalPointsToClaim),
          updatedAt: serverTimestamp()
        }).catch(e => {
          handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
          throw e;
        });
        console.log(`Successfully claimed ${totalPointsToClaim} points for user ${user.uid}`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'users/claimPoints');
    }
  };

  useEffect(() => {
    if (location.state) {
      if (location.state.email) setEmail(location.state.email);
      if (location.state.isRegister !== undefined) setIsRegister(location.state.isRegister);
    }
  }, [location.state]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    setErrorCode('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Ensure the user document is created/updated in firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || 'ลูกค้าผู้มีอุปการคุณ',
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true }).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, `users/${result.user.uid}`);
        throw e;
      });

      // Claim guest points
      claimGuestPoints(result.user).catch(err => {
        console.error("Failed to claim guest points during Google login:", err);
      });

      navigate('/');
    } catch (err: any) {
      console.error("Google Login Error:", err);
      setErrorCode(err.code);
      setError('การเข้าสู่ระบบผ่าน Google ล้มเหลว โปรดลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setErrorCode('');
    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('รหัสผ่านไม่ตรงกัน');
          setLoading(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(result.user, { displayName });
        // Manual sync to ensure document is created immediately
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          email: result.user.email,
          displayName: displayName || 'ลูกค้าผู้มีอุปการคุณ',
          points: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).catch(e => {
          handleFirestoreError(e, OperationType.CREATE, `users/${result.user.uid}`);
          throw e;
        });
        
        // Claim guest points - make it non-blocking to avoid login failure if this fails
        claimGuestPoints(result.user).catch(err => {
          console.error("Failed to claim guest points:", err);
        });
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        // Also check guest points on login - make it non-blocking
        claimGuestPoints(result.user).catch(err => {
          console.error("Failed to claim guest points during login:", err);
        });
      }
      navigate('/');
    } catch (err: any) {
      console.error("Login/Register Error:", err);
      setErrorCode(err.code);
      let errorMessage = 'เกิดข้อผิดพลาดในการดำเนินการ';
      
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'อีเมลนี้ถูกใช้งานแล้ว หากคุณเคยสมัครสมาชิกไว้แล้ว กรุณาลองเข้าสู่ระบบหรือรีเซ็ตรหัสผ่าน';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'ระบบยังไม่เปิดใช้งานการเข้าสู่ระบบด้วยอีเมล กรุณาติดต่อแอดมิน';
          break;
        case 'auth/weak-password':
          errorMessage = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
          break;
        case 'auth/invalid-email':
          errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'ไม่สามารถเชื่อมต่อกับระบบได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตของคุณ หรือปิดตัวบล็อกโฆษณา (Ad-blocker) แล้วลองใช้อีกครั้ง';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป ระบบได้ระงับชั่วคราวเพื่อความปลอดภัย กรุณารอสักครู่แล้วลองใหม่อีกครั้ง';
          break;
        case 'auth/user-disabled':
          errorMessage = 'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อแอดมิน';
          break;
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
          break;
        default:
          errorMessage = isRegister ? 'การสมัครสมาชิกล้มเหลว' : 'เข้าสู่ระบบล้มเหลว';
          if (err.message && err.message.includes('Quota Exceeded')) {
            errorMessage = 'ขออภัย: โควตาการใช้งานวันนี้เต็มแล้ว กรุณาลองใหม่วันพรุ่งนี้';
          }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white p-10 rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-200/50 space-y-8">
        <div className="text-center space-y-2">
          <Logo 
            logoUrl={settings?.logoUrl} 
            label={settings?.name} 
            size="lg" 
            showText={false} 
            className="mx-auto mb-4" 
          />
          <h1 className="text-3xl font-bold text-gray-900">
            {isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </h1>
          <p className="text-gray-500">
            {isRegister ? `ร่วมเป็นส่วนหนึ่งกับ ${settings?.name || 'RumahSekolah'}` : `ยินดีต้อนรับกลับสู่ ${settings?.name || 'RumahSekolah'}`}
          </p>
        </div>

        <div id="recaptcha-container"></div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex flex-col gap-3 text-sm font-medium border border-red-100">
            <div className="flex items-center gap-3">
              <ShieldAlert size={18} className="shrink-0" />
              <p>{error}</p>
            </div>
            {errorCode === 'auth/email-already-in-use' && isRegister && (
              <button 
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                  setErrorCode('');
                }}
                className="w-full py-2 bg-white text-red-600 border border-red-200 rounded-lg font-bold hover:bg-red-100 transition-all"
              >
                สลับไปหน้าเข้าสู่ระบบ
              </button>
            )}
          </div>
        )}

        {errorCode === 'auth/operation-not-allowed' && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 p-5 rounded-2xl text-xs space-y-3 shadow-sm">
            <p className="font-bold text-orange-950 flex items-center gap-1.5">💡 สำหรับผู้ดูแลระบบ / แอดมิน:</p>
            <p className="text-slate-700 leading-relaxed">
              Firebase Authentication เพิ่งได้รับการติดตั้งใหม่ คุณจำเป็นต้องเข้าไปเปิดใช้งานการเข้าสู่ระบบแบบ <b>Email/Password</b> ใน Firebase Console ก่อนจึงจะใช้งานล็อกอินด้วยอีเมลหรือสมัครสมาชิกได้:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 ml-1 font-normal text-slate-700">
              <li>ไปที่เมนู <b>Authentication</b> ใน Firebase Console</li>
              <li>คลิกแท็บ <b>Sign-in method</b></li>
              <li>คลิกปุ่ม <b>Add new provider</b> แล้วเลือก <b>Email/Password</b></li>
              <li>สลับสวิตช์เป็น <b>Enable</b> และกดบันทึก (Save)</li>
            </ol>
            <a 
              href="https://console.firebase.google.com/project/green-ethos-50bnn/authentication/providers"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full text-center bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-3 px-4 rounded-xl transition-all font-sans"
            >
              ไปที่หน้าตั้งค่า Firebase Auth ↗
            </a>
          </div>
        )}

        <div className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-6">
                {isRegister && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">ชื่อ-นามสกุล</label>
                    <div className="relative">
                      <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder="ชื่อของคุณ"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">อีเมล</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                      placeholder="example@email.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-gray-700">รหัสผ่าน</label>
                    {!isRegister && (
                      <button 
                        type="button"
                        onClick={() => {
                          if (!email) {
                            setError('กรุณากรอกอีเมลเพื่อรีเซ็ตรหัสผ่าน');
                            return;
                          }
                          import('firebase/auth').then(({ sendPasswordResetEmail }) => {
                            sendPasswordResetEmail(auth, email).then(() => {
                              alert('ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว กรุณาเช็คกล่องจดหมายของคุณ');
                            }).catch((err) => {
                              console.error(err);
                              if (err.code === 'auth/quota-exceeded') {
                                setError('ขออภัย: อีเมลรีเซ็ตรหัสผ่านเกินโควตาสำหรับวันนี้แล้ว โปรดลองอีกครั้งในภายหลัง');
                              } else if (err.code === 'auth/too-many-requests') {
                                setError('คุณส่งคำขอมากเกินไปชั่วคราว โปรดรอสักครู่แล้วลองใหม่อีกครั้ง');
                              } else {
                                setError('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ' + (err.message || ''));
                              }
                            });
                          });
                        }}
                        className="text-xs text-orange-600 hover:underline font-medium"
                      >
                        ลืมรหัสผ่าน?
                      </button>
                    )}
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

                {isRegister && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">ยืนยันรหัสผ่าน</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white py-5 rounded-2xl font-bold transition-all shadow-lg shadow-orange-600/20 cursor-pointer"
                >
                  {loading ? 'กำลังดำเนินการ...' : (isRegister ? 'สร้างบัญชี' : 'เข้าสู่ระบบ')}
                </button>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-gray-100"></div>
                <span className="flex-shrink mx-4 text-gray-400 text-xs uppercase font-semibold">หรือ</span>
                <div className="flex-grow border-t border-gray-100"></div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-4 rounded-2xl font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.9h6.6c-.28 1.5-.1.14-.1.1a4.514 4.514 0 01-5.07 3.51V20h5.07c2.97-2.74 4.67-6.78 4.67-11.64z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-5.07-3.93c-1.4.94-3.19 1.5-5.07 1.5-3.89 0-7.18-2.63-8.36-6.17H1.13v4.06C3.11 20.11 7.21 24 12 24z" />
                  <path fill="#FBBC05" d="M3.64 12.5a7.143 7.143 0 010-4.43V4.01H1.13a11.94 11.94 0 000 12.55l2.51-4.06z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.93 1.19 15.24 0 12 0 7.21 0 3.11 3.89 1.13 7.94l2.51 4.06c1.18-3.54 4.47-6.17 8.36-6.17z" />
                </svg>
                {isRegister ? 'สมัครใช้งานด้วย Google' : 'เข้าสู่ระบบด้วย Google'}
              </button>
        </div>
        
        <div className="text-center pt-4">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-gray-500 hover:text-orange-600 transition-colors"
          >
            {isRegister ? (
              <span className="flex items-center justify-center gap-2">
                <ArrowLeft size={16} /> กลับไปหน้าเข้าสู่ระบบ
              </span>
            ) : (
              <>ยังไม่มีบัญชี? <span className="text-orange-600 font-bold hover:underline">สมัครสมาชิกที่นี่</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;