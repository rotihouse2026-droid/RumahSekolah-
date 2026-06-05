import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PRODUCTS } from "./src/data/mockProducts";

const DB_FILE = path.join(process.cwd(), "db_store.json");

// Helper to safely write JSON atomically
function writeDbFile(data: any) {
  const tempFile = `${DB_FILE}.tmp`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error("Failed to write database file:", err);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (e) {}
    }
    throw err;
  }
}

// Helper to read JSON safely
export function readDb(): any {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = seedDatabase();
    writeDbFile(initialData);
    return initialData;
  }
  try {
    const rawData = fs.readFileSync(DB_FILE, "utf8");
    if (!rawData.trim()) {
      const initialData = seedDatabase();
      writeDbFile(initialData);
      return initialData;
    }
    return JSON.parse(rawData);
  } catch (err) {
    console.error("Failed to read database file, restoring from seed...", err);
    const initialData = seedDatabase();
    writeDbFile(initialData);
    return initialData;
  }
}

function seedDatabase(): any {
  console.log("[DB Seed] Injecting initial seed data...");
  const categories = [
    { id: "cat-1", name: "ปากกาและเครื่องเขียน" },
    { id: "cat-2", name: "สมุดและกระดาษ" },
    { id: "cat-3", name: "อุปกรณ์ศิลปะ" },
    { id: "cat-4", name: "กระเป๋าและกล่องดินสอ" },
    { id: "cat-5", name: "อุปกรณ์" }
  ];

  return {
    products: PRODUCTS || [],
    categories: categories,
    coupons: [
      { id: "coupon-1", code: "WELCOME10", discountType: "percentage", value: 10, isActive: true, createdAt: new Date().toISOString() },
      { id: "coupon-2", code: "FREE30", discountType: "fixed", value: 30, isActive: true, createdAt: new Date().toISOString() }
    ],
    settings: {
      shop: {
        name: "Rumah Sekolah",
        description: "ร้านจำหน่ายเครื่องเขียนและอุปกรณ์ศิลปะเกรดพรีเมียม",
        logoUrl: "https://images.unsplash.com/photo-1542435503-956c469947f6?auto=format&fit=crop&q=80&w=800"
      },
      sheets: {
        spreadsheetId: "",
        spreadsheetUrl: "",
        lastSyncedAt: ""
      }
    },
    orders: [],
    users: [],
    slips: [],
    pointTransactions: [],
    contacts: [],
    reviews: [],
    notifications: []
  };
}

// Database collection modifiers
export function getCollection(collectionName: string): any[] {
  const db = readDb();
  if (collectionName === "settings") {
    // Treat settings as a flat key-value list wrapped in mock docs
    const settings = db.settings || {};
    return Object.keys(settings).map(key => ({
      id: key,
      ...settings[key]
    }));
  }
  return db[collectionName] || [];
}

export function getDocument(collectionName: string, id: string): any | null {
  const col = getCollection(collectionName);
  return col.find(doc => doc.id === id) || null;
}

export function saveDocument(collectionName: string, id: string, data: any): any {
  const db = readDb();
  
  if (collectionName === "settings") {
    if (!db.settings) db.settings = {};
    db.settings[id] = { ...db.settings[id], ...data, id };
    writeDbFile(db);
    return db.settings[id];
  }

  if (!db[collectionName]) db[collectionName] = [];
  
  const index = db[collectionName].findIndex((doc: any) => doc.id === id);
  const now = new Date().toISOString();
  const newDoc = {
    id,
    ...data,
    updatedAt: now,
    createdAt: index >= 0 ? (db[collectionName][index].createdAt || now) : now
  };

  if (index >= 0) {
    db[collectionName][index] = { ...db[collectionName][index], ...newDoc };
  } else {
    db[collectionName].push(newDoc);
  }

  writeDbFile(db);
  return newDoc;
}

export function createDocument(collectionName: string, data: any): any {
  const id = data.id || `doc-${crypto.randomBytes(8).toString("hex")}`;
  return saveDocument(collectionName, id, data);
}

export function deleteDocument(collectionName: string, id: string): boolean {
  const db = readDb();
  
  if (collectionName === "settings") {
    if (db.settings && db.settings[id]) {
      delete db.settings[id];
      writeDbFile(db);
      return true;
    }
    return false;
  }

  if (!db[collectionName]) return false;
  const initialLength = db[collectionName].length;
  db[collectionName] = db[collectionName].filter((doc: any) => doc.id !== id);
  const deleted = db[collectionName].length < initialLength;
  if (deleted) {
    writeDbFile(db);
  }
  return deleted;
}

export function overwriteCollection(collectionName: string, items: any[]): void {
  const db = readDb();
  if (collectionName === "settings") {
    db.settings = {};
    items.forEach(item => {
      if (item.id) {
        const { id, ...rest } = item;
        db.settings[id] = rest;
      }
    });
  } else {
    db[collectionName] = items;
  }
  writeDbFile(db);
}
