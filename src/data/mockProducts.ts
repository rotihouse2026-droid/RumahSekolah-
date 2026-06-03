export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  discountPrice?: number;
  image: string;
  images?: string[];
  stock: number;
  rating: number;
  reviews: number;
  lowStockThreshold?: number;
  description: string;
}

export const PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "ปากกาลูกลื่นสไตล์ญี่ปุ่นเซ็ต 5 สี (Japanese Style Gel Pen Set)",
    category: "ปากกาและเครื่องเขียน",
    price: 150,
    discountPrice: 120,
    image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=800"
    ],
    stock: 25,
    rating: 4.8,
    reviews: 18,
    lowStockThreshold: 5,
    description: "ปากกาลูกลื่นเขียนลื่น แห้งไว เซ็ต 5 สี คุมโทนพาสเทล ดีไซน์มินิมอลเขียนง่ายจับถนัดมือ เหมาะสำหรับการจดโน้ตและทำสรุป"
  },
  {
    id: "prod-2",
    name: "สมุดบันทึกปกหนังถนอมสายตา ขนาด A5 (A5 Premium Leather Journal)",
    category: "สมุดและกระดาษ",
    price: 320,
    discountPrice: 280,
    image: "https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&q=80&w=800",
    images: [
      "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?auto=format&fit=crop&q=80&w=800"
    ],
    stock: 12,
    rating: 4.9,
    reviews: 32,
    lowStockThreshold: 5,
    description: "สมุดโน้ตถนอมสายตาถักเย็บกี่อย่างดี เปิดกางได้ 180 องศา ปกหนัง PU สัมผัสนุ่ม เรียบหรูคลาสสิก มีช่องใส่ปากกาและสายรัด"
  },
  {
    id: "prod-3",
    name: "สีไม้เกรดอาร์ตทิสต์ 36 สี (Professional 36 Color Pencils Set)",
    category: "อุปกรณ์ศิลปะ",
    price: 490,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800",
    stock: 8,
    rating: 4.7,
    reviews: 14,
    lowStockThreshold: 3,
    description: "สีไม้คุณภาพระดับผู้เชี่ยวชาญ เนื้อสีนุ่ม เกลี่ยสีและผสมสีได้ง่ายเป็นธรรมชาติ ไส้สีแข็งแรงไม่หักง่ายระหว่างเหลา"
  },
  {
    id: "prod-4",
    name: "ยางลบดินสอไฟฟ้าไร้สาย (Rechargeable Electric Eraser)",
    category: "อุปกรณ์ศิลปะ",
    price: 180,
    discountPrice: 155,
    image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=800",
    stock: 4,
    rating: 4.6,
    reviews: 9,
    lowStockThreshold: 5,
    description: "ยางลบไฟฟ้าสำหรับงานสเก็ตช์ภาพ ลบสะอาดหมดจดด้วยแรงขัดสั่นสะเทือนที่นุ่มนวล ไม่ทำลายเนื้อกระดาษ ชาร์จไฟ USB ได้"
  },
  {
    id: "prod-5",
    name: "กล่องดินสอผ้าแคนวาสความจุสูง (High Capacity Canvas Pencil Case)",
    category: "กระเป๋าและกล่องดินสอ",
    price: 120,
    image: "https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=800",
    stock: 30,
    rating: 4.5,
    reviews: 21,
    lowStockThreshold: 8,
    description: "กล่องดินสอผลิตจากผ้าแคนวาสทนทานพิเศษ ใส่ปากกาได้มากกว่า 50 แท่ง มีช่องแบ่งแยกชั้นช่วยจัดระเบียบอุปกรณ์"
  },
  {
    id: "prod-6",
    name: "ไม้บรรทัดเหล็กสแตนเลสพิมพ์สเกลเลเซอร์ 30 ซม. (30cm Stainless Steel Ruler)",
    category: "ปากกาและเครื่องเขียน",
    price: 65,
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800",
    stock: 45,
    rating: 4.4,
    reviews: 11,
    lowStockThreshold: 5,
    description: "ไม้บรรทัดสแตนเลสสตีลทนทาน พิมพ์สเกลหน่วยเซนติเมตรและนิ้วด้วยเลเซอร์ คมชัดอ่านง่าย ขอบเรียบตรงใช้งานตัดกระดาษได้สะดวกรวดเร็ว"
  },
  {
    id: "prod-7",
    name: "เครื่องคิดเลขทัศนศึกษา 12 หลัก (12-Digit Student Calculator)",
    category: "อุปกรณ์",
    price: 290,
    discountPrice: 240,
    image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=800",
    stock: 15,
    rating: 4.7,
    reviews: 25,
    lowStockThreshold: 4,
    description: "เครื่องคิดเลขหน้าจอใหญ่ 12 หลัก ปุ่มกดสัมผัสนุ่มและตอบสนองเสถียร ใช้พลังงานแสงอาทิตย์และแบตเตอรี่ในตัว"
  },
  {
    id: "prod-8",
    name: "เทปลบคำผิดมินิมอลยาว 12 เมตร (12m Minimalist Correction Tape)",
    category: "ปากกาและเครื่องเขียน",
    price: 45,
    image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=800",
    stock: 60,
    rating: 4.5,
    reviews: 43,
    lowStockThreshold: 10,
    description: "เทปลบคำผิดหน้ากว้าง 5 มม. ความยาวสูงสุดคุ้ม 12 เมตร ปิดทับข้อความได้เนียนเรียบ เขียนทับได้ทันที"
  },
  {
    id: "prod-9",
    name: "กระดาษโน้ตโพสต์-อิทพาสเทล 4 สี (Pastel Sticky Notes 4-Pack)",
    category: "สมุดและกระดาษ",
    price: 85,
    image: "https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&q=80&w=800",
    stock: 50,
    rating: 4.6,
    reviews: 19,
    lowStockThreshold: 5,
    description: "กระดาษมีกาวในตัวสีพาสเทลละมุนตา พิมพ์ข้อความง่าย กาวอะคริลิกติดแน่น ลอกออกง่ายไม่ทิ้งรอยคราบกาว"
  },
  {
    id: "prod-10",
    name: "เซ็ตไม้ฉากสามเหลี่ยมและครึ่งวงกลมทองเหลือง (Luxury Brass Geometry Set)",
    category: "ปากกาและเครื่องเขียน",
    price: 420,
    discountPrice: 380,
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800",
    stock: 6,
    rating: 4.9,
    reviews: 15,
    lowStockThreshold: 2,
    description: "ชุดไม้บรรทัดฟังก์ชันเรขาคณิต ผลิตจากทองเหลืองแท้ 100% สลักสเกลคมลึก สวยคลาสสิก ยิ่งใช้นานยิ่งสะสมคุณค่าทางพื้นผิว"
  },
  {
    id: "prod-11",
    name: "กรรไกรด้ามยางซิลิโคนถนอมมือ (Comfort Grip Scissors)",
    category: "อุปกรณ์",
    price: 75,
    image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&q=80&w=800",
    stock: 35,
    rating: 4.5,
    reviews: 8,
    lowStockThreshold: 5,
    description: "กรรไกรสแตนเลสเคลือบสารกันสนิม ด้ามจับหุ้มเกราะยางซิลิโคนนิ่มนุ่มสบายมือ ออกแบบให้กระจายแรงลดความเมื่อยล้าระหว่างตัด"
  },
  {
    id: "prod-12",
    name: "มีดคัตเตอร์เซรามิกมินิตาข่ายล็อคอัตโนมัติ (Mini Ceramic Utility Knife)",
    category: "อุปกรณ์",
    price: 90,
    image: "https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=800",
    stock: 22,
    rating: 4.6,
    reviews: 16,
    lowStockThreshold: 5,
    description: "คัตเตอร์ขนาดพกพา ใบมีดเซรามิกพิเศษคมนาน ไม่เป็นสนิม ปลอดภัย ปรับระดับล็อคได้ด้วยระบบสไลด์กันใบมีดถอยกลับ"
  },
  {
    id: "prod-13",
    name: "สีน้ำเกรดเรียนกล่องเหล็ก 18 สี (Artist Watercolor 18-Color Set)",
    category: "อุปกรณ์ศิลปะ",
    price: 350,
    discountPrice: 299,
    image: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&q=80&w=800",
    stock: 14,
    rating: 4.8,
    reviews: 10,
    lowStockThreshold: 3,
    description: "พิกเมนต์สีสดใส กระจายและผสมผสานสีน้ำเข้าด้วยกันอย่างกลมเกลียด มาพร้อมพู่กันแทงค์เติมน้ำและถาดสีในตัวกล่องเหล็ก"
  },
  {
    id: "prod-14",
    name: "ปากกาเน้นข้อความสไตล์พาสเทล 6 สี (6-Color Pastel Highlighter Set)",
    category: "ปากกาและเครื่องเขียน",
    price: 110,
    image: "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?auto=format&fit=crop&q=80&w=800",
    stock: 40,
    rating: 4.7,
    reviews: 55,
    lowStockThreshold: 10,
    description: "ปากกาไฮไลท์สีพาสเทลถนอมสายตา ไร้สารเคมีกลิ่นฉุน เขียนทับหมึกปากกาไม่เลอะขุย ขัดเน้นได้เรียบเนียน"
  },
  {
    id: "prod-15",
    name: "ลวดเย็บกระดาษไร้ใบมีดมินิ (Stapleless Eco Mini Stapler)",
    category: "อุปกรณ์",
    price: 165,
    image: "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&q=80&w=800",
    stock: 18,
    rating: 4.3,
    reviews: 12,
    lowStockThreshold: 4,
    description: "นวัตกรรมเครื่องเย็บกระดาษแบบไม่ต้องใช้ลวดเหล็ก ปลอดภัย เป็นมิตรต่อสิ่งแวดล้อม เย็บรวมแน่นได้สูงสุด 5 แผ่น"
  }
];
