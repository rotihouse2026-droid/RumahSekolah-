import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Search, ShoppingBag, Star, Filter, Share2, Eye, Plus } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, where } from 'firebase/firestore';
import { useCart } from '../CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';

import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const Shop = ({ settings, categories: initialCategories }: { settings: any, categories: any[] }) => {
  const { addToCart, productsCache, setProductsCache } = useCart();
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>(productsCache);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(productsCache.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const PAGE_SIZE = 12;

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setCategories(['All', ...initialCategories.map(c => c.name)]);
    }
  }, [initialCategories]);

  useEffect(() => {
    fetchFromFirestore(true);
  }, [selectedCategory]); // Re-fetch when category changes to handle server-side filtering easily

  const fetchFromFirestore = async (isInitial = false) => {
    if (isInitial) {
      if (products.length === 0) {
        setLoading(true);
      }
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(collection(db, 'products'), orderBy('name', 'asc'), limit(PAGE_SIZE));
      
      if (selectedCategory !== 'All') {
        q = query(collection(db, 'products'), where('category', '==', selectedCategory), orderBy('name', 'asc'), limit(PAGE_SIZE));
      }

      if (!isInitial && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const productSnapshot = await getDocs(q).catch(e => {
        handleFirestoreError(e, OperationType.LIST, 'products');
        throw e;
      });
      const productData = productSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isInitial) {
        setProducts(productData);
        setProductsCache(productData);
      } else {
        setProducts(prev => {
          const combined = [...prev, ...productData];
          const seen = new Set();
          return combined.filter(item => {
            const isDuplicate = seen.has(item.id);
            seen.add(item.id);
            return !isDuplicate;
          });
        });
      }

      setLastDoc(productSnapshot.docs[productSnapshot.docs.length - 1] || null);
      setHasMore(productSnapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleShare = (productName: string, productId: string) => {
    const url = `${window.location.origin}/product/${productId}`;
    if (navigator.share) {
      navigator.share({
        title: productName,
        text: `ดูสินค้า ${productName} ได้ที่นี่!`,
        url: url,
      }).catch((err) => {
        if (err.name !== 'AbortError') {
          console.error("Error sharing:", err);
        }
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('คัดลอกลิงก์สินค้าเรียบร้อยแล้ว!');
    }
  };

  const handleAddToCart = (product: any) => {
    addToCart(product);
  };

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">ร้านค้า</h1>
          <p className="text-gray-400 mt-1 text-[10px] sm:text-xs font-medium italic">ศูนย์รวมสินค้าคุณภาพเพื่อการศึกษา</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <div className="relative flex-grow sm:flex-none sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input 
              type="text" 
              placeholder="ค้นหา..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 w-full text-[12px] font-bold transition-all shadow-sm"
            />
          </div>
          
          <div className="flex overflow-x-auto pb-1 gap-1.5 no-scrollbar scroll-smooth">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  selectedCategory === cat 
                    ? 'bg-orange-600 text-white border-orange-600 shadow-md shadow-orange-600/20' 
                    : 'bg-white text-gray-500 border-gray-100 hover:border-orange-200'
                }`}
              >
                {cat === 'All' ? 'ทั้งหมด' : cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {loading ? (
          Array.from({ length: 8 }).map((_, idx) => (
            <div key={`skeleton-${idx}`} className="bg-white rounded-xl overflow-hidden border border-gray-100 animate-pulse h-fit">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 sm:p-4 space-y-2">
                <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
                <div className="h-4 bg-gray-100 rounded-lg w-3/4 animate-pulse" />
                <div className="flex items-center justify-between gap-1.5 pt-1">
                  <div className="h-5 bg-gray-100 rounded-lg w-1/2" />
                  <div className="w-10 h-10 bg-gray-100 rounded-xl shrink-0" />
                </div>
                <div className="h-8 bg-gray-100 rounded-xl w-full" />
              </div>
            </div>
          ))
        ) : (
          filteredProducts.map((product) => (
          <motion.div 
            layout
            key={product.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-all h-fit"
          >
            <Link to={`/product/${product.id}`} className="block relative aspect-square overflow-hidden">
              <img 
                src={getGoogleDriveDirectLink(product.image)} 
                alt={product.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              {product.discountPrice && (
                <div className="absolute top-2 left-2 bg-red-600 text-white px-2 py-0.5 rounded-lg text-[10px] font-bold shadow-lg z-10">
                  -{Math.round(((product.price - product.discountPrice) / product.price) * 100)}%
                </div>
              )}
              <div className="absolute top-2 right-2 flex flex-col gap-1.5">
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
            <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
              <div>
                <p className="text-[10px] sm:text-[11px] text-orange-600 font-bold uppercase tracking-widest mb-0.5">{product.category}</p>
                <Link to={`/product/${product.id}`} className="text-[13px] sm:text-base font-bold text-gray-900 hover:text-orange-600 transition-colors line-clamp-1 leading-tight">
                  {product.name}
                </Link>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex flex-col">
                    {product.discountPrice ? (
                      <>
                        <span className="text-sm sm:text-lg font-extrabold text-orange-600">฿{product.discountPrice.toLocaleString()}</span>
                        <span className="text-[10px] sm:text-xs text-gray-400 line-through leading-none">฿{product.price.toLocaleString()}</span>
                      </>
                    ) : (
                      <span className="text-sm sm:text-lg font-extrabold text-gray-900">฿{product.price.toLocaleString()}</span>
                    )}
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => handleAddToCart(product)}
                    className="p-2 bg-orange-600 text-white hover:bg-orange-700 rounded-xl transition-all shrink-0 shadow-md shadow-orange-600/20"
                    title="เพิ่มลงในตะกร้า"
                  >
                    <div className="flex items-center gap-0.5">
                      <Plus size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                      <ShoppingBag size={18} className="sm:w-5 sm:h-5" />
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
        )))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-8">
          <button 
            onClick={() => fetchFromFirestore(false)}
            disabled={loadingMore}
            className="px-8 py-3 bg-white text-orange-600 border border-orange-100 rounded-2xl font-bold text-sm shadow-sm hover:shadow-md hover:bg-orange-50 transition-all disabled:opacity-50"
          >
            {loadingMore ? 'กำลังโหลด...' : 'ดูสินค้าเพิ่มเติม'}
          </button>
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="text-center py-20">
          <p className="text-gray-500 text-lg">ไม่พบสินค้าที่คุณกำลังค้นหา</p>
          <button 
            onClick={() => {setSelectedCategory('All'); setSearchQuery('');}}
            className="mt-4 text-orange-600 font-bold hover:underline"
          >
            ล้างการค้นหา
          </button>
        </div>
      )}
    </div>
  );
};

export default Shop;