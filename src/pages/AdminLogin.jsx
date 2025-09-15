import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { auth, app } from "../firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // Check Firestore for role using UID = document id
      try {
        const db = getFirestore();
        try { console.info("Firebase projectId:", app?.options?.projectId); } catch (_) {}
        const uid = credential.user.uid;
        console.info("Authenticated UID:", uid);

        // Check 'staff' collection for role
        let snap = await getDoc(doc(db, "staff", uid));

        if (!snap.exists()) {
          console.warn("Staff document missing for UID:", uid);
          alert("Access denied: staff profile not found.");
          await signOut(auth);
          return;
        }

        const data = snap.data() || {};
        console.info("Staff doc path:", snap.ref.path);
        console.info("Staff doc data:", data);

        const findRoleString = (obj) => {
          if (!obj || typeof obj !== "object") return undefined;
          if (typeof obj.role === "string") return obj.role;
          if (typeof obj.Role === "string") return obj.Role;
          if (typeof obj.userRole === "string") return obj.userRole;
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (val && typeof val === "object") {
              const nested = findRoleString(val);
              if (typeof nested === "string") return nested;
            }
          }
          return undefined;
        };

        const roleString = findRoleString(data);
        const role = typeof roleString === "string" ? roleString.trim().toLowerCase() : "";
        const isAdminFlag = data.isAdmin === true;
        console.info("Resolved role fields:", { role: data.role, Role: data.Role, userRole: data.userRole, isAdmin: data.isAdmin });

        if (role === "admin" || isAdminFlag) {
          navigate("/admin/dashboard");
        } else {
          console.warn("Non-admin role for UID:", uid, "role/flag:", { roleString, isAdminFlag });
          alert(`Access denied: insufficient role`);
          await signOut(auth);
        }
      } catch (firestoreError) {
        console.error("Firestore error while checking admin role:", firestoreError);
        alert("Could not verify access. Please try again.");
        await signOut(auth);
      }
    } catch (err) {
      setError("Invalid email or password");
    }
  };

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
          <ShieldCheck className="w-7 h-7 text-white" />
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-wide">Admin Login</h2>
        </div>
        <p className="text-white/80 text-center mb-6">Access your administration dashboard securely.</p>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 rounded-xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-red-200"
          >
            {error}
          </motion.p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
              required
            />
          </div>

          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl bg-white/10 border border-white/30 px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/60"
              required
            />
          </div>

          <motion.button
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full group bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 sm:py-3.5 rounded-xl font-semibold shadow-lg transition-all"
          >
            <span className="inline-block group-hover:translate-x-0.5 transition-transform">Login</span>
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
}