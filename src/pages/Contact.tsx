import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

const Contact = ({ settings }: { settings: any }) => {
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await addDoc(collection(db, 'contacts'), {
        ...formData,
        createdAt: serverTimestamp()
      }).catch(e => {
        handleFirestoreError(e, OperationType.CREATE, 'contacts');
        throw e;
      });
      setIsSuccess(true);
      setFormData({ name: '', email: '', phone: '', message: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contacts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Contact Info */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">ติดต่อเรา</h1>
            <p className="text-gray-500 text-sm italic leading-relaxed">เราพร้อมรับฟังทุกความคิดเห็นและคำถามของคุณ</p>
          </div>

          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center text-violet-600 flex-shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">อีเมล</h3>
                <p className="text-xs text-gray-500">{settings?.email || 'support@rumahsekolah.com'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 flex-shrink-0">
                <Phone size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">เบอร์โทรศัพท์</h3>
                <p className="text-xs text-gray-500">{settings?.phone || '061-194-8570'}</p>
                <p className="text-xs text-gray-400">{settings?.workingHours || 'จันทร์ - ศุกร์ (09:00 - 18:00)'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 flex-shrink-0">
                <MapPin size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">ที่อยู่</h3>
                <p className="text-[11px] text-gray-500 whitespace-pre-wrap">{settings?.address || '123 อาคารเรียนรู้ ชั้น 5 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110'}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-600 flex-shrink-0">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M24 10.304c0-5.231-5.383-9.486-12-9.486s-12 4.255-12 9.486c0 4.69 4.27 8.613 10.046 9.348.392.085.923.258 1.058.592.121.301.079.771.038 1.074l-.164 1.027c-.045.301-.24 1.186 1.035.644 1.275-.541 6.89-4.053 9.405-6.939 1.725-1.838 2.582-3.746 2.582-5.746zm-15.659 3.105h-2.611c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.146h1.93c.375 0 .681.306.681.682s-.306.682-.681.682zm3.671-.682c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.837zm5.603 0c0 .348-.261.641-.604.677l-.077.005h-2.587c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682h2.587c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682zm5.482-3.837v3.837c0 .376-.306.682-.681.682s-.681-.306-.681-.682v-2.547l-2.22 2.994c-.114.153-.276.249-.451.249h-.027c-.171-.012-.323-.104-.411-.251l-2.233-3.007v2.562c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.214.102-.415.273-.541.171-.126.391-.153.587-.074l2.963 3.991 2.963-3.991c.196-.079.416-.052.587.074.171.126.273.327.273.541z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-tight">LINE</h3>
                <a 
                  href={settings?.lineLink || "https://lin.ee/5QcUiXF"} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block mt-1 hover:opacity-80 transition-opacity"
                >
                  <img 
                    src="https://scdn.line-apps.com/n/line_add_friends/btn/th.png" 
                    alt="เพิ่มเพื่อน" 
                    height="28" 
                    className="h-7"
                    referrerPolicy="no-referrer"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/50">
          {isSuccess ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8"
            >
              <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-900">ส่งข้อความเรียบร้อย!</h2>
                <p className="text-xs text-gray-500">ทีมงานจะติดต่อกลับหาคุณโดยเร็วที่สุด</p>
              </div>
              <button 
                onClick={() => setIsSuccess(false)}
                className="text-violet-600 font-bold hover:underline text-xs"
              >
                ส่งข้อความอื่นเพิ่มเติม
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">ชื่อของคุณ</label>
                  <input 
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm"
                    placeholder="กรอกชื่อ-นามสกุล"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700">เบอร์โทรศัพท์</label>
                  <input 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm"
                    placeholder="08X-XXX-XXXX"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">อีเมล</label>
                <input 
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all text-sm"
                  placeholder="example@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">ข้อความของคุณ</label>
                <textarea 
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none text-sm"
                  placeholder="พิมพ์ข้อความที่ต้องการติดต่อ..."
                />
              </div>
              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20 text-sm mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} /> ...
                  </>
                ) : (
                  <>
                    ส่งข้อความ <Send size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default Contact;
