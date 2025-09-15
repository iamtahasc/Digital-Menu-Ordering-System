// src/pages/StaffLogin.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { Users, ArrowLeft } from "lucide-react";

const StaffLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  // firebase auth is initialized in firebaseConfig

  // Login Function
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      
      // Check staff collection for role
      const db = getFirestore();
      const snap = await getDoc(doc(db, "staff", credential.user.uid));
      
      if (!snap.exists()) {
        alert("Access denied: staff profile not found.");
        await signOut(auth);
        return;
      }
      
      const data = snap.data() || {};
      const role = data.role?.toLowerCase() || "";
      
      if (role === "staff" || role === "admin") {
        alert("Login successful!");
        navigate("/staff-dashboard");
      } else {
        alert("Access denied: insufficient permissions.");
        await signOut(auth);
      }
    } catch (error) {
      alert(error.message);
    }
    setLoading(false);
  };

  // Forgot Password Function
  const handleForgotPassword = async () => {
    if (!email) {
      alert("Please enter your email first.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Password reset email sent! Check your inbox.");
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-6 sm:p-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md sm:max-w-lg text-white border border-white/20"
      >
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center text-white/80 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5 mr-2" /> Back
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 mb-2">
          <Users className="w-7 h-7 text-white" />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide">Staff Login</h2>
        </div>
        <p className="text-white/80 text-center mb-6">Sign in to manage orders and tables.</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
            />
          </div>

          <motion.button
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full group bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 sm:py-3.5 rounded-xl font-semibold shadow-lg transition-all"
          >
            {loading ? "Logging in..." : "Login"}
          </motion.button>
        </form>

        <button
          type="button"
          onClick={handleForgotPassword}
          className="mt-4 w-full text-sm text-white/80 hover:text-white underline-offset-4 hover:underline"
        >
          Forgot Password?
        </button>
      </motion.div>
    </div>
  );
};

export default StaffLogin;