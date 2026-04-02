const DB_NAME = 'leadDBExtensionCache';
const DB_VERSION = 1;
const PROSPECTS_STORE = 'prospects';
const META_STORE = 'meta';

const openDb = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(PROSPECTS_STORE)) {
      db.createObjectStore(PROSPECTS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'key' });
    }
  };

  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
});

const withStore = async (storeName, mode, work) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = work(store);
    } catch (err) {
      reject(err);
      db.close();
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('IndexedDB transaction failed'));
    };
  });
};

export const getAllProspectsFromDb = async () => withStore(PROSPECTS_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
  const req = store.getAll();
  req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
  req.onerror = () => reject(req.error || new Error('Failed to read prospects'));
}));

export const replaceAllProspectsInDb = async (prospects) => {
  const list = Array.isArray(prospects) ? prospects : [];
  await withStore(PROSPECTS_STORE, 'readwrite', (store) => {
    store.clear();
    for (const p of list) {
      if (p && p.id) store.put(p);
    }
  });
};

export const upsertProspectInDb = async (prospect) => {
  if (!prospect || !prospect.id) return;
  await withStore(PROSPECTS_STORE, 'readwrite', (store) => {
    store.put(prospect);
  });
};

export const getMetaValue = async (key) => withStore(META_STORE, 'readonly', (store) => new Promise((resolve, reject) => {
  const req = store.get(key);
  req.onsuccess = () => resolve(req.result ? req.result.value : null);
  req.onerror = () => reject(req.error || new Error('Failed to read metadata'));
}));

export const setMetaValue = async (key, value) => {
  await withStore(META_STORE, 'readwrite', (store) => {
    store.put({ key, value });
  });
};
