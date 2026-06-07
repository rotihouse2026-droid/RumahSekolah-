import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, ShopSettings, Product } from './types';
import { db } from './firebase';
import { doc, onSnapshot, collection, query, orderBy, getDocs } from 'firebase/firestore';

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  removeBulkFromCart: (productIds: string[]) => void;
  totalPrice: number;
  settings: ShopSettings | null;
  loadingSettings: boolean;
  categories: any[];
  productsCache: any[];
  setProductsCache: React.Dispatch<React.SetStateAction<any[]>>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const defaultSettings: ShopSettings = {
  name: "RumahSekolah",
  description: "แพลตฟอร์มอีคอมเมิร์ซที่ทันสมัยและครบวงจร พร้อมระบบจัดการสินค้าและชำระเงินที่ปลอดภัย",
  logoUrl: "/icon.svg",
  promptPayQrUrl: "",
  banner0: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200",
  banner1: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1200",
  banner2: "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1200",
  lineLink: "https://line.me",
  phone: "081-234-5678",
  bankName: "กสิกรไทย (K-Bank)",
  bankAccountNo: "123-4-56789-0",
  bankAccountName: "สมชาย รักดี"
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const local = localStorage.getItem('rumahsekolah_cart');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id);
        }
      }
    } catch (e) {
      console.error("Failed to parse cart localstorage:", e);
    }
    return [];
  });
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [productsCache, setProductsCache] = useState<any[]>([]);

  // Sync cart to local storage
  useEffect(() => {
    localStorage.setItem('rumahsekolah_cart', JSON.stringify(cart));
  }, [cart]);

  // Load settings from Firebase in real-time
  useEffect(() => {
    const shopDocRef = doc(db, 'settings', 'shop');
    const unsub = onSnapshot(shopDocRef, (shopSnap) => {
      if (shopSnap.exists()) {
        setSettings({ ...defaultSettings, ...shopSnap.data() as ShopSettings });
      } else {
        setSettings(defaultSettings);
      }
      setLoadingSettings(false);
    }, (err) => {
      console.error("Failed to load settings in real-time:", err);
      setSettings(defaultSettings);
      setLoadingSettings(false);
    });
    return unsub;
  }, []);

  // Load categories from Firebase
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesRef = collection(db, 'categories');
        const q = query(categoriesRef, orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (cats.length > 0) {
          setCategories(cats);
        } else {
          setCategories([
            { id: 'cat-1', name: 'ปากกาและเครื่องเขียน' },
            { id: 'cat-2', name: 'สมุดและกระดาษ' },
            { id: 'cat-3', name: 'อุปกรณ์ศิลปะ' },
            { id: 'cat-4', name: 'กระเป๋าและกล่องดินสอ' },
            { id: 'cat-5', name: 'อุปกรณ์' }
          ]);
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
        setCategories([
          { id: 'cat-1', name: 'ปากกาและเครื่องเขียน' },
          { id: 'cat-2', name: 'สมุดและกระดาษ' },
          { id: 'cat-3', name: 'อุปกรณ์ศิลปะ' },
          { id: 'cat-4', name: 'กระเป๋าและกล่องดินสอ' },
          { id: 'cat-5', name: 'อุปกรณ์' }
        ]);
      }
    };
    fetchCategories();
  }, []);

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      }
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.min(quantity, product.stock),
        image: product.image,
        category: product.category
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item =>
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setCart([]);

  const removeBulkFromCart = (productIds: string[]) => {
    setCart(prev => prev.filter(item => !productIds.includes(item.id)));
  };

  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      removeBulkFromCart,
      totalPrice,
      settings,
      loadingSettings,
      categories,
      productsCache,
      setProductsCache
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};
