import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CartProvider, useCart } from './CartContext';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import UserProfile from './pages/UserProfile';
import UserLogin from './pages/UserLogin';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Contact from './pages/Contact';
import { LineContact } from './components/LineContact';
import { RealtimeNotificationManager } from './components/RealtimeNotificationManager';
import { NotificationBell } from './components/NotificationBell';
import { Toaster } from 'sonner';
import { ShoppingBag, User as UserIcon, Home as HomeIcon, LayoutDashboard, Menu, X, Phone, LogOut } from 'lucide-react';

const Navigation: React.FC = () => {
  const { cart, settings } = useCart();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setIsAdmin(false);
      return;
    }

    const checkAdminStatus = async () => {
      const superAdmins = [
        "ismael.charu2015@gmail.com",
        "ismael.charu2025@gmail.com"
      ];
      const email = currentUser.email || '';

      // 1. Check superAdmin list
      if (superAdmins.includes(email)) {
        setIsAdmin(true);
        // Securely run bootstrap check only for super developers so settings are perfectly initialized in DB if missing.
        try {
          const shopDocRef = doc(db, 'settings', 'shop');
          const shopSnap = await getDoc(shopDocRef);
          if (shopSnap.exists()) {
            const data = shopSnap.data();
            let emailsArray: string[] = [];
            if (Array.isArray(data.adminEmails)) {
              emailsArray = data.adminEmails;
            } else if (typeof data.adminEmails === 'string') {
              emailsArray = (data.adminEmails as string).split(',').map(e => e.trim()).filter(Boolean);
            }

            const originalLength = emailsArray.length;
            if (!emailsArray.includes('ismael.charu2015@gmail.com')) {
              emailsArray.push('ismael.charu2015@gmail.com');
            }
            if (!emailsArray.includes('ismael.charu2025@gmail.com')) {
              emailsArray.push('ismael.charu2025@gmail.com');
            }

            if (emailsArray.length !== originalLength) {
              await updateDoc(shopDocRef, { adminEmails: emailsArray });
              console.log("Super admin emails initialized in database lists.");
            }
          }
        } catch (err) {
          console.error("Failed to bootstrap super admins list:", err);
        }
        return;
      }

      // 2. Check shopSettings dynamic list
      let emailsArray: string[] = [];
      if (settings?.adminEmails) {
        if (Array.isArray(settings.adminEmails)) {
          emailsArray = settings.adminEmails;
        } else if (typeof settings.adminEmails === 'string') {
          emailsArray = (settings.adminEmails as string).split(',').map(e => e.trim()).filter(Boolean);
        }
      }

      if (email && emailsArray.includes(email)) {
        setIsAdmin(true);
        return;
      }

      // 3. Fallback to admins collection
      try {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(adminDoc.exists());
      } catch (e) {
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [currentUser, settings]);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Close mobile menu on path changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <nav className="bg-white border-b border-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        {/* Brand logo details */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white scale-100 group-hover:scale-105 group-hover:rotate-6 transition-all shadow-md shadow-orange-500/10">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <span className="font-black text-lg text-slate-800 tracking-tight group-hover:text-orange-500 transition-colors">
            {settings?.name || "RumahSekolah"}
          </span>
        </Link>

        {/* Desktop Menus */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${
              location.pathname === '/' ? 'text-orange-500' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <HomeIcon className="w-4 h-4" /> หน้าแรก
          </Link>
          <Link
            to="/shop"
            className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${
              location.pathname === '/shop' ? 'text-orange-500' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShoppingBag className="w-4 h-4" /> ร้านค้า
          </Link>
          <Link
            to="/contact"
            className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${
              location.pathname === '/contact' ? 'text-orange-500' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Phone className="w-4 h-4" /> ติดต่อเรา
          </Link>
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className={`text-sm font-bold flex items-center gap-1.5 transition-colors ${
                location.pathname.startsWith('/admin') ? 'text-orange-500' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" /> จัดการร้านค้า
            </Link>
          )}
        </div>

        {/* Right Nav Controls */}
        <div className="hidden md:flex items-center gap-4">
          <Link to="/cart" className="relative p-2.5 text-slate-500 hover:text-slate-800 transition active:scale-95 bg-slate-50 hover:bg-slate-100 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-orange-500 text-white font-black text-xs min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center animate-bounce shadow">
                {cartCount}
              </span>
            )}
          </Link>

          {/* User notification bell */}
          <NotificationBell />

          {currentUser ? (
            <div className="flex items-center gap-2">
              <Link
                to="/profile"
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm active:scale-95"
              >
                <UserIcon className="w-4 h-4" />
                หน้าโปรไฟล์
              </Link>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold px-3 py-2.5 rounded-xl transition shadow-sm active:scale-95"
                title="ออกจากระบบ"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="flex items-center gap-2 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-black transition shadow-md active:scale-95"
            >
              <UserIcon className="w-4 h-4" />
              เข้าสู่ระบบ
            </Link>
          )}
        </div>

        {/* Mobile controls toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <Link to="/cart" className="relative p-2 text-slate-500 bg-slate-50 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-orange-500 text-white font-bold text-[10px] min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>

          <NotificationBell />

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 bg-slate-50 rounded-xl active:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white p-6 space-y-4 shadow-xl select-none">
          <div className="flex flex-col gap-3 font-bold text-slate-600">
            <Link to="/" className="py-2 hover:text-orange-500 flex items-center gap-2 border-b border-slate-50">
              <HomeIcon className="w-4 h-4" /> หน้าแรก
            </Link>
            <Link to="/shop" className="py-2 hover:text-orange-500 flex items-center gap-2 border-b border-slate-50">
              <ShoppingBag className="w-4 h-4" /> ร้านค้า
            </Link>
            <Link to="/contact" className="py-2 hover:text-orange-500 flex items-center gap-2 border-b border-slate-50">
              <Phone className="w-4 h-4" /> ติดต่อเรา
            </Link>
            {isAdmin && (
              <Link to="/admin/dashboard" className="py-2 hover:text-orange-500 flex items-center gap-2 border-b border-slate-50">
                <LayoutDashboard className="w-4 h-4" /> จัดการร้านค้า
              </Link>
            )}
          </div>

          {currentUser ? (
            <div className="flex flex-col gap-2 w-full">
              <Link
                to="/profile"
                className="w-full bg-slate-150 text-slate-800 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm bg-slate-100"
              >
                <UserIcon className="w-4 h-4" />
                หน้าโปรไฟล์
              </Link>
              <button
                onClick={() => {
                  signOut(auth);
                  setMobileMenuOpen(false);
                }}
                className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow"
              >
                <LogOut className="w-4 h-4" />
                ออกจากระบบ
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="w-full bg-slate-900 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow"
            >
              <UserIcon className="w-4 h-4" />
              ลงชื่อ เข้าสู่ระบบ
            </Link>
          )}
        </div>
      )}
    </nav>
  );
};

const MainLayout: React.FC = () => {
  const { settings, categories } = useCart();
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      <div className="flex-1 flex flex-col">
        <Navigation />
        <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 w-full flex-1">
          <Routes>
            <Route path="/" element={<Home settings={settings} categories={categories} />} />
            <Route path="/shop" element={<Shop settings={settings} categories={categories} />} />
            <Route path="/product/:id" element={<ProductDetail settings={settings} />} />
            <Route path="/cart" element={<Cart settings={settings} />} />
            <Route path="/checkout" element={<Checkout settings={settings} />} />
            <Route path="/contact" element={<Contact settings={settings} />} />
            <Route path="/profile" element={<UserProfile />} />
            <Route path="/login" element={React.createElement(UserLogin as any, { settings })} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard/:tab?" element={<AdminDashboard />} />
          </Routes>
        </main>
      </div>

      <footer className="hidden md:block bg-slate-900 text-slate-400 border-t border-slate-800 py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h4 className="font-extrabold text-white text-base mb-3 leading-snug">สโลแกนและที่มา</h4>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              RumahSekolah - ดำเนินการจัดจำหน่ายผลิตภัณฑ์พรีเมียม สนับสนุนฝีมือคนไทย และบริการหลังบ้านอย่างเป็นกลาง
            </p>
          </div>
          <div>
            <h4 className="font-extrabold text-white text-base mb-3 leading-snug">ลิ้งก์ส่วนอื่นๆ</h4>
            <div className="flex flex-col gap-1 text-xs">
              <Link to="/shop" className="hover:text-white transition">เข้าชมร้านค้า</Link>
              <Link to="/contact" className="hover:text-white transition">ติดต่อเรา</Link>
              <Link to="/admin/login" className="hover:text-white transition">ระบบร้านค้าสำหรับแอดมิน</Link>
            </div>
          </div>
          <div>
            <h4 className="font-extrabold text-white text-base mb-3 leading-snug">ลิขสิทธิ์สิทธิ์ผู้ใช้</h4>
            <p className="text-xs font-medium leading-relaxed font-mono">
              © {new Date().getFullYear()} RumahSekolah. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      <LineContact />
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <Toaster position="top-right" richColors />
        <RealtimeNotificationManager />
        <MainLayout />
      </CartProvider>
    </BrowserRouter>
  );
}
