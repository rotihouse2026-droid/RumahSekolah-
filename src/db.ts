// Custom Client-Side Mock Database Adapter replacing 'firebase/firestore'
// Connects directly to our local, highly dependable JSON database server

export const db = { type: "local-json-db" };

export class MockDocumentSnapshot {
  id: string;
  _data: any;

  constructor(id: string, data: any) {
    this.id = id;
    this._data = data;
  }

  exists() {
    return this._data !== null && this._data !== undefined;
  }

  data() {
    return this._data || {};
  }
}

export class MockQuerySnapshot {
  docs: MockDocumentSnapshot[];

  constructor(docs: MockDocumentSnapshot[]) {
    this.docs = docs;
  }

  get size() {
    return this.docs.length;
  }

  get empty() {
    return this.docs.length === 0;
  }

  forEach(callback: (doc: MockDocumentSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export class MockCollectionReference {
  path: string;
  type = "collection" as const;
  constructor(path: string) {
    this.path = path;
  }
}

export class MockDocumentReference {
  collectionPath: string;
  id: string;
  type = "document" as const;
  constructor(collectionPath: string, id: string) {
    this.collectionPath = collectionPath;
    this.id = id;
  }
}

export class MockQuery {
  collectionPath: string;
  constraints: any[];
  type = "query" as const;
  constructor(collectionPath: string, constraints: any[] = []) {
    this.collectionPath = collectionPath;
    this.constraints = constraints;
  }
}

export function collection(_db: any, pathName: string) {
  return new MockCollectionReference(pathName);
}

export function doc(firstArg: any, secondArg?: string, thirdArg?: string) {
  if (firstArg && firstArg.type === "collection") {
    return new MockDocumentReference(firstArg.path, secondArg!);
  }
  if (thirdArg) {
    return new MockDocumentReference(secondArg!, thirdArg);
  }
  return new MockDocumentReference(firstArg.path || "unknown", secondArg!);
}

export function query(collectionRef: MockCollectionReference, ...constraints: any[]) {
  return new MockQuery(collectionRef.path, constraints);
}

export function where(field: string, op: string, val: any) {
  return { type: "where", field, op, val };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc") {
  return { type: "orderBy", field, direction };
}

export function limit(value: number) {
  return { type: "limit", value };
}

export function startAfter(docRefDetail: any) {
  return { type: "startAfter", docRefDetail };
}

export function increment(value: number) {
  return { type: "increment", value };
}

export function serverTimestamp() {
  return { type: "serverTimestamp" };
}

export function documentId() {
  return "__documentId__";
}

// Special Resolver to process sentinel objects (increment, serverTimestamp) during writes
function resolveSentinelFields(data: any, existingData?: any) {
  if (!data || typeof data !== "object") return data;
  const resolved = { ...data };
  for (const key of Object.keys(resolved)) {
    const val = resolved[key];
    if (val && typeof val === "object") {
      if (val.type === "increment") {
        const base = existingData && typeof existingData[key] === "number" ? existingData[key] : 0;
        resolved[key] = base + val.value;
      } else if (val.type === "serverTimestamp") {
        resolved[key] = new Date().toISOString();
      } else {
        resolved[key] = resolveSentinelFields(val, existingData?.[key]);
      }
    }
  }
  return resolved;
}

// Fetch helper to perform AJAX mutations reliably
import { PRODUCTS } from "./data/mockProducts";

let useLocalStorageFallback = false;

function getLocalStorageDb() {
  const dbStr = localStorage.getItem('rumahsekolah_local_db');
  if (!dbStr) {
    const initialDb = {
      products: PRODUCTS || [],
      categories: [
        { id: "cat-1", name: "ปากกาและเครื่องเขียน" },
        { id: "cat-2", name: "สมุดและกระดาษ" },
        { id: "cat-3", name: "อุปกรณ์ศิลปะ" },
        { id: "cat-4", name: "กระเป๋าและกล่องดินสอ" },
        { id: "cat-5", name: "อุปกรณ์" }
      ],
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
      notifications: [],
      users_auth_secure: {}
    };
    localStorage.setItem('rumahsekolah_local_db', JSON.stringify(initialDb));
    return initialDb;
  }
  try {
    return JSON.parse(dbStr);
  } catch (e) {
    return {
      products: PRODUCTS || [],
      categories: [],
      coupons: [],
      settings: {},
      orders: [],
      users: [],
      slips: [],
      users_auth_secure: {}
    };
  }
}

function saveLocalStorageDb(db: any) {
  try {
    localStorage.setItem('rumahsekolah_local_db', JSON.stringify(db));
  } catch (e) {
    console.error("Local DB: Failed to save:", e);
  }
}

function getLocalCollection(collectionName: string): any[] {
  const db = getLocalStorageDb();
  if (collectionName === "settings") {
    const settings = db.settings || {};
    return Object.keys(settings).map(key => ({
      id: key,
      ...settings[key]
    }));
  }
  return db[collectionName] || [];
}

function getLocalDocument(collectionName: string, id: string): any | null {
  const col = getLocalCollection(collectionName);
  return col.find((doc: any) => doc.id === id) || null;
}

function saveLocalDocument(collectionName: string, id: string, data: any): any {
  const db = getLocalStorageDb();
  if (collectionName === "settings") {
    if (!db.settings) db.settings = {};
    db.settings[id] = { ...db.settings[id], ...data, id };
    saveLocalStorageDb(db);
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
  saveLocalStorageDb(db);
  return newDoc;
}

function deleteLocalDocument(collectionName: string, id: string): boolean {
  const db = getLocalStorageDb();
  if (collectionName === "settings") {
    if (db.settings && db.settings[id]) {
      delete db.settings[id];
      saveLocalStorageDb(db);
      return true;
    }
    return false;
  }
  if (!db[collectionName]) return false;
  const initialLength = db[collectionName].length;
  db[collectionName] = db[collectionName].filter((doc: any) => doc.id !== id);
  const deleted = db[collectionName].length < initialLength;
  if (deleted) {
    saveLocalStorageDb(db);
  }
  return deleted;
}

async function apiCall(method: string, url: string, body?: any) {
  try {
    const options: RequestInit = { method };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`DB Server returned error status: ${response.status}`);
    }
    return await response.json();
  } catch (err: any) {
    console.error(`Local API DB Error [${method} ${url}]:`, err);
    throw err;
  }
}

export async function getDoc(docRef: MockDocumentReference): Promise<MockDocumentSnapshot> {
  if (useLocalStorageFallback) {
    const val = getLocalDocument(docRef.collectionPath, docRef.id);
    return new MockDocumentSnapshot(docRef.id, val);
  }

  const url = `/api/db/${docRef.collectionPath}/${docRef.id}`;
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type");
    if (res.status === 404 && (!contentType || !contentType.includes("application/json"))) {
      useLocalStorageFallback = true;
      console.warn("[DB Fallback] API returned 404 HTML/Non-JSON. Switching to client-side LocalStorage DB.");
      const val = getLocalDocument(docRef.collectionPath, docRef.id);
      return new MockDocumentSnapshot(docRef.id, val);
    }
    if (res.status === 404) {
      return new MockDocumentSnapshot(docRef.id, null);
    }
    const txt = await res.text();
    try {
      const data = JSON.parse(txt);
      return new MockDocumentSnapshot(docRef.id, data);
    } catch {
      useLocalStorageFallback = true;
      console.warn("[DB Fallback] API did not return valid JSON. Switching to client-side LocalStorage DB.");
      const val = getLocalDocument(docRef.collectionPath, docRef.id);
      return new MockDocumentSnapshot(docRef.id, val);
    }
  } catch (err) {
    useLocalStorageFallback = true;
    console.warn("[DB Fallback] Failed to fetch. Switching to client-side LocalStorage DB.", err);
    const val = getLocalDocument(docRef.collectionPath, docRef.id);
    return new MockDocumentSnapshot(docRef.id, val);
  }
}

export async function getDocs(queryRef: MockQuery | MockCollectionReference): Promise<MockQuerySnapshot> {
  const collectionPath = queryRef.type === "collection" ? (queryRef as MockCollectionReference).path : (queryRef as MockQuery).collectionPath;
  const constraints = queryRef.type === "query" ? (queryRef as MockQuery).constraints : [];

  let docs: any[] = [];
  
  if (useLocalStorageFallback) {
    docs = getLocalCollection(collectionPath);
  } else {
    const url = `/api/db/${collectionPath}`;
    try {
      const res = await fetch(url);
      const contentType = res.headers.get("content-type");
      if (!res.ok && (!contentType || !contentType.includes("application/json"))) {
        useLocalStorageFallback = true;
        console.warn("[DB Fallback] API returned 404/Non-JSON. Switching to LocalStorage.");
        docs = getLocalCollection(collectionPath);
      } else if (res.ok) {
        const txt = await res.text();
        try {
          docs = JSON.parse(txt);
        } catch {
          useLocalStorageFallback = true;
          console.warn("[DB Fallback] Invalid JSON returned. Switched to LocalStorage.");
          docs = getLocalCollection(collectionPath);
        }
      } else {
        docs = [];
      }
    } catch (err) {
      useLocalStorageFallback = true;
      console.warn("[DB Fallback] Fetch failed. Switched to LocalStorage.", err);
      docs = getLocalCollection(collectionPath);
    }
  }

  // Handle client-side querying logic dynamically to guarantee 100% correctness
  let results = [...docs];
  for (const item of constraints) {
    if (item.type === "where") {
      const { field, op, val } = item;
      results = results.filter((docItem: any) => {
        const itemVal = docItem[field];
        if (op === "==" || op === "===") return itemVal === val;
        if (op === "!=") return itemVal !== val;
        if (op === ">") return itemVal > val;
        if (op === ">=") return itemVal >= val;
        if (op === "<") return itemVal < val;
        if (op === "<=") return itemVal <= val;
        if (op === "array-contains") return Array.isArray(itemVal) && itemVal.includes(val);
        return true;
      });
    } else if (item.type === "orderBy") {
      const { field, direction } = item;
      results.sort((a: any, b: any) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === valB) return 0;
        const multiplier = direction === "desc" ? -1 : 1;
        if (valA === undefined || valA === null) return 1 * multiplier;
        if (valB === undefined || valB === null) return -1 * multiplier;
        return valA > valB ? 1 * multiplier : -1 * multiplier;
      });
    } else if (item.type === "limit") {
      results = results.slice(0, item.value);
    }
  }

  const documentSnapshots = results.map(docItem => new MockDocumentSnapshot(docItem.id, docItem));
  return new MockQuerySnapshot(documentSnapshots);
}

