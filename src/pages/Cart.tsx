import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft } from 'lucide-react';
import { useCart } from '../CartContext';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';

const Cart = ({ settings }: { settings: any }) => {
  const { cart, removeFromCart, updateQuantity, totalPrice } = useCart();

  if (cart.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center space-y-6">
        <div className="w-24 h-24 bg-violet-50 rounded-full flex items-center justify-center text-violet-600 mx-auto">
          <ShoppingBag size={48} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900">ตะกร้าสินค้าว่างเปล่า</h2>
        <p className="text-gray-500 max-w-md mx-auto">ดูเหมือนว่าคุณยังไม่ได้เลือกสินค้าใดๆ ลงในตะกร้า ลองไปเลือกดูสินค้าที่เราแนะนำสิ!</p>
        <Link 
          to="/shop" 
          className="inline-flex items-center gap-2 bg-orange-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
        >
          ไปที่ร้านค้า <ArrowRight size={20} />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">ตะกร้าสินค้า</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {cart.map((item) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  key={item.id}
                  className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-6 shadow-xl shadow-gray-200/30 group hover:border-violet-200 transition-all"
                >
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-50 ring-4 ring-gray-50">
                    <img src={getGoogleDriveDirectLink(item.image)} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                  </div>
                  
                  <div className="flex-grow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="min-w-0 flex-grow">
                      <h3 className="text-sm font-bold text-gray-900 group-hover:text-violet-600 transition-colors uppercase tracking-tight truncate">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">{item.category}</span>
                        <p className="text-violet-600 font-black text-sm">฿{item.price.toLocaleString()}</p>
                      </div>
                    </div>
  
                    <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 pt-3 sm:pt-0 border-gray-50">
                      <div className="flex items-center bg-gray-100/50 rounded-2xl p-1 border border-gray-100 shadow-inner scale-90 sm:scale-100">
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-500 hover:text-violet-600 hover:scale-110 transition-all active:scale-95 disabled:opacity-30"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center font-black text-gray-900 text-xs">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white rounded-xl shadow-sm text-gray-500 hover:text-violet-600 hover:scale-110 transition-all active:scale-95"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="hidden sm:block text-right">
                          <p className="text-[9px] text-gray-400 font-bold uppercase leading-none mb-1">รวม</p>
                          <p className="text-xs font-black text-gray-900 leading-none">฿{(item.price * item.quantity).toLocaleString()}</p>
                        </div>
                        <button 
                          onClick={() => removeFromCart(item.id)}
                          className="w-10 h-10 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                          title="ลบสินค้า"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          <Link to="/shop" className="inline-flex items-center gap-2 text-violet-600 font-bold hover:underline mt-6 text-sm">
            <ArrowLeft size={16} /> เลือกสินค้าเพิ่มเติม
          </Link>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5 sticky top-24">
            <h2 className="text-lg font-bold text-gray-900">สรุปคำสั่งซื้อ</h2>
            
            <div className="space-y-3 text-xs">
              <div className="flex justify-between text-gray-500">
                <span>ราคารวมสินค้า</span>
                <span className="text-gray-900 font-medium">฿{(totalPrice || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>ค่าจัดส่ง</span>
                <span className="text-violet-600 font-medium">
                  {totalPrice >= (Number(settings?.freeShippingThreshold) || 999) ? 'ฟรี' : `฿${Number(settings?.shippingFee) || 50}`}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between items-end">
                <span className="text-gray-900 font-bold text-base">ยอดชำระรวม</span>
                <span className="text-2xl font-bold text-violet-600">
                  ฿{(totalPrice + (totalPrice >= (Number(settings?.freeShippingThreshold) || 999) ? 0 : (Number(settings?.shippingFee) || 50))).toLocaleString()}
                </span>
              </div>
            </div>

            <Link 
              to="/checkout" 
              className="block w-full bg-orange-600 text-white text-center py-3.5 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 text-sm"
            >
              ดำเนินการชำระเงิน
            </Link>
            
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400">
              <ShoppingBag size={12} />
              <span>ชำระผ่าน PromptPay / โอนเงิน</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Cart;