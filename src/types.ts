export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface ShopSettings {
  name: string;
  description: string;
  logoUrl: string;
  promptPayQrUrl: string;
  banner0: string;
  banner1: string;
  banner2: string;
  lineLink: string;
  phone: string;
  bankName?: string;
  bankAccountNo?: string;
  bankAccountName?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  category: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: CartItem[];
  total: number;
  paymentMethod: 'bank_transfer' | 'promptpay';
  slipUrl: string;
  status: 'pending' | 'paid' | 'packaging' | 'shipped' | 'cancelled';
  trackingNumber?: string;
  createdAt: any; // Can be Timestamp or string
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  phone: string;
  address: string;
}