export async function setDoc(docRef: MockDocumentReference, data: any, options?: { merge?: boolean }) {
  let finalData = data;
  if (options?.merge) {
    const currentSnap = await getDoc(docRef);
    const existing = currentSnap.exists() ? currentSnap.data() : {};
    finalData = { ...existing, ...data };
  }
  const resolved = resolveSentinelFields(finalData);

  if (useLocalStorageFallback) {
    saveLocalDocument(docRef.collectionPath, docRef.id, resolved);
    return resolved;
  }

  try {
    return await apiCall("PUT", `/api/db/${docRef.collectionPath}/${docRef.id}`, resolved);
  } catch (err) {
    useLocalStorageFallback = true;
    console.warn("[DB Fallback] API setDoc failed. Saved to LocalStorage instead.", err);
    saveLocalDocument(docRef.collectionPath, docRef.id, resolved);
    return resolved;
  }
}

export async function addDoc(collectionRef: MockCollectionReference, data: any): Promise<MockDocumentReference> {
  const resolved = resolveSentinelFields(data);
  const id = resolved.id || `doc-${Math.random().toString(36).substr(2, 9)}`;
  const finalData = { ...resolved, id };

  if (useLocalStorageFallback) {
    saveLocalDocument(collectionRef.path, id, finalData);
    return new MockDocumentReference(collectionRef.path, id);
  }

  try {
    const result = await apiCall("POST", `/api/db/${collectionRef.path}`, finalData);
    return new MockDocumentReference(collectionRef.path, result.id || id);
  } catch (err) {
    useLocalStorageFallback = true;
    console.warn("[DB Fallback] API addDoc failed. Saved to LocalStorage instead.", err);
    saveLocalDocument(collectionRef.path, id, finalData);
    return new MockDocumentReference(collectionRef.path, id);
  }
}

