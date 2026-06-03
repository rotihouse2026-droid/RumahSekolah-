import React, { useEffect, useState, useRef } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

// Custom pleasant chime sound generator utilizing browser Web Audio API
export const playDingChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First tone (chime high, soft decay)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.6);
    
    // Second tone played slightly later (perfect fifth A5, high and bright)
    setTimeout(() => {
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, audioCtx.currentTime); // A5
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.0);
      
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start();
      osc2.stop(audioCtx.currentTime + 1.0);
    }, 100);
  } catch (e) {
    console.warn("Audio chime block or not supported until click:", e);
  }
};

export const RealtimeNotificationManager: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const customerInitialized = useRef(false);
  const adminOrdersInitialized = useRef(false);
  const adminSlipsInitialized = useRef(false);
  const adminContactsInitialized = useRef(false);

  // Authentication State Monitor
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        if (user.email === "ismael.charu2015@gmail.com") {
          setIsAdmin(true);
        } else {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            setIsAdmin(adminDoc.exists());
          } catch (e) {
            setIsAdmin(false);
          }
        }
      } else {
        setIsAdmin(false);
      }
    });
    return unsub;
  }, []);

  // 1. Customer Notifications Listener (Real-time updates)
  useEffect(() => {
    if (!currentUser || isAdmin) {
      customerInitialized.current = false;
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      where('status', '==', 'unread')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!customerInitialized.current) {
        // First snapshot loaded. Set state to capture future notifications
        customerInitialized.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          playDingChime();
          toast.success(data.title || 'แจ้งเตือนใหม่! ✨', {
            description: data.message || 'คุณมีอัปเดตใหม่',
            duration: 8000,
          });
        }
      });
    }, (err) => {
      console.warn("Customer real-time notifications error:", err);
    });

    return () => unsubscribe();
  }, [currentUser, isAdmin]);

  // 2. Administrator Store Operations Listeners
  useEffect(() => {
    if (!isAdmin) {
      adminOrdersInitialized.current = false;
      adminSlipsInitialized.current = false;
      adminContactsInitialized.current = false;
      return;
    }

    // A. Real-time Pending Orders Detector
    const ordersQuery = query(
      collection(db, 'orders'),
      where('status', '==', 'pending')
    );

    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      if (!adminOrdersInitialized.current) {
        adminOrdersInitialized.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          playDingChime();
          toast.success('🛍️ มีออเดอร์ใหม่เข้ามาจากระบบ!', {
            description: `ลูกค้า: ${data.customerName || data.customer?.name || 'ลูกค้าทั่วไป'} - ยอดชำระ: ฿${(data.total || 0).toLocaleString()}`,
            duration: 12000,
            action: {
              label: 'ดูออเดอร์',
              onClick: () => {
                window.location.href = '/admin/dashboard';
              }
            }
          });
        }
      });
    }, (err) => {
      console.warn("Admin order observer failing (expected if permissions not sync'ed):", err);
    });

    // B. Real-time Payment Slips Observer
    const slipsQuery = query(
      collection(db, 'slips')
    );

    const unsubscribeSlips = onSnapshot(slipsQuery, (snapshot) => {
      if (!adminSlipsInitialized.current) {
        adminSlipsInitialized.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          playDingChime();
          toast.info('📁 มีผู้ส่งหลักฐานการโอนเงินใหม่!', {
            description: `ลูกค้า: ${data.customerName || 'ผู้ชำระเงิน'} - ยอดรวม: ฿${(data.total || 0).toLocaleString()}`,
            duration: 12000,
            action: {
              label: 'ตรวจสอบ',
              onClick: () => {
                window.location.href = '/admin/dashboard';
              }
            }
          });
        }
      });
    }, (err) => {
      console.warn("Admin slips observer status:", err);
    });

    // C. Real-time Contact Submissions Observer
    const contactsQuery = query(
      collection(db, 'contacts')
    );

    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      if (!adminContactsInitialized.current) {
        adminContactsInitialized.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          playDingChime();
          toast.warning('✉️ มีข้อความติดต่อใหม่จากลูกค้า!', {
            description: `ชื่อ: ${data.name || 'ไม่ระบุชื่อ'} - ข้อความ: "${data.message?.substring(0, 35)}..."`,
            duration: 10000,
          });
        }
      });
    }, (err) => {
      console.warn("Admin contacts observer status:", err);
    });

    return () => {
      unsubscribeOrders();
      unsubscribeSlips();
      unsubscribeContacts();
    };
  }, [isAdmin]);

  return null;
};
