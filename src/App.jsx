import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import RoleSelect from "./pages/LoginSelection";
import AdminLogin from "./pages/AdminLogin";
import StaffLogin from "./pages/StaffLogin";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import CustomerMenu from "./pages/CustomerMenu";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleSelect />} />
        <Route path="/AdminLogin" element={<AdminLogin />} />
        <Route path="/StaffLogin" element={<StaffLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="/menu" element={<CustomerMenu />} />
      </Routes>
    </Router>
  );
}