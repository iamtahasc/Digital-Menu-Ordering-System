// src/pages/StaffDashboard.jsx
import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  collection, 
  doc, 
  updateDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp,
  addDoc
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Bell,
  LogOut,
  User,
  Eye,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Smartphone,
  Tablet,
  Monitor,
  X
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";

const StaffDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [notification, setNotification] = useState("");
  const [lastOrderIds, setLastOrderIds] = useState(new Set());
  
  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTable, setFilterTable] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // UI State
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Firestore collection references
  const ordersCol = useMemo(() => collection(db, "orders"), []);
  const activityLogsCol = useMemo(() => collection(db, "activityLogs"), []);

  // Play notification sound
  const playNotificationSound = () => {
    if (!soundEnabled) return;
    
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.log("Audio not supported");
    }
  };

  // Log activity
  const logActivity = async (action, details = {}) => {
    try {
      await addDoc(activityLogsCol, {
        action,
        details,
        timestamp: serverTimestamp(),
        user: auth.currentUser?.email || "staff",
        userType: "staff"
      });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  // Real-time data listeners
  useEffect(() => {
    const unsubOrders = onSnapshot(ordersCol, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      
      // Check for new orders
      const incomingIds = new Set(data.map((o) => o.id));
      
      // Only check for new orders if we have previous orders to compare
      if (lastOrderIds.size > 0 && data.length > 0) {
        for (const order of data) {
          if (!lastOrderIds.has(order.id)) {
            const notificationText = `New order${order.tableNumber ? ` at table ${order.tableNumber}` : ""}`;
            setNotification(notificationText);
            playNotificationSound();
            logActivity("new_order_notification", { orderId: order.id });
            setTimeout(() => setNotification(""), 5000);
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
      setIsLoading(false);
    }, (error) => {
      console.error("Orders listener error:", error);
      setIsLoading(false);
    });

    return () => {
      unsubOrders();
    };
  }, [ordersCol, lastOrderIds]);

  // Handle order status update
  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      
      logActivity("order_status_update", { 
        orderId, 
        newStatus,
        previousStatus: orders.find(o => o.id === orderId)?.status 
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      alert("Failed to update order status");
    }
  };

  // Handle order cancellation
  const handleCancelOrder = async (orderId) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "Cancelled",
        updatedAt: serverTimestamp()
      });
      
      logActivity("order_cancelled", { orderId });
    } catch (error) {
      console.error("Error cancelling order:", error);
      alert("Failed to cancel order");
    }
  };

  // View order details
  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setIsOrderModalOpen(true);
  };

  // Close order modal
  const closeOrderModal = () => {
    setIsOrderModalOpen(false);
    setSelectedOrder(null);
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesStatus = filterStatus === "all" || order.status === filterStatus;
      const matchesTable = !filterTable || order.tableNumber?.toLowerCase().includes(filterTable.toLowerCase());
      const matchesSearch = !searchTerm || 
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tableNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.items && JSON.stringify(order.items).toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesStatus && matchesTable && matchesSearch;
    });
  }, [orders, filterStatus, filterTable, searchTerm]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logActivity("staff_logout");
      await signOut(auth);
      navigate("/StaffLogin");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    if (!status) return "bg-gray-100 text-gray-800";
    switch (status) {
      case "Pending": return "bg-yellow-100 text-yellow-800";
      case "Preparing": return "bg-blue-100 text-blue-800";
      case "Ready": return "bg-green-100 text-green-800";
      case "Served": return "bg-purple-100 text-purple-800";
      case "Completed": return "bg-gray-100 text-gray-800";
      case "Cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleString();
  };

  // Calculate order total
  const calculateTotal = (order) => {
    if (!order.items) return 0;
    
    let subtotal = 0;
    if (Array.isArray(order.items)) {
      subtotal = order.items.reduce((sum, item) => {
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
        const qty = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0;
        return sum + (price * qty);
      }, 0);
    } else if (typeof order.items === 'object') {
      subtotal = Object.values(order.items).reduce((sum, item) => {
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0;
        const qty = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0;
        return sum + (price * qty);
      }, 0);
    }
    
    const tax = (subtotal * (order.taxPercent || 5)) / 100;
    return subtotal + tax;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
      {/* Header */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white/10 backdrop-blur-md border-b border-white/20 shadow-lg sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
                <User className="h-4 w-4 sm:h-6 sm:w-6 text-blue-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Staff Dashboard</h1>
                <p className="text-xs sm:text-sm text-white/70 hidden sm:block">Order Management</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              
              {/* Sound Toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 sm:p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-300"
                title={soundEnabled ? "Disable sound" : "Enable sound"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-300" />
                ) : (
                  <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-red-300" />
                )}
              </button>
              
              {/* Notification Bell */}
              <div className="relative">
                <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                {notification && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 sm:h-3 sm:w-3 bg-red-500 rounded-full animate-pulse"></div>
                )}
              </div>
              
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-300"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline text-sm">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="bg-green-500/20 border border-green-500/30 text-green-300 px-3 sm:px-4 py-2 sm:py-3 mx-3 sm:mx-4 mt-3 sm:mt-4 rounded-lg backdrop-blur-sm"
        >
          <div className="flex items-center space-x-2">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="text-sm sm:text-base">{notification}</span>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">


        {/* Stats Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8"
        >
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/70">Total Orders</p>
                <p className="text-lg sm:text-2xl font-bold text-white">{orders.length}</p>
              </div>
              <ShoppingCart className="h-6 w-6 sm:h-8 sm:w-8 text-blue-300" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/70">Pending</p>
                <p className="text-lg sm:text-2xl font-bold text-yellow-300">{orders.filter(o => o.status === "Pending").length}</p>
              </div>
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-300" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/70">Preparing</p>
                <p className="text-lg sm:text-2xl font-bold text-orange-300">{orders.filter(o => o.status === "Preparing").length}</p>
              </div>
              <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-orange-300" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/70">Ready</p>
                <p className="text-lg sm:text-2xl font-bold text-green-300">{orders.filter(o => o.status === "Ready").length}</p>
              </div>
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-300" />
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/20 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm text-white/70">Served</p>
                <p className="text-lg sm:text-2xl font-bold text-purple-300">{orders.filter(o => o.status === "Served").length}</p>
              </div>
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-300" />
            </div>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-4 sm:p-6 border border-white/20 shadow-xl mb-6 sm:mb-8"
        >
          <div className="flex items-center space-x-2 mb-4">
            <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            <h3 className="text-base sm:text-lg font-semibold text-white">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-white/50" />
                <input
                  id="search-input"
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search orders..."
                  className="w-full pl-8 sm:pl-10 pr-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-white/50"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
              >
                <option value="all" className="bg-gray-800 text-white">All Status</option>
                <option value="Pending" className="bg-gray-800 text-white">Pending</option>
                <option value="Preparing" className="bg-gray-800 text-white">Preparing</option>
                <option value="Ready" className="bg-gray-800 text-white">Ready</option>
                <option value="Served" className="bg-gray-800 text-white">Served</option>
                <option value="Completed" className="bg-gray-800 text-white">Completed</option>
                <option value="Cancelled" className="bg-gray-800 text-white">Cancelled</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium text-white/70 mb-2">Table Number</label>
              <input
                type="text"
                value={filterTable}
                onChange={(e) => setFilterTable(e.target.value)}
                placeholder="e.g., T1, T2"
                className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder-white/50"
              />
            </div>
          </div>
        </motion.div>

        {/* Orders Table */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl overflow-hidden"
        >
          <div className="px-4 sm:px-6 py-4 border-b border-white/20">
            <h3 className="text-base sm:text-lg font-semibold text-white">Orders ({filteredOrders.length})</h3>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="text-white/70 mt-2">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingCart className="h-12 w-12 text-white/30 mx-auto mb-4" />
              <p className="text-white/70">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Mobile Card View */}
              <div className="block sm:hidden">
                {filteredOrders.map((order) => (
                  <motion.div
                    key={order.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 border-b border-white/10 last:border-b-0"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="text-sm font-medium text-white">#{order.id.slice(-6)}</p>
                        <p className="text-xs text-white/70">Table {order.tableNumber}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm text-white/70 mb-1">Customer: {order.customerName || "N/A"}</p>
                      <p className="text-sm text-white/70 mb-1">Items: {Array.isArray(order.items) ? order.items.length : Object.keys(order.items || {}).length}</p>
                      <p className="text-sm text-white/70">Total: ₹{calculateTotal(order).toFixed(2)}</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg transition-all duration-300"
                      >
                        <Eye className="h-3 w-3" />
                        <span className="text-xs">View</span>
                      </button>
                      
                      {order.status !== "Completed" && order.status !== "Cancelled" && (
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          className="flex-1 px-2 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        >
                          <option value="Pending" className="bg-gray-800 text-white">Pending</option>
                          <option value="Preparing" className="bg-gray-800 text-white">Preparing</option>
                          <option value="Ready" className="bg-gray-800 text-white">Ready</option>
                          <option value="Served" className="bg-gray-800 text-white">Served</option>
                          <option value="Completed" className="bg-gray-800 text-white">Completed</option>
                        </select>
                      )}
                      
                      {order.status !== "Completed" && order.status !== "Cancelled" && (
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-300"
                        >
                          <XCircle className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Desktop Table View */}
              <table className="w-full hidden sm:table">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Order ID</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Table</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Customer</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Items</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Total</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Status</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Time</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-white/70 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white/5 divide-y divide-white/10">
                  {filteredOrders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="hover:bg-white/5 transition-colors duration-200"
                    >
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                        #{order.id.slice(-6)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                        {order.tableNumber || "N/A"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                        {order.customerName || "N/A"}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                        {Array.isArray(order.items) ? order.items.length : Object.keys(order.items || {}).length} items
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white">
                        ₹{calculateTotal(order).toFixed(2)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-white/70">
                        {formatTime(order.createdAt)}
                      </td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleViewOrder(order)}
                            className="flex items-center space-x-1 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg transition-all duration-300"
                          >
                            <Eye className="h-3 w-3" />
                            <span className="text-xs">View</span>
                          </button>
                          
                          {order.status !== "Completed" && order.status !== "Cancelled" && (
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                              className="px-2 py-1 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white text-xs focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            >
                              <option value="Pending" className="bg-gray-800 text-white">Pending</option>
                              <option value="Preparing" className="bg-gray-800 text-white">Preparing</option>
                              <option value="Ready" className="bg-gray-800 text-white">Ready</option>
                              <option value="Served" className="bg-gray-800 text-white">Served</option>
                              <option value="Completed" className="bg-gray-800 text-white">Completed</option>
                            </select>
                          )}
                          
                          {order.status !== "Completed" && order.status !== "Cancelled" && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-300"
                            >
                              <XCircle className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </main>

      {/* Order Details Modal */}
      <AnimatePresence>
        {isOrderModalOpen && selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={closeOrderModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-white">Order Details</h3>
                  <button
                    onClick={closeOrderModal}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300"
                  >
                    <X className="h-5 w-5 text-white" />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Order Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Order ID</label>
                      <p className="text-white">#{selectedOrder?.id?.slice(-6) || "N/A"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Table Number</label>
                      <p className="text-white">{selectedOrder?.tableNumber || "N/A"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Customer Name</label>
                      <p className="text-white">{selectedOrder?.customerName || "N/A"}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Status</label>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder?.status)}`}>
                        {selectedOrder?.status || "N/A"}
                      </span>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Order Time</label>
                      <p className="text-white">{formatTime(selectedOrder?.createdAt)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white/70 mb-1">Last Updated</label>
                      <p className="text-white">{formatTime(selectedOrder?.updatedAt)}</p>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">Items Ordered</label>
                    <div className="space-y-2">
                      {selectedOrder?.items ? (
                        Array.isArray(selectedOrder.items) ? (
                          selectedOrder.items.map((item, index) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                              <div>
                                <p className="text-white font-medium">{item?.name || "Unknown Item"}</p>
                                <p className="text-white/70 text-sm">Qty: {item?.quantity || 0}</p>
                              </div>
                              <p className="text-white">₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</p>
                            </div>
                          ))
                        ) : (
                          Object.entries(selectedOrder.items).map(([key, item]) => (
                            <div key={key} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                              <div>
                                <p className="text-white font-medium">{item?.name || "Unknown Item"}</p>
                                <p className="text-white/70 text-sm">Qty: {item?.quantity || 0}</p>
                              </div>
                              <p className="text-white">₹{((item?.price || 0) * (item?.quantity || 0)).toFixed(2)}</p>
                            </div>
                          ))
                        )
                      ) : (
                        <p className="text-white/70">No items found</p>
                      )}
                    </div>
                  </div>

                  {/* Bill Breakdown */}
                  <div className="border-t border-white/20 pt-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-white/70">
                        <span>Subtotal:</span>
                        <span>₹{calculateTotal(selectedOrder || {}).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white/70">
                        <span>Tax ({(selectedOrder?.taxPercent || 5)}%):</span>
                        <span>₹{((calculateTotal(selectedOrder || {}) * (selectedOrder?.taxPercent || 5)) / 100).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-white font-bold text-lg border-t border-white/20 pt-2">
                        <span>Total:</span>
                        <span>₹{calculateTotal(selectedOrder || {}).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {selectedOrder?.status !== "Completed" && selectedOrder?.status !== "Cancelled" && (
                    <div className="flex space-x-3">
                      <select
                        value={selectedOrder?.status || "Pending"}
                        onChange={(e) => {
                          handleStatusChange(selectedOrder?.id, e.target.value);
                          closeOrderModal();
                        }}
                        className="flex-1 px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                      >
                        <option value="Pending" className="bg-gray-800 text-white">Pending</option>
                        <option value="Preparing" className="bg-gray-800 text-white">Preparing</option>
                        <option value="Ready" className="bg-gray-800 text-white">Ready</option>
                        <option value="Served" className="bg-gray-800 text-white">Served</option>
                        <option value="Completed" className="bg-gray-800 text-white">Completed</option>
                      </select>
                      <button
                        onClick={() => {
                          handleCancelOrder(selectedOrder?.id);
                          closeOrderModal();
                        }}
                        className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 rounded-lg transition-all duration-300"
                      >
                        Cancel Order
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffDashboard;