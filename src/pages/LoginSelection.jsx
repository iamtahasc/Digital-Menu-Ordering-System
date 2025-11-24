import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Users } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";


export default function LoginSelection() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    restaurantName: "Smart Café",
    logoURL: "",
    address: "",
    phone: "",
    contact: ""
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "app"));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setSettings({
            restaurantName: data.restaurantName || "Smart Café",
            logoURL: data.logoURL || "",
            address: data.address || "",
            phone: data.phone || "",
            contact: data.contact || ""
          });
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-6 sm:p-12">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md sm:max-w-lg w-full text-center border border-white/20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white/80">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-800 to-pink-700 p-6 sm:p-12">
      <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-6 sm:p-10 max-w-md sm:max-w-lg w-full text-center border border-white/20">
        {settings.logoURL && (
          <div className="flex justify-center mb-4">
            <img 
              src={settings.logoURL} 
              alt={settings.restaurantName} 
              className="h-52 w-auto object-contain"
            />
          </div>
        )}
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white mb-6 tracking-wide leading-tight">
          Welcome to {settings.restaurantName}
        </h1>
        {settings.address && (
          <p className="text-white/70 text-sm mb-2 flex items-center justify-center">
            <span className="mr-2" role="img" aria-label="location">📍</span>
            <span>{settings.address}</span>
          </p>
        )}
        {settings.phone && (
          <p className="text-white/70 text-sm mb-2 flex items-center justify-center">
            <span className="mr-2" role="img" aria-label="phone">📞</span>
            <span>{settings.phone}</span>
          </p>
        )}
        {settings.contact && (
          <p className="text-white/70 text-sm mb-6 flex items-center justify-center">
            <span className="mr-2" role="img" aria-label="email">✉️</span>
            <span>{settings.contact}</span>
          </p>
        )}
        <p className="text-white/80 mb-6 text-sm sm:text-base leading-relaxed">
          Select your role to proceed with secure login.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 sm:gap-8">
          <button
            onClick={() => navigate("/AdminLogin")}
            className="group flex-1 bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 sm:py-5 rounded-xl font-bold text-base sm:text-lg shadow-lg transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center gap-3"
          >
            <ShieldCheck size={24} className="group-hover:rotate-12 transition-transform" />
            Admin Login
          </button>

          <button
            onClick={() => navigate("/StaffLogin")}
            className="group flex-1 bg-gradient-to-r from-green-500 to-teal-500 text-white py-4 sm:py-5 rounded-xl font-bold text-base sm:text-lg shadow-lg transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 ease-in-out flex items-center justify-center gap-3"
          >
            <Users size={24} className="group-hover:rotate-12 transition-transform" />
            Staff Login
          </button>
        </div>
      </div>
    </div>
  );
}