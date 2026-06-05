import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, MapPin, Package, Settings, 
  LayoutDashboard, LogOut, ChevronRight, Star, 
  CheckCircle2, Clock, Shield, Gift, 
  Plus, X, Coins, Truck, Share2, Lock, ArrowRight,
  Target, Info, Trash2, Edit2, Copy, Globe, AlertTriangle,
  Camera, ShoppingBag, Smartphone, Image as ImageIcon
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp, arrayUnion, arrayRemove, increment, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { motion, AnimatePresence } from 'motion/react';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';
import { compressAndUploadImage, generateUniquePath, uploadFile, compressImageToBase64 } from '../utils/storage';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';

const UserProfile: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'addresses' | 'settings' | 'notifications' | 'points'>('dashboard');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['dashboard', 'orders', 'addresses', 'settings', 'notifications', 'points'].includes(tab)) {
      setActiveTab(tab as any);
    }
  }, [searchParams]);
  const [orders, setOrders] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pointTransactions, setPointTransactions] = useState<any[]>([]);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressData, setAddressData] = useState({
    id: '',
    isDefault: false,
    addressLine1: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
  });
  const [editData, setEditData] = useState({
    displayName: '',
    phone: '',
    photoURL: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploadingSlip, setIsUploadingSlip] = useState<string | null>(null);
  const [shopSettings, setShopSettings] = useState<any>(null);

  // Review state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewingItem, setReviewingItem] = useState<any>(null);
  const [productRating, setProductRating] = useState(5);
  const [productReviewText, setProductReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);
  const [orderToConfirm, setOrderToConfirm] = useState<any>(null);

  const getTrackingLink = (company: string, number: string) => {
    if (!number) return '#';
    const cleanNumber = number.trim();
    switch (company) {
      case 'Flash Express': return `https://www.flashexpress.co.th/tracking/?trackndata=${cleanNumber}`;
      case 'Kerry Express': return `https://th.kerryexpress.com/th/track/?track=${cleanNumber}`;
      case 'J&T Express': return `https://www.jtexpress.co.th/tracking/track?billCode=${cleanNumber}`;
      case 'Thailand Post': return `https://track.thailandpost.co.th/?trackNumber=${cleanNumber}`;
      case 'Ninja Van': return `https://www.ninjavan.co/th-th/tracking?dashline=${cleanNumber}`;
      case 'Best Express': return `https://www.best-inc.co.th/track?bills=${cleanNumber}`;
      default: return `https://www.google.com/search?q=tracking+${cleanNumber}`;
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('คัดลอกเลขพัสดุเรียบร้อย: ' + text);
      }).catch(() => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('คัดลอกเลขพัสดุเรียบร้อย: ' + text);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('คัดลอกเลขพัสดุเรียบร้อย: ' + text);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchProfile(currentUser.uid);
        await fetchOrders(currentUser.uid);
        await fetchNotifications(currentUser.uid);
        await fetchPointTransactions(currentUser.uid);
        await fetchShopSettings();
      } else {
        window.location.href = '/login';
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef).catch(e => {
        handleFirestoreError(e, OperationType.GET, `users/${uid}`);
        throw e;
      });
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(data);
        setEditData({
          displayName: data.displayName || '',
          phone: data.phone || '',
          photoURL: data.photoURL || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchOrders = async (uid: string) => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('customer.uid', '==', uid)
      );
      const querySnapshot = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'orders');
        throw e;
      });
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  };

  const fetchNotifications = async (uid: string) => {
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', uid));
      const snap = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'notifications');
        throw e;
      });
      setNotifications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setQuotaError(null);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.LIST, 'notifications');
      if (e.message && e.message.includes('isQuotaError')) {
        const err = JSON.parse(e.message);
        setQuotaError(err.message);
      }
    }
  };

  const fetchPointTransactions = async (uid: string) => {
    try {
      const q = query(collection(db, 'pointTransactions'), where('userId', '==', uid));
      const snap = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'pointTransactions');
        throw e;
      });
      setPointTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setQuotaError(null);
    } catch (e: any) {
      console.error("Error fetching point transactions:", e);
      if (e.message && e.message.includes('isQuotaError')) {
        const err = JSON.parse(e.message);
        setQuotaError(err.message);
      }
    }
  };

  const fetchShopSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'shop');
      const docSnap = await getDoc(docRef).catch(e => {
        handleFirestoreError(e, OperationType.GET, 'settings/shop');
        throw e;
      });
      if (docSnap.exists()) {
        setShopSettings(docSnap.data());
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'settings/shop');
    }
  };

  const markNotificationAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { status: 'read' }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `notifications/${id}`));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `notifications/${id}`);
    }
  };

   const handleSlipUpload = async (e: React.ChangeEvent<HTMLInputElement>, order: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploadingSlip(order.id);
    setUploadProgress(0);

    try {
      // 1. Generate Base64 as reliable primary/backup (Very fast)
      setUploadProgress(10);
      const base64 = await compressImageToBase64(file, 600, 0.3);
      setUploadProgress(100);
      
      // Stop blocking here - Base64 is ready for Firestore
      setIsUploadingSlip(null);

      // 2. Start Background Upload to Storage
      // We don't block the UI for this anymore
      (async () => {
        try {
          const folder = `slips/${user.uid}`;
          const fileName = `${order.id}_${Date.now()}.jpg`;
          const path = generateUniquePath(folder, fileName);

          const storageURL = await uploadFile(file, path);
          
          if (storageURL) {
            // Update both the order and the slip record with the real URL
            await updateDoc(doc(db, 'orders', order.id), { paymentSlip: storageURL });
            // The slip record in 'slips' collection was created with base64, we search for it and update
            const slipQuery = query(collection(db, 'slips'), where('orderId', '==', order.id));
            const slipSnap = await getDocs(slipQuery);
            if (!slipSnap.empty) {
              await updateDoc(doc(db, 'slips', slipSnap.docs[0].id), { url: storageURL });
            }
          }
        } catch (e) {
          console.warn("Background storage upload failed (this is usually a CORS/Configuration issue):", e);
          // Don't toast error here because Base64 already worked and notified success
        }
      })();

      // 3. Update Firestore immediately with Base64
      const updatePayload: any = {
        paymentSlip: base64, // Use base64 as primary for immediate response
        paymentSlipBase64: base64,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'orders', order.id), updatePayload).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${order.id}`));

      // Create record in slips collection
      await addDoc(collection(db, 'slips'), {
        orderId: order.id,
        url: base64,
        base64: base64,
        customerName: order.customer?.name || profile?.displayName || 'ลูกค้า',
        total: order.total,
        paymentMethod: 'bank_transfer',
        createdAt: serverTimestamp(),
        uid: user.uid
      }).catch(e => handleFirestoreError(e, OperationType.CREATE, 'slips'));

      toast.success('อัปโหลดสลิปเรียบร้อยแล้ว!', {
        description: 'ขอบคุณสำหรับการสั่งซื้อ ทางร้านจะเร่งตรวจสอบโดยเร็วที่สุด'
      });
      
      // Refresh orders
      await fetchOrders(user.uid);
    } catch (error) {
      console.error('Error uploading slip:', error);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดสลิป');
      setIsUploadingSlip(null);
    } finally {
      setUploadProgress(0);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      // Also update Firebase Auth profile
      await updateProfile(user, {
        displayName: editData.displayName,
        photoURL: editData.photoURL
      });

      await updateDoc(doc(db, 'users', user.uid), {
        ...editData,
        phoneNumber: editData.phone, // Sync phoneNumber for compatibility
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));
      await fetchProfile(user.uid);
      alert('บันทึกข้อมูลเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setUploading(true);
      setUploadProgress(0);
      
      // Use the compression and upload utility with a user-specific path
      // Max 400x400 for profile pics is usually enough
      const downloadURL = await compressAndUploadImage(file, `profiles/${user.uid}`, 400, 400, 0.7, (progress) => {
        setUploadProgress(Math.round(progress));
      });

      // Update local state immediately for fast feedback
      setEditData((prev: any) => ({ ...prev, photoURL: downloadURL }));
      setProfile((prev: any) => ({ ...prev, photoURL: downloadURL }));

      // Update Firebase Auth and Firestore in parallel
      await Promise.all([
        updateProfile(user, { photoURL: downloadURL }),
        updateDoc(doc(db, 'users', user.uid), {
          photoURL: downloadURL,
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`))
      ]);

      // Soft refresh in background
      fetchProfile(user.uid);
      alert('อัปโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error uploading photo:', error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const newAddress = {
        ...addressData,
        id: editingAddressId || Math.random().toString(36).substr(2, 9),
        isDefault: (!profile?.addresses || !Array.isArray(profile.addresses) || profile.addresses.length === 0) ? true : addressData.isDefault
      };

      let updatedAddresses = [...(Array.isArray(profile?.addresses) ? profile.addresses : [])];
      
      if (editingAddressId) {
        updatedAddresses = updatedAddresses.map(addr => addr.id === editingAddressId ? newAddress : addr);
      } else {
        updatedAddresses.push(newAddress);
      }

      // If this is set as default, unset others
      if (newAddress.isDefault) {
        updatedAddresses = updatedAddresses.map(addr => ({
          ...addr,
          isDefault: addr.id === newAddress.id
        }));
      }

      const updateData: any = {
        addresses: updatedAddresses,
        updatedAt: serverTimestamp()
      };

      // If we are updating an address that matches the legacy root fields, sync them too
      if (newAddress.isDefault) {
        updateData.addressLine1 = newAddress.addressLine1;
        updateData.subDistrict = newAddress.subDistrict;
        updateData.district = newAddress.district;
        updateData.province = newAddress.province;
        updateData.postalCode = newAddress.postalCode;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`));

      await fetchProfile(user.uid);
      setIsEditingAddress(false);
      setEditingAddressId(null);
      alert('บันทึกที่อยู่เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error updating address:', error);
      alert('เกิดข้อผิดพลาดในการบันทึกที่อยู่');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!user || !profile || !Array.isArray(profile.addresses)) return;
    if (!window.confirm('คุณต้องการลบที่อยู่นี้ใช่หรือไม่?')) return;
    try {
      setLoading(true);
      const updatedAddresses = (Array.isArray(profile.addresses) ? profile.addresses : []).filter((addr: any) => addr.id !== addressId);
      
      const wasDefault = (Array.isArray(profile.addresses) ? profile.addresses : []).find((a: any) => a.id === addressId)?.isDefault;
      if (wasDefault && updatedAddresses.length > 0) {
        updatedAddresses[0].isDefault = true;
      }

      const updateData: any = {
        addresses: updatedAddresses,
        updatedAt: serverTimestamp()
      };

      // If we deleted the address that matches the legacy root fields, or it was the default
      if (wasDefault || addressId === 'default_legacy') {
        updateData.addressLine1 = updatedAddresses[0]?.addressLine1 || null;
        updateData.subDistrict = updatedAddresses[0]?.subDistrict || null;
        updateData.district = updatedAddresses[0]?.district || null;
        updateData.province = updatedAddresses[0]?.province || null;
        updateData.postalCode = updatedAddresses[0]?.postalCode || null;
      }

      await updateDoc(doc(db, 'users', user.uid), updateData).catch(e => {
        handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
        throw e;
      });

      await fetchProfile(user.uid);
      alert('ลบที่อยู่เรียบร้อยแล้ว');
    } catch (error: any) {
      console.error('Error deleting address:', error);
      alert('เกิดข้อผิดพลาดในการลบที่อยู่: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

   const handleSetDefaultAddress = async (addressId: string) => {
    if (!user || !profile || !Array.isArray(profile.addresses)) return;
    try {
      setLoading(true);
      const updatedAddresses = (Array.isArray(profile.addresses) ? profile.addresses : []).map((addr: any) => ({
        ...addr,
        isDefault: addr.id === addressId
      }));

      await updateDoc(doc(db, 'users', user.uid), {
        addresses: updatedAddresses,
        updatedAt: serverTimestamp()
      }).catch(e => {
        handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
        throw e;
      });

      await fetchProfile(user.uid);
    } catch (error) {
      console.error('Error setting default address:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      alert('ส่งอีเมลรีเซ็ตรหัสผ่านไปยัง: ' + user.email + ' เรียบร้อยแล้ว โปรดตรวจสอบกล่องจดหมายของคุณ');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      if (error.code === 'auth/quota-exceeded') {
        alert('ขออภัย: เนื่องจากมีการส่งอีเมลรีเซ็ตรหัสผ่านเกินโควตาที่กำหนดไว้ในวันนี้ โปรดลองใหม่อีกครั้งในภายหลัง หรือติดต่อผู้ดูแลระบบ');
      } else if (error.code === 'auth/too-many-requests') {
        alert('คุณส่งคำขอมากเกินไปชั่วคราว โปรดรอสักครู่แล้วลองใหม่อีกครั้ง');
      } else {
        alert('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถส่งอีเมลได้ในขณะนี้'));
      }
    }
  };

  const handleConfirmReceipt = async (order: any) => {
    if (!user || !profile) return;
    
    // Add confirmation to prevent accidental clicks
    if (!window.confirm('คุณยืนยันว่าได้รับสินค้ารายการนี้แล้วใช่หรือไม่? (ระบบจะเพิ่มแต้มสะสมให้คุณทันทีหลังยืนยัน)')) {
      return;
    }
    
    try {
      setConfirmingOrder(order.id);
      
      // 1. Get points from order or calculate (Total / 10)
      const pointsEarned = order.pointsEarned || Math.floor((order.total || 0) / 10);
      
      const batch = writeBatch(db);

      // 2. Update Order Status
      const orderRef = doc(db, 'orders', order.id);
      batch.update(orderRef, {
        status: 'delivered',
        deliveredAt: serverTimestamp(),
        pointsGranted: true,
        updatedAt: serverTimestamp()
      });

      // 3. Update User Points
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        points: increment(pointsEarned),
        lastClaimedOrderId: order.id,
        updatedAt: serverTimestamp()
      });

      // 4. Create Point Transaction
      const txRef = doc(collection(db, 'pointTransactions'));
      batch.set(txRef, {
          userId: user.uid,
          amount: pointsEarned,
          type: 'earn',
          description: `ได้รับแต้มจากการสั่งซื้อออเดอร์ #${order.id.slice(-6).toUpperCase()}`,
          orderId: order.id,
          createdAt: serverTimestamp()
      });

      // Commit full batch
      await batch.commit().catch(e => handleFirestoreError(e, OperationType.WRITE, `batch/confirm-receipt/${order.id}`));

      // 5. Celebration Effect!
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#7c3aed', '#f97316', '#10b981']
      });

      toast.success('ยืนยันพัสดุเรียบร้อย!', {
        description: `คุณได้รับ ${pointsEarned} แต้มสะสม ขอบคุณที่ใช้บริการ!`
      });

      // 6. Refresh Data
      await Promise.all([
        fetchProfile(user.uid),
        fetchOrders(user.uid),
        fetchPointTransactions(user.uid)
      ]);

    } catch (error) {
      console.error('Error confirming receipt:', error);
      toast.error('เกิดข้อผิดพลาดในการยืนยันรายการ');
    } finally {
      setConfirmingOrder(null);
    }
  };

  const handleSubmitProductReview = async () => {
    if (!user || !reviewingItem) return;
    try {
      setSubmittingReview(true);
      await addDoc(collection(db, 'reviews'), {
        productId: reviewingItem.productId || reviewingItem.id,
        uid: user.uid,
        userName: 'ลูกค้า',
        rating: productRating,
        text: productReviewText,
        createdAt: serverTimestamp()
      }).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'reviews');
        throw e;
      });
      
      setIsReviewModalOpen(false);
      setReviewingItem(null);
      setProductReviewText('');
      alert('ขอบคุณสำหรับรีวิวของคุณ!');
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('เกิดข้อผิดพลาดในการส่งรีวิว');
    } finally {
      setSubmittingReview(false);
    }
  };

  const calculateTierSpending = (months: number) => {
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    if (months === 0) return deliveredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    
    const now = new Date();
    const cutoff = new Date();
    cutoff.setMonth(now.getMonth() - months);
    
    return deliveredOrders
      .filter(o => {
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        return orderDate >= cutoff;
      })
      .reduce((sum, o) => sum + (o.total || 0), 0);
  };

  const getMemberTier = () => {
    if (!shopSettings?.tierRules?.gold || !shopSettings?.tierRules?.platinum) {
      const total = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total || 0), 0);
      if (total >= 50000) return 'PLATINUM';
      if (total >= 10000) return 'GOLD';
      return 'SILVER';
    }

    const { tierRules } = shopSettings;
    const platSpending = calculateTierSpending(tierRules.platinum.months || 0);
    if (platSpending >= (tierRules.platinum.minSpending || 0)) return 'PLATINUM';

    const goldSpending = calculateTierSpending(tierRules.gold.months || 0);
    if (goldSpending >= (tierRules.gold.minSpending || 0)) return 'GOLD';

    return 'SILVER';
  };

  const memberTier = getMemberTier();
  const totalSpending = orders.filter(o => o.status === 'delivered').reduce((sum, o) => sum + (o.total || 0), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12 animate-fade-in">
      {loading ? (
        <div className="space-y-6 animate-pulse">
          {/* Header Skeleton */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-200" />
            <div className="space-y-2 flex-grow text-center md:text-left">
              <div className="h-5 bg-slate-200 rounded w-1/4 mx-auto md:mx-0" />
              <div className="h-4 bg-slate-200 rounded w-1/3 mx-auto md:mx-0" />
            </div>
            <div className="h-10 bg-slate-200 rounded-xl w-32" />
          </div>

          {/* Stats Skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-slate-150 h-24" />
            ))}
          </div>

          {/* Content Skeletons */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 h-64" />
        </div>
      ) : (
        <>
          {quotaError && (
        <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-left">
            <AlertTriangle className="text-orange-500 shrink-0" size={20} />
            <p className="text-sm font-medium text-orange-800 flex-1">{quotaError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-semibold hover:bg-orange-700 transition-colors"
            >
              รีเฟรช
            </button>
        </div>
      )}
      
      {/* Refined Header */}
      <div className="mb-12">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center text-3xl font-medium border border-gray-100 shadow-sm overflow-hidden transition-all duration-300">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                profile?.displayName?.charAt(0) || <User size={32} />
              )}
              
              {uploading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-center sm:text-left flex-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              {profile?.displayName || 'ลูกค้าผู้มีเกียรติ'}
            </h1>
            <div className="flex flex-wrap justify-center sm:justify-start items-center gap-x-4 gap-y-1 mt-1">
              <p className="text-sm text-gray-500 font-medium">{user?.email}</p>
              {profile?.phone && (
                <p className="text-sm text-gray-400 flex items-center gap-1.5 font-medium">
                  <Phone size={14} className="text-gray-300" /> {profile.phone}
                </p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-2">
              <span className="px-3 py-1 bg-gray-900 text-white text-[10px] font-bold rounded-full tracking-wider uppercase">
                {memberTier} Member
              </span>
            </div>
          </div>
        </div>
        
        {/* Navigation Breadcrumb-style */}
        {activeTab !== 'dashboard' && (
          <div className="mt-8 border-t border-gray-100 pt-6">
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="group flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-orange-600 transition-colors"
            >
              <ArrowRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={16} /> 
              กลับไปหน้าหลัก
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              {/* Stat Grid - Lighter look */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'แต้มสะสม', value: (profile?.points || 0).toLocaleString(), icon: <Coins size={18} />, color: 'text-orange-600' },
                  { label: 'ออเดอร์', value: orders.length, icon: <Package size={18} />, color: 'text-gray-900' },
                  { label: 'ยอดใช้จ่าย', value: `฿${totalSpending.toLocaleString()}`, icon: <Gift size={18} />, color: 'text-gray-900' },
                  { label: 'ระดับ', value: memberTier.charAt(0) + memberTier.slice(1).toLowerCase(), icon: <Star size={18} />, color: 'text-gray-900' },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className={`${stat.color} mb-3`}>
                      {stat.icon}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className="text-lg font-bold text-gray-900 leading-none">{stat.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Menu List - Simplified */}
              <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                {[
                  { id: 'orders', label: 'รายการคำสั่งซื้อ', sub: `ประวัติและการติดตาม (${orders.length})`, icon: <Package size={20} /> },
                  { id: 'notifications', label: 'แจ้งเตือน', sub: notifications.filter(n => n.status === 'unread').length > 0 ? `ใหม่ ${notifications.filter(n => n.status === 'unread').length} ข้อความ` : 'ดูการแจ้งเตือนทั้งหมด', icon: <Mail size={20} />, badge: notifications.filter(n => n.status === 'unread').length },
                  { id: 'points', label: 'สิทธิพิเศษ', sub: 'รายละเอียดระดับสมาชิกและแต้ม', icon: <Coins size={20} /> },
                  { id: 'addresses', label: 'ข้อมูลที่อยู่', sub: (Array.isArray(profile?.addresses) ? profile.addresses : []).find((a: any) => a.isDefault)?.addressLine1 || 'ตั้งค่าที่อยู่หลัก', icon: <MapPin size={20} /> },
                  { id: 'settings', label: 'ตั้งค่าบัญชี', sub: 'แก้ไขโปรไฟล์และรหัสผ่าน', icon: <Settings size={20} /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-gray-400 group-hover:text-orange-600 transition-colors">
                        {item.icon}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-gray-900 mb-0.5">{item.label}</p>
                        <p className="text-xs text-gray-400 font-medium truncate max-w-[200px] sm:max-w-xs">{item.sub}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.badge && (
                        <span className="bg-orange-600 text-white text-[10px] font-bold h-5 min-w-[20px] px-1 rounded-full flex items-center justify-center">
                          {item.badge}
                        </span>
                      )}
                      <ChevronRight size={18} className="text-gray-300 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

              {activeTab === 'orders' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">การสั่งซื้อของฉัน</h2>
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{orders.length} รายการ</span>
                  </div>
                  
                  {orders.length === 0 ? (
                    <div className="bg-white py-16 rounded-2xl border border-gray-100 shadow-sm text-center">
                      <ShoppingBag className="mx-auto text-gray-200 mb-4" size={40} />
                      <p className="text-sm text-gray-400 font-medium">ยังไม่มีประวัติการสั่งซื้อ</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden group transition-all hover:shadow-md">
                          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-gray-50/30">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-gray-900">Order #{order.id.slice(-6).toUpperCase()}</span>
                              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                              <span className="text-[10px] font-bold text-gray-400 uppercase">
                                {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('th-TH') : 'Just now'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className={`w-1.5 h-1.5 rounded-full ${
                                  order.status === 'delivered' ? 'bg-green-500' : 
                                  order.status === 'cancelled' ? 'bg-red-500' : 'bg-orange-500'
                                }`}></span>
                                <p className={`text-[11px] font-bold uppercase tracking-wider ${
                                  order.status === 'delivered' ? 'text-green-600' : 
                                  order.status === 'cancelled' ? 'text-red-500' : 'text-orange-600'
                                }`}>
                                  {order.status === 'pending' ? 'รอดำเนินการ' : 
                                   order.status === 'processing' ? 'เตรียมสินค้า' : 
                                   order.status === 'shipped' ? 'จัดส่งแล้ว' : 
                                   order.status === 'delivered' ? 'สำเร็จ' : 
                                   order.status === 'cancelled' ? 'ยกเลิก' : order.status}
                                </p>
                            </div>
                          </div>

                          <div className="p-6 space-y-4">
                            <div className="space-y-3">
                              {order.items.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-4">
                                  <img 
                                    src={getGoogleDriveDirectLink(item.image) || 'https://via.placeholder.com/100'} 
                                    className="w-12 h-12 rounded-lg object-cover border border-gray-100" 
                                    alt=""
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{item.name || item.title}</p>
                                    <p className="text-xs text-gray-400 font-medium">数量: {item.quantity}</p>
                                  </div>
                                  <p className="text-sm font-bold text-gray-900">฿{(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                              ))}
                            </div>

                            {order.paymentMethod === 'promptpay' && !order.paymentSlip && order.status === 'pending' && (
                              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-orange-700">
                                  <Smartphone size={18} />
                                  <div className="flex flex-col">
                                    <p className="text-xs font-bold uppercase tracking-tight">ยังไม่ได้แจ้งชำระเงิน</p>
                                    <p className="text-[10px] font-medium opacity-80">กรุณาแนบหลักฐานเพื่อยืนยันรายการ</p>
                                  </div>
                                </div>
                                <label className={`px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-bold cursor-pointer hover:bg-orange-700 transition-colors shadow-sm ${isUploadingSlip === order.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                  {isUploadingSlip === order.id ? 'กำลังส่ง...' : 'แนบสลิป'}
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={(e) => handleSlipUpload(e, order)} 
                                    disabled={isUploadingSlip === order.id} 
                                  />
                                </label>
                              </div>
                            )}

                            {order.paymentSlip && (
                              <div className="flex items-center justify-between bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-2 text-gray-400">
                                  <ImageIcon size={16} />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">แนบสลิปเรียบร้อย</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <a 
                                    href={order.paymentSlip} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wider"
                                  >
                                    ตรวจสอบ
                                  </a>
                                  {order.status === 'pending' && (
                                    <label className="text-[10px] font-bold text-gray-400 hover:text-orange-600 cursor-pointer uppercase tracking-wider">
                                      เปลี่ยน
                                      <input 
                                        type="file" 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={(e) => handleSlipUpload(e, order)} 
                                        disabled={isUploadingSlip === order.id} 
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between gap-4">
                              <div className="flex-1">
                                {order.trackingNumber ? (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">{order.shippingCompany}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-gray-900 tracking-wider">{order.trackingNumber}</span>
                                      <button onClick={() => copyToClipboard(order.trackingNumber)} className="text-gray-300 hover:text-orange-600 transition-colors"><Copy size={14} /></button>
                                      <a 
                                        href={getTrackingLink(order.shippingCompany, order.trackingNumber)} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="text-[10px] font-bold text-orange-600 hover:underline uppercase tracking-wider ml-2"
                                      >
                                        ติดตาม
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-gray-300">
                                    <Clock size={14} />
                                    <span className="text-[10px] font-bold uppercase tracking-widest">กำลังดำเนินการ</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {order.status === 'shipped' && (
                                  <button onClick={() => setOrderToConfirm(order)} className="h-9 px-5 bg-orange-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-sm hover:bg-orange-700 transition-all">ได้รับสินค้าแล้ว</button>
                                )}
                                {order.status === 'delivered' && (
                                  <button onClick={() => { setReviewingItem(order.items[0]); setIsReviewModalOpen(true); }} className="h-9 px-5 bg-gray-900 text-white rounded-lg text-[11px] font-bold uppercase tracking-wider shadow-sm hover:bg-gray-800 transition-all">เขียนรีวิว</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}


              {activeTab === 'notifications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-1">
                    <h2 className="text-sm font-black text-gray-900 tracking-tight uppercase tracking-[0.1em]">การแจ้งเตือน</h2>
                    <button 
                      onClick={async () => {
                        try {
                          const unreadNots = notifications.filter(n => n.status === 'unread');
                          for (const n of unreadNots) {
                            await markNotificationAsRead(n.id);
                          }
                        } catch (e) {
                          console.error("Error marking all read:", e);
                        }
                      }}
                      className="text-[8px] font-black text-orange-600 hover:scale-105 transition-transform uppercase tracking-widest"
                    >
                      อ่านทั้งหมด
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div className="bg-white p-10 rounded-[32px] border border-gray-100 shadow-sm text-center space-y-2">
                      <Mail className="mx-auto text-gray-100" size={32} />
                      <p className="text-[11px] text-gray-400 font-black uppercase tracking-widest leading-none">ไม่มีข้อความใหม่ในขณะนี้</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            if (notif.status === 'unread') {
                              markNotificationAsRead(notif.id);
                            }
                            if (notif.orderId || notif.type === 'order' || notif.type === 'shipping') {
                              setActiveTab('orders');
                            }
                          }}
                          className={`p-3.5 rounded-2xl border transition-all relative group cursor-pointer active:scale-[0.98] ${
                            notif.status === 'unread' 
                              ? 'bg-orange-50/50 border-orange-100 shadow-sm' 
                              : 'bg-white border-gray-50 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <div className="flex gap-4">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              notif.type === 'shipping' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                            }`}>
                              {notif.type === 'shipping' ? <Truck size={16} /> : <Package size={16} />}
                            </div>
                            <div className="space-y-0.5 flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className={`text-sm font-black text-gray-900 truncate ${notif.status === 'unread' ? 'pr-16' : ''}`}>{notif.title}</h4>
                                {notif.status === 'unread' && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markNotificationAsRead(notif.id);
                                    }}
                                    className="p-1 px-2 bg-orange-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest absolute top-3.5 right-3.5 shadow-sm"
                                  >
                                    NEW
                                  </button>
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-gray-500 leading-snug line-clamp-2">{notif.message}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-[9px] text-gray-300 font-bold uppercase">
                                  {notif.createdAt ? notif.createdAt.toDate().toLocaleString('th-TH', { 
                                    day: '2-digit', month: 'short', 
                                    hour: '2-digit', minute: '2-digit' 
                                  }) : 'เมื่อสักครู่'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'points' && (
                <div className="space-y-8">
                  <div className="bg-gray-900 p-8 rounded-2xl text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10 space-y-4">
                      <div className="flex items-center gap-2">
                        <Coins size={20} className="text-orange-400" />
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">แต้มสะสมปัจจุบัน</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <h2 className="text-4xl font-bold tracking-tight">{(profile?.points || 0).toLocaleString()}</h2>
                        <span className="text-xs font-semibold opacity-40 uppercase tracking-wider">Points</span>
                      </div>
                      <div className="pt-2">
                        <p className="text-[11px] font-bold bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-md">
                          ทุก 10 แต้มใช้แทนเงินสดได้ 1 บาท
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <Target size={18} className="text-gray-400" /> ระดับสมาชิกของคุณ
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                       {[
                         { level: 'PLATINUM', threshold: shopSettings?.tierRules?.platinum?.minSpending?.toLocaleString() || '60,000', icon: '💎', current: memberTier === 'PLATINUM' },
                         { level: 'GOLD', threshold: shopSettings?.tierRules?.gold?.minSpending?.toLocaleString() || '12,000', icon: '🥇', current: memberTier === 'GOLD' },
                         { level: 'SILVER', threshold: '0', icon: '🥈', current: memberTier === 'SILVER' },
                       ].map((tier, idx) => (
                         <div key={idx} className={`p-5 rounded-xl border-2 transition-all ${tier.current ? 'border-orange-600 bg-orange-50/10' : 'border-gray-50 bg-white opacity-40'}`}>
                           <span className="text-2xl mb-3 block">{tier.icon}</span>
                           <p className="text-xs font-bold text-gray-900 mb-1">{tier.level}</p>
                           <p className="text-[10px] text-gray-400 font-medium whitespace-nowrap">฿{tier.threshold} +</p>
                         </div>
                       ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Clock size={16} className="text-gray-400" /> ประวัติการใช้แต้ม
                      </h3>
                    </div>

                    {pointTransactions.length === 0 ? (
                      <div className="py-12 text-center text-gray-300">
                        <Coins className="mx-auto mb-2 opacity-20" size={32} />
                        <p className="text-xs font-medium uppercase tracking-widest">ยังไม่มีรายการ</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {pointTransactions.map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-4">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                tx.amount > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                              }`}>
                                {tx.amount > 0 ? <Plus size={14} /> : <Lock size={14} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900 mb-0.5">{tx.description}</p>
                                <p className="text-[10px] text-gray-400 font-medium">
                                  {tx.createdAt ? tx.createdAt.toDate().toLocaleDateString('th-TH') : 'Just now'}
                                </p>
                              </div>
                            </div>
                            <p className={`text-sm font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'addresses' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">จัดการที่อยู่</h2>
                    <button 
                      onClick={() => {
                        setEditingAddressId(null);
                        setAddressData({ id: '', isDefault: false, addressLine1: '', subDistrict: '', district: '', province: '', postalCode: '', });
                        setIsEditingAddress(true);
                      }}
                      className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                    >
                      เพิ่มที่อยู่ใหม่
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {isEditingAddress ? (
                      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">รายละเอียดที่อยู่</label>
                            <input 
                              type="text" 
                              placeholder="House No., Street, etc."
                              value={addressData.addressLine1} 
                              onChange={(e) => setAddressData({...addressData, addressLine1: e.target.value})}
                              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm outline-none transition-all"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">ตำบล / แขวง</label>
                              <input 
                                type="text" 
                                value={addressData.subDistrict} 
                                onChange={(e) => setAddressData({...addressData, subDistrict: e.target.value})}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">อำเภอ / เขต</label>
                              <input 
                                type="text" 
                                value={addressData.district} 
                                onChange={(e) => setAddressData({...addressData, district: e.target.value})}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm outline-none transition-all"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">จังหวัด</label>
                              <input 
                                type="text" 
                                value={addressData.province} 
                                onChange={(e) => setAddressData({...addressData, province: e.target.value})}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm outline-none transition-all"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">รหัสไปรษณีย์</label>
                              <input 
                                type="text" 
                                value={addressData.postalCode} 
                                onChange={(e) => setAddressData({...addressData, postalCode: e.target.value})}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 py-2">
                          <input 
                            type="checkbox" 
                            id="isDefault" 
                            checked={addressData.isDefault} 
                            onChange={(e) => setAddressData({...addressData, isDefault: e.target.checked})}
                            className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-gray-300"
                          />
                          <label htmlFor="isDefault" className="text-sm font-semibold text-gray-700">ตั้งเป็นที่อยู่เริ่มต้น</label>
                        </div>

                        <div className="flex gap-3">
                          <button 
                            onClick={handleUpdateAddress}
                            className="flex-1 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all text-xs uppercase tracking-wider shadow-sm"
                          >
                            บันทึกที่อยู่
                          </button>
                          <button 
                            onClick={() => setIsEditingAddress(false)}
                            className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs uppercase tracking-wider"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {((profile?.addresses && Array.isArray(profile.addresses) && profile.addresses.length > 0) 
                          ? profile.addresses 
                          : (profile?.addressLine1 ? [{
                              id: 'default_legacy',
                              addressLine1: profile.addressLine1,
                              subDistrict: profile.subDistrict || '',
                              district: profile.district || '',
                              province: profile.province || '',
                              postalCode: profile.postalCode || '',
                              isDefault: true
                            }] : [])).map((addr: any) => (
                          <div key={addr.id} className={`p-5 rounded-2xl border transition-all relative group ${addr.isDefault ? 'border-orange-100 bg-orange-50/10' : 'border-gray-50 bg-white hover:border-gray-200 shadow-sm'}`}>
                            {addr.isDefault && (
                              <div className="absolute top-4 right-4 bg-orange-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                                Default
                              </div>
                            )}
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-gray-900 leading-snug">{addr.addressLine1}</p>
                                <p className="text-xs text-gray-400 font-medium">{addr.subDistrict}, {addr.district}</p>
                                <p className="text-xs text-gray-400 font-medium">{addr.province} {addr.postalCode}</p>
                              </div>
                              
                              <div className="flex items-center gap-4 pt-2 border-t border-gray-50">
                                <button 
                                  onClick={() => { setEditingAddressId(addr.id); setAddressData(addr); setIsEditingAddress(true); }}
                                  className="text-xs font-bold text-gray-900 hover:text-orange-600 transition-colors uppercase tracking-wider"
                                >
                                  แก้ไข
                                </button>
                                {!addr.isDefault && (
                                  <button 
                                    onClick={() => handleSetDefaultAddress(addr.id)}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-wider"
                                  >
                                    ตั้งเป็นที่อยู่หลัก
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteAddress(addr.id)} 
                                  className="ml-auto text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="mb-8">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">ตั้งค่าโปรไฟล์</h3>
                      <p className="text-xs text-gray-400 font-medium">จัดการข้อมูลส่วนตัวและรายละเอียดบัญชีของคุณ</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">ชื่อที่แสดง</label>
                        <input 
                          type="text" 
                          value={editData.displayName}
                          onChange={(e) => setEditData({...editData, displayName: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm font-medium outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">เบอร์โทรศัพท์</label>
                        <input 
                          type="text" 
                          value={editData.phone}
                          onChange={(e) => setEditData({...editData, phone: e.target.value})}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 text-sm font-medium outline-none transition-all"
                        />
                      </div>
                      <div className="sm:col-span-2 pt-2">
                        <button 
                          onClick={handleUpdateProfile}
                          className="w-full sm:w-fit px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all text-xs uppercase tracking-widest shadow-sm"
                        >
                          บันทึกการเปลี่ยนแปลง
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

      {/* Confirm Receipt Modal */}
      <AnimatePresence>
        {orderToConfirm && (
          <div 
            onClick={() => setOrderToConfirm(null)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-14 h-14 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={28} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">รับสินค้าเรียบร้อย?</h3>
                  <p className="text-sm text-gray-500 font-medium">ยืนยันว่าคุณได้รับพัสดุออเดอร์ #{orderToConfirm.id.slice(-6).toUpperCase()} ในสภาพสมบูรณ์</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setOrderToConfirm(null)}
                    className="py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all text-xs uppercase tracking-wider"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => {
                      handleConfirmReceipt(orderToConfirm);
                      setOrderToConfirm(null);
                    }}
                    className="py-3 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all text-xs uppercase tracking-wider"
                  >
                    ยืนยัน
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Review Modal */}
      <AnimatePresence>
        {isReviewModalOpen && reviewingItem && (
          <div 
            onClick={() => {
              setIsReviewModalOpen(false);
              setReviewingItem(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative"
            >
              <button 
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setReviewingItem(null);
                }}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>

              <div className="p-8 space-y-8">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-bold text-gray-900">รีวิวสินค้า</h2>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">แชร์ความเห็นของคุณเกี่ยวกับ</p>
                  <p className="text-sm font-bold text-orange-600 truncate px-4">{reviewingItem.name}</p>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">คุณให้กี่ดาว?</p>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setProductRating(star)}
                          className="p-1 transition-transform hover:scale-110 active:scale-95"
                        >
                          <Star 
                            size={32} 
                            className={`${productRating >= star ? 'fill-yellow-400 stroke-yellow-400' : 'text-gray-200 stroke-gray-200'}`} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">ข้อความรีวิว</label>
                    <textarea 
                      placeholder="บอกความรู้สึกของคุณหลังจากได้รับสินค้า..."
                      value={productReviewText}
                      onChange={(e) => setProductReviewText(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-1 focus:ring-orange-500 outline-none font-medium text-sm min-h-[120px] transition-all"
                      required
                    />
                  </div>

                  <button 
                    onClick={handleSubmitProductReview}
                    disabled={submittingReview}
                    className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 text-xs uppercase tracking-widest"
                  >
                    {submittingReview ? 'กำลังส่ง...' : 'ส่งรีวิวให้เรา'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
};

export default UserProfile;