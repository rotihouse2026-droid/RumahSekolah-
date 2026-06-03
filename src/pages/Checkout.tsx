import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CreditCard, Truck, CheckCircle2, Loader2, Smartphone, Upload, X, Image as ImageIcon, Coins, Copy, Check, MapPin } from 'lucide-react';
import Logo from '../components/Logo';
import { useCart } from '../CartContext';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc, increment, getDocFromServer, query, where, getDocs, writeBatch, documentId } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';
import { compressAndUploadImage, generateUniquePath, uploadFile, compressImageToBase64 } from '../utils/storage';

const Checkout = ({ settings }: { settings: any }) => {
  const { cart, totalPrice, clearCart, removeBulkFromCart } = useCart();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [slipImage, setSlipImage] = useState<string | null>(null);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [compressedSlipBlob, setCompressedSlipBlob] = useState<Blob | null>(null);
  const [uploadedSlipUrl, setUploadedSlipUrl] = useState<string | null>(null);
  const [slipBase64, setSlipBase64] = useState<string | null>(null);
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [userPoints, setUserPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [usePoints, setUsePoints] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [finalPointsEarned, setFinalPointsEarned] = useState(0);
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    addressLine1: '',
    subDistrict: '',
    district: '',
    province: '',
    postalCode: '',
    paymentMethod: 'promptpay'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef).catch(e => {
          handleFirestoreError(e, OperationType.GET, `users/${user.uid}`);
          throw e;
        });
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserPoints(userData.points || 0);
          setSavedAddresses(userData.addresses || []);
          
          // Pre-fill form with default address or the direct fields if they exist
          let addressToUse = (userData.addresses || []).find((a: any) => a.isDefault);
          if (!addressToUse && (userData.addresses || []).length > 0) {
            addressToUse = userData.addresses[0];
          }

          if (addressToUse) {
            setSelectedAddressId(addressToUse.id);
            setFormData(prev => ({
              ...prev,
              name: userData.displayName || user.displayName || prev.name,
              email: userData.email || user.email || prev.email,
              phone: userData.phoneNumber || userData.phone || user.phoneNumber || prev.phone,
              addressLine1: addressToUse.addressLine1 || '',
              subDistrict: addressToUse.subDistrict || '',
              district: addressToUse.district || '',
              province: addressToUse.province || '',
              postalCode: addressToUse.postalCode || '',
            }));
          } else {
            // Fallback to legacy fields if no addresses array
            setFormData(prev => ({
              ...prev,
              name: userData.displayName || user.displayName || prev.name,
              email: userData.email || user.email || prev.email,
              phone: userData.phoneNumber || userData.phone || user.phoneNumber || prev.phone,
              addressLine1: userData.addressLine1 || prev.addressLine1,
              subDistrict: userData.subDistrict || prev.subDistrict,
              district: userData.district || prev.district,
              province: userData.province || prev.province,
              postalCode: userData.postalCode || prev.postalCode,
            }));
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSlipFile(file);
      setIsUploadingSlip(true);
      setUploadedSlipUrl(null);
      setSlipBase64(null);
      
      try {
        // 1. Generate preview and Base64 (Reliable Storage in Firestore)
        // This is fast and local
        const base64 = await compressImageToBase64(file, 600, 0.3); 
        setSlipBase64(base64);
        setSlipImage(base64);
        
        // IMPORTANT: We stop the blocking loading state here because Base64 is enough
        // This removes the loader from the image preview immediately
        setIsUploadingSlip(false);

        // 2. Attempt BACKGROUND UPLOAD to Storage (May fail due to CORS, but it's okay)
        const folder = currentUser ? `slips/${currentUser.uid}` : 'slips/guests';
        
        setUploadProgress(0);
        compressAndUploadImage(file, folder, 800, 800, 0.7, (progress) => {
          setUploadProgress(Math.round(progress));
        }).then(url => {
          setUploadedSlipUrl(url);
        }).catch(err => {
          console.warn("Background storage upload failed (CORS/Plan), using Base64:", err);
        });
      } catch (err) {
        console.error("Preparation error:", err);
        setIsUploadingSlip(false);
        // Fallback preview
        const reader = new FileReader();
        reader.onloadend = () => setSlipImage(reader.result as string);
        reader.readAsDataURL(file);
      }
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCodeInput.trim()) return;
    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCodeInput.trim().toUpperCase()), where('isActive', '==', true));
      const snapshot = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'coupons');
        throw e;
      });
      
      if (snapshot.empty) {
        setCouponError('ไม่พบรหัสคูปองนี้ หรือคูปองหมดอายุแล้ว');
        setAppliedCoupon(null);
        return;
      }

      const couponData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
      const now = new Date();

      // Check dates
      if (couponData.startDate && new Date(couponData.startDate) > now) {
        setCouponError('คูปองนี้ยังไม่เริ่มใช้งาน');
        return;
      }
      if (couponData.endDate && new Date(couponData.endDate) < now) {
        setCouponError('คูปองนี้หมดอายุแล้ว');
        return;
      }

      // Check usage limit
      if (couponData.usageLimit && couponData.usageCount >= couponData.usageLimit) {
        setCouponError('คูปองนี้ถูกใช้งานครบจำนวนจำกัดแล้ว');
        return;
      }

      // Check min purchase
      if (totalPrice < couponData.minPurchase) {
        setCouponError(`ยอดซื้อขั้นต่ำสำหรับคูปองนี้คือ ฿${couponData.minPurchase.toLocaleString()}`);
        return;
      }

      setAppliedCoupon(couponData);
      setCouponError(null);
    } catch (err) {
      console.error("Error applying coupon:", err);
      setCouponError('เกิดข้อผิดพลาดในการตรวจสอบคูปอง');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const discountFromPoints = usePoints ? Math.floor(userPoints * (Number(settings?.bahtPerPoint) ?? 0.1)) : 0;
  const shippingFee = totalPrice >= (Number(settings?.freeShippingThreshold) || 999) ? 0 : (Number(settings?.shippingFee) || 50);
  const subTotal = totalPrice + shippingFee;
  
  // Calculate coupon discount
  let couponDiscount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'percentage') {
      couponDiscount = (totalPrice * appliedCoupon.value) / 100;
      if (appliedCoupon.maxDiscount) {
        couponDiscount = Math.min(couponDiscount, appliedCoupon.maxDiscount);
      }
    } else {
      couponDiscount = appliedCoupon.value;
    }
  }

  // Calculate actual discount and points to redeem (don't redeem more than needed)
  const totalDiscount = Math.min(subTotal, discountFromPoints + couponDiscount);
  const actualPointsDiscount = Math.min(subTotal - couponDiscount, discountFromPoints);
  const pointsToRedeem = usePoints ? Math.ceil(actualPointsDiscount / (settings?.bahtPerPoint ?? 0.1)) : 0;
  
  const totalAmount = Math.max(0, subTotal - couponDiscount - actualPointsDiscount);
  // Points earned should be based on product total after discount, excluding shipping
  const pointsToEarn = Math.floor(Math.max(0, totalPrice - couponDiscount - actualPointsDiscount) * (settings?.pointsPerBaht ?? 0.1));

  const handleSelectAddress = (addr: any) => {
    setSelectedAddressId(addr.id);
    setFormData(prev => ({
      ...prev,
      addressLine1: addr.addressLine1,
      subDistrict: addr.subDistrict,
      district: addr.district,
      province: addr.province,
      postalCode: addr.postalCode,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // We allow submitting without a slip if they chose PromptPay, 
    // it will just stay in 'pending' status until verified.
    
    setLoading(true);
    
    try {
      // 1. Ensure we have either URL or Base64
      let finalSlipUrl = uploadedSlipUrl;
      let finalSlipBase64 = slipBase64;
      
      if (formData.paymentMethod === 'promptpay' && totalAmount > 0) {
        if (!finalSlipUrl && !finalSlipBase64 && slipFile) {
          setProcessingStep('uploading_slip');
          
          // Generate Base64 as priority for reliability (very fast)
          finalSlipBase64 = await compressImageToBase64(slipFile, 600, 0.3);
          setSlipBase64(finalSlipBase64);
          
          // Try storage one last time but DON'T block if it fails due to CORS
          // We set skipRetry=true to fail fast
          try {
            const folder = currentUser ? `slips/${currentUser.uid}` : 'slips/guests';
            finalSlipUrl = await compressAndUploadImage(slipFile, folder, 800, 800, 0.7, undefined, true);
            setUploadedSlipUrl(finalSlipUrl);
          } catch (e) {
            console.warn("Storage upload failed at submission (CORS), proceeding with Base64");
          }
        }
      }

      setProcessingStep('creating_order');
      
      // Verification: Check if all products in cart still exist and have enough stock
      const productIds = cart.map(item => item.id);
      // Firestore 'in' query supports up to 30 elements. For retail carts this is usually plenty.
      const productsQuery = query(collection(db, 'products'), where(documentId(), 'in', productIds));
      const productsSnap = await getDocs(productsQuery).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'products');
        throw e;
      });
      const existingProductsMap = productsSnap.docs.reduce((acc, doc) => {
        acc[doc.id] = doc.data();
        return acc;
      }, {} as Record<string, any>);

      const missingProductItems = cart.filter(item => !existingProductsMap[item.id]);
      if (missingProductItems.length > 0) {
        const missingIds = missingProductItems.map(p => p.id);
        const names = missingProductItems.map(p => p.name).join(', ');
        
        // AUTOMATIC CLEANUP: Remove missing items from cart
        removeBulkFromCart(missingIds);
        
        throw new Error(`ขออภัย สินค้าต่อไปนี้ไม่พร้อมจำหน่ายแล้ว: ${names}. ระบบได้นำออกจากตะกร้าให้คุณแล้ว กรุณาตรวจสอบยอดชำระและสั่งซื้ออีกครั้ง`);
      }

      const combinedAddress = `${formData.addressLine1} ต. ${formData.subDistrict} อ. ${formData.district} จ. ${formData.province} ${formData.postalCode}`;

      // 2. Prepare Batch
      const batch = writeBatch(db);
      
      // Order ID and Ref
      const orderRef = doc(collection(db, 'orders'));
      const orderData = {
        id: orderRef.id,
        items: cart,
        total: totalAmount,
        customer: {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone,
          address: combinedAddress,
          uid: currentUser?.uid || null
        },
        paymentMethod: formData.paymentMethod,
        paymentSlip: (totalAmount > 0 && formData.paymentMethod === 'promptpay') ? (finalSlipUrl || finalSlipBase64) : null,
        paymentSlipBase64: (totalAmount > 0 && formData.paymentMethod === 'promptpay') ? finalSlipBase64 : null,
        pointsEarned: pointsToEarn,
        pointsRedeemed: pointsToRedeem,
        discountAmount: actualPointsDiscount + couponDiscount,
        couponCode: appliedCoupon?.code || null,
        couponDiscount: couponDiscount,
        status: totalAmount > 0 ? 'pending' : 'processing',
        pointsGranted: false,
        createdAt: serverTimestamp()
      };

      // Add to batch
      batch.set(orderRef, orderData);

      // 1.5 Add slip record to dedicated slips collection (for easier tracking)
      if (orderData.paymentSlip) {
        const slipRef = doc(collection(db, 'slips'));
        batch.set(slipRef, {
          orderId: orderRef.id,
          url: orderData.paymentSlip,
          base64: finalSlipBase64,
          customerName: orderData.customer.name,
          total: orderData.total,
          paymentMethod: orderData.paymentMethod,
          createdAt: serverTimestamp(),
          uid: currentUser?.uid || null
        });
      }

      setProcessingStep('updating_inventory');
      // 3. Deduct Stock (Add to batch)
      for (const item of cart) {
        const productRef = doc(db, 'products', item.id);
        batch.update(productRef, {
          stock: increment(-item.quantity),
          updatedAt: serverTimestamp()
        });
      }

      setProcessingStep('finalizing_order');
      // 4. Update Coupon (Add to batch)
      if (appliedCoupon) {
        const couponRef = doc(db, 'coupons', appliedCoupon.id);
        batch.update(couponRef, {
          usageCount: increment(1)
        });
      }

      // 5. User Specific Operations (Add to batch)
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        const userUpdateData: any = {
          email: formData.email || null,
          phoneNumber: formData.phone,
          phone: formData.phone,
          addressLine1: formData.addressLine1,
          subDistrict: formData.subDistrict,
          district: formData.district,
          province: formData.province,
          postalCode: formData.postalCode,
          updatedAt: serverTimestamp()
        };

        // Sync with addresses array for UserProfile consistency
        let updatedAddresses = [...savedAddresses];
        const currentAddrData = {
          id: selectedAddressId || Math.random().toString(36).substring(2, 11),
          isDefault: true,
          addressLine1: formData.addressLine1,
          subDistrict: formData.subDistrict,
          district: formData.district,
          province: formData.province,
          postalCode: formData.postalCode,
        };

        if (selectedAddressId) {
          updatedAddresses = updatedAddresses.map(addr => 
            addr.id === selectedAddressId ? currentAddrData : { ...addr, isDefault: false }
          );
        } else {
          // Check if similar address already exists
          const existingAddrIndex = updatedAddresses.findIndex(addr => 
            addr.addressLine1 === formData.addressLine1 && 
            addr.district === formData.district && 
            addr.province === formData.province
          );

          if (existingAddrIndex !== -1) {
            updatedAddresses = updatedAddresses.map((addr, idx) => ({
              ...addr,
              isDefault: idx === existingAddrIndex
            }));
          } else {
            updatedAddresses = updatedAddresses.map(addr => ({ ...addr, isDefault: false }));
            updatedAddresses.push(currentAddrData);
          }
        }
        userUpdateData.addresses = updatedAddresses;

        // Handle points redemption
        if (usePoints && pointsToRedeem > 0) {
          userUpdateData.points = increment(-pointsToRedeem);
          userUpdateData.lastRedeemedOrderId = orderRef.id;
          
          // Log Point Transaction
          const txRef = doc(collection(db, 'pointTransactions'));
          batch.set(txRef, {
            userId: currentUser.uid,
            amount: -pointsToRedeem,
            type: 'redeem',
            description: 'แลกแต้มส่วนลดสำหรับการสั่งซื้อ',
            createdAt: serverTimestamp()
          });
        }

        // Apply User Update
        batch.update(userRef, userUpdateData);

        // Add Notification
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          userId: currentUser.uid,
          title: 'สั่งซื้อสำเร็จ!',
          message: `ออเดอร์ของคุณได้รับเรียบร้อยแล้ว ยอดชำระ ฿${totalAmount.toLocaleString()}`,
          type: 'order',
          status: 'unread',
          createdAt: serverTimestamp()
        });
      }

      // 6. Execute ALL at once
      setProcessingStep('submitting');
      await batch.commit().catch(e => {
        handleFirestoreError(e, OperationType.WRITE, 'batch/order');
        throw e;
      });
      
      setFinalPointsEarned(pointsToEarn);
      setIsSuccess(true);
      clearCart();
      
      if (!currentUser) {
        setShowRegisterPrompt(true);
      } else {
        setTimeout(() => navigate('/'), 5000);
      }
    } catch (error: any) {
      console.error('Error creating order:', error);
      let errorMessage = 'เกิดข้อผิดพลาดในการสั่งซื้อ กรุณาลองใหม่อีกครั้ง';
      
      // Try to parse detailed error if it's our JSON format
      try {
        const errObj = JSON.parse(error.message);
        if (errObj.error && errObj.error.includes('permission')) {
          errorMessage = 'ขออภัย คุณไม่มีสิทธิ์ในการดำเนินการนี้ (Permission Denied) กรุณาตรวจสอบการเข้าสู่ระบบ';
        }
      } catch (e) {
        // Not a JSON error, use default
      }
      
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 min-h-[70vh] flex flex-col justify-center text-center space-y-8">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto"
        >
          <CheckCircle2 size={64} />
        </motion.div>
        <div className="space-y-4">
          <h2 className="text-4xl font-bold text-gray-900">สั่งซื้อสำเร็จ!</h2>
          <div className="max-w-md mx-auto space-y-4">
            <p className="text-gray-500 italic text-sm">
              ขอบคุณที่ไว้วางใจ {settings?.name || 'RumahSekolah'} เราได้รับคำสั่งซื้อของคุณแล้ว
            </p>
            
            {formData.paymentMethod === 'promptpay' && !slipImage && !uploadedSlipUrl && !slipBase64 && (
              <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-orange-800 text-sm font-medium">
                <p>เนื่องจากคุณยังไม่ได้แนบสลิปการโอนเงิน อย่าลืมแจ้งโอนเงินภายหลังได้ที่เมนู <span className="font-bold underline cursor-pointer" onClick={() => navigate('/profile')}>"ข้อมูลส่วนตัว &gt; ประวัติการสั่งซื้อ"</span> เพื่อให้ทางร้านดำเนินการตรวจสอบและเตรียมจัดส่งสินค้า</p>
              </div>
            )}
            
            {(slipImage || uploadedSlipUrl || slipBase64) && (
              <div className="bg-green-50 border border-green-100 p-4 rounded-2xl text-green-800 text-sm font-medium">
                <p>เราได้รับหลักฐานการโอนเงินเรียบร้อยแล้ว ทางร้านจะดำเนินการตรวจสอบและเตรียมจัดส่งสินค้าให้คุณโดยเร็วที่สุด</p>
              </div>
            )}
            
            <p className="text-xs text-gray-400">
              สถานะออเดอร์ปัจจุบัน: <span className="font-bold text-orange-600 uppercase">รอการยืนยัน</span>
            </p>
          </div>
        </div>

        {showRegisterPrompt ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto bg-orange-50 p-8 rounded-[40px] border border-orange-100 space-y-6"
          >
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-orange-900">สมัครสมาชิกเพื่อรับสิทธิพิเศษ?</h3>
              <p className="text-sm text-orange-700">
                สมัครสมาชิกวันนี้เพื่อสะสมแต้มจากการสั่งซื้อ (คุณจะได้รับ <span className="font-bold text-orange-900">{finalPointsEarned} แต้ม</span>จากออเดอร์นี้) และใช้เป็นส่วนลดในครั้งถัดไป!
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => navigate('/login', { state: { email: formData.email, isRegister: true } })}
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
              >
                สมัครสมาชิกเลย
              </button>
              <button 
                onClick={() => navigate('/')}
                className="text-sm text-orange-600 font-medium hover:underline"
              >
                ไว้คราวหน้า, กลับหน้าหลัก
              </button>
            </div>
          </motion.div>
        ) : (
          <p className="text-sm text-gray-400">กำลังพาคุณกลับไปที่หน้าหลักใน 5 วินาที...</p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ชำระเงิน</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipping Info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Saved Addresses Selector */}
          {savedAddresses.length > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center gap-3 text-orange-600 mb-1">
                <MapPin size={18} />
                <h2 className="text-base font-bold text-gray-900">เลือกที่อยู่จากที่บันทึกไว้</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedAddresses.map((addr) => (
                  <div 
                    key={addr.id}
                    onClick={() => handleSelectAddress(addr)}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all relative ${selectedAddressId === addr.id ? 'border-orange-500 bg-orange-50/20' : 'border-gray-50 hover:bg-gray-50'}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-gray-400 font-mono italic">#{addr.id.slice(0, 4)}</span>
                        {addr.isDefault && <span className="text-[9px] font-bold text-orange-600 uppercase border border-orange-100 px-1.5 py-0.5 rounded">Default</span>}
                      </div>
                      <p className="text-xs text-gray-700 line-clamp-2">{addr.addressLine1}</p>
                      <p className="text-[10px] text-gray-500">{addr.subDistrict}, {addr.district}, {addr.province}</p>
                    </div>
                    {selectedAddressId === addr.id && (
                      <div className="absolute top-2 right-2 text-orange-600">
                        <CheckCircle2 size={14} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-orange-600 mb-1">
              <Truck size={18} />
              <h2 className="text-base font-bold text-gray-900">ข้อมูลการจัดส่ง</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ชื่อ-นามสกุล</label>
                <input 
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">เบอร์โทรศัพท์</label>
                <input 
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="08X-XXX-XXXX"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">อีเมล (ถ้ามี)</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="example@email.com"
                />
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ที่อยู่ (บ้านเลขที่, หมู่บ้าน, ถนน)</label>
                <input 
                  required
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({...formData, addressLine1: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="เช่น 123/45 หมู่ 6 ซอย..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">แขวง / ตำบล</label>
                <input 
                  required
                  type="text"
                  value={formData.subDistrict}
                  onChange={(e) => setFormData({...formData, subDistrict: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="ตำบล"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">เขต / อำเภอ</label>
                <input 
                  required
                  type="text"
                  value={formData.district}
                  onChange={(e) => setFormData({...formData, district: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="อำเภอ"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">จังหวัด</label>
                <input 
                  required
                  type="text"
                  value={formData.province}
                  onChange={(e) => setFormData({...formData, province: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                  placeholder="จังหวัด"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">รหัสไปรษณีย์</label>
                <input 
                  required
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm font-mono"
                  placeholder="รหัสไปรษณีย์"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-3 text-orange-600 mb-1">
              <CreditCard size={18} />
              <h2 className="text-base font-bold text-gray-900">วิธีการชำระเงิน</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div 
                onClick={() => setFormData({...formData, paymentMethod: 'promptpay'})}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.paymentMethod === 'promptpay' ? 'border-orange-500 bg-orange-50/20' : 'border-gray-50 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center text-white">
                      <Smartphone size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-xs">โอนเงิน / PromptPay</p>
                      <p className="text-[9px] text-gray-500">โอนผ่านธนาคาร หรือ แสกน QR</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'promptpay' ? 'border-orange-500' : 'border-gray-300'}`}>
                    {formData.paymentMethod === 'promptpay' && <div className="w-2 h-2 bg-orange-500 rounded-full"></div>}
                  </div>
                </div>

                {formData.paymentMethod === 'promptpay' && (
                  <div className="space-y-4 pt-2 border-t border-orange-100">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                      <div className="bg-white p-2 rounded-xl shadow-sm border border-orange-100 shrink-0">
                        <img 
                          src={getGoogleDriveDirectLink(settings?.promptPayQrUrl || "https://drive.google.com/uc?export=view&id=1HzFLR7rGmYFQ4V__0Ej8euvsmqdKoARl")} 
                          alt="PromptPay QR Code"
                          className="w-32 h-auto mx-auto rounded-lg"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="space-y-1.5 flex-grow text-center md:text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">โอนผ่านบัญชีธนาคาร</p>
                        <div className="space-y-1">
                          <p className="text-xs text-gray-500">ธนาคาร: <span className="font-bold text-gray-900">{settings?.bankName || '-'}</span></p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-500">เลขที่บัญชี: <span className="font-bold text-orange-600 font-mono italic">{settings?.accountNumber || '-'}</span></p>
                            {settings?.accountNumber && (
                              <button 
                                type="button"
                                onClick={() => handleCopy(settings.accountNumber, 'account')}
                                className="p-1 hover:bg-orange-100 rounded-md transition-all text-orange-600"
                                title="คัดลอกเลขบัญชี"
                              >
                                {copiedField === 'account' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">ชื่อบัญชี: <span className="font-bold text-gray-900">{settings?.accountName || '-'}</span></p>
                          {settings?.promptPayId && (
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-500">PromptPay ID: <span className="font-bold text-gray-900">{settings.promptPayId}</span></p>
                              <button 
                                type="button"
                                onClick={() => handleCopy(settings.promptPayId, 'promptpay')}
                                className="p-1 hover:bg-orange-100 rounded-md transition-all text-orange-600"
                                title="คัดลอก PromptPay ID"
                              >
                                {copiedField === 'promptpay' ? <Check size={12} /> : <Copy size={12} />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider">แนบหลักฐานการโอนเงิน (สลิป)</label>
                        <span className="text-[9px] text-orange-600 font-bold uppercase tracking-tight italic">ข้ามได้ - แนบภายหลังได้</span>
                      </div>
                      <div className="relative">
                        {!slipImage ? (
                          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-white hover:border-orange-500 transition-all group">
                            <Upload className="w-6 h-6 text-gray-300 group-hover:text-orange-500 mb-1" />
                            <p className="text-xs text-gray-500 group-hover:text-orange-600 font-bold uppercase text-[10px]">อัปโหลดสลิป</p>
                            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                          </label>
                        ) : (
                          <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-100 shadow-sm group">
                            <img src={slipImage} alt="Payment Slip" className="w-full h-full object-contain bg-gray-50 transition-opacity" />
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setSlipImage(null); setUploadedSlipUrl(null); }}
                              className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div 
                onClick={() => setFormData({...formData, paymentMethod: 'cod'})}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex h-fit ${formData.paymentMethod === 'cod' ? 'border-orange-500 bg-orange-50/20' : 'border-gray-50 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center">
                      <Truck size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-xs">เก็บเงินปลายทาง (COD)</p>
                      <p className="text-[9px] text-gray-500">ชำระเงินสดเมื่อได้รับสินค้า</p>
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.paymentMethod === 'cod' ? 'border-orange-500' : 'border-gray-300'}`}>
                    {formData.paymentMethod === 'cod' && <div className="w-2 h-2 bg-orange-500 rounded-full"></div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-xl space-y-5 sticky top-24">
            <h2 className="text-lg font-bold">สรุปยอดชำระ</h2>
            
            <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center text-[11px] gap-2">
                  <span className="text-gray-400 truncate flex-grow italic">{item.name} <span className="text-[10px] not-italic ml-1">x {item.quantity}</span></span>
                  <span className="shrink-0 font-bold">฿{(item.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-800 pt-3 space-y-2.5">
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>ราคารวม</span>
                <span>฿{totalPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>ค่าจัดส่ง</span>
                <span>{shippingFee === 0 ? 'ฟรี' : `฿${shippingFee.toLocaleString()}`}</span>
              </div>
              
              {usePoints && actualPointsDiscount > 0 && (
                <div className="flex justify-between text-[11px] text-orange-400 font-bold italic">
                  <span>ส่วนลดจากแต้ม ({pointsToRedeem} แต้ม)</span>
                  <span>-฿{actualPointsDiscount.toLocaleString()}</span>
                </div>
              )}

              {appliedCoupon && (
                <div className="flex justify-between text-[11px] text-green-400 font-bold italic">
                  <div className="flex items-center gap-1.5">
                    <span>คูปอง ({appliedCoupon.code})</span>
                    <button type="button" onClick={() => setAppliedCoupon(null)} className="text-red-400 hover:text-red-500">
                      <X size={10} />
                    </button>
                  </div>
                  <span>-฿{couponDiscount.toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-between items-end pt-1">
                <span className="font-bold text-sm">ยอดชำระสุทธิ</span>
                <span className="text-xl font-bold text-orange-400">฿{totalAmount.toLocaleString()}</span>
              </div>

              {currentUser && userPoints > 0 && (
                <div className="pt-2">
                  {userPoints >= (settings?.minPointsToRedeem || 0) ? (
                    <label className="flex items-center gap-2 cursor-pointer group p-2 bg-gray-800/50 rounded-xl border border-gray-800">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${usePoints ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-500 group-hover:bg-gray-700'}`}>
                        <Coins size={14} />
                      </div>
                      <div className="flex-grow">
                        <p className="text-[9px] font-bold text-white leading-tight">ใช้แต้มสะสม</p>
                        <p className="text-[8px] text-gray-500">มีอยู่ {userPoints.toLocaleString()} แต้ม</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={usePoints}
                        onChange={(e) => setUsePoints(e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 opacity-50 p-2 bg-gray-800/20 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-gray-800 text-gray-500 flex items-center justify-center">
                        <Coins size={14} />
                      </div>
                      <div className="flex-grow">
                        <p className="text-[9px] font-bold text-white leading-tight">แต้มสะสมไม่พอยังไม่เปิดใช้</p>
                        <p className="text-[8px] text-gray-500">ต้องการขั้นต่ำ {settings?.minPointsToRedeem || 100} แต้ม</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Coupon Input */}
              {!appliedCoupon && (
                <div className="pt-1.5 space-y-1.5">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value)}
                      placeholder="รหัสคูปอง"
                      className="flex-grow bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-[10px] focus:outline-none focus:border-orange-500 transition-all uppercase font-bold"
                    />
                    <button 
                      type="button"
                      onClick={handleApplyCoupon}
                      disabled={isApplyingCoupon || !couponCodeInput.trim()}
                      className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-[10px] font-bold hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isApplyingCoupon ? <Loader2 className="animate-spin" size={12} /> : 'ใช้'}
                    </button>
                  </div>
                  {couponError && <p className="text-[9px] text-red-400 font-bold italic">{couponError}</p>}
                </div>
              )}

              <div className="pt-0.5 text-center">
                <p className="text-[9px] font-bold text-orange-400 italic font-mono">+ จะได้รับ {pointsToEarn.toLocaleString()} แต้มสะสม</p>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 text-xs uppercase tracking-wider"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> 
                  <span className="animate-pulse">
                    {processingStep === 'uploading_slip' ? 'กำลังอัปโหลดสลิป...' : 
                     processingStep === 'creating_order' ? 'กำลังบันทึกคำสั่งซื้อ...' : 
                     processingStep === 'updating_inventory' ? 'กำลังตัดสต็อกสินค้า...' : 
                     processingStep === 'finalizing_profile' ? 'กำลังบันทึกข้อมูลผู้ใช้...' : 'กำลังดำเนินการ...'}
                  </span>
                </>
              ) : (
                <>{totalAmount > 0 ? `ยืนยันการสั่งซื้อ (${formData.paymentMethod === 'promptpay' ? 'โอนเงิน' : 'เก็บเงินปลายทาง'})` : 'ยืนยันการสั่งซื้อ (ฟรี)'}</>
              )}
            </button>
          </div>
        </div>
      </form>
      
      <p className="text-[9px] text-center text-gray-500 mt-6 max-w-sm mx-auto leading-relaxed">
        ข้อมูลการจัดส่งของคุณจะถูกบันทึกไว้ในระบบเพื่อความสะดวกในการสั่งซื้อครั้งถัดไป โดยเป็นไปตามนโยบายความเป็นส่วนตัว
      </p>
    </div>
  );
};

export default Checkout;