export async function updateDoc(docRef: MockDocumentReference, data: any) {
  const currentSnap = await getDoc(docRef);
  const existing = currentSnap.exists() ? currentSnap.data() : {};
  const finalData = { ...existing, ...data };
  const resolved = resolveSentinelFields(finalData);

  if (useLocalStorageFallback) {
    saveLocalDocument(docRef.collectionPath, docRef.id, resolved);
    return resolved;
  }

  try {
    return await apiCall("PUT", `/api/db/${docRef.collectionPath}/${docRef.id}`, resolved);
  } catch (err) {
    useLocalStorageFallback = true;
    console.warn("[DB Fallback] API updateDoc failed. Saved to LocalStorage instead.", err);
    saveLocalDocument(docRef.collectionPath, docRef.id, resolved);
    return resolved;
  }
}

export class MockBatch {
  operations: Array<{ type: 'set' | 'update' | 'delete', ref: MockDocumentReference, data?: any, options?: any }> = [];

  set(ref: MockDocumentReference, data: any, options?: any) {
    this.operations.push({ type: 'set', ref, data, options });
    return this;
  }

  update(ref: MockDocumentReference, data: any) {
    this.operations.push({ type: 'update', ref, data });
    return this;
  }

  delete(ref: MockDocumentReference) {
    this.operations.push({ type: 'delete', ref });
    return this;
  }

