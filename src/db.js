const DB_NAME = "DiaryDB";
const STORE_NAME = "entries";
const DB_VERSION = 1;

// --- Utility functions ---

export function normalizeDateKey(date) {
  if (typeof date === "string") return date;

  if (date && typeof date === "object") {
    if (
      date.year !== undefined &&
      date.month !== undefined &&
      date.day !== undefined
    ) {
      return `${date.year}-${String(date.month + 1).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
    }
  }

  throw new Error("Invalid date key");
}

export function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- DB setup ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "date" });
      }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function migrateEntries(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.openCursor();

    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        let entry = cursor.value;

        if (!entry.date || typeof entry.date !== "string") {
          if (
            entry.year !== undefined &&
            entry.month !== undefined &&
            entry.day !== undefined
          ) {
            entry.date = normalizeDateKey(entry);
          } else if (entry.timestamp) {
            const d = new Date(entry.timestamp);
            entry.date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          }
          if (entry.date) {
            store.put(entry);
          }
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

// --- CRUD functions ---

export async function saveEntry(entry) {
  const db = await openDB();
  await migrateEntries(db);

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    try {
      entry.date = normalizeDateKey(entry.date);
    } catch (err) {
      reject(err);
      return;
    }

    const request = store.put(entry);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function getEntry(date) {
  const db = await openDB();
  await migrateEntries(db);

  return new Promise((resolve, reject) => {
    let key;
    try {
      key = normalizeDateKey(date);
    } catch (err) {
      reject(err);
      return;
    }

    const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).get(key);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllEntries() {
  const db = await openDB();
  await migrateEntries(db);

  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_NAME).objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteEntry(date) {
  const db = await openDB();
  await migrateEntries(db);

  return new Promise((resolve, reject) => {
    let key;
    try {
      key = normalizeDateKey(date);
    } catch (err) {
      reject(err);
      return;
    }

    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function clearDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}
