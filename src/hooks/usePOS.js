import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import {
  collection, onSnapshot, doc, getDoc,
  addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, where,
  serverTimestamp, increment,
} from 'firebase/firestore';

// ── Products (real-time) ─────────────────────────────────────
export function usePOSProducts() {
  const [products, setProducts] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'pos_products'), orderBy('category'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (err) => {
      console.error('usePOSProducts:', err);
      setError(err.message);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  async function addProduct(data) {
    return await addDoc(collection(db, 'pos_products'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  }

  async function updateProduct(id, data) {
    await updateDoc(doc(db, 'pos_products', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
  }

  async function removeProduct(id) {
    await deleteDoc(doc(db, 'pos_products', id));
  }

  // Restock: increment stock by qty. `cost` is optional — when provided,
  // it updates the product's tracked unit cost (used for profit calc on
  // future sales). Existing callers that only pass (id, qty) keep working
  // exactly as before; cost simply won't change.
  async function restockProduct(id, qty, cost) {
    const updates = { stock: increment(qty), updatedAt: serverTimestamp() };
    if (cost !== undefined && cost !== null && !isNaN(cost)) {
      updates.cost = Number(cost);
    }
    await updateDoc(doc(db, 'pos_products', id), updates);
  }

  // Deduct stock after a sale
  async function deductStock(id, qty) {
    await updateDoc(doc(db, 'pos_products', id), {
      stock:     increment(-qty),
      updatedAt: serverTimestamp(),
    });
  }

  return {
    products, loading, error,
    addProduct, updateProduct, removeProduct,
    restockProduct, deductStock,
  };
}

// ── Sales (on-demand) ────────────────────────────────────────
export function usePOSSales() {
  const [sales,   setSales]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // Fetch sales for a specific date (YYYY-MM-DD)
  async function fetchSalesByDate(date) {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'pos_sales'),
        where('date', '==', date),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('usePOSSales fetchByDate:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fetch sales for a month (YYYY-MM)
  async function fetchSalesByMonth(month) {
    setLoading(true);
    try {
      const startDate = `${month}-01`;
      const endDate   = `${month}-31`;
      const q = query(
        collection(db, 'pos_sales'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('usePOSSales fetchByMonth:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Fetch sales for a date range
  async function fetchSalesByRange(startDate, endDate) {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'pos_sales'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('usePOSSales fetchByRange:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Record a sale + deduct stock in one go
  // items = [{ productId, name, qty, price }]
  // method: 'cash' | 'free'
  // date:   'YYYY-MM-DD'
  //
  // Each item's current product cost is looked up and snapshotted onto the
  // sale record at the moment of sale — this keeps profit calculations
  // historically accurate even if a product's cost changes later (e.g. a
  // future restock at a different price won't retroactively change what
  // last month's sales are considered to have cost).
  async function recordSale({ items, total, method, date }) {
    const month = date.slice(0, 7); // store month for easy monthly queries

    const itemsWithCost = await Promise.all(items.map(async (item) => {
      try {
        const snap = await getDoc(doc(db, 'pos_products', item.productId));
        const cost = snap.exists() ? (snap.data().cost || 0) : 0;
        return { ...item, cost };
      } catch (err) {
        console.error('recordSale: cost lookup failed for', item.productId, err);
        return { ...item, cost: 0 };
      }
    }));

    const saleRef = await addDoc(collection(db, 'pos_sales'), {
      items: itemsWithCost,
      total: method === 'free' ? 0 : total,
      method,
      date,
      month,
      createdAt: serverTimestamp(),
    });
    return saleRef;
  }

  // ── Computed helpers ──────────────────────────────────────────
  // Only count cash sales towards revenue (free = $0 income)
  const totalRevenue = sales
    .filter(s => s.method !== 'free')
    .reduce((s, sale) => s + (sale.total || 0), 0);

  const totalItems = sales.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + i.qty, 0), 0
  );

  const freeSales = sales.filter(s => s.method === 'free').length;

  // Cost of goods sold — counted for ALL sales, including free/comped ones,
  // since giving an item away still consumes real inventory that cost money.
  const totalCost = sales.reduce(
    (s, sale) => s + sale.items.reduce((a, i) => a + (i.cost || 0) * i.qty, 0), 0
  );

  // True profit: revenue minus the cost of what was actually sold this
  // period (not what was purchased/restocked this period).
  const totalProfit = totalRevenue - totalCost;

  return {
    sales, loading, error,
    fetchSalesByDate, fetchSalesByMonth, fetchSalesByRange, recordSale,
    totalRevenue, totalItems, freeSales, totalCost, totalProfit,
  };
}