import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import { Bell, Check, Trash2, Mail, ExternalLink, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';

// Format relative time in pleasant Thai style
const formatRelativeTime = (timestamp: any) => {
  if (!timestamp) return 'เมื่อสักครู่';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'เมื่อสักครู่';
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHr < 24) return `${diffHr} ชั่วโมงที่แล้ว`;
  if (diffDays === 1) return 'เมื่อวานนี้';
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const NotificationBell: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Monitor auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return unsub;
  }, []);

  // Listen to customer notifications
  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setNotifications(items);
    }, (error) => {
      console.warn("Error loading live notifications for bell:", error);
    });

    return unsubscribe;
  }, [currentUser]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), {
        status: 'read'
      });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    try {
      const unreadNotifications = notifications.filter(n => n.status === 'unread');
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(db);
      unreadNotifications.forEach(n => {
        const docRef = doc(db, 'notifications', n.id);
        batch.update(docRef, { status: 'read' });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Target Bell Trigger Button */}
      <button
        id="btn-customer-notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 text-slate-500 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition active:scale-95 ${
          isOpen ? 'bg-orange-50 text-orange-500' : 'bg-slate-50 hover:bg-slate-100'
        }`}
        aria-label="การแจ้งเตือน"
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
        
        {/* Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white font-bold text-[10px] min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center border-2 border-white shadow">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Real-time Staggered Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="panel-customer-notification-dropdown"
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 mt-3 w-80 sm:w-96 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header section */}
            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-800 tracking-tight">การแจ้งเตือนของคุณ</span>
                {unreadCount > 0 && (
                  <span className="bg-red-50 text-red-600 font-bold text-[10px] px-2 py-0.5 rounded-full">
                    {unreadCount} ข้อความใหม่
                  </span>
                )}
              </div>
              
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-orange-600 hover:text-orange-700 font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  อ่านแล้วทั้งหมด
                </button>
              )}
            </div>

            {/* List container */}
            <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200">
              {notifications.length === 0 ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center select-none">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-2">
                    <Inbox className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">ไม่มีการแจ้งเตือนในขณะนี้</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">เมื่อมีการอัปเดตสถานะการสั่งซื้อหรือข้อมูลจากทางร้าน คุณจะเห็นที่นี่</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif, index) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => {
                        // Automatically mark as read on click
                        if (notif.status === 'unread') {
                          updateDoc(doc(db, 'notifications', notif.id), { status: 'read' });
                        }
                      }}
                      className={`p-4 flex items-start gap-3 transition cursor-pointer text-left ${
                        notif.status === 'unread' ? 'bg-orange-50/20 hover:bg-orange-50/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Left Icon with color depending on unread status */}
                      <div className={`p-2 rounded-xl flex-shrink-0 ${
                        notif.status === 'unread' 
                          ? 'bg-orange-100 text-orange-600' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Mail className="w-4 h-4" />
                      </div>

                      {/* Content details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className={`text-xs truncate transition-all ${
                            notif.status === 'unread' ? 'font-extrabold text-slate-800' : 'font-bold text-slate-500'
                          }`}>
                            {notif.title || 'อัปเดตข้อมูลระบบ'}
                          </h4>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-2">
                            {formatRelativeTime(notif.createdAt || notif.time)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed break-words font-medium">
                          {notif.message}
                        </p>
                        
                        {/* Interactive operations inside single card */}
                        <div className="flex items-center gap-3 mt-2">
                          {notif.status === 'unread' && (
                            <button
                              onClick={(e) => handleMarkAsRead(notif.id, e)}
                              className="text-[10px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 transition"
                            >
                              <Check className="w-3 h-3" />
                              อ่านแล้ว
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDelete(notif.id, e)}
                            className="text-[10px] text-slate-400 hover:text-red-500 font-bold flex items-center gap-1 transition ml-auto"
                          >
                            <Trash2 className="w-3 h-3" />
                            ลบ
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Navigation Link */}
            <div className="p-3 bg-slate-50 text-center border-t border-slate-100">
              <Link
                to="/profile?tab=notifications"
                onClick={() => setIsOpen(false)}
                className="inline-flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-black transition"
              >
                ดูแจ้งเตือนทั้งหมดในโปรไฟล์
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
