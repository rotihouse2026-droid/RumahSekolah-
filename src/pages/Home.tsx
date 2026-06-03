import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Star, ShoppingBag, Truck, ShieldCheck, Clock, Share2, Eye, Plus } from 'lucide-react';
import Logo from '../components/Logo';
import { toast } from 'sonner';
import { db } from '../firebase';
import { collection, query, limit, getDocs, orderBy } from 'firebase/firestore';
import { useCart } from '../CartContext';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';

import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const Home = ({ settings, categories: initialCategories }: { settings: any, categories: any[] }) => {
  const { addToCart } = useCart();
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  const banners = [
    {
      image: settings?.banner1 || settings?.heroImage || "https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?auto=format&fit=crop&q=80&w=2000",
      tag: settings?.heroTag1 || settings?.heroTag || 'คอลเลกชันใหม่ 2026',
      title: settings?.heroTitle1 || settings?.heroTitle || 'เตรียมพร้อมสำหรับการเรียนรู้ที่ดีกว่า',
      subtitle: settings?.heroSubtitle1 || settings?.heroSubtitle || `ค้นพบอุปกรณ์การเรียนคุณภาพพรีเมียมจาก ${settings?.name || 'RumahSekolah'}`
    },
    {
      image: settings?.banner2 || "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=2000",
      tag: settings?.heroTag2 || 'โปรโมชั่นพิเศษ',
      title: settings?.heroTitle2 || 'ลดกระหน่ำรับเปิดเทอม',
      subtitle: settings?.heroSubtitle2 || 'พบกับดีลที่ดีที่สุดสำหรับน้องๆ ทุกคน'
    },
    {
      image: settings?.banner3 || "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&q=80&w=2000",
      tag: settings?.heroTag3 || 'สินค้าใหม่ล่าสุด',
      title: settings?.heroTitle3 || 'อุปกรณ์ไอทีเพื่อการศึกษา',
      subtitle: settings?.heroSubtitle3 || 'เทคโนโลยีล้ำสมัย ช่วยให้การเรียนสนุกยิ่งขึ้น'
    }
  ];

  const finalBanners = banners;

  useEffect(() => {
    if (finalBanners.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % finalBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [finalBanners.length]);

  useEffect(() => {

    if (initialCategories && initialCategories.length > 0) {
      const catData = initialCategories.map((cat, idx) => {
        const name = cat.name;
        const icons: Record<string, string> = {
          'เครื่องเขียน': '✏️',
          'กระเป๋า': '🎒',
          'ชุดนักเรียน': '👔',
          'หนังสือ': '📖',
          'ใบงาน': '📝',
          'Stationery': '✏️',
          'Bags': '🎒',
          'Uniform': '👔',
          'Books': '📖',
          'Digital': '💾'
        };
        const colors = [
          'bg-blue-100 text-blue-600',
          'bg-violet-100 text-violet-600',
          'bg-orange-100 text-orange-600',
          'bg-purple-100 text-purple-600',
          'bg-pink-100 text-pink-600',
          'bg-green-100 text-green-600',
          'bg-red-100 text-red-600',
          'bg-yellow-100 text-yellow-600'
        ];
        return {
          name,
          icon: icons[name] || '📦',
          color: colors[idx % colors.length]
        };
      });
      setCategories(catData);
    }
  }, [initialCategories]);

  const handleShare = (productName: string, productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    if (navigator.share) {
      navigator.share({
        title: productName,
        text: `ดูสินค้า ${productName} ได้ที่นี่!`,
        url: url,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      toast.success('คัดลอกลิงก์สินค้าเรียบร้อยแล้ว!');
    }
  };
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Featured Products (Keep this as it is specific to Home)
        const q = query(collection(db, 'products'), limit(8));
        const snapshot = await getDocs(q).catch(e => {
          handleFirestoreError(e, OperationType.LIST, 'products');
          throw e;
        });
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeaturedProducts(data);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'products');
      }
    };

    fetchData();
  }, []);

  const reviews = [
    { name: 'คุณสมชาย', text: 'สินค้าคุณภาพดีมาก กระเป๋าทนทานสุดๆ ลูกชายชอบมากครับ', rating: 5 },
    { name: 'คุณวิภา', text: 'ส่งของไวมาก แพ็คมาอย่างดี เครื่องเขียนน่ารักทุกชิ้นเลย', rating: 5 },
    { name: 'คุณกิตติ', text: 'ราคาคุ้มค่ากับคุณภาพ แนะนำแบรนด์นี้เลยครับ ไม่ผิดหวัง', rating: 4 },
  ];

  return (
    <div className="space-y-12 pb-12">
      {/* Hero Slider / Banner */}
      <section className="relative h-[450px] md:h-[550px] overflow-hidden bg-orange-900 group">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
          >
            <div className="absolute inset-0 bg-black/40 z-10" />
            <img 
              src={getGoogleDriveDirectLink(finalBanners[currentSlide].image)} 
              alt="Hero Background" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-20 max-w-7xl mx-auto px-4 h-full flex items-center">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentSlide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl text-white space-y-4"
            >
              <span className="inline-block px-3 py-1 rounded-full bg-orange-500/50 backdrop-blur-sm border border-orange-400/30 text-orange-50 text-[10px] font-bold uppercase tracking-widest">
                {finalBanners[currentSlide].tag}
              </span>
              <h1 className="text-3xl md:text-5xl lg:text-7xl font-bold leading-tight drop-shadow-md">
                {finalBanners[currentSlide].title}
              </h1>
              <p className="text-base lg:text-xl text-white/90 max-w-lg drop-shadow-sm font-medium">
                {finalBanners[currentSlide].subtitle}
              </p>
              <div className="flex flex-wrap gap-3 pt-4">
                <Link 
                  to="/shop" 
                  className="px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl font-bold text-sm transition-all flex items-center gap-2 shadow-xl shadow-orange-600/30 active:scale-95"
                >
                  ช้อปเลย <ArrowRight size={18} />
                </Link>
                <Link 
                  to="/contact" 
                  className="px-8 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white border border-white/30 rounded-2xl font-bold text-sm transition-all active:scale-95"
                >
                  ติดต่อสอบถาม
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Indicators */}
        {finalBanners.length > 1 && (
          <div className="absolute bottom-10 left-0 right-0 z-30 flex justify-center gap-3">
            {finalBanners.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`transition-all duration-300 rounded-full h-2 ${
                  currentSlide === idx ? 'w-8 bg-orange-500 shadow-lg shadow-orange-500/50' : 'w-2 bg-white/50 hover:bg-white'
                }`}
              />
            ))}
          </div>
        )}
      </section>


      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl lg:text-4xl font-bold text-gray-900">เลือกช้อปตามหมวดหมู่</h2>
          <p className="text-gray-500 mt-1 text-sm">ค้นหาสิ่งที่คุณต้องการได้ง่ายๆ</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.name}
              whileHover={{ y: -2 }}
              className={`${cat.color} p-4 rounded-xl text-center cursor-pointer transition-all shadow-sm hover:shadow-md`}
            >
              <span className="text-2xl mb-2 block">{cat.icon}</span>
              <h3 className="font-bold text-[11px] truncate uppercase tracking-wider">{cat.name}</h3>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-2xl lg:text-4xl font-bold text-gray-900">สินค้าแนะนำ</h2>
            <p className="text-gray-500 mt-1 text-sm">สินค้าขายดีที่ทุกคนต้องมี</p>
          </div>
          <Link to="/shop" className="text-orange-600 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
            ดูทั้งหมด <ArrowRight size={16} />
          </Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {featuredProducts.map((product) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all"
            >
              <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden">
                <img 
                  src={getGoogleDriveDirectLink(product.image)} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                {product.discountPrice && (
                  <div className="absolute top-3 left-3 bg-red-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-lg z-10">
                    -{Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
                  </div>
                )}
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  <div className="bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-lg flex items-center gap-1 text-[10px] font-bold text-gray-700">
                    <Star size={10} className="text-yellow-400 fill-yellow-400" />
                    {product.rating}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      handleShare(product.name, product.id);
                    }}
                    className="bg-white/90 backdrop-blur-sm p-1.5 rounded-lg text-gray-700 hover:text-orange-600 transition-colors shadow-sm"
                    title="แชร์สินค้า"
                  >
                    <Share2 size={12} />
                  </button>
                </div>
              </Link>
              <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                <div>
                  <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-0.5">{product.category}</p>
                  <Link to={`/product/${product.id}`} className="text-sm sm:text-base font-bold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1">
                    {product.name}
                  </Link>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      {product.discountPrice ? (
                        <>
                          <span className="text-base sm:text-lg font-bold text-orange-600 leading-tight">฿{product.discountPrice.toLocaleString()}</span>
                          <span className="text-[9px] text-gray-400 line-through">฿{product.price.toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="text-base sm:text-lg font-bold text-gray-900 leading-tight">฿{product.price.toLocaleString()}</span>
                      )}
                    </div>
                    <motion.button 
                      whileTap={{ scale: 0.9 }}
                      whileHover={{ scale: 1.1 }}
                      onClick={() => addToCart(product)}
                      className="p-2 sm:p-2.5 bg-orange-600 text-white hover:bg-orange-700 rounded-xl transition-all shadow-md shadow-orange-600/20"
                    >
                      <div className="flex items-center gap-0.5">
                        <Plus size={12} strokeWidth={3} />
                        <ShoppingBag size={16} />
                      </div>
                    </motion.button>
                  </div>
                  <Link 
                    to={`/product/${product.id}`}
                    className="w-full py-2 bg-gray-50 text-gray-700 hover:bg-orange-50 hover:text-orange-600 rounded-xl text-center text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Eye size={14} /> รายละเอียดสินค้า
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-orange-50 py-12">
        <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { icon: <Truck size={20} />, title: settings?.feature1Title || 'ส่งฟรีทั่วไทย', desc: settings?.feature1Desc || `เมื่อครบ ${settings?.freeShippingThreshold || 999} ฿` },
            { icon: <ShieldCheck size={20} />, title: settings?.feature2Title || 'รับประกันคุณภาพ', desc: settings?.feature2Desc || 'แท้ 100%' },
            { icon: <Clock size={20} />, title: settings?.feature3Title || 'ส่งไวใน 24 ชม.', desc: settings?.feature3Desc || 'รวดเร็ว ทันใจ' },
            { icon: <Star size={20} />, title: settings?.feature4Title || 'รีวิว 4.9/5', desc: settings?.feature4Desc || 'จากลูกค้า 10,000+' },
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center text-center space-y-2">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm">
                {item.icon}
              </div>
              <h4 className="font-bold text-gray-900 text-sm">{item.title}</h4>
              <p className="text-[10px] text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900">เสียงจากลูกค้า</h2>
          <p className="text-gray-500 mt-1 text-sm">ความประทับใจจริง</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {reviews.map((review, idx) => (
            <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm italic text-gray-600 relative">
              <div className="flex text-yellow-400 mb-3">
                {[...Array(review.rating)].map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
              </div>
              <p className="mb-4 text-sm leading-relaxed">"{review.text}"</p>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs">
                  {review.name[0]}
                </div>
                <span className="font-bold text-gray-900 not-italic text-sm">{review.name}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;