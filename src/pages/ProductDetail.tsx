import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Star, ShoppingBag, ArrowLeft, Truck, ShieldCheck, RotateCcw, Gift, X, Share2, ExternalLink, Camera, Send, ImageIcon, MessageSquare, Plus } from 'lucide-react';
import { db, auth } from '../firebase';
import { doc, getDoc, collection, query, where, limit, getDocs, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { useCart } from '../CartContext';
import { toast } from 'sonner';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';
import { compressImageToBase64, compressAndUploadImage } from '../utils/storage';

import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const ProductDetail = ({ settings }: { settings: any }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = useState<any>(null);

  const handleAddToCart = () => {
    addToCart(product);
  };

  const handleShare = () => {
    if (!product) return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `ดูสินค้า ${product.name} ได้ที่นี่!`,
        url: url,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Error sharing:", err);
        }
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('คัดลอกลิงก์สินค้าเรียบร้อยแล้ว!');
    }
  };
  const [activeImage, setActiveImage] = useState<string>('');
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReviewFile(file);
      try {
        const base64 = await compressImageToBase64(file);
        setReviewImage(base64);
      } catch (err) {
        console.error("Error uploading image:", err);
        toast.error('ไม่สามารถอัปโหลดรูปภาพได้');
      }
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      toast.error('กรุณาเข้าสู่ระบบก่อนเขียนรีวิว');
      return;
    }
    if (!reviewText.trim()) {
      toast.error('กรุณาพิมพ์ข้อความรีวิว');
      return;
    }

    setSubmittingReview(true);
    try {
      let finalReviewImageUrl = null;
      if (reviewFile) {
        finalReviewImageUrl = await compressAndUploadImage(reviewFile, 'reviews');
      }

      await addDoc(collection(db, 'reviews'), {
        productId: id,
        uid: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'ลูกค้าทั่วไป',
        userPhoto: auth.currentUser.photoURL || '',
        rating: reviewRating,
        text: reviewText,
        image: finalReviewImageUrl,
        createdAt: serverTimestamp()
      }).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'reviews');
        throw e;
      });

      setReviewText('');
      setReviewImage(null);
      setReviewRating(5);
      setIsReviewing(false);
      toast.success('ขอบคุณสำหรับรีวิวของคุณ!');
      
      // Refresh reviews
      const reviewsQ = query(
        collection(db, 'reviews'),
        where('productId', '==', id),
        orderBy('createdAt', 'desc')
      );
      const reviewsSnap = await getDocs(reviewsQ).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'reviews');
        throw e;
      });
      setProductReviews(reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error submitting review:", err);
      toast.error('เกิดข้อผิดพลาดในการส่งรีวิว');
    } finally {
      setSubmittingReview(false);
    }
  };

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      setLoading(true);
      try {
        // Fetch from Firestore
        const productRef = doc(db, 'products', id);
        const productSnap = await getDoc(productRef).catch(e => {
           handleFirestoreError(e, OperationType.GET, `products/${id}`);
           throw e;
        });
        
        if (productSnap.exists()) {
          const productData = { id: productSnap.id, ...productSnap.data() } as any;
          setProduct(productData);
          setActiveImage(productData.image);
          
          // Fetch related products from Firestore
          const q = query(
            collection(db, 'products'),
            where('category', '==', productData.category),
            limit(5)
          );
          const relatedSnap = await getDocs(q).catch(e => {
             handleFirestoreError(e, OperationType.LIST, 'products');
             throw e;
          });
          const related = relatedSnap.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => p.id !== id)
            .slice(0, 4);
          setRelatedProducts(related);

          // Fetch reviews
          try {
            const reviewsQ = query(
              collection(db, 'reviews'),
              where('productId', '==', id),
              orderBy('createdAt', 'desc')
            );
            const reviewsSnap = await getDocs(reviewsQ).catch(e => {
               handleFirestoreError(e, OperationType.LIST, 'reviews');
               throw e;
            });
            setProductReviews(reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, 'reviews');
          }
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-gray-500 hover:text-orange-600 transition-colors font-medium text-sm"
      >
        <ArrowLeft size={16} /> กลับ
      </button>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
          {/* Image Gallery Skeleton */}
          <div className="space-y-4">
            <div className="rounded-2xl bg-gray-100 aspect-square w-full" />
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-100 rounded-lg" />
              ))}
            </div>
          </div>

          {/* Details Skeleton */}
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 rounded-lg w-1/4" />
              <div className="h-8 bg-gray-200 rounded-lg w-3/4" />
              <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
            </div>

            <div className="p-4 bg-gray-100 rounded-2xl space-y-3">
              <div className="h-6 bg-gray-200 rounded-lg w-1/2" />
              <div className="h-4 bg-gray-200 rounded-lg w-1/4" />
            </div>

            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded-lg w-full" />
              <div className="h-4 bg-gray-200 rounded-lg w-full" />
              <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
            </div>

            <div className="flex gap-4 pt-4">
              <div className="h-12 bg-gray-200 rounded-2xl w-1/2" />
              <div className="h-12 bg-gray-200 rounded-2xl w-1/2" />
            </div>
          </div>
        </div>
      ) : !product ? (
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900">ไม่พบสินค้า</h2>
          <Link to="/shop" className="mt-4 text-orange-600 font-bold inline-block">กลับไปที่ร้านค้า</Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="rounded-2xl overflow-hidden bg-white border border-gray-100 aspect-square relative"
          >
            <img 
              src={getGoogleDriveDirectLink(activeImage)} 
              alt={product.name} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {product.discountPrice && (
              <div className="absolute top-4 left-4 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-lg z-10">
                ลด {Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
              </div>
            )}
          </motion.div>
          
          {product.images && product.images.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              <button 
                onClick={() => setActiveImage(product.image)}
                className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${activeImage === product.image ? 'border-orange-500' : 'border-transparent'}`}
              >
                <img src={getGoogleDriveDirectLink(product.image)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </button>
              {product.images.map((img: string, idx: number) => (
                <button 
                  key={idx}
                  onClick={() => setActiveImage(img)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${activeImage === img ? 'border-orange-500' : 'border-transparent'}`}
                >
                  <img src={getGoogleDriveDirectLink(img)} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
              {product.category}
            </span>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 leading-tight">{product.name}</h1>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-0.5 text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} size={14} fill={i < Math.floor(product.rating) ? "currentColor" : "none"} />
                ))}
                <span className="ml-1.5 text-gray-900 font-bold text-xs">{product.rating}</span>
              </div>
              <span className="text-gray-400 text-[10px]">({product.reviews} รีวิว)</span>
            </div>
            <div className="flex items-baseline gap-3">
              {product.discountPrice ? (
                <>
                  <p className="text-3xl lg:text-4xl font-bold text-orange-600">฿{product.discountPrice.toLocaleString()}</p>
                  <p className="text-lg text-gray-400 line-through font-medium">฿{product.price.toLocaleString()}</p>
                  <span className="bg-red-100 text-red-600 px-1.5 py-0.5 rounded-lg text-[10px] font-bold">
                    ลด {Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
                  </span>
                </>
              ) : (
                <p className="text-3xl lg:text-4xl font-bold text-orange-600">฿{product.price.toLocaleString()}</p>
              )}
            </div>
          </div>

          <p className="text-gray-600 leading-relaxed text-sm lg:text-base">
            {product.description}
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={handleAddToCart}
              className="flex-grow bg-orange-600 hover:bg-orange-700 text-white px-5 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-600/20 text-xs"
            >
              <Plus size={16} strokeWidth={3} />
              <ShoppingBag size={16} /> เพิ่มลงในตะกร้า
            </motion.button>
            <motion.button 
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleShare}
              className="px-2.5 py-2 bg-gray-50 text-gray-600 hover:bg-gray-100 rounded-xl font-bold flex items-center justify-center transition-all border border-gray-100"
              title="แชร์สินค้านี้"
            >
              <Share2 size={16} />
            </motion.button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-gray-100">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-50 rounded-xl text-orange-600 flex-shrink-0">
                <Truck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">
                  {settings?.feature1Title || (settings?.freeShippingThreshold ? `ส่งฟรีเมื่อช้อปครบ ฿${settings.freeShippingThreshold.toLocaleString()}` : 'ส่งฟรีเมื่อช้อปครบ ฿999')}
                </h4>
                <p className="text-[10px] text-gray-500 mt-0.5">{settings?.feature1Desc || 'บริการจัดส่งฟรีทั่วประเทศ'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-50 rounded-xl text-orange-600 flex-shrink-0">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">{settings?.feature2Title || 'รับประกันสินค้าแท้'}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">{settings?.feature2Desc || 'มั่นใจได้ในคุณภาพสินค้า 100%'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-50 rounded-xl text-orange-600 flex-shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">{settings?.feature3Title || 'คืนสินค้าได้ใน 7 วัน'}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">{settings?.feature3Desc || 'หากไม่พอใจ ยินดีคืนเงิน'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-50 rounded-xl text-orange-600 flex-shrink-0">
                <Star size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-xs">{settings?.feature4Title || 'คะแนนรีวิว 4.9/5'}</h4>
                <p className="text-[10px] text-gray-500 mt-0.5">{settings?.feature4Desc || 'จากลูกค้าผู้ใช้งานจริงทั่วประเทศ'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="space-y-4 pt-8 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">สินค้าที่เกี่ยวข้อง</h2>
            <Link to="/shop" className="text-xs font-bold text-orange-600 hover:underline">ดูทั้งหมด</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {relatedProducts.map((p) => (
              <motion.div 
                key={p.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all"
              >
                <Link to={`/product/${p.id}`} className="block relative aspect-square overflow-hidden bg-gray-50">
                  <img src={getGoogleDriveDirectLink(p.image)} alt={p.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  {p.discountPrice && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white px-1.5 py-0.5 rounded-lg text-[9px] font-bold shadow-lg z-10">
                      -{Math.round(((p.price - p.discountPrice) / p.price) * 100)}%
                    </div>
                  )}
                </Link>
                <div className="p-3">
                  <Link to={`/product/${p.id}`} className="text-sm font-bold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1">{p.name}</Link>
                  <div className="flex items-center gap-1.5 mt-1">
                    {p.discountPrice ? (
                      <>
                        <p className="text-orange-600 font-bold text-sm">฿{p.discountPrice.toLocaleString()}</p>
                        <p className="text-gray-400 text-[10px] line-through">฿{p.price.toLocaleString()}</p>
                      </>
                    ) : (
                      <p className="text-orange-600 font-bold text-sm">฿{p.price.toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Product Reviews */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">รีวิวจากลูกค้า ({productReviews.length})</h2>
          {productReviews.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    size={14} 
                    className={i < Math.round(productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length) ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-300'} 
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-gray-900">
                {(productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length).toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {productReviews.length === 0 ? (
          <div className="bg-gray-50 p-8 rounded-2xl text-center space-y-1">
            <p className="text-gray-500 font-medium text-xs">ยังไม่มีรีวิวสำหรับสินค้านี้</p>
            <p className="text-[10px] text-gray-400">เป็นคนแรกที่รีวิวสินค้านี้หลังจากได้รับสินค้า!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productReviews.map((review) => (
              <motion.div 
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold overflow-hidden text-xs">
                      {review.userPhoto ? (
                        <img src={review.userPhoto} alt={review.userName} className="w-full h-full object-cover" />
                      ) : (
                        review.userName.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">{review.userName}</p>
                      <p className="text-[9px] text-gray-400">{review.createdAt?.toDate().toLocaleDateString('th-TH')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        size={10} 
                        className={i < review.rating ? 'fill-yellow-400 stroke-yellow-400' : 'stroke-gray-200'} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed italic">"{review.text}"</p>
                {review.image && (
                  <div className="mt-2 rounded-lg overflow-hidden border border-gray-100 max-w-[150px]">
                    <img src={review.image} alt="Review" className="w-full h-auto object-cover" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Add Review Section */}
        <div className="mt-6 border-t border-gray-100 pt-6">
          {!isReviewing ? (
            <button 
              onClick={() => setIsReviewing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-bold text-xs hover:bg-orange-100 transition-all"
            >
              <MessageSquare size={14} /> เขียนรีวิวของคุณ
            </button>
          ) : (
            <motion.form 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSubmitReview}
              className="bg-gray-50 p-6 rounded-[32px] border border-orange-100 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-gray-900">ให้คะแนนสินค้า</h3>
                <button 
                  type="button"
                  onClick={() => setIsReviewing(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setReviewRating(star)}
                    className={`transition-all ${star <= reviewRating ? 'text-yellow-400 scale-110' : 'text-gray-300'}`}
                  >
                    <Star size={24} fill={star <= reviewRating ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <textarea 
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder="บอกเล่าความประทับใจของคุณ..."
                  className="w-full p-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs min-h-[100px] transition-all"
                />
                
                <div className="flex flex-wrap items-center gap-3">
                  <input 
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-bold text-gray-500 hover:bg-gray-50 transition-all"
                  >
                    <Camera size={14} />
                    {reviewImage ? 'เปลี่ยนรูปภาพ' : 'เพิ่มรูปภาพจริง'}
                  </button>

                  {reviewImage && (
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-orange-200">
                      <img src={reviewImage} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setReviewImage(null)}
                        className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit"
                disabled={submittingReview}
                className={`w-full py-3 bg-orange-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-orange-600/20 transition-all flex items-center justify-center gap-2 ${submittingReview ? 'opacity-70' : 'hover:bg-orange-700'}`}
              >
                {submittingReview ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Send size={16} /> ส่งคำวิจารณ์
                  </>
                )}
              </button>
            </motion.form>
          )}
        </div>
      </section>

        </>
      )}
    </div>
  );
};

export default ProductDetail;