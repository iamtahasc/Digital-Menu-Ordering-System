import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ShoppingCart, Plus, Minus, X, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { generateOrderBillPDF } from '../utils/pdf';

const CustomerMenu = () => {
  // Get table number from URL
  const urlParams = new URLSearchParams(window.location.search);
  const tableNumber = urlParams.get('table') || 'T1';
  
  // State
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const [ordersForTable, setOrdersForTable] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
  const [settings, setSettings] = useState({ 
    taxPercent: 5, 
    restaurantName: "Smart Café", 
    contact: "",
    logoURL: "",
    address: "",
    phone: ""
  });
  const [audioInitialized, setAudioInitialized] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState('all');

  // Firestore collection references
  const menuCol = useMemo(() => collection(db, "menu"), []);
  const ordersCol = useMemo(() => collection(db, "orders"), []);

  // Initialize audio context on user interaction
  const initializeAudio = () => {
    if (!audioInitialized) {
      // Create a temporary audio context to unlock audio
      const tempAudio = new Audio();
      tempAudio.src = '/customer.mp3';
      tempAudio.play().then(() => {
        tempAudio.pause();
        tempAudio.currentTime = 0;
      }).catch(() => {
        // Expected to fail since we're just trying to unlock audio
      });
      setAudioInitialized(true);
    }
  };

  // Load active orders for this table - simple real-time updates
  useEffect(() => {
    if (!tableNumber) return;
    
    // Initialize audio on first user interaction
    const handleFirstInteraction = () => {
      initializeAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    
    // Only show orders that are not completed or cancelled
    const q = query(ordersCol, where("tableNumber", "==", tableNumber));
    
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Filter out completed and cancelled orders for new customers
      const activeOrders = data.filter(order => 
        order.status !== 'completed' && 
        order.status !== 'cancelled' &&
        order.status !== 'Completed' && 
        order.status !== 'Cancelled'
      );
      setOrdersForTable(activeOrders);
    });
    
    return () => {
      unsub();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [tableNumber, ordersCol]);

  // Load menu and settings
  useEffect(() => {
    const unsubMenu = onSnapshot(menuCol, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMenu(data.filter(item => item.available !== false));
    });

    // Load settings
    const loadSettings = async () => {
      try {
        const settingsDocRef = doc(db, "settings", "app");
        const settingsSnap = await getDoc(settingsDocRef);
        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setSettings({
            taxPercent: data.taxPercent || 5,
            restaurantName: data.restaurantName || "Smart Café",
            logoURL: data.logoURL || "",
            contact: data.contact || "",
            address: data.address || "",
            phone: data.phone || ""
          });
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    
    loadSettings();
    return () => unsubMenu();
  }, [menuCol]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = [...new Set(menu.map(item => item.category).filter(Boolean))];
    return ['all', ...cats];
  }, [menu]);

  // Filter menu items
  const filteredMenu = useMemo(() => {
    return menu.filter(item => {
      const matchesSearch = !searchTerm || 
        item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      
      const matchesPrice = priceRange === 'all' || 
        (priceRange === 'low' && item.price <= 200) ||
        (priceRange === 'medium' && item.price > 200 && item.price <= 500) ||
        (priceRange === 'high' && item.price > 500);
      
      return matchesSearch && matchesCategory && matchesPrice;
    });
  }, [menu, searchTerm, selectedCategory, priceRange]);

  // Cart functions
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      } else {
        return [...prev, { ...item, quantity: 1 }];
      }
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = (subtotal * settings.taxPercent) / 100;
    return { subtotal, tax, total: subtotal + tax };
  };

  // Place order
  const placeOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    if (!customerInfo.name.trim()) {
      alert('Please enter your name');
      return;
    }

    try {
      // Calculate totals before saving
      const { subtotal, tax, total } = getCartTotal();
      
      const orderData = {
        tableNumber,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone,
        customerEmail: customerInfo.email,
        items: cart,
        status: 'Pending',
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        taxPercent: settings.taxPercent,
        subtotal: subtotal,
        tax: tax,
        total: total
      };

      const docRef = await addDoc(ordersCol, orderData);
      setOrderId(docRef.id);
      setOrderPlaced(true);
      setOrderStatus('Pending');
      // Play customer success sound (best-effort; ignore errors)
      try {
        const audio = new Audio('/customer.mp3');
        audio.volume = 1.0;
        // Handle autoplay policies
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn('Audio play failed:', error);
            // Try again with user interaction
            document.body.addEventListener('click', () => {
              audio.play().catch(e => console.warn('Audio play failed on retry:', e));
            }, { once: true });
          });
        }
      } catch (error) {
        console.warn('Error playing customer audio:', error);
      }
      setCart([]);
      setShowCart(false);
      setShowCheckout(false);
      
      // Clear customer info
      setCustomerInfo({ name: '', phone: '', email: '' });
      
    } catch (error) {
      console.error('Error placing order:', error);
      alert('Error placing order. Please try again.');
    }
  };

  // Track order status
  useEffect(() => {
    if (orderId) {
      const unsub = onSnapshot(doc(db, "orders", orderId), (doc) => {
        if (doc.exists()) {
          setOrderStatus(doc.data().status);
        }
      });
      return () => unsub();
    }
  }, [orderId]);

  // Generate bill for served orders
  const generateBill = async (order) => {
    try {
      await generateOrderBillPDF({ order, settings, title: 'Restaurant Bill' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF bill. Please try again.');
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'preparing': return <Clock className="w-4 h-4 text-blue-500" />;
      case 'ready': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'served': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-700" />;
      case 'cancelled': return <X className="w-4 h-4 text-red-500" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'served': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20 shadow-2xl text-center max-w-md w-full"
        >
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Order Placed!</h2>
          <p className="text-gray-300 mb-4">Your order has been received and is being prepared.</p>
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-300">Order ID: {orderId}</p>
            <p className="text-sm text-gray-300">Table: {tableNumber}</p>
            <p className="text-sm text-gray-300">Status: {orderStatus}</p>
          </div>
          <button
            onClick={() => {
              setOrderPlaced(false);
              setOrderId('');
              setOrderStatus('');
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Place Another Order
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">{settings.restaurantName}</h1>
              <p className="text-gray-300">Table {tableNumber}</p>
            </div>
            <button
              onClick={() => setShowCart(true)}
              className="relative bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              <ShoppingCart className="w-5 h-5" />
              Cart ({cart.length})
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Your Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl mb-8"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Your Orders (Table {tableNumber})</h3>
          
          {ordersForTable.length === 0 ? (
            <p className="text-gray-300 text-center py-8">No orders yet. Start by adding items to your cart!</p>
          ) : (
            <div className="space-y-4">
              {ordersForTable.map((order) => (
                <div key={order.id} className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(order.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">
                        {order.timestamp?.toDate?.()?.toLocaleString() || 'Just now'}
                      </span>
                      {order.status?.toLowerCase() === 'served' && (
                        <button
                          onClick={() => generateBill(order)}
                          className="bg-blue-600 hover:bg-blue-700 text-white p-1 rounded-full transition-colors"
                          title="Generate Bill"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {order.items?.map((item, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="text-gray-300">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-white">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Total:</span>
                      <span className="text-white font-semibold">₹{order.total ? order.total.toFixed(2) : (order.items?.reduce((sum, item) => sum + (item.price * item.quantity), 0) || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Menu Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Search</label>
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat} className="bg-gray-800">
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-white mb-2">Price Range</label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all" className="bg-gray-800">All Prices</option>
                <option value="low" className="bg-gray-800">Under ₹200</option>
                <option value="medium" className="bg-gray-800">₹200 - ₹500</option>
                <option value="high" className="bg-gray-800">Over ₹500</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Menu Items */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredMenu.map((item) => (
            <div key={item.id} className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="aspect-w-16 aspect-h-9 mb-4">
                <img
                  src={item.image || '/placeholder-food.jpg'}
                  alt={item.name}
                  className="w-full h-48 object-cover rounded-lg"
                  onError={(e) => {
                    e.target.src = 'https://via.placeholder.com/300x200/4F46E5/FFFFFF?text=Food+Image';
                  }}
                />
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">{item.name}</h3>
              <p className="text-gray-300 text-sm mb-3 line-clamp-2">{item.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl font-bold text-white">₹{item.price}</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                  {item.category}
                </span>
              </div>
              
              <button
                onClick={() => addToCart(item)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Cart Modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md w-full max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Your Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-300 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            {cart.length === 0 ? (
              <p className="text-gray-300 text-center py-8">Your cart is empty</p>
            ) : (
              <>
                <div className="space-y-4 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{item.name}</h3>
                        <p className="text-gray-300 text-sm">₹{item.price}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-full flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-white w-8 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-full flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="border-t border-white/20 pt-4 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">Subtotal:</span>
                    <span className="text-white">₹{getCartTotal().subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300">Tax ({settings.taxPercent}%):</span>
                    <span className="text-white">₹{getCartTotal().tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-white">Total:</span>
                    <span className="text-white">₹{getCartTotal().total.toFixed(2)}</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    setShowCart(false);
                    setShowCheckout(true);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors"
                >
                  Proceed to Checkout
                </button>
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-2xl max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Checkout</h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-300 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Name *</label>
                <input
                  type="text"
                  value={customerInfo.name}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Phone</label>
                <input
                  type="tel"
                  value={customerInfo.phone}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email</label>
                <input
                  type="email"
                  value={customerInfo.email}
                  onChange={(e) => setCustomerInfo(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your email"
                />
              </div>
            </div>
            
            <div className="border-t border-white/20 pt-4 mb-6">
              <div className="flex justify-between text-lg font-bold">
                <span className="text-white">Total:</span>
                <span className="text-white">₹{getCartTotal().total.toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={placeOrder}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg transition-colors"
            >
              Place Order
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;