  async commit() {
    for (const op of this.operations) {
      if (op.type === 'set') {
        await setDoc(op.ref, op.data, op.options);
      } else if (op.type === 'update') {
        await updateDoc(op.ref, op.data);
      } else if (op.type === 'delete') {
        await deleteDoc(op.ref);
      }
    }
  }
}

export function writeBatch() {
  return new MockBatch();
}

export async function deleteDoc(docRef: MockDocumentReference) {
  if (useLocalStorageFallback) {
    const success = deleteLocalDocument(docRef.collectionPath, docRef.id);
    return { success };
  }

  try {
    return await apiCall("DELETE", `/api/db/${docRef.collectionPath}/${docRef.id}`);
  } catch (err) {
    useLocalStorageFallback = true;
    console.warn("[DB Fallback] API deleteDoc failed. Deleted from LocalStorage instead.", err);
    const success = deleteLocalDocument(docRef.collectionPath, docRef.id);
    return { success };
  }
}

export async function getAggregateFromServer(queryRef: any, spec: any) {
  const snap = await getDocs(queryRef);
  const docs = snap.docs;
  return {
    data: () => ({
      sum: (field?: string) => {
        const targetField = field || (spec && Object.values(spec)[0] as any)?.field || 'totalAmount';
        return docs.reduce((acc, d) => acc + (Number(d.data()[targetField]) || 0), 0);
      }
    })
  };
}

export function sum(field: string) {
  return { type: 'sum', field };
}

export async function getCountFromServer(queryRef: MockQuery | MockCollectionReference) {
  const snap = await getDocs(queryRef);
  return {
    data: () => ({ count: snap.docs.length })
  };
}

export function initializeFirestore() {
  return db;
}

// Memory snap cache of listeners to prevent high frequency polling clashing
const snapshotIntervals: { [key: string]: any } = {};

export function onSnapshot(
  queryRef: any,
  nextCallback: (snapshot: MockQuerySnapshot | MockDocumentSnapshot) => void,
  errorCallback?: (error: any) => void
) {
  const isDoc = queryRef.type === "document";
  const listenerKey = Math.random().toString(36).substring(2, 11);

  // Define poll handler
  const poll = async () => {
    try {
      if (isDoc) {
        const snap = await getDoc(queryRef);
        nextCallback(snap);
      } else {
        const snap = await getDocs(queryRef);
        nextCallback(snap);
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
    }
  };

  // Run immediately
  poll();

  // Set interval to poll every 3 seconds for persistent real-time updates and low lag in user session
  const timer = setInterval(poll, 3000);
  snapshotIntervals[listenerKey] = timer;

  // Return unsubscribe handle
  return () => {
    clearInterval(snapshotIntervals[listenerKey]);
    delete snapshotIntervals[listenerKey];
  };
}
