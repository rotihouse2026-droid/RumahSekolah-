import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, increment, getDoc, serverTimestamp, setDoc, addDoc, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData, getCountFromServer, getAggregateFromServer, sum, where } from 'firebase/firestore';
import { onAuthStateChanged, signOut, sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { GoogleGenAI } from '@google/genai';

import { Package, Truck, Trash2, LogOut, Image, Search, ShieldAlert, Eye, X, Coins, Plus, Edit2, Settings, BarChart3, ShoppingBag, RefreshCcw, RefreshCw, Users, User, Ticket, Star, Printer, AlertTriangle, TrendingUp, Globe, CreditCard, Camera, ScanText, Copy, Activity, Database, Info, CheckCircle2, PackageSearch, PackagePlus, Layers, Loader2, Bell, Clock, ArrowRight, ArrowLeft } from 'lucide-react';
import Logo from '../components/Logo';
import { motion, AnimatePresence } from 'motion/react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { PRODUCTS } from '../data/mockProducts';
import { getGoogleDriveDirectLink } from '../utils/googleDrive';
import { compressImageToBase64, compressAndUploadImage } from '../utils/storage';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab: string }>();
  const [activeTab, setActiveTab] = useState<'orders' | 'products' | 'inventory' | 'settings' | 'stats' | 'customers' | 'categories' | 'coupons' | 'system' | 'slips' | 'banners'>((tab as any) || 'orders');

  useEffect(() => {
    if (tab) {
      setActiveTab(tab as any);
    } else {
      setActiveTab('orders');
    }
  }, [tab]);
  const [dbStats, setDbStats] = useState({
    products: 0,
    orders: 0,
    users: 0,
    reviews: 0,
    transactions: 0,
    slips: 0
  });

  const [sheetsConfig, setSheetsConfig] = useState({
    spreadsheetId: '',
    spreadsheetUrl: '',
    accessToken: '',
    lastSyncedAt: ''
  });
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isConnectingSheets, setIsConnectingSheets] = useState(false);
  const [isSyncingExport, setIsSyncingExport] = useState(false);
  const [isSyncingImport, setIsSyncingImport] = useState(false);

  const fetchSheetsConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'sheets'));
      if (docSnap.exists()) {
        const data = docSnap.data();
        const configData = {
          spreadsheetId: data.spreadsheetId || '',
          spreadsheetUrl: data.spreadsheetUrl || '',
          accessToken: data.accessToken || '',
          lastSyncedAt: data.lastSyncedAt || ''
        };
        setSheetsConfig(configData);
        setManualSheetInput(data.spreadsheetId || '');
        setManualTokenInput(data.accessToken || '');
      }
    } catch (e) {
      console.error("Failed to load sheets config:", e);
    }
  };

  const ensureSheetsExist = async (token: string, spreadsheetId: string) => {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error("ไม่สามารถอ่านสัญญลักษณ์ของชีตได้");
    const data = await res.json();
    const existingTitles = data.sheets.map((s: any) => s.properties.title);
    
    const requiredTitles = ['สินค้า', 'หมวดหมู่', 'คูปอง', 'คำสั่งซื้อ', 'ลูกค้า', 'รีวิว'];
    const requests: any[] = [];
    
    requiredTitles.forEach(title => {
      if (!existingTitles.includes(title)) {
        requests.push({
          addSheet: {
            properties: { title }
          }
        });
      }
    });
    
    if (requests.length > 0) {
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ requests })
      });
      if (!updateRes.ok) console.warn("Could not create sheet tabs dynamically");
    }
  };

  const getSheetsToken = async (): Promise<string | null> => {
    let token = sessionStorage.getItem('google_sheets_access_token') || sheetsConfig.accessToken;
    if (token) return token;

    const inputToken = prompt("กรุณาใส่ Google Access Token สำหรับซิงค์ข้อมูล (เนื่องจาก Google บล็อกหน้าต่าง Pop-up เนื่องจากเป็นแอปทดสอบในระบบ):\n\nคุณสามารถนำ Access Token มาวางเพื่อดำเนินการซิงค์แบบส่วนตัวได้ทันที:");
    if (inputToken && inputToken.trim()) {
      const trimmed = inputToken.trim();
      sessionStorage.setItem('google_sheets_access_token', trimmed);
      setSheetsConfig(prev => ({ ...prev, accessToken: trimmed }));
      setManualTokenInput(trimmed);
      try {
        await setDoc(doc(db, 'settings', 'sheets'), { accessToken: trimmed }, { merge: true });
      } catch (err) {
        console.warn("Failed to auto-save token in settings:", err);
      }
      return trimmed;
    }
    return null;
  };

  const handleSaveManualSheetsConfig = async () => {
    if (!manualSheetInput.trim()) {
      toast.error("กรุณากรอก Google Sheets Spreadsheet ID หรือ ลิงก์ URL");
      return;
    }

    let id = manualSheetInput.trim();
    // Support parsing Spreadsheet ID from URL
    const match = id.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      id = match[1];
    }

    const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
    const token = manualTokenInput.trim();

    const newConfig = {
      spreadsheetId: id,
      spreadsheetUrl: url,
      accessToken: token,
      lastSyncedAt: sheetsConfig.lastSyncedAt || ''
    };

    try {
      toast.loading('กำลังบันทึกและเชื่อมข้อมูลตารางเครื่องเขียน...', { id: 'manual-sheets' });
      await setDoc(doc(db, 'settings', 'sheets'), newConfig, { merge: true });
      setSheetsConfig(newConfig);
      toast.success('บันทึกข้อมูลตารางและ Access Token เรียบร้อยแล้ว! สามารถกดใช้ Import / Export ได้เลย', { id: 'manual-sheets' });
    } catch (err: any) {
      toast.error(`บันทึกไม่สำเร็จ: ${err.message}`, { id: 'manual-sheets' });
    }
  };

  const handleConnectSheets = async () => {
    setIsConnectingSheets(true);
    try {
      const token = await getSheetsToken();
      if (!token) throw new Error("ยกเลิกการเข้าถึงสิทธิ์ Google Sheets");
      
      toast.loading('กำลังเชื่อมโยงและสร้างไฟล์ข้อมูลเครื่องเขียนจำลองบน Google Sheet...', { id: 'sheets-setup' });
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: 'Rumah Sekolah (ระบบฐานข้อมูลเครื่องเขียน)' }
        })
      });
      
      if (!response.ok) {
        throw new Error("เกิดข้อผิดพลาดในการเรียกใช้ Google REST Sheets API");
      }
      
      const sheetData = await response.json();
      const id = sheetData.spreadsheetId;
      const url = sheetData.spreadsheetUrl;
      
      await ensureSheetsExist(token, id);

      const newConfig = {
        spreadsheetId: id,
        spreadsheetUrl: url,
        accessToken: token,
        lastSyncedAt: new Date().toLocaleTimeString('th-TH') + ' ' + new Date().toLocaleDateString('th-TH')
      };
      
      await setDoc(doc(db, 'settings', 'sheets'), newConfig, { merge: true });
      setSheetsConfig(newConfig);
      
      toast.success('เชื่อมต่อและตั้งค่าตารางบน Google Sheets สำหรับร้านเรียบร้อย!', { id: 'sheets-setup' });
    } catch (err: any) {
      console.error(err);
      toast.error(`การตั้งค่าล้มเหลว: ${err.message || 'โปรดลองใหม่อีกครั้ง'}`, { id: 'sheets-setup' });
    } finally {
      setIsConnectingSheets(false);
    }
  };

  const handleExportToSheets = async () => {
    setIsSyncingExport(true);
    try {
      const token = await getSheetsToken();
      if (!token) throw new Error("กรุณายืนยันสิทธิ์ Google ก่อนส่งออก");
      
      const spreadsheetId = sheetsConfig.spreadsheetId;
      if (!spreadsheetId) throw new Error("ไม่พบข้อมูลคีย์ Google Sheets ในโมดูลความปลอดภัย");

      toast.loading('กำลังตรวจเช็คคอลัมน์และสร้างชีตย่อย...', { id: 'sheets-export' });
      await ensureSheetsExist(token, spreadsheetId);

      // Raw tables mapping to row matrices
      const productsVal = [['ID', 'ชื่อสินค้า', 'หมวดหมู่', 'ราคาปกติ', 'ราคาลดพิเศษ', 'จำนวนสต็อก', 'คะแนนเฉลี่ย', 'รีวิวสะสม', 'สต็อกขั้นต่ำแจ้งเตือน', 'รายละเอียดสินค้า']];
      const prodDocs = await getDocs(collection(db, 'products'));
      prodDocs.forEach(d => {
        const item = d.data();
        productsVal.push([
          item.id || d.id,
          item.name || '',
          item.category || '',
          String(item.price || 0),
          String(item.discountPrice || ''),
          String(item.stock || 0),
          String(item.rating || 0),
          String(item.reviews || 0),
          String(item.lowStockThreshold || ''),
          item.description || ''
        ]);
      });

      const categoriesVal = [['ID', 'ชื่อหมวดหมู่']];
      const catDocs = await getDocs(collection(db, 'categories'));
      catDocs.forEach(d => {
        const item = d.data();
        categoriesVal.push([item.id || d.id, item.name || '']);
      });

      const couponsVal = [['ID', 'รหัสคูปอง', 'ประเภทส่วนลด', 'มูลค่าส่วนลด', 'สถานะการทำงาน', 'วันที่สร้างอ้างอิง']];
      const couponDocs = await getDocs(collection(db, 'coupons'));
      couponDocs.forEach(d => {
        const item = d.data();
        couponsVal.push([
          item.id || d.id,
          item.code || '',
          item.discountType || '',
          String(item.value || 0),
          item.isActive ? 'เปิดการใช้งาน' : 'ปิดการใช้งาน',
          item.createdAt || ''
        ]);
      });

      const ordersVal = [['ID', 'ชื่อลูกค้าปลายทาง', 'วิธีการชำระเงิน', 'ราคารวมสุทธิ์', 'สถานะปัจจุบัน', 'วันที่สั่งซื้อ']];
      const orderDocs = await getDocs(collection(db, 'orders'));
      orderDocs.forEach(d => {
        const item = d.data();
        ordersVal.push([
          item.id || d.id,
          item.customerName || item.shippingAddress?.fullName || 'ผู้ใช้นอกระบบ',
          item.paymentMethod || 'โอนเงินบัญชีกลาง',
          String(item.totalAmount || 0),
          item.status || '',
          item.createdAt || ''
        ]);
      });

      const customersVal = [['ID', 'ชื่อลงทะเบียน', 'อีเมลข้อมูล', 'เบอร์ติดต่อ', 'พอยท์แต้มสะสม']];
      const customerDocs = await getDocs(collection(db, 'users'));
      customerDocs.forEach(d => {
        const item = d.data();
        customersVal.push([
          item.id || d.id,
          item.displayName || item.name || '',
          item.email || '',
          item.phoneNumber || '',
          String(item.points || 0)
        ]);
      });

      const reviewsVal = [['ID', 'ชื่อสินค้า', 'คะแนนความพึงใจ', 'ความคิดเห็น', 'นามผู้รีวิว', 'วันที่ประเมิน']];
      const reviewDocs = await getDocs(collection(db, 'reviews'));
      reviewDocs.forEach(d => {
        const item = d.data();
        reviewsVal.push([
          item.id || d.id,
          item.productName || item.productId || '',
          String(item.rating || 0),
          item.comment || '',
          item.reviewerName || item.userName || '',
          item.createdAt || ''
        ]);
      });

      toast.loading('กำลังเคลียร์ตารางความจำเก่านอกไดรฟ์...', { id: 'sheets-export' });
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ranges: ['สินค้า!A1:Z1000', 'หมวดหมู่!A1:Z1000', 'คูปอง!A1:Z1000', 'คำสั่งซื้อ!A1:Z1000', 'ลูกค้า!A1:Z1000', 'รีวิว!A1:Z1000']
        })
      });

      toast.loading('กำลังส่งบันทึกทับลายแถวทั้งหมด...', { id: 'sheets-export' });
      const batchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
      const updateRes = await fetch(batchUpdateUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: [
            { range: 'สินค้า!A1', values: productsVal },
            { range: 'หมวดหมู่!A1', values: categoriesVal },
            { range: 'คูปอง!A1', values: couponsVal },
            { range: 'คำสั่งซื้อ!A1', values: ordersVal },
            { range: 'ลูกค้า!A1', values: customersVal },
            { range: 'รีวิว!A1', values: reviewsVal }
          ]
        })
      });

      if (!updateRes.ok) throw new Error("กระบวนการบันทึกทับไม่ได้รับการตอบกลับ");

      const nowStr = new Date().toLocaleTimeString('th-TH') + ' ' + new Date().toLocaleDateString('th-TH');
      const updatedConfig = {
        ...sheetsConfig,
        lastSyncedAt: nowStr
      };
      await setDoc(doc(db, 'settings', 'sheets'), updatedConfig, { merge: true });
      setSheetsConfig(updatedConfig);

      toast.success('ส่งออกรายการฐานข้อมูลไปยัง Google Sheets สำเร็จเรียบร้อย!', { id: 'sheets-export' });
      fetchDbStats();
    } catch (err: any) {
      console.error(err);
      toast.error(`ส่งออกไม่สำเร็จ: ${err.message || 'โปรดตรวจสอบสิทธิ์เชื่อมต่อ'}`, { id: 'sheets-export' });
    } finally {
      setIsSyncingExport(false);
    }
  };

  const handleImportFromSheets = async () => {
    setIsSyncingImport(true);
    try {
      const token = await getSheetsToken();
      if (!token) throw new Error("กรุณายืนยันสิทธิ์ Google ก่อนนำเข้าข้อมูล");
      
      const spreadsheetId = sheetsConfig.spreadsheetId;
      if (!spreadsheetId) throw new Error("ไม่มี Google Sheets เชื่อมต่ออยู่ภายในระบบ");

      toast.loading('กำลังอ่านหมวดและแถวข้อมูลจากเครื่องพิมพ์คลาวด์...', { id: 'sheets-import' });
      const ranges = ['สินค้า!A1:Z1000', 'หมวดหมู่!A1:Z1000', 'คูปอง!A1:Z1000', 'คำสั่งซื้อ!A1:Z1000', 'ลูกค้า!A1:Z1000', 'รีวิว!A1:Z1000'];
      const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?` + ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
      
      const response = await fetch(getUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error("ข้อมูลตารางขัดแย้งหรือสิทธิ์การนำเข้าล้มเหลว");
      const resData = await response.json();
      const valueRanges = resData.valueRanges || [];

      toast.loading('คำนวณและทับบันทึกสัญลักษณ์หมวดเข้าเซิร์ฟของระบบ...', { id: 'sheets-import' });

      // 1. Products
      const productsRows = valueRanges[0]?.values || [];
      if (productsRows.length > 1) {
        const items = productsRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          name: row[1] || '',
          category: row[2] || '',
          price: Number(row[3]) || 0,
          discountPrice: row[4] && row[4] !== 'undefined' && row[4] !== '' ? Number(row[4]) : undefined,
          stock: Number(row[5]) || 0,
          rating: Number(row[6]) || 4.5,
          reviews: Number(row[7]) || 0,
          lowStockThreshold: row[8] && row[8] !== 'undefined' && row[8] !== '' ? Number(row[8]) : undefined,
          description: row[9] || ''
        })).filter((item: any) => item.id && item.name);

        await fetch('/api/db/products/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      // 2. Categories
      const categoriesRows = valueRanges[1]?.values || [];
      if (categoriesRows.length > 1) {
        const items = categoriesRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          name: row[1] || ''
        })).filter((item: any) => item.id && item.name);

        await fetch('/api/db/categories/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      // 3. Coupons
      const couponsRows = valueRanges[2]?.values || [];
      if (couponsRows.length > 1) {
        const items = couponsRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          code: row[1] || '',
          discountType: row[2] || 'percentage',
          value: Number(row[3]) || 0,
          isActive: row[4] === 'เปิดการใช้งาน',
          createdAt: row[5] || new Date().toISOString()
        })).filter((item: any) => item.id && item.code);

        await fetch('/api/db/coupons/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      // 4. Orders
      const ordersRows = valueRanges[3]?.values || [];
      if (ordersRows.length > 1) {
        const items = ordersRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          customerName: row[1] || '',
          paymentMethod: row[2] || '',
          totalAmount: Number(row[3]) || 0,
          status: row[4] || 'pending',
          createdAt: row[5] || new Date().toISOString()
        })).filter((item: any) => item.id);

        await fetch('/api/db/orders/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      // 5. Customers
      const customersRows = valueRanges[4]?.values || [];
      if (customersRows.length > 1) {
        const items = customersRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          displayName: row[1] || '',
          email: row[2] || '',
          phoneNumber: row[3] || '',
          points: Number(row[4]) || 0
        })).filter((item: any) => item.id);

        await fetch('/api/db/users/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      // 6. Reviews
      const reviewsRows = valueRanges[5]?.values || [];
      if (reviewsRows.length > 1) {
        const items = reviewsRows.slice(1).map((row: any) => ({
          id: row[0] || '',
          productName: row[1] || '',
          rating: Number(row[2]) || 5,
          comment: row[3] || '',
          reviewerName: row[4] || '',
          createdAt: row[5] || new Date().toISOString()
        })).filter((item: any) => item.id);

        await fetch('/api/db/reviews/overwrite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items)
        });
      }

      const nowStr = new Date().toLocaleTimeString('th-TH') + ' ' + new Date().toLocaleDateString('th-TH');
      const updatedConfig = {
        ...sheetsConfig,
        lastSyncedAt: nowStr
      };
      await setDoc(doc(db, 'settings', 'sheets'), updatedConfig, { merge: true });
      setSheetsConfig(updatedConfig);

      toast.success('ดึงและติดตั้งฐานข้อมูลร้านชุดใหม่ล่าสุดจาก Google Sheets สำเร็จ!', { id: 'sheets-import' });
      fetchDbStats();
    } catch (err: any) {
      console.error(err);
      toast.error(`ดึงข้อมูลล้มเหลว: ${err.message || 'โปรดตรวจคอลัมน์แถวชีตอีกครั้ง'}`, { id: 'sheets-import' });
    } finally {
      setIsSyncingImport(false);
    }
  };

  const fetchDbStats = async () => {
    try {
      setIsRefreshing(true);
      const [prodCount, orderCount, userCount, reviewCount, txCount, slipCount] = await Promise.all([
        getCountFromServer(collection(db, 'products')),
        getCountFromServer(collection(db, 'orders')),
        getCountFromServer(collection(db, 'users')),
        getCountFromServer(collection(db, 'reviews')),
        getCountFromServer(collection(db, 'pointTransactions')),
        getCountFromServer(collection(db, 'slips'))
      ]);

      setDbStats({
        products: prodCount.data().count,
        orders: orderCount.data().count,
        users: userCount.data().count,
        reviews: reviewCount.data().count,
        transactions: txCount.data().count,
        slips: slipCount.data().count
      });
      
      if (activeTab === 'system') {
        toast.success('รีเฟรชสถานะระบบเรียบร้อยแล้ว');
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, 'multiple/stats');
      toast.error('ไม่สามารถรีเฟรชข้อมูลได้');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDbStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'system') {
      fetchDbStats();
      fetchSheetsConfig();
    }
  }, [activeTab]);

  const getSafeItemsArray = (items: any): any[] => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.warn("Failed to parse items string:", e);
      }
    }
    return [];
  };

  const formatDate = (date: any, includeTime: boolean = false) => {
    if (!date) return 'N/A';
    try {
      const options: Intl.DateTimeFormatOptions = {
        day: 'numeric', month: 'short', year: 'numeric'
      };
      if (includeTime) {
        options.hour = '2-digit';
        options.minute = '2-digit';
      }

      if (typeof date.toDate === 'function') {
        return date.toDate().toLocaleDateString('th-TH', options);
      }
      if (date instanceof Date) {
        return date.toLocaleDateString('th-TH', options);
      }
    } catch (e) {
      console.error("Error formatting date:", e);
    }
    return 'N/A';
  };

  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);
  
  // Pagination state
  const [lastOrderDoc, setLastOrderDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastProductDoc, setLastProductDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastUserDoc, setLastUserDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastSlipDoc, setLastSlipDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [hasMoreSlips, setHasMoreSlips] = useState(true);
  const PAGE_SIZE = 10;
  const [visitorCount, setVisitorCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [bannerUploading, setBannerUploading] = useState<number | null>(null);
  const [bannerProgress, setBannerProgress] = useState(0);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [showDbTools, setShowDbTools] = useState(false);
  const [isConfirmingDeleteSamples, setIsConfirmingDeleteSamples] = useState(false);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState('');
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<any>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompany, setShippingCompany] = useState('Flash Express');
  const [isExtractingTracking, setIsExtractingTracking] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [productFiles, setProductFiles] = useState<(File | null)[]>([null, null, null, null, null]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [shopSettings, setShopSettings] = useState<any>({
    name: 'RumahSekolah',
    description: 'แหล่งรวมสินค้าอุปกรณ์การเรียนคุณภาพสูง เพื่อสร้างแรงบันดาลใจในการเรียนรู้ให้กับทุกคน',
    phone: '061-194-8570',
    email: 'support@rumahsekolah.com',
    freeShippingThreshold: 999,
    shippingFee: 50,
    bankName: '',
    accountNumber: '',
    accountName: '',
    promptPayId: '',
    promptPayQrUrl: 'https://drive.google.com/uc?export=view&id=1HzFLR7rGmYFQ4V__0Ej8euvsmqdKoARl',
    logoUrl: '',
    pointsPerBaht: 0.1, // 10 Baht = 1 Point
    bahtPerPoint: 0.1, // 10 Points = 1 Baht
    minPointsToRedeem: 10,
    heroTitle: 'พบกับสินค้าคุณภาพจาก RumahSekolah ทั้งหมดที่นี่',
    heroSubtitle: 'ค้นพบอุปกรณ์การเรียนคุณภาพพรีเมียมจาก RumahSekolah ที่ออกแบบมาเพื่อส่งเสริมศักยภาพของนักเรียนทุกคน',
    feature1Title: 'ส่งฟรีเมื่อช้อปครบ ฿999',
    feature1Desc: 'เมื่อช้อปครบ 999 บาท',
    feature2Title: 'รับประกันสินค้าแท้',
    feature2Desc: 'สินค้าแท้ 100%',
    feature3Title: 'คืนสินค้าได้ใน 7 วัน',
    feature3Desc: 'รวดเร็ว ทันใจ',
    feature4Title: 'คะแนนรีวิว 4.9/5',
    feature4Desc: 'จากลูกค้ากว่า 10,000 ราย',
    address: '123 อาคารเรียนรู้ ชั้น 5 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
    workingHours: 'จันทร์ - ศุกร์ (09:00 - 18:00)',
    lineLink: 'https://lin.ee/5QcUiXF',
    facebookLink: 'https://www.facebook.com/rumahsekolahsaya?_rdc=1&_rdr#',
    instagramLink: 'https://www.instagram.com/ismael_charu/',
    youtubeLink: 'https://www.youtube.com/@Rumah-Sekolah',
    adminEmails: ['ismael.charu2015@gmail.com', 'ismael.charu2025@gmail.com', 'ismael.charu2018@gmail.com', 'admin@rumahsekolah.com'],
    tierRules: {
      silver: { minSpending: 0, months: 0 },
      gold: { minSpending: 12000, months: 12 },
      platinum: { minSpending: 60000, months: 12 }
    }
  });
  
  const [realStats, setRealStats] = useState({
    totalSales: 0,
    orderCount: 0,
    productCount: 0,
    pendingOrders: 0,
    userCount: 0,
    lowStockCount: 0,
    salesData: [] as any[],
    topProducts: [] as any[]
  });

  const [authLoading, setAuthLoading] = useState(!auth.currentUser);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<string | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [selectedLabelData, setSelectedLabelData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAdminNotifications, setShowAdminNotifications] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [actionableCounts, setActionableCounts] = useState({
    pendingOrders: 0,
    pendingSlips: 0,
    lowStock: 0
  });
  
  const defaultAdminEmails = ['ismael.charu2015@gmail.com', 'ismael.charu2025@gmail.com', 'ismael.charu2018@gmail.com', 'admin@rumahsekolah.com'];
  const allowedAdmins = shopSettings?.adminEmails?.length > 0 ? shopSettings.adminEmails : defaultAdminEmails;
  const isFirebaseAdmin = auth.currentUser && (
    allowedAdmins.includes(auth.currentUser.email || '') || 
    auth.currentUser.uid === 'HIsfiO4Vh6MTUYT6QZToCWjqpHn1' ||
    auth.currentUser.uid === '6WkoIIyNCZef1NP6aoHtMKOoeSo1'
  );

  useEffect(() => {
    if (isFirebaseAdmin && !loading && dbStats.products === 0) {
      const autoSeed = async () => {
        const hasSeeded = localStorage.getItem('hasAutoSeeded');
        if (!hasSeeded) {
          console.log('Auto-seeding products...');
          await seedProducts(true);
          localStorage.setItem('hasAutoSeeded', 'true');
        }
      };
      autoSeed();
    }
  }, [isFirebaseAdmin, loading, dbStats.products]);

  // Load Settings independently on mount
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'shop'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setShopSettings((prev: any) => ({
          ...prev,
          ...data,
          tierRules: {
            ...prev.tierRules,
            ...(data.tierRules || {})
          }
        }));
      }
      setSettingsLoading(false);
    }, (err) => {
      console.warn("Failed to fetch shop settings:", err);
      setSettingsLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // We will check isFirebaseAdmin in the render/logic, but we must set loading to false
        setAuthLoading(false);
      } else {
        setAuthLoading(false);
        navigate('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!authLoading && !settingsLoading && auth.currentUser) {
      if (!isFirebaseAdmin) {
        navigate('/admin/login');
      }
    }
  }, [authLoading, settingsLoading, isFirebaseAdmin, navigate]);

  const fetchRealStats = async () => {
    if (!isFirebaseAdmin) return;
    try {
      const ordersCol = collection(db, 'orders');
      const productsCol = collection(db, 'products');
      const usersCol = collection(db, 'users');

      // Total Sales (Delivered only) - USING AGGREGATION FOR QUOTA SAVING
      const salesQuery = query(ordersCol, where('status', '==', 'delivered'));
      const totalSalesSnap = await getAggregateFromServer(salesQuery, {
        totalSum: sum('total')
      });
      const totalSales = totalSalesSnap.data().totalSum || 0;

      // For charts and top products, we still need some recent data, but let's limit it strictly
      const chartQuery = query(ordersCol, where('status', '==', 'delivered'), orderBy('createdAt', 'desc'), limit(50));
      const salesSnap = await getDocs(chartQuery);
      const salesList = salesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
      
      // Aggregate sales by date for chart
      const salesByDate: { [key: string]: number } = {};
      const productSales: { [key: string]: { name: string; quantity: number; amount: number } } = {};

      salesList.forEach(order => {
        if (order.createdAt) {
          const date = order.createdAt.toDate?.() ? order.createdAt.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : 'N/A';
          salesByDate[date] = (salesByDate[date] || 0) + (order.total || 0);
        }
        
        // Count product sales
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (!productSales[item.id]) {
              productSales[item.id] = { name: item.name, quantity: 0, amount: 0 };
            }
            productSales[item.id].quantity += item.quantity || 0;
            productSales[item.id].amount += (item.price * item.quantity) || 0;
          });
        }
      });

      const salesData = Object.entries(salesByDate)
        .map(([date, amount]) => ({ date, amount }))
        .reverse()
        .slice(-14);

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Order Count
      const orderCountSnap = await getCountFromServer(ordersCol);
      const orderCount = orderCountSnap.data().count;

      // Product Count
      const productCountSnap = await getCountFromServer(productsCol);
      const productCount = productCountSnap.data().count;

      // Pending Orders
      const pendingQuery = query(ordersCol, where('status', '==', 'pending'));
      const pendingSnap = await getCountFromServer(pendingQuery);
      const pendingOrders = pendingSnap.data().count;

      // User Count
      const userCountSnap = await getCountFromServer(usersCol);
      const userCount = userCountSnap.data().count;

      // Low Stock Count (Urgent: <= 5)
      const lowStockQuery = query(productsCol, where('stock', '<=', 5));
      const lowStockSnap = await getCountFromServer(lowStockQuery);
      const lowStockCount = lowStockSnap.data().count;

      setRealStats({
        totalSales,
        orderCount,
        productCount,
        pendingOrders,
        userCount,
        lowStockCount,
        salesData: salesData.length > 0 ? salesData : [
          { date: '1 เม.ย.', amount: 0 },
          { date: '5 เม.ย.', amount: 0 },
          { date: '10 เม.ย.', amount: 0 },
          { date: '15 เม.ย.', amount: 0 },
          { date: '20 เม.ย.', amount: 0 },
          { date: '25 เม.ย.', amount: 0 },
          { date: '29 เม.ย.', amount: 0 }
        ],
        topProducts: topProducts.length > 0 ? topProducts : []
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.GET, 'dashboard/stats');
      if (err.message && err.message.includes('isQuotaError')) {
        const errorData = JSON.parse(err.message);
        setQuotaError(errorData.message);
      }
    }
  };

  // Initial Fetch for Users (Merged from Auth and Firestore)
  const fetchUsers = async () => {
    try {
      setIsRefreshing(true);
      const user = auth.currentUser;
      if (!user) {
        console.warn("User not logged in, skipping user list fetch");
        return;
      }

      const idToken = await user.getIdToken(true);
      const response = await fetch('/api/admin/list-users', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      const isJson = response.headers.get('content-type')?.includes('application/json');

      if (response.ok && isJson) {
        const data = await response.json();
        if (data.success) {
          if (data.firestoreError && (!data.users || data.users.length === 0)) {
            console.warn("API list-users returned firestore error and no users, falling back to client-side Firestore:", data.firestoreError);
            const q = query(collection(db, 'users'), limit(PAGE_SIZE));
            const snapshot = await getDocs(q);
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLastUserDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMoreUsers(snapshot.docs.length === PAGE_SIZE);
            return;
          }
          console.log(`Fetched ${data.users.length} users from API`);
          setUsers(data.users);
          setHasMoreUsers(false); // We fetched all
          return;
        } else {
          console.warn("API returned success:false", data);
        }
      } else {
        const errorText = isJson ? await response.json().then(j => JSON.stringify(j)) : 'API endpoint not available or returned non-JSON template';
        console.warn(`API list-users failed with status ${response.status}:`, errorText);
        
        if (response.status === 403 || response.status === 401) {
          toast.error('สิทธิ์ผู้ดูแลระบบไม่ถูกต้อง หรือเซสชันหมดอายุ');
        }
      }
      
      // Fallback to Firestore if API fails or returns error
      console.warn("API list-users failed, falling back to Firestore only (Note: Auth users might be missing)");
      const q = query(collection(db, 'users'), limit(PAGE_SIZE));
      const snapshot = await getDocs(q);
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastUserDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreUsers(snapshot.docs.length === PAGE_SIZE);
    } catch (err: any) {
      console.warn("Error in fetchUsers:", err);
      // Final fallback
      const q = query(collection(db, 'users'), limit(PAGE_SIZE));
      const snapshot = await getDocs(q).catch(() => ({ docs: [] }));
      if (snapshot && 'docs' in snapshot) {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Management listeners and fetches
  useEffect(() => {
    if (authLoading || !isFirebaseAdmin) return;

    setLoading(true);

    // Listen to Visitor Stats
    const unsubscribeVisitors = onSnapshot(doc(db, 'stats', 'visitors'), (doc) => {
      if (doc.exists()) setVisitorCount(doc.data().count || 0);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'stats/visitors'));

    // Real-time Fetch for Categories
    const unsubscribeCategories = onSnapshot(query(collection(db, 'categories'), orderBy('name', 'asc')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'categories'));

    // Real-time Fetch for Orders (First Page)
    const unsubscribeOrders = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)), (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastOrderDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreOrders(snapshot.docs.length === PAGE_SIZE);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'orders');
      setLoading(false);
    });

    // Real-time Fetch for Products (First Page)
    const unsubscribeProducts = onSnapshot(query(collection(db, 'products'), orderBy('name', 'asc'), limit(PAGE_SIZE)), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastProductDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreProducts(snapshot.docs.length === PAGE_SIZE);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubscribeCoupons = onSnapshot(query(collection(db, 'coupons'), orderBy('createdAt', 'desc')), (snapshot) => {
      setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'coupons'));

    // Real-time Fetch for Slips
    const unsubscribeSlips = onSnapshot(query(collection(db, 'slips'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE)), (snapshot) => {
      setSlips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastSlipDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMoreSlips(snapshot.docs.length === PAGE_SIZE);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'slips'));

    // Watch auth state to fetch users when ready
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchUsers();
      }
    });

    fetchRealStats();

    // Real-time Actionable Counts (Beyond pagination limits)
    const unsubscribeOrdersCount = onSnapshot(query(collection(db, 'orders'), where('status', '==', 'pending'), limit(100)), (snap) => {
      setActionableCounts(prev => ({ ...prev, pendingOrders: snap.size }));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'orders/counts'));
    
    const unsubscribeSlipsCount = onSnapshot(query(collection(db, 'slips'), where('status', '==', 'pending'), limit(100)), (snap) => {
      setActionableCounts(prev => ({ ...prev, pendingSlips: snap.size }));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'slips/counts'));

    const unsubscribeLowStockCount = onSnapshot(query(collection(db, 'products'), where('stock', '<=', 5), limit(100)), (snap) => {
      setActionableCounts(prev => ({ ...prev, lowStock: snap.size }));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'products/counts'));

    return () => {
      unsubscribeVisitors();
      unsubscribeCategories();
      unsubscribeOrders();
      unsubscribeProducts();
      unsubscribeCoupons();
      unsubscribeSlips();
      unsubscribeOrdersCount();
      unsubscribeSlipsCount();
      unsubscribeLowStockCount();
      unsubscribeAuth();
    };
  }, [authLoading, isFirebaseAdmin]);

  useEffect(() => {
    const notifications: any[] = [];
    
    // 1. Low Stock
    if (actionableCounts.lowStock > 0) {
      notifications.push({
        id: 'low-stock-alert',
        title: 'สต็อกต่ำ!',
        message: `มีสินค้า ${actionableCounts.lowStock} รายการที่สต็อกต่ำกว่าเกณฑ์`,
        icon: <AlertTriangle className="text-red-500" size={16} />,
        type: 'low-stock',
        severity: 'danger',
        action: () => { setActiveTab('inventory'); setSearchTerm('stock<5'); setShowAdminNotifications(false); }
      });
    }

    // 2. Pending Orders
    if (actionableCounts.pendingOrders > 0) {
      notifications.push({
        id: 'pending-orders',
        title: 'มีคำสั่งซื้อใหม่',
        message: `มี ${actionableCounts.pendingOrders} คำสั่งซื้อที่รอดำเนินการ`,
        icon: <ShoppingBag className="text-blue-500" size={16} />,
        type: 'order',
        severity: 'info',
        action: () => { setActiveTab('orders'); setSearchTerm(''); setShowAdminNotifications(false); }
      });
    }

    // 3. New Slips
    if (actionableCounts.pendingSlips > 0) {
        notifications.push({
            id: 'pending-slips',
            title: 'มีหลักฐานการโอนใหม่',
            message: `มี ${actionableCounts.pendingSlips} หลักฐานการโอนที่รอตรวจสอบ`,
            icon: <Camera className="text-orange-500" size={16} />,
            type: 'slip',
            severity: 'warning',
            action: () => { setActiveTab('slips'); setShowAdminNotifications(false); }
        });
    }

    setAdminNotifications(notifications);
  }, [actionableCounts]);

  const loadMoreOrders = async () => {
    if (!lastOrderDoc || !hasMoreOrders) return;
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), startAfter(lastOrderDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'orders'));
      if (snapshot) {
        const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setOrders(prev => {
          const combined = [...prev, ...newOrders];
          const seen = new Set();
          return combined.filter(item => {
            const isDuplicate = seen.has(item.id);
            seen.add(item.id);
            return !isDuplicate;
          });
        });
        setLastOrderDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreOrders(snapshot.docs.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("Error loading more orders:", err);
    }
  };

  const loadMoreProducts = async () => {
    if (!lastProductDoc || !hasMoreProducts) return;
    try {
      const q = query(collection(db, 'products'), orderBy('name', 'asc'), startAfter(lastProductDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'products'));
      if (snapshot) {
        const newProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(prev => {
          const combined = [...prev, ...newProducts];
          const seen = new Set();
          return combined.filter(item => {
            const isDuplicate = seen.has(item.id);
            seen.add(item.id);
            return !isDuplicate;
          });
        });
        setLastProductDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreProducts(snapshot.docs.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("Error loading more products:", err);
    }
  };

  const loadMoreUsers = async () => {
    if (!lastUserDoc || !hasMoreUsers) return;
    try {
      const q = query(collection(db, 'users'), startAfter(lastUserDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'users'));
      if (snapshot && snapshot.docs.length > 0) {
        const newUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(prev => {
          const combined = [...prev, ...newUsers];
          const seen = new Set();
          return combined.filter(item => {
            if (!item.id) return false;
            const isDuplicate = seen.has(item.id);
            seen.add(item.id);
            return !isDuplicate;
          });
        });
        setLastUserDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreUsers(snapshot.docs.length === PAGE_SIZE);
      } else {
        setHasMoreUsers(false);
      }
    } catch (err) {
      console.error("Error loading more users:", err);
    }
  };

  const loadMoreSlips = async () => {
    if (!lastSlipDoc || !hasMoreSlips) return;
    try {
      const q = query(collection(db, 'slips'), orderBy('createdAt', 'desc'), startAfter(lastSlipDoc), limit(PAGE_SIZE));
      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'slips'));
      if (snapshot) {
        const newSlips = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setSlips(prev => {
          const combined = [...prev, ...newSlips];
          const seen = new Set();
          return combined.filter(item => {
            const isDuplicate = seen.has(item.id);
            seen.add(item.id);
            return !isDuplicate;
          });
        });
        setLastSlipDoc(snapshot.docs[snapshot.docs.length - 1] || null);
        setHasMoreSlips(snapshot.docs.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error("Error loading more slips:", err);
    }
  };

  const handleScanTracking = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsExtractingTracking(true);
      const reader = new FileReader();
      const base64Data = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      const prompt = `You are a helpful logistics assistant. Your task is to extract the official shipping TRACKING NUMBER from this image of a shipping label or receipt.
      
      Look for:
      - Barcodes or QR codes (they usually have the tracking number underneath)
      - Bold text near 'เลขพัสดุ', 'Tracking', 'Waybill', 'Shipment No', 'Ref No'
      - Common formats: 
        - Flash Express: Usually starts with TH followed by numbers (e.g., TH01014V1Y...)
        - Kerry Express: Usually numeric or prefixed with letters (e.g., SHP..., KEX...)
        - J&T Express: Usually a 12-digit number (e.g., 82..., 61...)
        - Thailand Post: Starts with consonants like EF, R, K followed by 9 digits and TH.
      
      Return ONLY the tracking number string. 
      If you are unsure or see multiple, return the one that looks most like a tracking number.
      If you definitely can't find it, return 'NOT_FOUND'.`;
      
      const imagePart = {
        inlineData: {
          data: base64Data.split(',')[1],
          mimeType: file.type
        }
      };
      const textPart = { text: prompt };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts: [imagePart, textPart] }
      });

      const extractedText = response.text?.trim() || '';
      
      if (extractedText === 'NOT_FOUND' || !extractedText) {
        alert('ไม่พบเลขพัสดุในรูปภาพ กรุณาลองถ่ายภาพให้ชัดเจนขึ้นหรือกรอกด้วยตนเอง');
      } else {
        // Clean up the response - sometimes Gemini adds "Tracking Number: " prefix despite instructions
        let cleaned = extractedText.replace(/Tracking Number:|เลขพัสดุ:|Shipment No:|Waybill:|Ref No:/gi, '').trim();
        
        // Extract the first block that looks like a tracking number (alphanumeric, at least 8 chars typically)
        // Adjust regex to be more inclusive of common Thai tracking formats
        const match = cleaned.match(/[A-Z0-9]{8,20}/i);
        if (match) {
          cleaned = match[0];
        }
        
        if (cleaned && cleaned.length >= 5) {
          setTrackingNumber(cleaned.toUpperCase());
          // Optional: try to auto-detect shipping company
          if (cleaned.startsWith('TH')) setShippingCompany('Flash Express');
          else if (cleaned.match(/^(EF|E|R|K)[0-9]{9}TH$/i)) setShippingCompany('Thailand Post');
        } else {
          alert('ไม่สามารถดึงข้อมูลได้ชัดเจน (พบ: ' + cleaned + ') กรุณาลองอีกครั้งหรือกรอกเอง');
        }
      }
    } catch (err) {
      console.error("Error scanning tracking:", err);
      alert('เกิดข้อผิดพลาดในการสแกนรูปภาพ: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsExtractingTracking(false);
      e.target.value = '';
    }
  };

  const updateStatus = async (orderId: string, status: string) => {
    if (status === 'shipped') {
      const order = orders.find(o => o.id === orderId);
      setSelectedOrderForTracking(order);
      setTrackingNumber(order?.trackingNumber || '');
      setShippingCompany(order?.shippingCompany || 'Flash Express');
      setIsTrackingModalOpen(true);
      return;
    }

    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      const orderData = orderSnap.data();

      if (!orderData) return;

      // Handle points removal if status was delivered and is now something else
      if (orderData.status === 'delivered' && status !== 'delivered' && orderData.pointsGranted && orderData.customer.uid) {
        const userRef = doc(db, 'users', orderData.customer.uid);
        await updateDoc(userRef, {
          points: increment(-orderData.pointsEarned),
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${orderData.customer.uid}`));

        // Log Point Transaction (Revoke)
        await addDoc(collection(db, 'pointTransactions'), {
          userId: orderData.customer.uid,
          amount: -orderData.pointsEarned,
          type: 'adjustment',
          description: `หักแต้มคืนเนื่องจากเปลี่ยนสถานะออเดอร์ #${orderId.slice(0, 8)}`,
          createdAt: serverTimestamp()
        }).catch(e => console.error("Error logging point transaction:", e));

        await updateDoc(orderRef, { 
          status,
          pointsGranted: false,
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`));
      } else {
        await updateDoc(orderRef, { 
          status,
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`));
      }

      // Add notification for status change
      if (orderData.customer.uid) {
        let title = 'อัปเดตสถานะคำสั่งซื้อ';
        let message = `คำสั่งซื้อของคุณได้เปลี่ยนสถานะเป็น "${status}" แล้ว`;
        if (status === 'processing') message = 'ทางร้านกำลังเตรียมสินค้าเพื่อรอจัดส่ง';
        if (status === 'delivered') message = 'สินค้าถูกจัดส่งถึงมือคุณเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ';
        if (status === 'cancelled') message = 'คำสั่งซื้อของคุณถูกยกเลิกแล้ว';
        
        await addDoc(collection(db, 'notifications'), {
          userId: orderData.customer.uid,
          title,
          message,
          type: 'order',
          status: 'unread',
          orderId: orderId,
          createdAt: serverTimestamp()
        }).catch(e => console.error("Error creating notification:", e));
      }

      if (status === 'delivered' && !orderData.pointsGranted && orderData.customer.uid && (orderData.pointsEarned || 0) > 0) {
        const userRef = doc(db, 'users', orderData.customer.uid);
        await updateDoc(userRef, {
          points: increment(orderData.pointsEarned),
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${orderData.customer.uid}`));

        // Log Point Transaction (Earn)
        await addDoc(collection(db, 'pointTransactions'), {
          userId: orderData.customer.uid,
          amount: orderData.pointsEarned,
          type: 'purchase',
          description: `ได้รับแต้มจากการสั่งซื้อ (ออเดอร์ #${orderId.slice(0, 8)})`,
          createdAt: serverTimestamp()
        }).catch(e => console.error("Error logging point transaction:", e));

        await updateDoc(orderRef, { 
          pointsGranted: true,
          updatedAt: serverTimestamp()
        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${orderId}`));
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleSaveTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForTracking) return;

    try {
      const orderRef = doc(db, 'orders', selectedOrderForTracking.id);
      await updateDoc(orderRef, {
        status: 'shipped',
        trackingNumber,
        shippingCompany,
        shippedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `orders/${selectedOrderForTracking.id}`));

      // Add notification for shipping
      if (selectedOrderForTracking.customer.uid) {
        await addDoc(collection(db, 'notifications'), {
          userId: selectedOrderForTracking.customer.uid,
          title: 'สินค้าของคุณถูกจัดส่งแล้ว! 📦',
          message: `รหัสพัสดุ ${trackingNumber} (${shippingCompany}) ตรวจสอบสถานะการจัดส่งได้ที่หน้าคำสั่งซื้อ. เมื่อได้รับสินค้าแล้ว อย่าลืมกด "ได้รับสินค้าแล้ว" เพื่อรับแต้มสะสมและเขียนรีวิวสินค้านะคะ! 💎`,
          type: 'shipping',
          status: 'unread',
          orderId: selectedOrderForTracking.id,
          createdAt: serverTimestamp()
        }).catch(e => console.error("Error creating notification:", e));
      }

      setIsTrackingModalOpen(false);
      setSelectedOrderForTracking(null);
    } catch (error) {
      console.error("Error saving tracking info:", error);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลการจัดส่ง');
    }
  };

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
    const doCopy = () => {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        alert('คัดลอกเลขพัสดุเรียบร้อย: ' + text);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => alert('คัดลอกเลขพัสดุเรียบร้อย: ' + text))
        .catch(() => doCopy());
    } else {
      doCopy();
    }
  };

  const deleteOrder = async (orderId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบคำสั่งซื้อนี้?')) {
      try {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.data();

        if (orderData && orderData.customer.uid) {
          const userRef = doc(db, 'users', orderData.customer.uid);
          
          // Return redeemed points
          if (orderData.pointsRedeemed > 0) {
            await updateDoc(userRef, {
              points: increment(orderData.pointsRedeemed)
            }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${orderData.customer.uid}`));
          }

          // Remove granted points if order was delivered
          if (orderData.status === 'delivered' && orderData.pointsGranted) {
            await updateDoc(userRef, {
              points: increment(-orderData.pointsEarned)
            }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${orderData.customer.uid}`));
          }
        }

        await deleteDoc(orderRef).catch(e => handleFirestoreError(e, OperationType.DELETE, `orders/${orderId}`));
        setOrders(prev => prev.filter(o => o.id !== orderId));
        toast.success('ลบคำสั่งซื้อเรียบร้อยแล้ว');
      } catch (error) {
        console.error("Error deleting order:", error);
        toast.error('เกิดข้อผิดพลาดในการลบคำสั่งซื้อ');
      }
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setBannerUploading(idx);
      setBannerProgress(0);
      
      const downloadURL = await compressAndUploadImage(
        file, 
        'banners', 
        1920, 
        1080, 
        0.75, 
        (progress) => setBannerProgress(Math.round(progress))
      );
      
      setShopSettings({
        ...shopSettings,
        [`banner${idx}`]: downloadURL
      });
      
      toast.success(`อัปโหลดรูปแบนเนอร์ ${idx} เรียบร้อยแล้ว`);
    } catch (err) {
      console.error("Error uploading banner:", err);
      toast.error('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setBannerUploading(null);
      setBannerProgress(0);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    const toastId = toast.loading(editingProduct ? 'กำลังอัปเดตสินค้า...' : 'กำลังเพิ่มสินค้าใหม่...');
    const formData = new FormData(e.target as HTMLFormElement);
    let mainImageUrl = formData.get('image') as string;
    let additionalImages: string[] = editingProduct?.images || [];

    try {
      // Parallelize all image uploads
      const uploadPromises = [];

      // Handle main image
      if (productFiles[0]) {
        const uploadMain = async () => {
          try {
            mainImageUrl = await compressAndUploadImage(productFiles[0]!, 'products', 800, 800, 0.7, undefined, true);
          } catch (err) {
            console.warn("Main image upload failed, fallback to Base64:", err);
            mainImageUrl = await compressImageToBase64(productFiles[0]!, 600, 0.3);
          }
        };
        uploadPromises.push(uploadMain());
      }

      // Handle additional images (indices 1-4)
      const newAdditionalImages = [...additionalImages];
      for (let i = 1; i < 5; i++) {
        if (productFiles[i]) {
          const uploadAdditional = async (index: number) => {
            try {
              const url = await compressAndUploadImage(productFiles[index]!, 'products', 800, 800, 0.7, undefined, true);
              newAdditionalImages[index - 1] = url;
            } catch (err) {
              console.warn(`Additional image ${index} upload failed, fallback to Base64:`, err);
              const b64 = await compressImageToBase64(productFiles[index]!, 400, 0.15);
              newAdditionalImages[index - 1] = b64;
            }
          };
          uploadPromises.push(uploadAdditional(i));
        }
      }

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }
      
      // Filter out empty slots if needed, but keeping them as is for now
      const finalAdditionalImages = newAdditionalImages.filter(img => img && img.length > 0).slice(0, 4);

      const productData = {
        name: formData.get('name') as string,
        price: Number(formData.get('price')),
        discountPrice: formData.get('discountPrice') ? Number(formData.get('discountPrice')) : null,
        stock: Number(formData.get('stock')) || 0,
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        image: mainImageUrl,
        images: finalAdditionalImages,
        rating: Number(formData.get('rating')) || 5,
        reviews: Number(formData.get('reviews')) || 0,
        updatedAt: serverTimestamp()
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData).catch(e => handleFirestoreError(e, OperationType.UPDATE, `products/${editingProduct.id}`));
        // No manual state update - handled by onSnapshot
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp()
        }).catch(e => {
          handleFirestoreError(e, OperationType.CREATE, 'products');
          throw e;
        });
        // No manual state update - handled by onSnapshot
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductFiles([null, null, null, null, null]);
      toast.success('บันทึกสินค้าเรียบร้อยแล้ว', { id: toastId });
    } catch (error) {
      console.error("Error saving product:", error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกสินค้า', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบสินค้านี้?')) {
      try {
        await deleteDoc(doc(db, 'products', productId)).catch(e => handleFirestoreError(e, OperationType.DELETE, `products/${productId}`));
        setProducts(prev => prev.filter(p => p.id !== productId));
        toast.success('ลบสินค้าเรียบร้อยแล้ว');
      } catch (error) {
        console.error("Error deleting product:", error);
        toast.error('เกิดข้อผิดพลาดในการลบสินค้า');
      }
    }
  };

  const deleteUser = async (userId: string, userEmail?: string) => {
    // Prevent deleting system administrators
    if (userEmail && allowedAdmins.includes(userEmail)) {
      toast.error('ไม่สามารถลบผู้ดูแลระบบได้');
      return;
    }

    if (userId === 'HIsfiO4Vh6MTUYT6QZToCWjqpHn1' || userId === '6WkoIIyNCZef1NP6aoHtMKOoeSo1') {
      toast.error('ไม่สามารถลบผู้ดูแลระบบหลักของได้');
      return;
    }

    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลลูกค้าท่านนี้? การกระทำนี้ไม่สามารถย้อนกลับได้ (รวมถึงบัญชีผู้ใช้จะถูกลบออกจากระบบด้วย)')) {
      const toastId = toast.loading('กำลังลบข้อมูลลูกค้าและบัญชีผู้ใช้...');
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('ไม่พบข้อมูลยืนยันตัวตนของผู้ดูแลระบบ');

        const response = await fetch(`/api/admin/delete-user/${userId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json'
          }
        });

        const isJson = response.headers.get('content-type')?.includes('application/json');

        if (!response.ok || !isJson) {
          let errorMessage = 'การลบล้มเหลว หรือไม่มีบริการ API คลาวด์';
          let errorData: any = null;
          if (isJson) {
            try {
              const errorText = await response.text();
              try {
                errorData = JSON.parse(errorText);
                errorMessage = errorData.error || errorMessage;
              } catch (e) {
                errorMessage = `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`;
              }
            } catch (e) {
              errorMessage = `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${response.statusText || 'Internal Server Error'}`;
            }
          }

          // FALLBACK: If API failed, try deleting Firestore doc directly (rules allow this for Admin)
          console.warn("API User deletion failed, attempting Firestore fallback...", errorMessage);
          try {
            await deleteDoc(doc(db, 'users', userId)); 
            console.log("Firestore fallback deletion successful");
            
            setUsers(prev => prev.filter(u => u.id !== userId));
            toast.success('ลบข้อมูลลูกค้าจากฐานข้อมูลแล้ว (ข้อมูลในระบบยืนยันตัวตนอาจยังมีอยู่)', { id: toastId });
            return;
          } catch (fallbackErr: any) {
            console.error("Firestore fallback also failed:", fallbackErr);
            throw new Error(`ลบไม่สำเร็จ: ${errorMessage} (Fallback Error: ${fallbackErr.message})`);
          }
        }

        const data = await response.json();
        if (data.authDeleted || data.firestoreDeleted) {
          setUsers(prev => prev.filter(u => u.id !== userId));
          
          if (data.authDeleted && data.firestoreDeleted) {
            toast.success('ลบข้อมูลลูกค้าและบัญชีผู้ใช้ออกสมบูรณ์แล้ว', { id: toastId });
          } else if (data.firestoreDeleted) {
            toast.success('ลบข้อมูลจากฐานข้อมูลแล้ว แต่ยังไม่สามารถลบบัญชีผู้ใช้ในระบบ Auth ได้ (อาจต้องตั้งค่า Service Account บน Vercel)', { id: toastId, duration: 6000 });
          } else {
            toast.success('ลบบัญชีผู้ใช้ในระบบ Auth แล้ว แต่ลบในฐานข้อมูลไม่สำเร็จ', { id: toastId });
          }
        } else {
          // If the API says neither was deleted, don't update UI
          throw new Error('เซิร์ฟเวอร์รายงานว่าไม่มีการลบข้อมูลใดๆ');
        }
      } catch (error: any) {
        console.error("Error deleting user:", error);
        toast.error(`ไม่สามารถลบข้อมูลลูกค้าได้: ${error.message || 'โปรดลองอีกครั้ง'}`, { id: toastId });
      }
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const userData: any = {
      displayName: formData.get('displayName') as string,
      email: formData.get('email') as string,
      phoneNumber: formData.get('phoneNumber') as string,
      points: Number(formData.get('points')),
      updatedAt: serverTimestamp()
    };

    if (!editingUser) {
      userData.email = formData.get('email') as string;
      userData.uid = formData.get('uid') as string;
      userData.createdAt = serverTimestamp();
    }

    try {
      if (editingUser) {
        // Update Auth record via API if important fields changed
        const idToken = await auth.currentUser?.getIdToken();
        if (idToken) {
          try {
            const authResponse = await fetch(`/api/admin/update-user/${editingUser.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                email: userData.email,
                displayName: userData.displayName,
                phoneNumber: userData.phoneNumber
              })
            });
            
            const isJson = authResponse.headers.get('content-type')?.includes('application/json');
            if (!authResponse.ok) {
              const authError = isJson ? await authResponse.json() : { error: 'API endpoint not available or returned non-JSON template' };
              console.warn("Auth update failed:", authError);
              toast.error(`ไม่สามารถอัปเดต Auth: ${authError.error}`);
            } else {
              console.log("Auth record updated successfully");
            }
          } catch (apiErr) {
            console.error("API call to update-user failed:", apiErr);
          }
        }

        await updateDoc(doc(db, 'users', editingUser.id), userData).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${editingUser.id}`));
        // Use local date for optimistic UI to avoid serverTimestamp().toDate() crash
        const localUpdate = { ...userData, updatedAt: new Date(), id: editingUser.id };
        setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...localUpdate } : u));
      } else {
        const uid = formData.get('uid') as string;
        if (!uid) throw new Error('กรุณาระบุ User UID จาก Firebase Console');
        await setDoc(doc(db, 'users', uid), userData).catch(e => handleFirestoreError(e, OperationType.CREATE, `users/${uid}`));
        const localNew = { ...userData, createdAt: new Date(), updatedAt: new Date(), id: uid };
        setUsers(prev => [localNew, ...prev]);
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
      toast.success('บันทึกข้อมูลลูกค้าเรียบร้อยแล้ว');
    } catch (error: any) {
      console.error("Error saving user:", error);
      toast.error(`ไม่สามารถบันทึกข้อมูลลูกค้าได้: ${error.message || 'โปรดลองอีกครั้ง'}`);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!email) return;
    if (window.confirm(`คุณต้องการส่งอีเมลรีเซ็ตรหัสผ่านไปยัง ${email} ใช่หรือไม่?`)) {
      try {
        await sendPasswordResetEmail(auth, email);
        alert('ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อยแล้ว');
      } catch (error: any) {
        console.error("Error sending reset email:", error);
        if (error.code === 'auth/quota-exceeded') {
          alert('ขออภัย: อีเมลรีเซ็ตรหัสผ่านเกินโควตาสำหรับวันนี้แล้ว โปรดลองอีกครั้งในภายหลัง');
        } else if (error.code === 'auth/too-many-requests') {
          alert('คุณส่งคำขอมากเกินไปชั่วคราว โปรดรอสักครู่แล้วลองใหม่อีกครั้ง');
        } else {
          alert('ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ' + (error.message || 'โปรดลองอีกครั้ง'));
        }
      }
    }
  };

  const seedProducts = async (isSilent = false) => {
    if (isSilent || window.confirm('ต้องการนำเข้าสินค้าเริ่มต้น 20+ รายการใช่หรือไม่? (สินค้าเดิมจะไม่ถูกลบ)')) {
      const toastId = toast.loading(isSilent ? 'กำลังเตรียมข้อมูลระบบครั้งแรก...' : 'กำลังนำเข้าสินค้า...');
      try {
        let successCount = 0;
        let failCount = 0;
        
        // Execute sequentially to be safe and provide easier debugging if it fails
        for (const product of PRODUCTS) {
          try {
            const { id, ...data } = product;
            // Removed existence check to avoid composite index requirements
            await addDoc(collection(db, 'products'), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            successCount++;
          } catch (e: any) {
            console.error(`Failed to seed ${product.name}:`, e);
            // Report specific quota error
            if (e.message?.includes('Quota exceeded')) {
              toast.error('โควตาการใช้งานฐานข้อมูลเต็มแล้ว (Quota Exceeded)', { id: toastId });
              return;
            }
            failCount++;
          }
        }
        
        toast.success(`นำเข้าสำเร็จ ${successCount} รายการ${failCount > 0 ? ` (ล้มเหลว ${failCount} รายการ)` : ''}`, { id: toastId });
        if (successCount > 0) {
          fetchDbStats();
        }
      } catch (error) {
        console.error("Error seeding products:", error);
        toast.error('เกิดข้อผิดพลาดในการนำเข้าสินค้า', { id: toastId });
      }
    }
  };

  const deleteSampleProducts = async () => {
    const toastId = toast.loading('กำลังลบสินค้าตัวอย่าง...');
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const docCount = querySnapshot.size;
      if (docCount === 0) {
        toast.success('ไม่มีสินค้าในระบบที่ต้องลบ', { id: toastId });
        return;
      }

      const sampleNames = PRODUCTS.map(p => p.name);
      let deletedCount = 0;

      for (const docSnap of querySnapshot.docs) {
        const productData = docSnap.data();
        if (sampleNames.includes(productData.name)) {
          await deleteDoc(doc(db, 'products', docSnap.id));
          deletedCount++;
        }
      }

      toast.success(`ลบสินค้าตัวอย่างสำเร็จแล้ว ${deletedCount} รายการ`, { id: toastId });
      fetchDbStats();
    } catch (error) {
      console.error("Error deleting sample products:", error);
      toast.error('เกิดข้อผิดพลาดในการลบสินค้าตัวอย่าง', { id: toastId });
    }
  };

  const clearAllProducts = async () => {
    const toastId = toast.loading('กำลังลบสินค้าทั้งหมด...');
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      let deletedCount = 0;
      for (const docSnap of querySnapshot.docs) {
        await deleteDoc(doc(db, 'products', docSnap.id));
        deletedCount++;
      }

      toast.success(`ลบสินค้าทั้งหมดสำเร็จแล้ว ${deletedCount} รายการ`, { id: toastId });
      fetchDbStats();
    } catch (error) {
      console.error("Error clearing all products:", error);
      toast.error('เกิดข้อผิดพลาดในการลบสินค้าทั้งหมด', { id: toastId });
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setUploadProgress(0);
    const toastId = toast.loading('กำลังบันทึกการตั้งค่า...');
    try {
      let updatedSettings = { ...shopSettings };
      const uploadPromises = [];

      if (logoFile) {
        const uploadLogo = async () => {
          try {
            updatedSettings.logoUrl = await compressAndUploadImage(
              logoFile, 
              'settings', 
              400, 
              400, 
              0.6,
              (progress) => setUploadProgress(prev => Math.max(prev, Math.round(progress))),
              true // skip retry for faster fallback
            );
          } catch (err) {
            console.warn("Logo storage upload failed, falling back to Base64:", err);
            updatedSettings.logoUrl = await compressImageToBase64(logoFile, 200, 0.1);
          }
        };
        uploadPromises.push(uploadLogo());
      }

      if (qrFile) {
        const uploadQr = async () => {
          try {
            updatedSettings.promptPayQrUrl = await compressAndUploadImage(
              qrFile, 
              'settings', 
              600, 
              600, 
              0.6,
              (progress) => setUploadProgress(prev => Math.max(prev, Math.round(progress))),
              true // skip retry for faster fallback
            );
          } catch (err) {
            console.warn("QR storage upload failed, falling back to Base64:", err);
            updatedSettings.promptPayQrUrl = await compressImageToBase64(qrFile, 400, 0.2);
          }
        };
        uploadPromises.push(uploadQr());
      }

      if (uploadPromises.length > 0) {
        await Promise.all(uploadPromises);
      }

      await setDoc(doc(db, 'settings', 'shop'), updatedSettings).catch(e => handleFirestoreError(e, OperationType.WRITE, 'settings/shop'));
      setShopSettings(updatedSettings);
      setLogoFile(null);
      setQrFile(null);
      toast.success('บันทึกการตั้งค่าเรียบร้อยแล้ว', { id: toastId });
    } catch (error) {
      console.error("Error saving settings:", error);
      if (error instanceof Error && error.message.includes('permissions')) {
        toast.error('คุณไม่มีสิทธิ์บันทึกการตั้งค่า กรุณาตรวจสอบว่าคุณเข้าสู่ระบบด้วยอีเมลที่ถูกต้อง', { id: toastId });
      } else {
        toast.error('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า', { id: toastId });
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const categoryData = {
      name: formData.get('name') as string,
      updatedAt: serverTimestamp()
    };

    try {
      if (editingCategory) {
        await updateDoc(doc(db, 'categories', editingCategory.id), categoryData)
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `categories/${editingCategory.id}`));
      } else {
        await addDoc(collection(db, 'categories'), {
          ...categoryData,
          createdAt: serverTimestamp()
        }).catch(e => {
          handleFirestoreError(e, OperationType.CREATE, 'categories');
          throw e;
        });
      }
      
      setIsCategoryModalOpen(false);
      toast.success('บันทึกหมวดหมู่เรียบร้อยแล้ว');
    } catch (err) {
      console.error("Error saving category:", err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกหมวดหมู่');
    }
  };

  const deleteCategory = async (id: string) => {
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบหมวดหมู่นี้?')) {
      try {
        await deleteDoc(doc(db, 'categories', id))
          .catch(e => handleFirestoreError(e, OperationType.DELETE, `categories/${id}`));
        setCategories(prev => prev.filter(c => c.id !== id));
        toast.success('ลบหมวดหมู่เรียบร้อยแล้ว');
      } catch (err) {
        console.error("Error deleting category:", err);
        toast.error('เกิดข้อผิดพลาดในการลบหมวดหมู่');
      }
    }
  };

  const updateStock = async (productId: string, amount: number) => {
    try {
      const productRef = doc(db, 'products', productId);
      await updateDoc(productRef, {
        stock: increment(amount),
        updatedAt: serverTimestamp()
      }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `products/${productId}`));
      
      // Update local state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: Math.max(0, (p.stock || 0) + amount) } : p));
    } catch (err) {
      console.error("Error updating stock:", err);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const couponData = {
      code: (formData.get('code') as string).toUpperCase(),
      type: formData.get('type') as string,
      value: Number(formData.get('value')),
      minPurchase: Number(formData.get('minPurchase')) || 0,
      maxDiscount: Number(formData.get('maxDiscount')) || null,
      startDate: formData.get('startDate') as string || null,
      endDate: formData.get('endDate') as string || null,
      usageLimit: Number(formData.get('usageLimit')) || null,
      isActive: formData.get('isActive') === 'true',
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), couponData)
          .catch(e => handleFirestoreError(e, OperationType.UPDATE, `coupons/${editingCoupon.id}`));
      } else {
        await addDoc(collection(db, 'coupons'), {
          ...couponData,
          usageCount: 0,
          createdAt: serverTimestamp(),
        }).catch(e => {
          handleFirestoreError(e, OperationType.CREATE, 'coupons');
          throw e;
        });
      }
      setIsCouponModalOpen(false);
      setEditingCoupon(null);
      toast.success('บันทึกคูปองเรียบร้อยแล้ว');
    } catch (err) {
      console.error("Error saving coupon:", err);
      toast.error('เกิดข้อผิดพลาดในการบันทึกคูปอง');
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบคูปองนี้?')) return;
    try {
      await deleteDoc(doc(db, 'coupons', couponId))
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `coupons/${couponId}`));
      setCoupons(prev => prev.filter(c => c.id !== couponId));
      toast.success('ลบคูปองเรียบร้อยแล้ว');
    } catch (err) {
      console.error("Error deleting coupon:", err);
      toast.error('เกิดข้อผิดพลาดในการลบคูปอง');
    }
  };

  const deleteSlip = async (slipId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบหลักฐานการโอนเงินนี้?')) return;
    try {
      await deleteDoc(doc(db, 'slips', slipId))
        .catch(e => handleFirestoreError(e, OperationType.DELETE, `slips/${slipId}`));
      setSlips(prev => prev.filter(s => s.id !== slipId));
      toast.success('ลบหลักฐานการโอนเงินเรียบร้อยแล้ว');
    } catch (err) {
      console.error("Error deleting slip:", err);
      toast.error('เกิดข้อผิดพลาดในการลบสลิป');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('rumahsekolah_admin_ui_auth');
      navigate('/admin/login');
    } catch (err) {
      console.error(err);
    }
  };

  const filteredOrders = orders.filter(order => 
    order.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (searchTerm.toLowerCase() === 'stock<5' && (product.stock || 0) < 5)
  );

  if (authLoading || settingsLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-6 bg-gray-200 rounded w-48" />
              <div className="h-4 bg-gray-200 rounded w-64" />
            </div>
          </div>
        </div>

        {/* Sidebar Layout Skeleton */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Sidebar Navigation Skeleton */}
          <aside className="w-full lg:w-72 flex-shrink-0">
            <div className="bg-white rounded-3xl border border-gray-100 p-3 space-y-2">
              <div className="px-4 py-3 border-b border-gray-50">
                <div className="h-3 bg-gray-200 rounded w-24 mb-1" />
              </div>
              {Array.from({ length: 11 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-gray-100" />
                  <div className="h-4 bg-gray-150 rounded w-28" />
                </div>
              ))}
            </div>
          </aside>

          {/* Main Content Area Skeleton */}
          <div className="flex-1 w-full space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-3xl border border-gray-50 p-5 h-24" />
              ))}
            </div>
            <div className="bg-white rounded-3xl border border-gray-50 p-6 h-96" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-2xl flex items-center gap-3 border border-red-100 shadow-sm">
          <ShieldAlert size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      
      {quotaError && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-orange-500" size={20} />
              <p className="text-xs font-bold text-orange-700">{quotaError}</p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 bg-orange-600 text-white rounded-lg text-[10px] font-bold hover:bg-orange-700 transition-all whitespace-nowrap"
            >
              Refresh
            </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">แผงควบคุมผู้ดูแลระบบ</h1>
            <p className="text-gray-500 text-[10px] sm:text-xs">ยินดีต้อนรับกลับมาจัดการร้านค้า RumahSekolah</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLogout}
            className="hidden items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold text-sm transition-all"
          >
            <LogOut size={16} /> ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Sidebar Layout Container */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left Sidebar Navigation */}
        <aside className={`w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-8 z-10 ${tab ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 overflow-hidden p-3 space-y-1">
            <div className="px-4 py-3 mb-2 border-b border-gray-50">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">เมนูจัดการร้านค้า</p>
            </div>
            {[
              { id: 'orders', label: 'คำสั่งซื้อ', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50' },
              { id: 'products', label: 'จัดการสินค้า', icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
              { id: 'inventory', label: 'สต็อกสินค้า', icon: Truck, color: 'text-orange-600', bg: 'bg-orange-50' },
              { id: 'categories', label: 'จัดการหมวดหมู่', icon: PackageSearch, color: 'text-pink-600', bg: 'bg-pink-50' },
              { id: 'customers', label: 'จัดการลูกค้า', icon: Users, color: 'text-teal-600', bg: 'bg-teal-50' },
              { id: 'coupons', label: 'คูปองส่วนลด', icon: Ticket, color: 'text-rose-600', bg: 'bg-rose-50' },
              { id: 'slips', label: 'หลักฐานการโอน', icon: Camera, color: 'text-indigo-600', bg: 'bg-indigo-50' },
              { id: 'banners', label: 'แบนเนอร์หน้าแรก', icon: Image, color: 'text-purple-600', bg: 'bg-purple-50' },
              { id: 'settings', label: 'ตั้งค่าร้านค้า', icon: Settings, color: 'text-amber-600', bg: 'bg-amber-50' },
              { id: 'stats', label: 'สถิติ', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { id: 'system', label: 'ระบบฐานข้อมูล', icon: Activity, color: 'text-red-600', bg: 'bg-red-50' },
            ].map((menuItem) => (
              <button
                key={menuItem.id}
                onClick={() => {
                  navigate(`/admin/dashboard/${menuItem.id}`);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full flex items-center justify-between group px-4 py-3 rounded-2xl transition-all duration-300 ${
                  activeTab === menuItem.id 
                    ? 'bg-orange-600 text-white shadow-xl shadow-orange-600/30' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2 rounded-xl transition-colors ${
                    activeTab === menuItem.id ? 'bg-white/20' : `${menuItem.bg} ${menuItem.color}`
                  }`}>
                    <menuItem.icon size={18} />
                  </div>
                  <span className="text-sm font-black tracking-tight">{menuItem.label}</span>
                </div>
                <ArrowRight size={14} className={`opacity-0 -translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 ${activeTab === menuItem.id ? 'opacity-100 translate-x-0' : ''}`} />
              </button>
            ))}

            <div className="pt-4 mt-4 border-t border-gray-50 px-2 pb-2">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl font-black text-sm transition-all"
              >
                <div className="p-2 bg-red-50 rounded-xl">
                  <LogOut size={18} />
                </div>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 w-full space-y-6 min-w-0 ${!tab ? 'hidden lg:block' : 'block'}`}>
          {/* Mobile Back Button */}
          <div className="lg:hidden mb-2">
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-2 text-gray-500 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm"
            >
              <ArrowLeft size={16} />
              กลับไปที่เมนู
            </button>
          </div>

      {/* Search Bar (Only for Orders, Products, and Customers) */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        {(activeTab === 'orders' || activeTab === 'products' || activeTab === 'customers') && (
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder={
                activeTab === 'orders' ? "ค้นหาชื่อลูกค้าหรือเลขที่สั่งซื้อ..." : 
                activeTab === 'products' ? "ค้นหาชื่อสินค้าหรือหมวดหมู่..." :
                "ค้นหาชื่อลูกค้าหรืออีเมล..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 w-full text-sm transition-all"
            />
          </div>
        )}
        
        {activeTab === 'customers' && (
          <button 
            onClick={() => {setEditingUser(null); setIsUserModalOpen(true);}}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-sm hover:bg-orange-700 shadow-lg shadow-orange-600/20 transition-all"
          >
            <Plus size={16} /> เพิ่มลูกค้าใหม่
          </button>
        )}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="space-y-4"
        >
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">รายการคำสั่งซื้อ ({orders.length})</h2>
              <button 
                onClick={async () => {
                  try {
                    setIsRefreshing(true);
                    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
                    const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'orders'));
                    if (snapshot) {
                      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                      setOrders(ordersData);
                      setLastOrderDoc(snapshot.docs[snapshot.docs.length - 1] || null);
                      setHasMoreOrders(snapshot.docs.length === PAGE_SIZE);
                    }
                    await fetchRealStats();
                  } catch (err) {
                    console.error("Error fetching orders:", err);
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
              >
                <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} /> 
                {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
              </button>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                    <th className="px-4 py-4">เลขที่สั่งซื้อ / วันที่</th>
                    <th className="px-4 py-4">ลูกค้า</th>
                    <th className="px-4 py-4">รายการสินค้า</th>
                    <th className="px-4 py-4">ยอดรวม</th>
                    <th className="px-4 py-4">สถานะ</th>
                    <th className="px-4 py-4">แต้มที่ได้รับ</th>
                    <th className="px-4 py-4 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence>
                    {filteredOrders.map((order) => (
                      <motion.tr 
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            <p className="font-mono text-xs font-bold text-gray-400">#{order.id.slice(-8).toUpperCase()}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(order.createdAt, true)}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            <p className="font-bold text-gray-900 text-sm">{order.customer.name}</p>
                            <p className="text-xs text-gray-500 font-medium">{order.customer.phone}</p>
                            <p className="text-xs text-gray-400 truncate max-w-[200px]">{order.customer.address}</p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-0.5">
                            {getSafeItemsArray(order.items).map((item: any, idx: number) => (
                              <p key={idx} className="text-xs text-gray-600 font-medium">
                                • {item.name} <span className="text-gray-400">x{item.quantity}</span>
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-bold text-orange-600 text-sm">฿{order.total.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <select 
                              value={order.status}
                              onChange={(e) => updateStatus(order.id, e.target.value)}
                              className="text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-500 cursor-pointer"
                            >
                              <option value="pending">รอดำเนินการ</option>
                              <option value="processing">กำลังเตรียมของ</option>
                              <option value="shipped">จัดส่งแล้ว</option>
                              <option value="delivered">ได้รับสินค้าแล้ว</option>
                              <option value="cancelled">ยกเลิก</option>
                            </select>
                            {order.trackingNumber && (
                              <div className="text-[10px] text-gray-400 mt-1 font-bold flex items-center gap-1.5 flex-wrap">
                                <p>{order.shippingCompany}: <span className="text-gray-900">{order.trackingNumber}</span></p>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => copyToClipboard(order.trackingNumber)}
                                    className="p-1 hover:bg-orange-50 rounded text-orange-600 transition-colors shadow-sm bg-white border border-gray-100"
                                    title="คัดลอกเลขพัสดุ"
                                  >
                                    <Copy size={10} /> 
                                  </button>
                                  {getTrackingLink(order.shippingCompany, order.trackingNumber) !== '#' && (
                                    <a 
                                      href={getTrackingLink(order.shippingCompany, order.trackingNumber)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 hover:bg-orange-50 rounded text-orange-600 transition-colors shadow-sm bg-white border border-gray-100"
                                      title="ติดตามพัสดุ"
                                    >
                                      <Globe size={10} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-orange-600 font-black group text-sm">
                            <Coins size={14} />
                            {order.pointsEarned || 0}
                            <button 
                              onClick={async () => {
                                const newPoints = prompt('ระบุแต้มที่ต้องการแก้ไข:', (order.pointsEarned || 0).toString());
                                if (newPoints !== null) {
                                  const points = Number(newPoints);
                                  if (!isNaN(points)) {
                                    try {
                                      const orderRef = doc(db, 'orders', order.id);
                                      const oldPoints = order.pointsEarned || 0;
                                      await updateDoc(orderRef, { pointsEarned: points });
                                      
                                      // If order is delivered, update user's points too
                                      if (order.status === 'delivered' && order.customer?.uid) {
                                        const userRef = doc(db, 'users', order.customer.uid);
                                        await updateDoc(userRef, {
                                          points: increment(points - oldPoints)
                                        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${order.customer.uid}`));
                                      }
                                      
                                      // Update local state
                                      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, pointsEarned: points } : o));
                                      alert('บันทึกแต้มเรียบร้อยแล้ว');
                                    } catch (err) {
                                      console.error("Error updating order points:", err);
                                      alert('เกิดข้อผิดพลาดในการบันทึกแต้ม');
                                    }
                                  }
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-all font-normal"
                              title="แก้ไขแต้ม"
                            >
                              <Edit2 size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.paymentSlip && (
                              <button 
                                onClick={() => setSelectedSlip(order.paymentSlip || order.paymentSlipBase64)}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                title="ดูสลิปการชำระเงิน"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            {getSafeItemsArray(order.items).map((item: any, idx: number) => (
                              <p key={idx} className="text-xs text-gray-600 font-medium">
                                • {item.name} <span className="text-gray-400">x{item.quantity}</span>
                              </p>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-bold text-orange-600 text-sm">฿{order.total.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            <select 
                              value={order.status}
                              onChange={(e) => updateStatus(order.id, e.target.value)}
                              className="text-xs font-bold bg-gray-50 border-none rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-500 cursor-pointer"
                            >
                              <option value="pending">รอดำเนินการ</option>
                              <option value="processing">กำลังเตรียมของ</option>
                              <option value="shipped">จัดส่งแล้ว</option>
                              <option value="delivered">ได้รับสินค้าแล้ว</option>
                            </select>
                            {order.trackingNumber && (
                              <div className="text-[10px] text-gray-400 mt-1 font-bold flex items-center gap-1.5 flex-wrap">
                                <p>{order.shippingCompany}: <span className="text-gray-900">{order.trackingNumber}</span></p>
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => copyToClipboard(order.trackingNumber)}
                                    className="p-1 hover:bg-orange-50 rounded text-orange-600 transition-colors shadow-sm bg-white border border-gray-100"
                                    title="คัดลอกเลขพัสดุ"
                                  >
                                    <Copy size={10} /> 
                                  </button>
                                  {getTrackingLink(order.shippingCompany, order.trackingNumber) !== '#' && (
                                    <a 
                                      href={getTrackingLink(order.shippingCompany, order.trackingNumber)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 hover:bg-orange-50 rounded text-orange-600 transition-colors shadow-sm bg-white border border-gray-100"
                                      title="ติดตามพัสดุ"
                                    >
                                      <Globe size={10} />
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-1 text-orange-600 font-black group text-sm">
                            <Coins size={14} />
                            {order.pointsEarned || 0}
                            <button 
                              onClick={async () => {
                                const newPoints = prompt('ระบุแต้มที่ต้องการแก้ไข:', (order.pointsEarned || 0).toString());
                                if (newPoints !== null) {
                                  const points = Number(newPoints);
                                  if (!isNaN(points)) {
                                    try {
                                      const orderRef = doc(db, 'orders', order.id);
                                      const oldPoints = order.pointsEarned || 0;
                                      await updateDoc(orderRef, { pointsEarned: points });
                                      
                                      // If order is delivered, update user's points too
                                      if (order.status === 'delivered' && order.customer?.uid) {
                                        const userRef = doc(db, 'users', order.customer.uid);
                                        await updateDoc(userRef, {
                                          points: increment(points - oldPoints)
                                        }).catch(e => handleFirestoreError(e, OperationType.UPDATE, `users/${order.customer.uid}`));
                                      }
                                      
                                      // Update local state
                                      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, pointsEarned: points } : o));
                                      alert('บันทึกแต้มเรียบร้อยแล้ว');
                                    } catch (err) {
                                      console.error("Error updating order points:", err);
                                      alert('เกิดข้อผิดพลาดในการบันทึกแต้ม');
                                    }
                                  }
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-orange-600 opacity-0 group-hover:opacity-100 transition-all font-normal"
                              title="แก้ไขแต้ม"
                            >
                              <Edit2 size={10} />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {order.paymentSlip && (
                              <button 
                                onClick={() => setSelectedSlip(order.paymentSlip || order.paymentSlipBase64)}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                                title="ดูสลิปการชำระเงิน"
                              >
                                <Eye size={16} />
                              </button>
                            )}
                            {order.status === 'processing' && (
                              <button 
                                onClick={() => {
                                  setSelectedLabelData({
                                    type: 'order',
                                    id: order.id,
                                    customerName: order.customer.name,
                                    phone: order.customer.phone,
                                    address: order.customer.address,
                                    items: order.items
                                  });
                                  setIsLabelModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="พิมพ์ใบปะหน้า"
                              >
                                <Printer size={16} />
                              </button>
                            )}
                            <a 
                              href={`https://line.me/R/msg/text/?${encodeURIComponent(`สวัสดีครับคุณ ${order.customer.name} \n\n📱 ขอบคุณที่สั่งซื้อสินค้าจาก ${shopSettings.name || 'RumahSekolah'} \n📦 ออเดอร์ #${order.id.slice(-8).toUpperCase()} \n✅ สถานะ: ${order.status === 'pending' ? 'รอดำเนินการ' : order.status === 'processing' ? 'กำลังเตรียมของ' : order.status === 'shipped' ? 'จัดส่งแล้ว' : 'ได้รับสินค้าแล้ว'} \n${order.trackingNumber ? `\n🚚 เลขพัสดุ: ${order.trackingNumber} (${order.shippingCompany}) \n📍 ติดตามได้ที่: ${getTrackingLink(order.shippingCompany, order.trackingNumber)}` : ''} \n\nตรวจสอบสถานะออเดอร์ได้ที่: ${window.location.origin}/profile \nขอบคุณครับ ✨`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-[#06C755] hover:bg-green-50 rounded-lg transition-all"
                              title="ส่งข้อความแจ้งเตือนทาง LINE"
                            >
                              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                                <path d="M24 10.304c0-5.231-5.383-9.486-12-9.486s-12 4.255-12 9.486c0 4.69 4.27 8.613 10.046 9.348.392.085.923.258 1.058.592.121.301.079.771.038 1.074l-.164 1.027c-.045.301-.24 1.186 1.035.644 1.275-.541 6.89-4.053 9.405-6.939 1.725-1.838 2.582-3.746 2.582-5.746zm-15.659 3.105h-2.611c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.146h1.93c.375 0 .681.306.681.682s-.306.682-.681.682zm3.671-.682c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.837zm5.603 0c0 .348-.261.641-.604.677l-.077.005h-2.587c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682h2.587c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682zm5.482-3.837v3.837c0 .376-.306.682-.681.682s-.681-.306-.681-.682v-2.547l-2.22 2.994c-.114.153-.276.249-.451.249h-.027c-.171-.012-.323-.104-.411-.251l-2.233-3.007v2.562c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.214.102-.415.273-.541.171-.126.391-.153.587-.074l2.963 3.991 2.963-3.991c.196-.079.416-.052.587.074.171.126.273.327.273.541z" />
                              </svg>
                            </a>
                            <button 
                              onClick={() => deleteOrder(order.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="ลบคำสั่งซื้อ"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {filteredOrders.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                  <ShoppingBag size={24} />
                </div>
                <p className="text-sm text-gray-500">ไม่พบข้อมูลคำสั่งซื้อ</p>
              </div>
            )}
            {hasMoreOrders && (
              <div className="p-4 text-center border-t border-gray-50">
                <button 
                  onClick={loadMoreOrders}
                  className="px-6 py-2 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-xl font-bold text-sm transition-all"
                >
                  โหลดเพิ่มเติม
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Inventory Alerts */}
            {products.some(p => (p.stock || 0) < 5) && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-center gap-3 text-orange-700"
              >
                <AlertTriangle size={18} className="flex-shrink-0" />
                <div className="flex-grow text-xs">
                  <p className="font-bold text-orange-800">พบสินค้าสต็อกต่ำ!</p>
                  <p className="text-orange-600">มี {products.filter(p => (p.stock || 0) < 5).length} รายการ ที่สต็อกเร่งด่วน</p>
                </div>
                <button 
                  onClick={() => setSearchTerm('stock<5')}
                  className="px-2 py-1 bg-orange-600 text-white rounded-lg text-[10px] font-bold uppercase transition-all hover:bg-orange-700"
                >
                  ดูรายการ
                </button>
              </motion.div>
            )}

            {/* Search filter and Category Quick Filter */}
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm space-y-3">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold" size={14} />
                <input 
                  type="text"
                  placeholder="ค้นหาชื่อสินค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all text-sm"
                />
              </div>
              
              <div className="flex flex-wrap gap-1.5 items-center overflow-x-auto no-scrollbar pb-1">
                <span className="text-[9px] font-bold text-gray-400 uppercase mr-1 whitespace-nowrap">กรองตาม:</span>
                <button 
                  onClick={() => setSearchTerm('')}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all whitespace-nowrap ${searchTerm === '' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                >
                  ทั้งหมด
                </button>
                <button 
                  onClick={() => setSearchTerm('stock<5')}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all whitespace-nowrap ${searchTerm === 'stock<5' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                >
                  สต็อกต่ำ
                </button>
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    onClick={() => setSearchTerm(cat.name)}
                    className={`px-2.5 py-1 rounded-full text-[9px] font-bold transition-all whitespace-nowrap ${searchTerm === cat.name ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-600 hover:bg-orange-100'}`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-gray-900 leading-tight">รายการสินค้า ({products.length})</h2>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    try {
                      setIsRefreshing(true);
                      const q = query(collection(db, 'products'), orderBy('name', 'asc'), limit(PAGE_SIZE));
                      const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'products'));
                      if (snapshot) {
                        const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        setProducts(productsData);
                        setLastProductDoc(snapshot.docs[snapshot.docs.length - 1] || null);
                        setHasMoreProducts(snapshot.docs.length === PAGE_SIZE);
                      }
                    } catch (err) {
                      console.error("Error fetching products:", err);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-[11px] transition-all disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
                <button 
                  onClick={() => {setEditingProduct(null); setIsProductModalOpen(true);}}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white hover:bg-orange-700 rounded-lg font-bold text-[11px] transition-all shadow-lg shadow-orange-600/20 whitespace-nowrap"
                >
                  <Plus size={14} /> สินค้าใหม่
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-400 text-[11px] font-black uppercase tracking-widest">
                      <th className="px-3 py-3">สินค้า</th>
                      <th className="px-3 py-3">หมวดหมู่</th>
                      <th className="px-3 py-3">ราคา</th>
                      <th className="px-3 py-3">สต็อก</th>
                      <th className="px-3 py-3">รีวิว</th>
                      <th className="px-3 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredProducts.map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <img src={getGoogleDriveDirectLink(product.image)} alt="" className="w-8 h-8 rounded-lg object-cover bg-gray-50" referrerPolicy="no-referrer" />
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate max-w-[150px]">{product.name}</p>
                              <p className="text-[10px] text-gray-400 truncate tracking-tighter">ID: {product.id.slice(-4)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <span className="px-1.5 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] font-bold uppercase border border-gray-100">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-bold text-gray-900 text-sm">฿{product.price.toLocaleString()}</span>
                        </td>
                        <td className="px-3 py-3">
                          <div className={`flex items-center gap-1 font-black text-xs ${product.stock < 5 ? 'text-red-500' : 'text-gray-500'}`}>
                            {product.stock || 0}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-0.5 text-xs text-gray-400 font-bold">
                            <Star size={10} className="text-yellow-400 fill-yellow-400" />
                            {product.rating}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => {setEditingProduct(product); setIsProductModalOpen(true);}}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => deleteProduct(product.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                              title="ลบสินค้า"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredProducts.length === 0 && (
                <div className="text-center py-16 space-y-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <Package size={24} />
                  </div>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">ไม่พบข้อมูลสินค้า</p>
                </div>
              )}
              {hasMoreProducts && (
                <div className="p-4 text-center border-t border-gray-50">
                  <button 
                    onClick={loadMoreProducts}
                    className="px-6 py-2 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-xl font-bold text-xs transition-all"
                  >
                    โหลดเพิ่มเติม
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'slips' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">คลังหลักฐานพัสดุ (Slips)</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Payment Evidence Inventory</p>
              </div>
              <button 
                onClick={async () => {
                  setIsRefreshing(true);
                  const q = query(collection(db, 'slips'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
                  const snapshot = await getDocs(q);
                  setSlips(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                  setLastSlipDoc(snapshot.docs[snapshot.docs.length - 1] || null);
                  setHasMoreSlips(snapshot.docs.length === PAGE_SIZE);
                  setIsRefreshing(false);
                }}
                className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-xl transition-all"
              >
                <RefreshCcw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {slips.map((slip) => (
                <motion.div 
                  key={slip.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm group hover:shadow-md transition-all"
                >
                  <div className="aspect-[3/4] relative overflow-hidden bg-gray-50">
                    <img 
                      src={getGoogleDriveDirectLink(slip.url || slip.base64)} 
                      alt="" 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                        onClick={() => setSelectedSlip(slip.url || slip.base64)}
                        className="p-2 bg-white text-gray-900 rounded-full hover:bg-orange-600 hover:text-white transition-all shadow-lg"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          const order = orders.find(o => o.id === slip.orderId);
                          if (order) {
                            setActiveTab('orders');
                            setSearchTerm(order.id);
                          } else {
                            toast.info('ไม่พบข้อมูลออเดอร์ดั้งเดิมในม่านตาการแสดงผลปัจจุบัน กรุณาค้นหาในแท็บออเดอร์');
                          }
                        }}
                        className="p-2 bg-white text-gray-900 rounded-full hover:bg-blue-600 hover:text-white transition-all shadow-lg"
                      >
                        <Search size={18} />
                      </button>
                      <button 
                        onClick={() => deleteSlip(slip.id)}
                        className="p-2 bg-white text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all shadow-lg"
                        title="ลบสลิป"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-400 font-mono">#{slip.orderId?.slice(-6).toUpperCase()}</p>
                      <p className="text-[9px] text-gray-400">
                        {formatDate(slip.createdAt)}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-gray-900 truncate">{slip.customerName}</p>
                    <p className="text-[10px] font-bold text-orange-600 tracking-tight">฿{slip.total?.toLocaleString()}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {slips.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
                <Camera size={48} className="mx-auto text-gray-200 mb-2" />
                <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">ยังไม่มีการอัปโหลดสลิป</p>
              </div>
            )}

            {hasMoreSlips && (
              <div className="text-center pt-4">
                <button 
                  onClick={loadMoreSlips}
                  className="px-8 py-3 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-2xl font-bold transition-all text-sm"
                >
                  โหลดหลักฐานเพิ่มเติม
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'banners' && (
          <div className="max-w-5xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">จัดการแบนเนอร์หน้าแรก</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Home Banners Configuration (3 Slides)</p>
              </div>
            </div>

            <form onSubmit={saveSettings} className="space-y-6 pb-12">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                    <Image size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-900">แบนเนอร์สไลด์แบบอัตโนมัติหน้าแรก (สลับทุกๆ 5 วินาที)</h3>
                    <p className="text-[10px] font-bold text-gray-400">กรุณาอัปโหลดรูปภาพ 16:9 และระบุข้อความเพื่อใช้สำหรับแต่ละแบนเนอร์สไลด์</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {[1, 2, 3].map(idx => (
                    <div key={idx} className="p-5 bg-gray-50/60 rounded-2xl border border-gray-100 space-y-4">
                      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full flex items-center justify-center">{idx}</span>
                          <h4 className="text-xs font-black text-purple-700 uppercase tracking-widest">Banner Slide {idx}</h4>
                        </div>
                        <span className={`${shopSettings[`banner${idx}`] ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'} px-2.5 py-1 rounded-lg text-[9px] font-bold`}>
                          {shopSettings[`banner${idx}`] ? 'ACTIVE' : 'EMPTY'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3.5">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">หัวข้อเล็ก (Tag)</label>
                            <input 
                              type="text"
                              value={shopSettings[`heroTag${idx}`] || ''}
                              onChange={e => setShopSettings({...shopSettings, [`heroTag${idx}`]: e.target.value})}
                              placeholder="เช่น คอลเลกชันใหม่..."
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">หัวข้อใหญ่ (Main Title)</label>
                            <input 
                              type="text"
                              value={shopSettings[`heroTitle${idx}`] || ''}
                              onChange={e => setShopSettings({...shopSettings, [`heroTitle${idx}`]: e.target.value})}
                              placeholder="หัวข้อใหญ่..."
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">คำบรรยาย (Subtitle)</label>
                            <textarea 
                              value={shopSettings[`heroSubtitle${idx}`] || ''}
                              onChange={e => setShopSettings({...shopSettings, [`heroSubtitle${idx}`]: e.target.value})}
                              placeholder="อธิบายสั้นๆ..."
                              rows={2}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-[10px] font-medium focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">รูปภาพแบนเนอร์ (สัดส่วนแนะนำ 16:9)</label>
                          
                          <div className="relative group/banner-upload overflow-hidden rounded-2xl bg-white border border-gray-200 hover:border-orange-300 transition-all aspect-video flex flex-col items-center justify-center gap-3">
                            {shopSettings[`banner${idx}`] ? (
                              <>
                                <img 
                                  src={getGoogleDriveDirectLink(shopSettings[`banner${idx}`])} 
                                  alt={`Banner ${idx}`} 
                                  className="absolute inset-0 w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/banner-upload:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-sm">
                                  <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl text-xs font-bold shadow-xl hover:scale-105 active:scale-95 transition-all">
                                    เปลี่ยนรูปภาพ
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBannerUpload(e, idx)} disabled={bannerUploading !== null} />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`ต้องการลบรูปแบนเนอร์ที่ ${idx} ใช่หรือไม่?`)) {
                                        setShopSettings({...shopSettings, [`banner${idx}`]: ''});
                                      }
                                    }}
                                    className="p-2.5 bg-white text-red-600 rounded-xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <label className="flex flex-col items-center gap-2 cursor-pointer group-hover/banner-upload:scale-105 transition-transform">
                                <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                                  <Camera size={24} />
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">เลือกรูปภาพแบนเนอร์</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleBannerUpload(e, idx)} disabled={bannerUploading !== null} />
                              </label>
                            )}

                            {bannerUploading === idx && (
                              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                <Loader2 className="animate-spin text-orange-600 mb-2" size={32} />
                                <span className="text-xs font-black text-orange-600 uppercase tracking-widest">
                                  {bannerProgress > 0 ? `กำลังอัปโหลด ${bannerProgress}%` : 'กำลังเตรียมไฟล์...'}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">Google Drive ID / URL</label>
                            <input 
                              type="text"
                              value={shopSettings[`banner${idx}`] || ''}
                              onChange={e => setShopSettings({...shopSettings, [`banner${idx}`]: e.target.value})}
                              placeholder="ID รูปภาพหรือลิงก์ภายนอก..."
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-[9px] font-mono focus:ring-1 focus:ring-orange-500 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <button 
                  type="submit"
                  disabled={uploading}
                  className="w-full md:w-auto px-8 py-3.5 bg-orange-600 text-white rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm uppercase tracking-widest"
                >
                  {uploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-white" />
                      กำลังบันทึกข้อมูล...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      บันทึกการตั้งค่าแบนเนอร์ทั้งหมด
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-5xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight">การตั้งค่าระบบ</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Shop & System Configuration</p>
              </div>
            </div>

            <form onSubmit={saveSettings} className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-12">
              <div className="lg:col-span-2 space-y-4">
                {/* Basic Info */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                      <Settings size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">ข้อมูลพื้นฐานร้านค้า</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ชื่อร้านค้า</label>
                      <input 
                        type="text"
                        value={shopSettings.name}
                        onChange={e => setShopSettings({...shopSettings, name: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">โลโก้ร้านค้า</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                          {(shopSettings.logoUrl || logoFile) ? (
                            <>
                              <img 
                                src={logoFile ? URL.createObjectURL(logoFile) : getGoogleDriveDirectLink(shopSettings.logoUrl)} 
                                alt="Logo Preview" 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <label className="cursor-pointer p-1.5 bg-white rounded-lg text-gray-600 shadow-sm hover:scale-110 active:scale-95 transition-all">
                                  <Camera size={16} />
                                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) setLogoFile(file);
                                  }} />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm('ต้องการลบโลโก้ร้านค้าใช่หรือไม่?')) {
                                      setLogoFile(null);
                                      setShopSettings({...shopSettings, logoUrl: ''});
                                    }
                                  }}
                                  className="p-1.5 bg-white rounded-lg text-red-600 shadow-sm hover:scale-110 active:scale-95 transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="flex flex-col items-center gap-1 cursor-pointer group-hover:scale-105 transition-all">
                              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                                <Camera size={20} />
                              </div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">เลือกรูป</span>
                              <input type="file" className="hidden" accept="image/*" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) setLogoFile(file);
                              }} />
                            </label>
                          )}
                        </div>
                        <div className="flex-grow space-y-1">
                          <p className="text-[10px] text-gray-400 font-bold leading-tight uppercase tracking-wider">
                            แนบไฟล์ภาพโลโก้
                          </p>
                          <p className="text-[9px] text-gray-400 font-medium leading-tight">
                            แนะนำรูปสี่เหลี่ยมจัตุรัส (.png, .jpg) <br/>
                            ขนาดไฟล์ไม่เกิน 2MB
                          </p>
                          {logoFile && (
                            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-black italic">
                              <div className="w-1 h-1 bg-orange-600 rounded-full animate-pulse" />
                              รอกดปุ่ม "บันทึกการตั้งค่า"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">คำอธิบายร้านค้า</label>
                    <textarea 
                      value={shopSettings.description}
                      onChange={e => setShopSettings({...shopSettings, description: e.target.value})}
                      rows={2}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">เบอร์โทรศัพท์</label>
                      <input 
                        type="text"
                        value={shopSettings.phone}
                        onChange={e => setShopSettings({...shopSettings, phone: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">อีเมล</label>
                      <input 
                        type="email"
                        value={shopSettings.email}
                        onChange={e => setShopSettings({...shopSettings, email: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ที่อยู่</label>
                      <input 
                        type="text"
                        value={shopSettings.address}
                        onChange={e => setShopSettings({...shopSettings, address: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">เวลาทำการ</label>
                      <input 
                        type="text"
                        value={shopSettings.workingHours}
                        onChange={e => setShopSettings({...shopSettings, workingHours: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Database Tools */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4 shadow-amber-500/5 transition-all">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-50 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                        <Database size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">จัดการฐานข้อมูล & เครื่องมือ</h3>
                        <p className="text-[10px] text-gray-400 font-medium">จัดการข้อมูลตัวอย่าง สถิติระบบ หรือล้างรายการ</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDbTools(!showDbTools)}
                      className="px-3 py-1.5 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100/80 active:scale-95 transition-all rounded-xl"
                    >
                      {showDbTools ? '✕ ปิดเครื่องมือ' : '⚙️ เปิดใช้งานเครื่องมือ'}
                    </button>
                  </div>
                  
                  {showDbTools && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-amber-900">นำเข้าสินค้าเริ่มต้น</p>
                          <p className="text-[10px] text-amber-700 font-medium">เพิ่มสินค้าจำลอง 20+ รายการจากระบบเพื่อเริ่มใช้งาน (จะใช้รูปจาก Unsplash/Picsum)</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => seedProducts(false)}
                          className="whitespace-nowrap px-6 py-2.5 bg-amber-600 text-white hover:bg-amber-700 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-95"
                        >
                          <PackagePlus size={16} />
                          นำเข้าสินค้าเดี๋ยวนี้
                        </button>
                      </div>

                      <div className="p-4 bg-red-50/40 rounded-xl border border-red-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-red-900">ลบเฉพาะสินค้าตัวอย่าง</p>
                          <p className="text-[10px] text-red-600 font-medium">ลบเฉพาะสินค้าจำลองเริ่มต้น 24 รายการของร้านค้า (สินค้าที่เพิ่มด้วยปุ่ม "นำเข้าสินค้าเริ่มต้น" ด้านบน) โดยไม่ผลกระทบต่อสินค้าจริงที่คุณสร้างขึ้นใหม่</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsConfirmingDeleteSamples(true)}
                          className="whitespace-nowrap px-6 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/15 active:scale-95 duration-200"
                        >
                          <Trash2 size={16} />
                          ลบเฉพาะสินค้าตัวอย่าง
                        </button>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 font-sans">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-800">ล้างรายการสินค้าทั้งหมด</p>
                          <p className="text-[10px] text-gray-500 font-medium">ลบรายการสินค้าในฐานข้อมูลระบบออกทั้งหมด เพื่อให้คุณพร้อมเริ่มสร้างหรืออัปโหลดสินค้าคลังสินค้าจริงของคุณเองตั้งแต่ศูนย์</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsConfirmingClearAll(true);
                            setClearAllConfirmText('');
                          }}
                          className="whitespace-nowrap px-6 py-2.5 bg-gray-900 text-white hover:bg-gray-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 active:scale-95 duration-200"
                        >
                          <Layers size={16} />
                          ล้างสินค้าทั้งหมด
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-2">
                        <button
                          type="button"
                          onClick={fetchDbStats}
                          className="px-4 py-2 bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                        >
                          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                          รีเฟรชสถิติระบบ
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features CMS */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                      <Plus size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">คุณสมบัติเด่น (Home Features)</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                        <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest mb-1">Feature {idx}</p>
                        <div className="space-y-2">
                          <input 
                            type="text"
                            value={shopSettings[`feature${idx}Title`] || ''}
                            onChange={e => setShopSettings({...shopSettings, [`feature${idx}Title`]: e.target.value})}
                            placeholder="หัวข้อ..."
                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold outline-none"
                          />
                          <input 
                            type="text"
                            value={shopSettings[`feature${idx}Desc`] || ''}
                            onChange={e => setShopSettings({...shopSettings, [`feature${idx}Desc`]: e.target.value})}
                            placeholder="คำอธิบาย..."
                            className="w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-[11px] outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Social Links */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Social Media</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Facebook</label>
                      <input 
                        type="text"
                        value={shopSettings.facebookLink}
                        onChange={e => setShopSettings({...shopSettings, facebookLink: e.target.value})}
                        placeholder="Link..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">Instagram</label>
                      <input 
                        type="text"
                        value={shopSettings.instagramLink}
                        onChange={e => setShopSettings({...shopSettings, instagramLink: e.target.value})}
                        placeholder="Link..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">YouTube</label>
                      <input 
                        type="text"
                        value={shopSettings.youtubeLink}
                        onChange={e => setShopSettings({...shopSettings, youtubeLink: e.target.value})}
                        placeholder="Link..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">LINE OA</label>
                      <input 
                        type="text"
                        value={shopSettings.lineLink}
                        onChange={e => setShopSettings({...shopSettings, lineLink: e.target.value})}
                        placeholder="Link..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {/* Shipping & Reward */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                      <Truck size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">ขนส่งและแต้ม</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ค่าส่ง (฿)</label>
                      <input 
                        type="number"
                        value={shopSettings.shippingFee}
                        onChange={e => setShopSettings({...shopSettings, shippingFee: Number(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ส่งฟรี (฿)</label>
                      <input 
                        type="number"
                        value={shopSettings.freeShippingThreshold}
                        onChange={e => setShopSettings({...shopSettings, freeShippingThreshold: Number(e.target.value)})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-black text-green-600"
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest block mb-2">แต้มสะสม</label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 font-bold uppercase">Reward Rate</span>
                        <input 
                          type="number" step="0.01"
                          value={shopSettings.pointsPerBaht}
                          onChange={e => setShopSettings({...shopSettings, pointsPerBaht: Number(e.target.value)})}
                          className="w-20 bg-transparent border-none text-right text-sm font-black text-orange-600 focus:ring-0"
                        />
                      </div>
                      <div className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <span className="text-xs text-gray-500 font-bold uppercase">Points Value</span>
                        <input 
                          type="number" step="0.01"
                          value={shopSettings.bahtPerPoint}
                          onChange={e => setShopSettings({...shopSettings, bahtPerPoint: Number(e.target.value)})}
                          className="w-20 bg-transparent border-none text-right text-sm font-black text-orange-600 focus:ring-0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payments */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                      <CreditCard size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">ช่องทางชำระเงิน</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">บัญชีธนาคาร</label>
                      <input 
                        type="text"
                        value={shopSettings.bankName}
                        onChange={e => setShopSettings({...shopSettings, bankName: e.target.value})}
                        placeholder="ธนาคาร..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                       <input 
                        type="text"
                        value={shopSettings.accountNumber}
                        onChange={e => setShopSettings({...shopSettings, accountNumber: e.target.value})}
                        placeholder="เลขบัญชี..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono font-bold"
                      />
                      <input 
                        type="text"
                        value={shopSettings.accountName}
                        onChange={e => setShopSettings({...shopSettings, accountName: e.target.value})}
                        placeholder="ชื่อบัญชี..."
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">PromptPay ID</label>
                      <input 
                        type="text"
                        value={shopSettings.promptPayId}
                        onChange={e => setShopSettings({...shopSettings, promptPayId: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-black text-orange-600"
                        placeholder="เลขบัตรประชาชน หรือ เบอร์โทรศัพท์..."
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest text-orange-600">PromptPay QR Code (ภาพ)</label>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                          {(shopSettings.promptPayQrUrl || qrFile) ? (
                            <>
                              <img 
                                src={qrFile ? URL.createObjectURL(qrFile) : getGoogleDriveDirectLink(shopSettings.promptPayQrUrl)} 
                                alt="QR Preview" 
                                className="w-full h-full object-contain"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                <label className="cursor-pointer p-1.5 bg-white rounded-lg text-gray-600 shadow-sm hover:scale-110 active:scale-95 transition-all">
                                  <Camera size={16} />
                                  <input type="file" className="hidden" accept="image/*" onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) setQrFile(file);
                                  }} />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm('ต้องการลบ QR Code ใช่หรือไม่?')) {
                                      setQrFile(null);
                                      setShopSettings({...shopSettings, promptPayQrUrl: ''});
                                    }
                                  }}
                                  className="p-1.5 bg-white rounded-lg text-red-600 shadow-sm hover:scale-110 active:scale-95 transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="flex flex-col items-center gap-1 cursor-pointer group-hover:scale-105 transition-all">
                              <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
                                <ScanText size={20} />
                              </div>
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">เพิ่ม QR</span>
                              <input type="file" className="hidden" accept="image/*" onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) setQrFile(file);
                              }} />
                            </label>
                          )}
                        </div>
                        <div className="flex-grow space-y-1">
                          <p className="text-[10px] text-gray-400 font-bold leading-tight uppercase tracking-wider">
                            แนบภาพ QR Code
                          </p>
                          {qrFile && (
                            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-black italic">
                              <div className="w-1 h-1 bg-orange-600 rounded-full animate-pulse" />
                              รอกดปุ่ม "บันทึกการตั้งค่า"
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Membership Rules */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-50">
                    <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-lg flex items-center justify-center">
                      <Star size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">เกณฑ์ระดับสมาชิก (Membership Tiers)</h3>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                    กำหนดเกณฑ์ยอดใช้จ่ายสะสมภายในระยะเวลาที่กำหนด เพื่อปรับระดับสมาชิกอัตโนมัติ
                  </p>
                  
                  <div className="space-y-4">
                    {/* Gold Tier */}
                    <div className="p-4 bg-yellow-50/30 border border-yellow-100 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-yellow-600">
                        <Star size={16} className="fill-current" />
                        <h4 className="text-xs font-black uppercase tracking-widest">ระดับ GOLD</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ยอดซื้อขั้นต่ำ (฿)</label>
                          <input 
                            type="number"
                            value={shopSettings.tierRules?.gold?.minSpending || 0}
                            onChange={e => setShopSettings({
                              ...shopSettings, 
                              tierRules: {
                                ...(shopSettings.tierRules || {}),
                                gold: { ...(shopSettings.tierRules?.gold || {}), minSpending: Number(e.target.value) }
                              }
                            })}
                            className="w-full px-3 py-2 bg-white border border-yellow-100 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ระยะเวลา (เดือน)</label>
                          <input 
                            type="number"
                            value={shopSettings.tierRules?.gold?.months || 0}
                            onChange={e => setShopSettings({
                              ...shopSettings, 
                              tierRules: {
                                ...(shopSettings.tierRules || {}),
                                gold: { ...(shopSettings.tierRules?.gold || {}), months: Number(e.target.value) }
                              }
                            })}
                            className="w-full px-3 py-2 bg-white border border-yellow-100 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-sm font-black"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Platinum Tier */}
                    <div className="p-4 bg-violet-50/30 border border-violet-100 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-violet-600">
                        <Star size={16} className="fill-current" />
                        <h4 className="text-xs font-black uppercase tracking-widest">ระดับ PLATINUM</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ยอดซื้อขั้นต่ำ (฿)</label>
                          <input 
                            type="number"
                            value={shopSettings.tierRules?.platinum?.minSpending || 0}
                            onChange={e => setShopSettings({
                              ...shopSettings, 
                              tierRules: {
                                ...(shopSettings.tierRules || {}),
                                platinum: { ...(shopSettings.tierRules?.platinum || {}), minSpending: Number(e.target.value) }
                              }
                            })}
                            className="w-full px-3 py-2 bg-white border border-violet-100 rounded-xl focus:ring-2 focus:ring-violet-400 outline-none text-sm font-black"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ระยะเวลา (เดือน)</label>
                          <input 
                            type="number"
                            value={shopSettings.tierRules?.platinum?.months || 0}
                            onChange={e => setShopSettings({
                              ...shopSettings, 
                              tierRules: {
                                ...(shopSettings.tierRules || {}),
                                platinum: { ...(shopSettings.tierRules?.platinum || {}), months: Number(e.target.value) }
                              }
                            })}
                            className="w-full px-3 py-2 bg-white border border-violet-100 rounded-xl focus:ring-2 focus:ring-violet-400 outline-none text-sm font-black"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-gray-50 rounded-xl text-[9px] text-gray-500 font-bold italic leading-relaxed">
                      * ระบบจะคำนวณยอดใช้จ่ายจากออเดอร์ที่สถานะ "ได้รับสินค้าแล้ว" เท่านั้น <br/>
                      * หากตั้งระยะเวลาเป็น 0 หมายถึงคำนวณจากยอดซื้อทั้งหมดตั้งแต่เริ่มใช้งานระบบ
                    </div>
                  </div>
                </div>

                {/* Admins */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-50">
                    <ShieldAlert size={16} className="text-orange-600" />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">แอดมินระบบ</h3>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(shopSettings.adminEmails || defaultAdminEmails).map((email: string) => (
                        <div key={email} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-full text-xs font-bold border border-gray-100">
                          {email}
                          <button 
                            type="button"
                            onClick={() => {
                              if (email === 'ismael.charu2025@gmail.com' || email === 'ismael.charu2018@gmail.com') return;
                              if (window.confirm(`ต้องการถอนสิทธิ์ผู้ดูแลระบบของ ${email} ใช่หรือไม่?`)) {
                                setShopSettings({...shopSettings, adminEmails: (shopSettings.adminEmails || defaultAdminEmails).filter((e: string) => e !== email)});
                                toast.info('ถอนสิทธิ์ชั่วคราวแล้ว อย่าลบกด "บันทึกการตั้งค่า" เพื่อบันทึกถาวร');
                              }
                            }}
                            className="text-red-500 hover:text-red-700 transition-colors p-1"
                            title="ถอนสิทธิ์แอดมิน"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <input 
                      type="email"
                      placeholder="เพิ่มอีเมล..."
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none font-medium"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = e.currentTarget.value.trim();
                          if (val && !shopSettings.adminEmails?.includes(val)) {
                            setShopSettings({...shopSettings, adminEmails: [...(shopSettings.adminEmails || []), val]});
                            e.currentTarget.value = '';
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2 disabled:opacity-50 text-sm uppercase tracking-widest"
                >
                  {uploading && <Loader2 size={16} className="animate-spin text-white" />}
                  {uploading ? (uploadProgress > 0 ? `กำลังบันทึก ${uploadProgress}%` : 'กำลังบันทึก...') : (
                    <>
                      <CheckCircle2 size={16} />
                      บันทึกทั้งหมด
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">รายการลูกค้า ({users.length})</h2>
              <div className="flex gap-2">
                <button 
                  onClick={fetchUsers}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
                <button 
                  onClick={() => {
                    setEditingUser(null);
                    setIsUserModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl font-bold text-xs hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all"
                >
                  <Plus size={16} /> เพิ่มลูกค้า
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 text-[11px] font-black uppercase tracking-widest">
                    <th className="px-3 py-3">ลูกค้า</th>
                    <th className="px-3 py-3">อีเมล / เบอร์โทร</th>
                    <th className="px-3 py-3">แต้มสะสม</th>
                    <th className="px-3 py-3">วันที่สมัคร</th>
                    <th className="px-3 py-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <AnimatePresence>
                    {users.filter(u => 
                      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      u.phoneNumber?.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((user) => (
                      <motion.tr 
                        key={user.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="hover:bg-gray-50/50 transition-colors"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-violet-100 text-violet-600 rounded-lg flex items-center justify-center font-bold text-xs">
                              {user.displayName?.charAt(0) || <User size={12} />}
                            </div>
                            <p className="font-bold text-gray-900 text-sm">{user.displayName || 'ไม่ระบุชื่อ'}</p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-[11px] font-medium italic">
                          {user.email || user.phoneNumber || '-'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 text-violet-600 font-black text-sm">
                            <Coins size={12} />
                            {user.points || 0}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-[10px] font-bold">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <a 
                              href={`https://line.me/R/msg/text/?${encodeURIComponent(`สวัสดีครับคุณ ${user.displayName || 'ลูกค้า'} ติดต่อสอบถามจากทีมงาน ${shopSettings.name || 'RumahSekolah'} ค่ะ/ครับ`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-[#06C755] hover:bg-green-50 rounded-lg transition-all"
                              title="แชทกับลูกค้าทาง LINE"
                            >
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                                <path d="M24 10.304c0-5.231-5.383-9.486-12-9.486s-12 4.255-12 9.486c0 4.69 4.27 8.613 10.046 9.348.392.085.923.258 1.058.592.121.301.079.771.038 1.074l-.164 1.027c-.045.301-.24 1.186 1.035.644 1.275-.541 6.89-4.053 9.405-6.939 1.725-1.838 2.582-3.746 2.582-5.746zm-15.659 3.105h-2.611c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.146h1.93c.375 0 .681.306.681.682s-.306.682-.681.682zm3.671-.682c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682s.681.306.681.682v3.837zm5.603 0c0 .348-.261.641-.604.677l-.077.005h-2.587c-.375 0-.681-.306-.681-.682V8.89c0-.376.306-.682.681-.682h2.587c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682s-.306.682-.681.682h-1.906v1.234h1.906c.375 0 .681.306.681.682zm5.482-3.837v3.837c0 .376-.306.682-.681.682s-.681-.306-.681-.682v-2.547l-2.22 2.994c-.114.153-.276.249-.451.249h-.027c-.171-.012-.323-.104-.411-.251l-2.233-3.007v2.562c0 .376-.306.682-.681.682s-.681-.306-.681-.682V8.89c0-.214.102-.415.273-.541.171-.126.391-.153.587-.074l2.963 3.991 2.963-3.991c.196-.079.416-.052.587.074.171.126.273.327.273.541z" />
                              </svg>
                            </a>
                            <button 
                              onClick={() => handleResetPassword(user.email)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="ส่งอีเมลรีเซ็ตรหัสผ่าน"
                            >
                              <RefreshCcw size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingUser(user);
                                setIsUserModalOpen(true);
                              }}
                              className="p-1 text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                              title="แก้ไขข้อมูล"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => deleteUser(user.id, user.email)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="ลบลูกค้า"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
            {hasMoreUsers && (
              <div className="p-4 text-center border-t border-gray-50">
                <button 
                  onClick={loadMoreUsers}
                  className="px-6 py-2 bg-violet-50 text-violet-600 hover:bg-violet-600 hover:text-white rounded-xl font-bold text-sm transition-all"
                >
                  โหลดเพิ่มเติม
                </button>
              </div>
            )}
          </div>
        </div>
        )}

        {activeTab === 'categories' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">หมวดหมู่สินค้า ({categories.length})</h2>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    try {
                      setIsRefreshing(true);
                      const snapshot = await getDocs(collection(db, 'categories')).catch(e => handleFirestoreError(e, OperationType.LIST, 'categories'));
                      if (snapshot) {
                        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                      }
                    } catch (err) {
                      console.error("Error fetching categories:", err);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
                <button 
                  onClick={() => {setEditingCategory(null); setIsCategoryModalOpen(true);}}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-xs hover:bg-orange-700 shadow-lg shadow-orange-600/20 transition-all"
                >
                  <Plus size={16} /> เพิ่มหมวดหมู่ใหม่
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-4 py-4">ชื่อหมวดหมู่</th>
                      <th className="px-4 py-4">จำนวนสินค้า</th>
                      <th className="px-4 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {categories.map((category) => (
                      <tr key={category.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-bold text-gray-900 text-sm">{category.name}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full text-xs font-black">
                            {products.filter(p => p.category === category.name).length}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => {setEditingCategory(category); setIsCategoryModalOpen(true);}}
                              className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                              title="แก้ไข"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              onClick={() => deleteCategory(category.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="ลบ"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {categories.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <BarChart3 size={24} />
                  </div>
                  <p className="text-sm text-gray-500">ไม่พบข้อมูลหมวดหมู่</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">ภาพรวมระบบ</h2>
              <button 
                onClick={async () => {
                  try {
                    setIsRefreshing(true);
                    await fetchRealStats();
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
              >
                <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'กำลังอัปเดต...' : 'รีเฟรชสถิติ'}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="text-orange-500" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">แนวโน้มยอดขาย</h3>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">14 วันล่าสุด</p>
                </div>
                
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={realStats.salesData}>
                      <defs>
                        <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                      />
                      <YAxis 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#9ca3af' }}
                        tickFormatter={(value) => `฿${value}`}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="amount" 
                        stroke="#f97316" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorAmount)" 
                        name="ยอดขาย"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="text-violet-500" size={20} />
                    <h3 className="text-lg font-bold text-gray-900">สินค้าขายดี (จำนวนชิ้น)</h3>
                  </div>
                  <Package size={16} className="text-gray-300" />
                </div>
                
                {realStats.topProducts && realStats.topProducts.length > 0 ? (
                  <div className="space-y-4 pt-4">
                    {realStats.topProducts.map((p: any, idx: number) => (
                      <div key={idx} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <p className="text-sm font-bold text-gray-700 truncate max-w-[70%]">{p.name}</p>
                          <p className="text-xs font-black text-violet-600">{p.quantity} ชิ้น</p>
                        </div>
                        <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(p.quantity / realStats.topProducts[0].quantity) * 100}%` }}
                            transition={{ duration: 1, delay: idx * 0.1 }}
                            className="bg-violet-500 h-full rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs italic">
                    ไม่มีข้อมูลสินค้าขายดี
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ยอดขายทั้งหมด</p>
                <h3 className="text-xl font-bold text-orange-600">฿{realStats.totalSales.toLocaleString()}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">คำสั่งซื้อ</p>
                <h3 className="text-xl font-bold text-gray-900">{realStats.orderCount}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ลูกค้า</p>
                <h3 className="text-xl font-bold text-gray-900">{realStats.userCount}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-1">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">ผู้เข้าชม</p>
                <h3 className="text-xl font-bold text-blue-500">{visitorCount.toLocaleString()}</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-gray-900">สถิติเพิ่มเติม</h3>
                <div className="space-y-3 font-medium">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">ยอดขายเฉลี่ยต่อคำสั่งซื้อ</span>
                    <span className="text-sm font-bold text-gray-900">฿{(realStats.orderCount > 0 ? realStats.totalSales / realStats.orderCount : 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">สินค้าทั้งหมดในระบบ</span>
                    <span className="text-sm font-bold text-gray-900">{realStats.productCount} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-xs text-gray-500">คำสั่งซื้อที่รอดำเนินการ</span>
                    <span className="text-sm font-bold text-orange-500">{realStats.pendingOrders} รายการ</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xl space-y-4">
                <h3 className="text-base font-bold text-gray-900 text-center">สัดส่วนหมวดหมู่สินค้า</h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          products.reduce((acc: any, p) => {
                            acc[p.category] = (acc[p.category] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {Object.entries(products.reduce((acc: any, p) => { acc[p.category] = (acc[p.category] || 0) + 1; return acc; }, {})).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(
                    products.reduce((acc: any, p) => {
                      acc[p.category] = (acc[p.category] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([category, count]: any, idx) => (
                    <div key={category} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#8b5cf6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'][idx % 5] }}></div>
                      <span className="text-[10px] text-gray-600 truncate">{category} ({count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">จัดการสต็อกสินค้า</h2>
                <p className="text-xs text-gray-500">ตรวจสอบและเพิ่มจำนวนสินค้าในคลัง</p>
              </div>
              <button 
                onClick={async () => {
                  try {
                    setIsRefreshing(true);
                    const q = query(collection(db, 'products'), orderBy('stock', 'asc'));
                    const snapshot = await getDocs(q).catch(e => handleFirestoreError(e, OperationType.LIST, 'products'));
                    if (snapshot) {
                      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                    }
                  } catch (err) {
                    console.error("Error fetching inventory:", err);
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
              >
                <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                รีเฟรชสต็อก
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">สต็อกต่ำกว่าเกณฑ์</p>
                  <h3 className="text-xl font-bold text-red-600">{products.filter(p => (p.stock || 0) <= (p.lowStockThreshold || 5)).length} รายการ</h3>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">สินค้าทั้งหมด</p>
                  <h3 className="text-xl font-bold text-gray-900">{products.length} รายการ</h3>
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">มูลค่าสต็อกรวม</p>
                  <h3 className="text-xl font-bold text-green-600">฿{products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0).toLocaleString()}</h3>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-4 py-4">สินค้า</th>
                      <th className="px-4 py-4">หมวดหมู่</th>
                      <th className="px-4 py-4">จำนวนปัจจุบัน</th>
                      <th className="px-4 py-4">สถานะ</th>
                      <th className="px-4 py-4 text-right">ปรับปรุงสต็อก</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.sort((a, b) => (a.stock || 0) - (b.stock || 0)).map((product) => (
                      <tr key={product.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <img src={getGoogleDriveDirectLink(product.image)} className="w-10 h-10 rounded-lg object-cover" alt="" referrerPolicy="no-referrer" />
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{product.name}</p>
                              <p className="text-[10px] text-gray-400">ID: {product.id.slice(-8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-bold uppercase tracking-tight">
                            {product.category}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <p className={`text-sm font-black ${(product.stock || 0) <= (product.lowStockThreshold || 5) ? 'text-red-600' : 'text-gray-900'}`}>
                            {product.stock || 0}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          {(product.stock || 0) <= 0 ? (
                            <span className="px-2 py-1 bg-red-100 text-red-600 rounded-lg text-[10px] font-black uppercase">หมด!</span>
                          ) : (product.stock || 0) <= (product.lowStockThreshold || 5) ? (
                            <span className="px-2 py-1 bg-orange-100 text-orange-600 rounded-lg text-[10px] font-black uppercase">ใกล้หมด</span>
                          ) : (
                            <span className="px-2 py-1 bg-green-100 text-green-600 rounded-lg text-[10px] font-black uppercase">ปกติ</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => updateStock(product.id, -1)}
                              className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-all font-bold"
                            >
                              -
                            </button>
                            <button 
                              onClick={() => {
                                const amount = prompt('จำนวนที่ต้องการเติม:', '10');
                                if (amount) {
                                  const num = parseInt(amount);
                                  if (!isNaN(num)) updateStock(product.id, num);
                                }
                              }}
                              className="px-3 py-1 bg-violet-50 text-violet-600 rounded-lg hover:bg-violet-600 hover:text-white transition-all text-xs font-bold"
                            >
                              เติมสต็อก
                            </button>
                            <button 
                              onClick={() => updateStock(product.id, 1)}
                              className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-600 rounded-lg hover:bg-green-50 hover:text-green-600 transition-all font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coupons' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 leading-tight">คูปองส่วนลด ({coupons.length})</h2>
              <div className="flex gap-2">
                <button 
                  onClick={async () => {
                    try {
                      setIsRefreshing(true);
                      const snapshot = await getDocs(collection(db, 'coupons')).catch(e => handleFirestoreError(e, OperationType.LIST, 'coupons'));
                      if (snapshot) {
                        setCoupons(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                      }
                    } catch (err) {
                      console.error("Error fetching coupons:", err);
                    } finally {
                      setIsRefreshing(false);
                    }
                  }}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg font-bold text-xs transition-all disabled:opacity-50"
                >
                  <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                  {isRefreshing ? 'กำลังโหลด...' : 'รีเฟรช'}
                </button>
                <button 
                  onClick={() => {setEditingCoupon(null); setIsCouponModalOpen(true);}}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-xl font-bold text-xs hover:bg-orange-700 shadow-lg shadow-orange-600/20 transition-all"
                >
                  <Plus size={16} /> เพิ่มคูปองใหม่
                </button>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider">
                      <th className="px-4 py-4">รหัสคูปอง</th>
                      <th className="px-4 py-4">ส่วนลด</th>
                      <th className="px-4 py-4">เงื่อนไข</th>
                      <th className="px-4 py-4">การใช้งาน</th>
                      <th className="px-4 py-4">สถานะ</th>
                      <th className="px-4 py-4 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {coupons.map((coupon) => (
                      <tr key={coupon.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-mono font-bold text-gray-900 text-sm">{coupon.code}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-orange-600 text-sm">
                            {coupon.type === 'percentage' ? `${coupon.value}%` : `฿${coupon.value.toLocaleString()}`}
                          </p>
                          {coupon.maxDiscount && <p className="text-xs text-gray-400 font-bold">สูงสุด ฿{coupon.maxDiscount.toLocaleString()}</p>}
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600 font-bold">ขั้นต่ำ ฿{coupon.minPurchase.toLocaleString()}</p>
                          <p className="text-xs text-gray-400 font-bold">
                            {coupon.startDate && coupon.endDate ? `${new Date(coupon.startDate).toLocaleDateString('th-TH')} - ${new Date(coupon.endDate).toLocaleDateString('th-TH')}` : 'ไม่มีวันหมดอายุ'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-gray-600 font-bold">{coupon.usageCount} / {coupon.usageLimit || '∞'}</p>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                            coupon.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {coupon.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => {setEditingCoupon(coupon); setIsCouponModalOpen(true);}}
                              className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                              title="แก้ไข"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="ลบ"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {coupons.length === 0 && (
                <div className="text-center py-12 space-y-3">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <Ticket size={24} />
                  </div>
                  <p className="text-sm text-gray-500">ไม่พบข้อมูลคูปองส่วนลด</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 leading-tight">รายงานและสถานะระบบ</h2>
                <p className="text-xs text-gray-500 font-medium mt-1">ติดตามการใช้งานฐานข้อมูลและสถานะของร้านค้า</p>
              </div>
              <button 
                onClick={fetchDbStats}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-xs hover:bg-gray-50 shadow-sm transition-all text-gray-600 disabled:opacity-50"
              >
                <RefreshCcw size={14} className={isRefreshing ? 'animate-spin' : ''} /> 
                {isRefreshing ? 'กำลังรีเฟรช...' : 'รีเฟรชสถานะ'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="w-10 h-10 bg-violet-50 text-violet-600 rounded-xl flex items-center justify-center">
                  <Package size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">สินค้าทั้งหมด</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-1">{dbStats.products.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">คำสั่งซื้อสะสม</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-1">{dbStats.orders.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ลูกค้าลงทะเบียน</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-1">{dbStats.users.toLocaleString()}</p>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Coins size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">รายการแต้มสะสม</p>
                  <p className="text-2xl font-black text-gray-900 leading-none mt-1">{dbStats.transactions.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-900 text-white rounded-lg flex items-center justify-center">
                      <Database size={16} />
                    </div>
                    <h3 className="font-bold text-gray-900">การใช้งาน Firebase Firestore (Spark Plan)</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-xs font-bold text-gray-600">สิทธิ์การอ่านข้อมูล (Reads)</p>
                        <p className="text-[10px] font-bold text-gray-400">ขีดจำกัด: 50,000 ครั้ง/วัน</p>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full" style={{ width: '15%' }}></div>
                      </div>
                      <p className="text-[10px] text-gray-400">* เปอร์เซ็นต์เป็นการประมาณการจากการใช้งานของคุณ</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <p className="text-xs font-bold text-gray-600">สิทธิ์การเขียนข้อมูล (Writes)</p>
                        <p className="text-[10px] font-bold text-gray-400">ขีดจำกัด: 20,000 ครั้ง/วัน</p>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-600 rounded-full" style={{ width: '8%' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 items-start">
                    <Info className="text-blue-500 mt-0.5 shrink-0" size={16} />
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-blue-900 italic">คำแนะนำการประหยัดโควตา:</p>
                      <ul className="text-[10px] text-blue-700 space-y-0.5">
                        <li>• ใช้ระบบรูปภาพ Upload ที่พัฒนาขึ้นใหม่ (ประหยัดค่า Writes และแบนด์วิดท์อย่างมาก)</li>
                        <li>• พยายามลดการดึงข้อมูลทั้งหมดบ่อยเกินไป (ใช้การ Reload เฉพาะจุด)</li>
                        <li>• หากผู้ใช้งานเกิน 100 คนต่อวัน แนะนำให้อัปเกรดเป็น Blaze Plan (จ่ายตามจริง)</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                      <Globe size={16} />
                    </div>
                    <h3 className="font-bold text-gray-900">พื้นที่จัดเก็บไฟล์ (Firebase Storage)</h3>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">สถานะการเก็บไฟล์</p>
                        <p className="text-sm font-black text-gray-900">รองรับไฟล์รูปภาพสินค้า และสลิปโอนเงิน</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-emerald-600">เปิดใช้งานปกติ</p>
                        <p className="text-[10px] text-gray-400">พื้นที่ฟรี 5GB</p>
                      </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <h3 className="font-bold text-gray-900">สถานะการเชื่อมต่อ</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-green-50 text-green-700 rounded-xl">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <p className="text-xs font-bold">ฐานข้อมูลออนไลน์</p>
                      </div>
                      <CheckCircle2 size={16} />
                    </div>
                    <button 
                      onClick={async (e) => {
                        const btn = e.currentTarget;
                        const originalText = btn.innerText;
                        try {
                          btn.disabled = true;
                          btn.innerHTML = '<div class="flex items-center justify-center gap-2"><div class="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div> กำลังทดสอบ...</div>';
                          
                          await getDocs(query(collection(db, 'settings'), limit(1)));
                          toast.success('การเชื่อมต่อปกติ: ฐานข้อมูลตอบสนองได้ดี (Ping Success)');
                        } catch (e) {
                          toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาตรวจสอบ Quota');
                        } finally {
                          btn.disabled = false;
                          btn.innerText = originalText;
                        }
                      }}
                      className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all disabled:opacity-50"
                    >
                      ทดสอบการเชื่อมต่อ (Ping)
                    </button>
                  </div>
                </div>

                <div className="bg-orange-50 p-6 rounded-2xl border border-orange-200 space-y-3 shadow-sm">
                  <div className="flex items-center gap-2 text-orange-700">
                    <AlertTriangle size={18} />
                    <h3 className="font-bold text-sm">การแจ้งเตือนระบบ</h3>
                  </div>
                  <p className="text-[10px] text-orange-800 leading-relaxed font-medium">
                    คุณจะได้รับการแจ้งเตือนที่นี่ หากการใช้งานฐานข้อมูลของคุณเข้าใกล้ขีดจำกัดรายวัน ของ Google Firebase
                  </p>
                  <div className="pt-2">
                    <p className="text-[9px] font-black uppercase text-orange-600 bg-white/50 px-2 py-1 rounded inline-block">สถานะปัจจุบัน: ปกติ</p>
                  </div>
                </div>

                {/* Google Sheets Database Synchronization Console */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs text-gray-900 leading-tight">ระบบฐานข้อมูล Google Sheets</h3>
                      <p className="text-[9px] text-gray-400 font-medium leading-none mt-1">สำรอง & จัดการตารางข้อมูลสด</p>
                    </div>
                  </div>

                  <hr className="border-gray-50" />

                  {sheetsConfig.spreadsheetId ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-green-50 border border-green-100 rounded-xl space-y-1">
                        <p className="text-[10px] font-bold text-green-800">เชื่อมต่อคลาวด์ชีตแล้ว</p>
                        <p className="text-[9px] text-green-700 font-mono truncate">{sheetsConfig.spreadsheetId}</p>
                        {sheetsConfig.lastSyncedAt && (
                          <p className="text-[8px] text-gray-400 font-medium pt-1">ซิงค์ล่าสุดเมื่อ: {sheetsConfig.lastSyncedAt}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <a 
                          href={sheetsConfig.spreadsheetUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold hover:bg-emerald-100 transition-all text-center block"
                        >
                          เปิดไฟล์ Google Sheets <ArrowRight size={12} />
                        </a>

                        <button 
                          onClick={handleExportToSheets}
                          disabled={isSyncingExport || isSyncingImport}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-gray-950 text-white rounded-xl text-[10px] font-bold hover:bg-gray-900 transition-all disabled:opacity-50"
                        >
                          {isSyncingExport ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" /> กำลังส่งออกไปชีต...
                            </div>
                          ) : 'บันทึกทับขึ้น Google Sheets (Export)'}
                        </button>

                        <button 
                          onClick={handleImportFromSheets}
                          disabled={isSyncingExport || isSyncingImport}
                          className="flex items-center justify-center gap-2 w-full py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-[10px] font-bold hover:bg-gray-50 transition-all disabled:opacity-50"
                        >
                          {isSyncingImport ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" /> กำลังดึงข้อมูลกลับ...
                            </div>
                          ) : 'ดึงตรรกะทับเข้าร้านค้า (Import)'}
                        </button>
                      </div>

                      <p className="text-[8px] text-gray-400 leading-normal text-center">
                        *แผ่นชีตจะจำแนกตามแท็บ ได้แก่ <b>สินค้า</b>, <b>หมวดหมู่</b>, <b>คูปอง</b>, <b>ลูกค้า</b>, <b>คำสั่งซื้อ</b> และ <b>รีวิว</b>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 text-center py-2">
                      <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                        คุณยังไม่ได้ทำการตั้งค่าเชื่อมต่อสเปรดชีต คุณสามารถสร้าง Google Sheets ใหม่ประจำร้านเพื่อใช้บริหารแถวตารางข้อมูลได้ทันที!
                      </p>
                      
                      <button 
                        onClick={handleConnectSheets}
                        disabled={isConnectingSheets}
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-bold hover:bg-green-700 transition-all disabled:opacity-50"
                      >
                        {isConnectingSheets ? (
                          <div className="flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" /> กำลังสร้างคลาวด์ชีต...
                          </div>
                        ) : 'เปิดสิทธิ์ Google Sheets และสร้างไฟล์'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>

      {/* Tracking Modal */}
      <AnimatePresence>
        {isTrackingModalOpen && (
          <div 
            onClick={() => setIsTrackingModalOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] w-full max-w-md my-8 overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                    <Truck size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">บันทึกการจัดส่ง</h3>
                    <p className="text-xs text-gray-500">ใส่ข้อมูลเพื่อแจ้งให้ลูกค้าทราบ</p>
                  </div>
                </div>
                <button onClick={() => setIsTrackingModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleSaveTracking} className="p-6 space-y-6">
                {/* Order Context */}
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-50">
                    <Package className="text-gray-400" size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] font-black text-gray-400 uppercase tracking-wider">#{selectedOrderForTracking?.id.slice(-8).toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">฿{selectedOrderForTracking?.total.toLocaleString()}</p>
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{selectedOrderForTracking?.customer?.name}</p>
                    <p className="text-xs text-gray-500 truncate w-48">{selectedOrderForTracking?.customer?.address}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                      <Globe size={12} /> บริษัทขนส่ง
                    </label>
                    <select 
                      value={shippingCompany}
                      onChange={(e) => setShippingCompany(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-900 transition-all"
                    >
                      <option value="Flash Express">Flash Express</option>
                      <option value="Kerry Express">Kerry Express</option>
                      <option value="J&T Express">J&T Express</option>
                      <option value="Thailand Post">ไปรษณีย์ไทย (EMS)</option>
                      <option value="Ninja Van">Ninja Van</option>
                      <option value="Best Express">Best Express</option>
                      <option value="Shopee Xpress">Shopee Xpress</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase flex items-center justify-between">
                      <span className="flex items-center gap-2"><ScanText size={12} /> เลขพัสดุ (Tracking Number)</span>
                    </label>
                    <div className="relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors">
                        <ShieldAlert size={18} />
                      </div>
                      <input 
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        required
                        placeholder="พิมพ์เลขพัสดุ..."
                        className="w-full pl-12 pr-14 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none font-black text-gray-900 tracking-wider placeholder:font-normal placeholder:tracking-normal transition-all"
                      />
                      <label className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-orange-600 text-white rounded-xl shadow-lg shadow-orange-600/20 cursor-pointer hover:bg-orange-700 transition-all flex items-center justify-center hover:scale-105 active:scale-95 group">
                        {isExtractingTracking ? (
                          <Loader2 size={20} className="animate-spin" />
                        ) : (
                          <Camera size={20} />
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment" 
                          onChange={handleScanTracking} 
                          className="hidden" 
                          disabled={isExtractingTracking}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                        <ScanText size={10} /> แนะนำ: ถ่ายรูปใบเสร็จเพื่อดึงเลขพัสดุอัตโนมัติ
                      </p>
                      {trackingNumber && (
                        <button 
                          type="button"
                          onClick={() => setTrackingNumber('')}
                          className="text-[10px] text-orange-600 font-bold hover:underline"
                        >
                          ล้างข้อมูล
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsTrackingModalOpen(false)}
                    className="py-4 bg-gray-100 text-gray-700 rounded-[20px] font-bold hover:bg-gray-200 transition-all active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={!trackingNumber || isExtractingTracking}
                    className="py-4 bg-orange-600 text-white rounded-[20px] font-bold hover:bg-orange-700 shadow-xl shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
                  >
                    {isExtractingTracking ? 'กำลังประมวลผล...' : 'ยืนยันจัดส่ง'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div 
            onClick={() => setIsUserModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingUser ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
                </h3>
                <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveUser} className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">User UID</label>
                  <input 
                    name="uid"
                    defaultValue={editingUser?.id}
                    readOnly={!!editingUser}
                    required
                    placeholder="UID ของลูกค้า"
                    className={`w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs font-bold ${editingUser ? 'text-gray-400 cursor-not-allowed' : 'focus:ring-2 focus:ring-violet-500'}`}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">อีเมล</label>
                    <input 
                      name="email"
                      type="email"
                      defaultValue={editingUser?.email}
                      placeholder="email@example.com"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">เบอร์โทรศัพท์</label>
                    <input 
                      name="phoneNumber"
                      type="tel"
                      defaultValue={editingUser?.phoneNumber}
                      placeholder="081xxx"
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ชื่อลูกค้า</label>
                  <input 
                    name="displayName"
                    defaultValue={editingUser?.displayName}
                    required
                    placeholder="ชื่อที่แสดงในระบบ"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">แต้มสะสม</label>
                  <input 
                    name="points"
                    type="number"
                    defaultValue={editingUser?.points || 0}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-black"
                  />
                </div>
                <div className="pt-2 space-y-2">
                  <button 
                    type="submit"
                    className="w-full py-3 bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-orange-700 shadow-lg shadow-orange-600/20 transition-all"
                  >
                    บันทึกข้อมูล
                  </button>
                  {editingUser?.email && (
                    <button 
                      type="button"
                      onClick={() => handleResetPassword(editingUser.email)}
                      className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold text-[10px] uppercase tracking-wider hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                    >
                      <RefreshCcw size={14} />
                      รีเซ็ตรหัสผ่าน
                    </button>
                  )}
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Modal */}
      <AnimatePresence>
        {isProductModalOpen && (
          <div 
            onClick={() => setIsProductModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-2xl my-8 overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
                </h3>
                <button onClick={() => setIsProductModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ชื่อสินค้า</label>
                    <input 
                      name="name"
                      defaultValue={editingProduct?.name}
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">หมวดหมู่</label>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsProductModalOpen(false);
                          setActiveTab('categories');
                        }}
                        className="text-[10px] text-violet-600 hover:underline font-black uppercase"
                      >
                        จัดการ
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 p-1.5 bg-gray-50 rounded-xl border border-gray-100">
                      <input type="hidden" name="category" value={editingProduct?.category || ''} />
                      {['ไม่มีหมวดหมู่', ...categories.map(c => c.name)].slice(0, 6).map(catName => (
                        <button
                          key={catName}
                          type="button"
                          onClick={() => {
                            setEditingProduct((prev: any) => ({...(prev || {}), category: catName === 'ไม่มีหมวดหมู่' ? '' : catName}));
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all truncate ${
                            (editingProduct?.category === catName || (catName === 'ไม่มีหมวดหมู่' && !editingProduct?.category))
                              ? 'bg-violet-600 text-white shadow-sm'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          {catName}
                        </button>
                      ))}
                      {categories.length > 5 && (
                        <select 
                          value={editingProduct?.category || ''}
                          onChange={e => setEditingProduct((prev: any) => ({...(prev || {}), category: e.target.value}))}
                          className="col-span-2 px-2.5 py-1.5 bg-transparent text-xs font-black text-violet-600 outline-none border-t border-gray-100 mt-1 cursor-pointer"
                        >
                          <option value="">เพิ่มเติม...</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ราคาปกติ (฿)</label>
                    <input 
                      name="price"
                      type="number"
                      defaultValue={editingProduct?.price}
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-black"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">ราคาลดพิเศษ (฿)</label>
                    <input 
                      name="discountPrice"
                      type="number"
                      defaultValue={editingProduct?.discountPrice}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-black text-orange-600"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">สต็อกสินค้า (ชิ้น)</label>
                    <input 
                      name="stock"
                      type="number"
                      defaultValue={editingProduct?.stock || 0}
                      required
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-sm font-black"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-gray-500 uppercase tracking-widest">รูปภาพสินค้า (แนะนำรูปสี่เหลี่ยมจัตุรัส)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[0, 1, 2, 3, 4].map((index) => {
                      const currentImage = index === 0 ? editingProduct?.image : editingProduct?.images?.[index - 1];
                      const currentFile = productFiles[index];
                      
                      return (
                        <div key={index} className="space-y-1">
                          <div className="relative aspect-square rounded-lg overflow-hidden border border-gray-100 bg-gray-50 group">
                            {(currentImage || currentFile) ? (
                              <>
                                <img 
                                  src={currentFile ? URL.createObjectURL(currentFile) : getGoogleDriveDirectLink(currentImage)} 
                                  alt="" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <button 
                                  type="button"
                                  onClick={() => {
                                    const newFiles = [...productFiles];
                                    newFiles[index] = null;
                                    setProductFiles(newFiles);
                                    
                                    if (editingProduct) {
                                      if (index === 0) {
                                        setEditingProduct({...editingProduct, image: ''});
                                      } else {
                                        const newImages = [...(editingProduct.images || [])];
                                        newImages[index - 1] = '';
                                        setEditingProduct({...editingProduct, images: newImages});
                                      }
                                    }
                                  }}
                                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-all">
                                <Plus size={20} className="text-gray-300" />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const newFiles = [...productFiles];
                                      newFiles[index] = file;
                                      setProductFiles(newFiles);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                          {index === 0 && (
                            <input 
                              name="image"
                              type="hidden"
                              defaultValue={editingProduct?.image}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">คำอธิบาย</label>
                  <textarea 
                    name="description"
                    defaultValue={editingProduct?.description}
                    rows={3}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-[11px] leading-relaxed"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-t-2 border-b-2 border-white"></div>
                        กำลังบันทึก...
                      </>
                    ) : (
                      editingProduct ? 'บันทึกการแก้ไข' : 'เพิ่มสินค้า'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div 
            onClick={() => setIsCategoryModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingCategory ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่ใหม่'}
                </h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="p-5 space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ชื่อหมวดหมู่</label>
                  <input 
                    name="name"
                    defaultValue={editingCategory?.name}
                    required
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-bold"
                    placeholder="เช่น เครื่องเขียน, หนังสือ..."
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
                  >
                    {editingCategory ? 'บันทึกข้อมูล' : 'เพิ่มหมวดหมู่'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Coupon Modal */}
      <AnimatePresence>
        {isCouponModalOpen && (
          <div 
            onClick={() => setIsCouponModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto cursor-pointer"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[40px] w-full max-w-lg my-8 overflow-hidden shadow-2xl cursor-default"
            >
              <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">
                  {editingCoupon ? 'แก้ไขคูปอง' : 'เพิ่มคูปองใหม่'}
                </h3>
                <button onClick={() => setIsCouponModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-all">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveCoupon} className="p-5 space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">รหัสคูปอง</label>
                  <input 
                    name="code"
                    defaultValue={editingCoupon?.code}
                    required
                    placeholder="เช่น WELCOME10"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none uppercase text-xs font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ประเภทส่วนลด</label>
                    <select 
                      name="type"
                      defaultValue={editingCoupon?.type || 'percentage'}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-[10px] font-bold"
                    >
                      <option value="percentage">เปอร์เซ็นต์ (%)</option>
                      <option value="fixed">จำนวนเงิน (฿)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">มูลค่าส่วนลด</label>
                    <input 
                      name="value"
                      type="number"
                      defaultValue={editingCoupon?.value}
                    required
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-bold"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ซื้อขั้นต่ำ (฿)</label>
                  <input 
                    name="minPurchase"
                    type="number"
                    defaultValue={editingCoupon?.minPurchase || 0}
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">ส่วนลดสูงสุด (฿)</label>
                  <input 
                    name="maxDiscount"
                    type="number"
                    defaultValue={editingCoupon?.maxDiscount}
                    placeholder="ไม่จำกัด"
                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-bold placeholder:font-normal placeholder:text-gray-300"
                  />
                </div>
              </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">วันที่เริ่ม</label>
                    <input 
                      name="startDate"
                      type="date"
                      defaultValue={editingCoupon?.startDate}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-[10px] font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">วันที่สิ้นสุด</label>
                    <input 
                      name="endDate"
                      type="date"
                      defaultValue={editingCoupon?.endDate}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-[10px] font-bold"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">จำกัดการใช้</label>
                    <input 
                      name="usageLimit"
                      type="number"
                      defaultValue={editingCoupon?.usageLimit}
                      placeholder="ไม่จำกัด"
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-xs font-bold placeholder:font-normal placeholder:text-gray-300"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">สถานะ</label>
                    <select 
                      name="isActive"
                      defaultValue={editingCoupon?.isActive !== false ? 'true' : 'false'}
                      className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none text-[10px] font-bold"
                    >
                      <option value="true">เปิดใช้งาน</option>
                      <option value="false">ปิดใช้งาน</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    type="button"
                    onClick={() => setIsCouponModalOpen(false)}
                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-gray-200 transition-all"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-orange-600 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider hover:bg-orange-700 transition-all shadow-lg shadow-orange-600/20"
                  >
                    {editingCoupon ? 'บันทึกข้อมูล' : 'สร้างคูปอง'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shipping Label Modal */}
      <AnimatePresence>
        {isLabelModalOpen && selectedLabelData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsLabelModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-w-2xl w-full bg-white rounded-[40px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <Printer size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">ใบปะหน้าพัสดุ</h3>
                </div>
                <button 
                  onClick={() => setIsLabelModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 sm:p-8 overflow-y-auto max-h-[70vh]">
                <div id="shipping-label" className="bg-white border-2 border-dashed border-gray-300 p-6 sm:p-10 rounded-3xl space-y-8 font-sans shadow-sm">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-gray-100 pb-8">
                    <div className="space-y-1">
                      <h4 className="text-2xl sm:text-3xl font-black text-gray-900 uppercase tracking-tighter">{shopSettings.name}</h4>
                      <p className="text-xs sm:text-sm text-gray-500 font-bold uppercase tracking-widest">ใบปะหน้าพัสดุ #{selectedLabelData.id.slice(-6).toUpperCase()}</p>
                    </div>
                    <div className="sm:text-right bg-violet-50 px-4 py-2 rounded-2xl border border-violet-100">
                      <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest">ประเภทสินค้า</p>
                      <p className="text-lg font-black text-violet-700 whitespace-nowrap">
                        {selectedLabelData.type === 'order' ? 'คำสั่งซื้อสินค้า' : 'ตัวอย่างสินค้า'}
                      </p>
                    </div>
                  </div>

                  {/* Sender & Receiver */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 sm:gap-16">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-gray-200 rounded-full"></div>
                        <p className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">ผู้ส่ง (Sender)</p>
                      </div>
                      <div className="space-y-1 pl-3">
                        <p className="text-base sm:text-lg font-black text-gray-900">{shopSettings.name}</p>
                        <p className="text-sm text-gray-600 leading-relaxed max-w-[280px]">{shopSettings.address}</p>
                        <p className="text-sm font-black text-gray-900 mt-2 bg-gray-100 px-3 py-1 rounded-lg inline-block">โทร: {shopSettings.phone}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-6 bg-violet-600 rounded-full shadow-sm shadow-violet-200"></div>
                        <p className="text-[11px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">ผู้รับ (Receiver)</p>
                      </div>
                      <div className="space-y-1 pl-3">
                        <p className="text-xl sm:text-2xl font-black text-gray-900">{selectedLabelData.customerName}</p>
                        <p className="text-base text-gray-800 leading-relaxed font-bold max-w-[320px]">{selectedLabelData.address}</p>
                        <p className="text-lg sm:text-xl font-black text-white mt-4 bg-gray-900 px-4 py-2 rounded-xl inline-block shadow-lg">โทร: {selectedLabelData.phone}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items Summary */}
                  <div className="bg-gray-50 p-6 rounded-2xl space-y-4">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">รายการสินค้า (Items)</p>
                    <div className="space-y-2">
                      {getSafeItemsArray(selectedLabelData.items).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700 font-medium">• {item.name}</span>
                          <span className="font-bold text-gray-900">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer / Note */}
                  <div className="flex justify-between items-end pt-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">ขอบคุณที่ใช้บริการ</p>
                      <p className="text-xs font-medium text-gray-500 italic">"RumahSekolah - เพราะการเรียนรู้ไม่มีที่สิ้นสุด"</p>
                    </div>
                    <div className="w-24 h-24 bg-gray-100 rounded-xl flex items-center justify-center text-gray-300">
                      <Package size={40} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex flex-col md:flex-row gap-3">
                <button 
                  onClick={() => setIsLabelModalOpen(false)}
                  className="flex-1 px-8 py-3 bg-white text-gray-700 border border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  onClick={() => {
                    const printContent = document.getElementById('shipping-label');
                    if (printContent) {
                      const printWindow = window.open('', '', 'width=800,height=900');
                      if (printWindow) {
                        printWindow.document.write(`
                          <html>
                            <head>
                              <title>Shipping Label - ${selectedLabelData.customerName}</title>
                              <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                              <style>
                                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                                body { font-family: 'Inter', sans-serif; -webkit-print-color-adjust: exact; }
                                @media print {
                                  body { padding: 20px; }
                                  .no-print { display: none; }
                                }
                              </style>
                            </head>
                            <body>
                              ${printContent.outerHTML}
                              <script>
                                window.onload = () => {
                                  window.print();
                                  window.onafterprint = () => window.close();
                                };
                              </script>
                            </body>
                          </html>
                        `);
                        printWindow.document.close();
                      }
                    }
                  }}
                  className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                >
                  <Printer size={20} /> พิมพ์ใบปะหน้า
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slip Modal */}
      <AnimatePresence>
        {selectedSlip && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedSlip(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-lg w-full bg-white rounded-[40px] overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">หลักฐานการชำระเงิน</h3>
                <button 
                  onClick={() => setSelectedSlip(null)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 bg-gray-50 flex items-center justify-center min-h-[300px]">
                <img 
                  src={getGoogleDriveDirectLink(selectedSlip)} 
                  alt="Payment Slip" 
                  className="w-full h-auto rounded-2xl shadow-lg transition-opacity duration-300"
                  onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                  style={{ opacity: '0' }}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6 text-center">
                <button 
                  onClick={() => setSelectedSlip(null)}
                  className="px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Sample Products Custom Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingDeleteSamples && (
          <div 
            onClick={() => setIsConfirmingDeleteSamples(false)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 cursor-default p-6 space-y-6"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-gray-900">ลบสินค้าตัวอย่าง</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Seeded Products Deletion</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-bold text-gray-800">ยืนยันการลบสินค้าจำลองออกจากระบบ?</p>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  ระบบจะทำการสแกนหาและลบเฉพาะ <span className="font-bold text-rose-600">"สินค้าจำลองตั้งต้น 24 รายการ"</span> ของระบบ 
                  ซึ่งเพิ่มด้วยฟังก์ชัน Seed ข้อมูล โดยสินค้าจริงอื่นๆ ที่คุณป้อนและบันทึกด้วยความตั้งใจของคุณเองจะไม่ถูกดึงออกไปด้วย
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsConfirmingDeleteSamples(false)}
                  className="py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl font-bold transition-all text-xs active:scale-95"
                >
                  ยกเลิกคืนค่า
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    setIsConfirmingDeleteSamples(false);
                    await deleteSampleProducts();
                  }}
                  className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-600/25 transition-all text-xs active:scale-95"
                >
                  ยืนยันลบข้อมูล
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear All Products Custom Confirmation Modal */}
      <AnimatePresence>
        {isConfirmingClearAll && (
          <div 
            onClick={() => setIsConfirmingClearAll(false)}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 cursor-default p-6 space-y-6"
            >
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <div className="w-10 h-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-rose-700">ล้างคลังสินค้าทั้งหมด</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">All Products Purge Tool</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-800 font-medium leading-relaxed">
                  <p className="font-bold flex items-center gap-1.5 text-xs mb-1"><AlertTriangle size={14} className="shrink-0" /> โปรดมั่นใจในสิ่งที่คุณกำลังทำ!</p>
                  การดำเนินการนี้จะทำการ <span className="font-black text-red-700 underline">"ลบรายการสินค้าทั้งหมดออกจากร้านค้า"</span> อย่างถาวร 
                  การเปลี่ยนคลังข้อมูลนี้เป็นแบบถาวรและไม่สามารถกู้คืนหรือย้อนคืนกลับได้ในภายหลัง
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none block">
                    พิมพ์ภาษาอังกฤษว่า <span className="font-bold font-mono text-rose-600">DELETE ALL</span> เพื่อยืนยันการตั้งค่าลบ:
                  </label>
                  <input 
                    type="text"
                    value={clearAllConfirmText}
                    onChange={(e) => setClearAllConfirmText(e.target.value)}
                    placeholder="พิมพ์รหัสเข้ายืนยันที่นี่..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-red-500 outline-none font-bold text-center text-rose-600 font-mono text-sm uppercase transition-all tracking-widest"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  type="button"
                  onClick={() => setIsConfirmingClearAll(false)}
                  className="py-3 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-2xl font-bold transition-all text-xs active:scale-95"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button"
                  disabled={clearAllConfirmText !== 'DELETE ALL'}
                  onClick={async () => {
                    setIsConfirmingClearAll(false);
                    await clearAllProducts();
                  }}
                  className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black shadow-lg shadow-red-600/20 transition-all text-xs active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
                >
                  ล้างข้อมูลถาวร
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboard;