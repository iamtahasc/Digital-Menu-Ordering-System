import React, { useEffect, useMemo, useState, useMemo as useReactMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { db, app, auth } from "../firebaseConfig";
import {
  collection,
  doc,
  updateDoc,
  onSnapshot,
  addDoc,
  deleteDoc,
  serverTimestamp,
  setDoc,
  getDoc,
  query,
  orderBy,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { generateOrderBillPDF } from "../utils/pdf";
import QRCodeGenerator from "../components/QRCodeGenerator";



export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuForm, setMenuForm] = useState({ name: "", description: "", price: "", category: "", image: "", available: true });

  // Filters
  const [filterTable, setFilterTable] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Settings
  const [settings, setSettings] = useState({ taxPercent: 5, restaurantName: "Smart Café", logoURL: "", contact: "", address: "", phone: "" });
  const [savingSettings, setSavingSettings] = useState(false);
  const [isEditingSettings, setIsEditingSettings] = useState(false);

  // Staff
  const [staff, setStaff] = useState([]);
  const [staffForm, setStaffForm] = useState({ email: "", password: "", role: "staff", name: "" });

  // Reports
  const [reportRange, setReportRange] = useState({ from: "", to: "" });

  // Notifications
  const [lastOrderIds, setLastOrderIds] = useState(new Set());
  const [notification, setNotification] = useState("");
  
  // Bulk delete
  const [selectedOrders, setSelectedOrders] = useState(new Set());

  // Collections
  const ordersCol = useMemo(() => collection(db, "orders"), []);
  const menuCol = useMemo(() => collection(db, "menu"), []);
  const settingsDocRef = useMemo(() => doc(db, "settings", "app"), []);
  const staffCol = useMemo(() => collection(db, "staff"), []);

  // Initialize settings document if it doesn't exist
  useEffect(() => {
    // Auth/role guard
    const unsubAuth = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        navigate("/AdminLogin");
        return;
      }
      try {
        const staffSnap = await getDoc(doc(db, "staff", user.uid));
        const data = staffSnap.data() || {};
        const role = String(data.role || "").toLowerCase();
        const isAdmin = role === "admin" || data.isAdmin === true;
        if (!isAdmin) {
          navigate("/");
        }
      } catch (_) {
        navigate("/");
      }
    });

    const initializeSettings = async () => {
      try {
        const settingsDoc = await getDoc(settingsDocRef);
        if (!settingsDoc.exists()) {
          // Create default settings document
          await setDoc(settingsDocRef, {
            taxPercent: 5,
            restaurantName: "Smart Café",
            logoURL: "",
            contact: "",
            address: "",
            phone: "",
            updatedAt: serverTimestamp(),
          });
          console.log("Created default settings document");
        }
      } catch (error) {
        console.error("Error initializing settings:", error);
      }
    };
    
    initializeSettings();
    return () => {
      unsubAuth && unsubAuth();
    };
  }, [settingsDocRef, navigate]);

  // Realtime listeners
  useEffect(() => {
    const unsubOrders = onSnapshot(ordersCol, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Simple new order notification
      const incomingIds = new Set(data.map((o) => o.id));
      if (lastOrderIds.size > 0) {
        for (const ord of data) {
          if (!lastOrderIds.has(ord.id)) {
            setNotification(`New order${ord.tableNumber ? ` at table ${ord.tableNumber}` : ""}`);
            setTimeout(() => setNotification(""), 3000);
            break;
          }
        }
      }
      setLastOrderIds(incomingIds);
      // Sort: non-completed first (newest first), then completed (newest first)
      const toMs = (o) => {
        const d = (o.updatedAt?.toDate?.() || o.timestamp?.toDate?.() || o.createdAt?.toDate?.() || null);
        return d ? d.getTime() : 0;
      };
      const nonCompleted = data.filter((o) => String(o.status || "").toLowerCase() !== "completed");
      const completed = data.filter((o) => String(o.status || "").toLowerCase() === "completed");
      nonCompleted.sort((a, b) => toMs(b) - toMs(a));
      completed.sort((a, b) => toMs(b) - toMs(a));
      setOrders([...nonCompleted, ...completed]);
    }, (error) => {
      console.error("Orders listener error:", error);
      alert("Error loading orders: " + error.message);
    });
    
    const unsubMenu = onSnapshot(menuCol, (snap) => {
      setMenu(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    
    const unsubSettings = onSnapshot(settingsDocRef, (snap) => {
      if (snap.exists()) {
        if (isEditingSettings) return; // don't override local edits while typing
        const s = snap.data();
        setSettings({
          taxPercent: typeof s.taxPercent === "number" ? s.taxPercent : 5,
          restaurantName: s.restaurantName || "Smart Café",
          logoURL: s.logoURL || "",
          contact: s.contact || "",
          address: s.address || "",
          phone: s.phone || "",
        });
      }
    });
    
    const unsubStaff = onSnapshot(staffCol, (snap) => {
      setStaff(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    
    return () => {
      unsubOrders();
      unsubMenu();
      unsubSettings();
      unsubStaff();
    };
  }, [ordersCol, menuCol, settingsDocRef, staffCol, lastOrderIds, isEditingSettings]);

  // Order status update
  const logActivity = async (action, details) => {
    try {
      await addDoc(collection(db, "activityLogs"), {
        action,
        details,
        userId: auth.currentUser?.uid || null,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Activity log failed", e);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      await logActivity("order_status_update", { orderId, status: newStatus });
    } catch (e) {
      console.error("Failed to update order status", e);
      alert("Could not update status. Try again.");
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!confirm("Cancel this order?")) return;
    try {
      await updateDoc(doc(db, "orders", orderId), { status: "Cancelled" });
      await logActivity("order_cancel", { orderId });
    } catch (e) {
      console.error("Failed to cancel order", e);
      alert("Could not cancel order.");
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!confirm("Delete this order permanently? This action cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "orders", orderId));
      await logActivity("order_delete", { orderId });
    } catch (e) {
      console.error("Failed to delete order", e);
      alert("Could not delete order.");
    }
  };

  const handleBulkDelete = async () => {
    const deletableOrders = Array.from(selectedOrders).filter(id => {
      const order = orders.find(o => o.id === id);
      return order && (order.status === "Cancelled" || order.status === "Completed");
    });

    if (deletableOrders.length === 0) {
      alert("No cancelled or completed orders selected for deletion.");
      return;
    }

    if (!confirm(`Delete ${deletableOrders.length} cancelled/completed orders permanently? This action cannot be undone.`)) return;

    try {
      for (const orderId of deletableOrders) {
        await deleteDoc(doc(db, "orders", orderId));
        await logActivity("order_bulk_delete", { orderId });
      }
      setSelectedOrders(new Set());
      alert(`Successfully deleted ${deletableOrders.length} orders.`);
    } catch (e) {
      console.error("Failed to bulk delete orders", e);
      alert("Could not delete some orders.");
    }
  };

  const toggleOrderSelection = (orderId) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const selectAllDeletable = () => {
    const deletableIds = orders
      .filter(o => o.status === "Cancelled" || o.status === "Completed")
      .map(o => o.id);
    setSelectedOrders(new Set(deletableIds));
  };

  // Menu CRUD
  const openAddModal = () => {
    setEditingItem(null);
    setMenuForm({ name: "", description: "", price: "", category: "", image: "", available: true });
    setIsMenuModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setMenuForm({
      name: item.name || "",
      description: item.description || "",
      price: String(item.price ?? ""),
      category: item.category || "",
      image: item.image || "",
      available: typeof item.available === "boolean" ? item.available : true,
    });
    setIsMenuModalOpen(true);
  };

  const closeModal = () => setIsMenuModalOpen(false);

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: menuForm.name.trim(),
      description: menuForm.description.trim(),
      price: Number(menuForm.price),
      category: menuForm.category.trim(),
      image: menuForm.image.trim(),
      available: Boolean(menuForm.available),
      updatedAt: serverTimestamp(),
    };

    if (!payload.name || isNaN(payload.price)) {
      alert("Please provide a valid name and price");
      return;
    }

    try {
      if (editingItem) {
        await updateDoc(doc(db, "menu", editingItem.id), payload);
        await logActivity("menu_update", { id: editingItem.id, name: payload.name });
      } else {
        const added = await addDoc(menuCol, { ...payload, createdAt: serverTimestamp() });
        await logActivity("menu_add", { id: added.id, name: payload.name });
      }
      closeModal();
    } catch (e) {
      console.error("Failed to save menu item", e);
      alert("Could not save item. Try again.");
    }
  };

  const handleDeleteItem = async (id) => {
    if (!confirm("Delete this item?")) return;
    try {
      await deleteDoc(doc(db, "menu", id));
      await logActivity("menu_delete", { id });
    } catch (e) {
      console.error("Failed to delete menu item", e);
      alert("Could not delete item. Try again.");
    }
  };

  // Image upload helper (optional)
  const handleImageUpload = async (file) => {
    if (!file) return "";
    try {
      const storage = getStorage(app);
      const fileRef = ref(storage, `menu/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    } catch (e) {
      console.error("Image upload failed", e);
      alert("Image upload failed");
      return "";
    }
  };

  // Save settings
  const saveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      // Validate inputs
      if (!settings.restaurantName.trim()) {
        alert("Restaurant name cannot be empty");
        setSavingSettings(false);
        return;
      }
      
      const taxValue = settings.taxPercent === "" ? 0 : Number(settings.taxPercent);
      if (isNaN(taxValue) || taxValue < 0) {
        alert("Please enter a valid tax percentage");
        setSavingSettings(false);
        return;
      }
      
      // Save to Firestore with merge option to update only specified fields
      await setDoc(settingsDocRef, {
        taxPercent: taxValue,
        restaurantName: settings.restaurantName.trim(),
        logoURL: settings.logoURL || "",
        contact: settings.contact || "",
        address: settings.address || "",
        phone: settings.phone || "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      await logActivity("settings_update", {});
      alert("Settings saved successfully!");
      setIsEditingSettings(false);
    } catch (e) {
      console.error("Failed to save settings", e);
      alert((e && e.message) ? ("Could not save settings: " + e.message) : "Could not save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  // Staff
  const addStaff = async (e) => {
    e.preventDefault();
    const { email, password, role, name } = staffForm;
    if (!email || !password || !name) return alert("Email, password, and name required");
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create staff document only
      await setDoc(doc(db, "staff", cred.user.uid), {
        email,
        name: name.trim(),
        role: role || "staff",
        createdAt: serverTimestamp(),
      });
      
      setStaffForm({ email: "", password: "", role: "staff", name: "" });
      await logActivity("staff_add", { userId: cred.user.uid, role, name });
    } catch (e) {
      console.error("Failed to add staff", e);
      alert(e.message || "Could not add staff");
    }
  };

  const deleteStaff = async (staffId, staffEmail) => {
    if (!confirm(`Delete staff member ${staffEmail}? This will also remove their authentication access.`)) return;
    
    try {
      // Delete from staff collection only
      await deleteDoc(doc(db, "staff", staffId));
      
      await logActivity("staff_delete", { userId: staffId, email: staffEmail });
    } catch (e) {
      console.error("Failed to delete staff", e);
      alert("Could not delete staff member");
    }
  };

  // Reports helpers
  const filteredOrders = useReactMemo(() => {
    const fromTs = filterFrom ? new Date(filterFrom).getTime() : null;
    const toTs = filterTo ? new Date(filterTo).getTime() : null;
    return orders.filter((o) => {
      if (filterTable && String(o.tableNumber || "").toLowerCase().indexOf(filterTable.toLowerCase()) === -1) return false;
      if (filterStatus && String(o.status || "").toLowerCase() !== filterStatus.toLowerCase()) return false;
      const t = o.timestamp?.toDate ? o.timestamp.toDate().getTime() : 0;
      if (fromTs && t < fromTs) return false;
      if (toTs && t > toTs) return false;
      return true;
    });
  }, [orders, filterTable, filterStatus, filterFrom, filterTo]);

  const computeBill = (order) => {
    const items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((sum, it) => {
      const price = Number(it.price || 0);
      const qty = Number(it.quantity || 1);
      return sum + price * qty;
    }, 0);
    const taxRate = Number(settings.taxPercent || 5) / 100;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const generateBillPDF = async (order) => {
    try {
      await generateOrderBillPDF({ order, settings, title: 'Restaurant Bill' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF bill. Please try again.');
    }
  };

  const exportSalesCSV = () => {
    const rows = [
      ["OrderID", "Table", "Customer", "Subtotal", "Tax", "Total", "Status", "Timestamp"],
    ];
    filteredOrders.forEach((o) => {
      const { subtotal, tax, total } = computeBill(o);
      rows.push([
        o.id,
        o.tableNumber || "",
        o.customerName || "",
        subtotal.toFixed(2),
        tax.toFixed(2),
        total.toFixed(2),
        o.status || "",
        o.timestamp?.toDate ? o.timestamp.toDate().toISOString() : "",
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="text-center text-white">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-wide">Admin Dashboard</h1>
          <p className="text-white/80 mt-2">Manage orders and menu in realtime</p>
        </header>

        {notification && (
          <div className="bg-green-500/80 text-white text-center rounded-xl py-2">{notification}</div>
        )}

        <div className="flex flex-wrap gap-2 justify-center text-white/90">
          {[
            { key: "orders", label: "Orders" },
            { key: "menu", label: "Menu" },
            { key: "settings", label: "Settings" },
            { key: "reports", label: "Reports" },
            { key: "staff", label: "Staff" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-xl border ${activeTab === t.key ? "bg-white/20 border-white/40" : "bg-white/10 border-white/20 hover:bg-white/15"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Orders */}
        {activeTab === "orders" && (
        <section className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Orders</h2>
            <div className="flex flex-wrap gap-2">
              <input value={filterTable} onChange={(e) => setFilterTable(e.target.value)} placeholder="Table #" className="rounded-lg bg-white/10 border border-white/30 px-3 py-2 text-white placeholder-white/60" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg bg-white/10 border border-white/30 px-3 py-2 text-white">
                <option value="">All Status</option>
                {['Pending','Preparing','Ready','Served','Completed','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="rounded-lg bg-white/10 border border-white/30 px-3 py-2 text-white" />
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="rounded-lg bg-white/10 border border-white/30 px-3 py-2 text-white" />
            </div>
          </div>
          
          {/* Bulk Delete Controls */}
          {selectedOrders.size > 0 && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-red-200">
                  {selectedOrders.size} order(s) selected for deletion
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={handleBulkDelete}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    🗑️ Delete Selected
                  </button>
                  <button
                    onClick={() => setSelectedOrders(new Set())}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Select All Deletable Button */}
          <div className="mb-4">
            <button
              onClick={selectAllDeletable}
              className="bg-orange-500/80 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm"
            >
              Select All Cancelled/Completed Orders
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/90">
              <thead className="text-left text-white/80">
                <tr>
                  <th className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedOrders.size > 0 && selectedOrders.size === filteredOrders.filter(o => o.status === "Cancelled" || o.status === "Completed").length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          selectAllDeletable();
                        } else {
                          setSelectedOrders(new Set());
                        }
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2">Order ID</th>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Items</th>
                  <th className="px-3 py-2">Subtotal</th>
                  <th className="px-3 py-2">Tax</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const { subtotal, tax, total } = computeBill(o);
                  return (
                  <tr key={o.id} className="border-t border-white/10">
                    <td className="px-3 py-3 align-top">
                      {(o.status === "Cancelled" || o.status === "Completed") && (
                        <input
                          type="checkbox"
                          checked={selectedOrders.has(o.id)}
                          onChange={() => toggleOrderSelection(o.id)}
                          className="rounded"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">{o.id}</td>
                    <td className="px-3 py-3 align-top">{o.tableNumber || "-"}</td>
                    <td className="px-3 py-3 align-top">{o.customerName || "-"}</td>
                    <td className="px-3 py-3 align-top">
                      {Array.isArray(o.items) && o.items.length > 0 ? (
                        <ul className="list-disc list-inside space-y-1">
                          {o.items.map((it, idx) => (
                            <li key={idx}>
                              {typeof it === "string" ? it : it?.name || "Item"}
                              {` x${Number(it.quantity || 1)}`}
                            </li>
                          ))}
                        </ul>
                      ) : "-"}
                    </td>
                    <td className="px-3 py-3 align-top">₹{subtotal.toFixed(2)}</td>
                    <td className="px-3 py-3 align-top">₹{tax.toFixed(2)}</td>
                    <td className="px-3 py-3 align-top">₹{total.toFixed(2)}</td>
                    <td className="px-3 py-3 align-top">
                      <select
                        value={o.status || "Pending"}
                        onChange={(e) => handleStatusChange(o.id, e.target.value)}
                        className="rounded-lg bg-white/10 border border-white/30 px-2 py-1 text-white focus:outline-none"
                      >
                        {['Pending','Preparing','Ready','Served','Completed'].map(s => (
                          <option key={s} className="bg-indigo-900" value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      {o.timestamp?.toDate ? o.timestamp.toDate().toLocaleString() : "-"}
                    </td>
                    <td className="px-3 py-3 align-top space-x-2">
                      {o.status === "Completed" && (
                        <button 
                          onClick={() => generateBillPDF(o)} 
                          className="rounded-lg bg-green-500/80 px-3 py-1 hover:bg-green-500 mr-2"
                          title="Generate Bill PDF"
                        >
                          📄 Bill
                        </button>
                      )}
                      {(o.status === "Cancelled" || o.status === "Completed") ? (
                        <button 
                          onClick={() => handleDeleteOrder(o.id)} 
                          className="rounded-lg bg-red-600/80 px-3 py-1 hover:bg-red-600"
                          title="Delete Order Permanently"
                        >
                          🗑️ Delete
                        </button>
                      ) : (
                        <button onClick={() => handleCancelOrder(o.id)} className="rounded-lg bg-red-500/80 px-3 py-1 hover:bg-red-500">Cancel</button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-white/70" colSpan={11}>
                      {orders.length === 0 ? "No orders in database" : "No orders match current filters"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* Menu */}
        {activeTab === "menu" && (
        <section className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Menu</h2>
            <button
              onClick={openAddModal}
              className="rounded-xl bg-gradient-to-r from-green-500 to-teal-500 text-white px-4 py-2 text-sm font-semibold shadow"
            >
              Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/90">
              <thead className="text-left text-white/80">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Available</th>
                  <th className="px-3 py-2">Price</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {menu.map((m) => (
                  <tr key={m.id} className="border-t border-white/10">
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-3">
                        {m.image ? (
                          <img src={m.image} alt={m.name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-white/10" />
                        )}
                        <div>
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-white/70 max-w-xs">{m.description}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">{m.category || "-"}</td>
                    <td className="px-3 py-3 align-top">{m.available ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 align-top">₹{Number(m.price || 0).toFixed(2)}</td>
                    <td className="px-3 py-3 align-top space-x-2">
                      <button onClick={() => openEditModal(m)} className="rounded-lg bg-white/10 px-3 py-1 hover:bg-white/20">Edit</button>
                      <button onClick={() => handleDeleteItem(m.id)} className="rounded-lg bg-red-500/80 px-3 py-1 hover:bg-red-500">Delete</button>
                    </td>
                  </tr>
                ))}
                {menu.length === 0 && (
                  <tr>
                    <td className="px-3 py-6 text-center text-white/70" colSpan={4}>No menu items</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* Settings */}
        {activeTab === "settings" && (
        <section className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Settings</h2>
          <form onSubmit={saveSettings} className="grid grid-cols-1 sm:grid-cols-2 gap-4" onChange={() => setIsEditingSettings(true)}>
            <div>
              <label className="block mb-1 text-white/80">Restaurant Name</label>
              <input 
                value={settings.restaurantName} 
                onChange={(e) => setSettings({ ...settings, restaurantName: e.target.value })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-white/80">Tax Percent</label>
              <input 
                type="number" 
                step="0.01" 
                value={settings.taxPercent}
                onChange={(e) => setSettings({ ...settings, taxPercent: e.target.value === '' ? '' : Number(e.target.value) })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-white/80">Logo URL</label>
              <input 
                value={settings.logoURL} 
                onChange={(e) => setSettings({ ...settings, logoURL: e.target.value })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                placeholder="https://example.com/logo.png"
              />
            </div>
            <div>
              <label className="block mb-1 text-white/80">Contact Email</label>
              <input 
                value={settings.contact} 
                onChange={(e) => setSettings({ ...settings, contact: e.target.value })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                placeholder="contact@example.com"
              />
            </div>
            <div>
              <label className="block mb-1 text-white/80">Address</label>
              <input 
                value={settings.address} 
                onChange={(e) => setSettings({ ...settings, address: e.target.value })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                placeholder="123 Main St, City"
              />
            </div>
            <div>
              <label className="block mb-1 text-white/80">Phone Number</label>
              <input 
                value={settings.phone} 
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })} 
                className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white" 
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button 
                disabled={savingSettings} 
                className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-6 py-3 font-semibold"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        </section>
        )}

        {/* Reports */}
        {activeTab === "reports" && (
        <section className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 text-white">
          <h2 className="text-xl font-bold mb-6">Billing & Reports</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Reports */}
            <div className="bg-white/5 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Sales Reports</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                <input type="date" value={reportRange.from} onChange={(e) => setReportRange({ ...reportRange, from: e.target.value })} className="rounded-lg bg-white/10 border border-white/30 px-3 py-2" />
                <input type="date" value={reportRange.to} onChange={(e) => setReportRange({ ...reportRange, to: e.target.value })} className="rounded-lg bg-white/10 border border-white/30 px-3 py-2" />
                <button onClick={exportSalesCSV} className="rounded-xl bg-white/10 border border-white/30 px-4 py-2 hover:bg-white/20">Export CSV</button>
              </div>
              <p className="text-white/80 text-sm">Export sales data for the selected date range in CSV format.</p>
            </div>

            {/* QR Code Generator */}
            <div>
              <QRCodeGenerator />
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h4 className="text-blue-300 font-medium mb-2">📄 PDF Bills</h4>
            <p className="text-white/80 text-sm">To generate PDF bills, click the "📄 Bill" button next to completed orders in the Orders tab.</p>
          </div>
        </section>
        )}

        {/* Staff */}
        {activeTab === "staff" && (
        <section className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 shadow-xl p-4 sm:p-6 text-white">
          <h2 className="text-xl font-bold mb-4">Staff Management</h2>
          <form onSubmit={addStaff} className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
            <input 
              value={staffForm.name} 
              onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} 
              placeholder="Name" 
              className="rounded-xl bg-white/10 border border-white/30 px-3 py-2" 
            />
            <input 
              value={staffForm.email} 
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} 
              placeholder="Email" 
              className="rounded-xl bg-white/10 border border-white/30 px-3 py-2" 
            />
            <input 
              type="password" 
              value={staffForm.password} 
              onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })} 
              placeholder="Password" 
              className="rounded-xl bg-white/10 border border-white/30 px-3 py-2" 
            />
            <select 
              value={staffForm.role} 
              onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })} 
              className="rounded-xl bg-white/10 border border-white/30 px-3 py-2"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <button className="rounded-xl bg-gradient-to-r from-green-500 to-teal-500 px-4 py-2 font-semibold">Add Staff</button>
          </form>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white/90">
              <thead className="text-left text-white/80">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-white/10">
                    <td className="px-3 py-3">{s.name || "-"}</td>
                    <td className="px-3 py-3">{s.email}</td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        s.role === 'admin' 
                          ? 'bg-red-500/20 text-red-300' 
                          : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {s.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : "-"}</td>
                    <td className="px-3 py-3">
                      {s.role !== 'admin' && (
                        <button 
                          onClick={() => deleteStaff(s.id, s.email)}
                          className="rounded-lg bg-red-500/80 px-3 py-1 hover:bg-red-500 text-sm"
                        >
                          Delete
                        </button>
                      )}
                      {s.role === 'admin' && (
                        <span className="text-white/50 text-sm">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
                {staff.length === 0 && (
                  <tr><td className="px-3 py-6 text-center text-white/70" colSpan={5}>No staff yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}
      </div>

      {/* Modal */}
      
      <AnimatePresence>
        {isMenuModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="relative z-10 w-full max-w-lg rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-6 text-white"
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold">{editingItem ? "Edit Item" : "Add Item"}</h3>
              </div>
              <form onSubmit={handleMenuSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    value={menuForm.name}
                    onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })}
                    placeholder="Name"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                  />
                  <input
                    value={menuForm.category}
                    onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })}
                    placeholder="Category"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                  />
                </div>
                <textarea
                  value={menuForm.description}
                  onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })}
                  placeholder="Description"
                  className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                  rows={3}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <input
                    type="number"
                    step="0.01"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })}
                    placeholder="Price"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                  />
                  <input
                    value={menuForm.image}
                    onChange={(e) => setMenuForm({ ...menuForm, image: e.target.value })}
                    placeholder="Image URL"
                    className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={menuForm.available} onChange={(e) => setMenuForm({ ...menuForm, available: e.target.checked })} /> Available</label>
                  <input type="file" accept="image/*" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = await handleImageUpload(file);
                      if (url) setMenuForm((f) => ({ ...f, image: url }));
                    }
                  }} className="text-white/80" />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal} className="rounded-xl bg-white/10 px-4 py-2 hover:bg-white/20">Cancel</button>
                  <button type="submit" className="rounded-xl bg-gradient-to-r from-red-500 to-pink-500 px-4 py-2 font-semibold">Save</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}