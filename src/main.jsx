import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { db } from "./firebaseConfig.js";
import { doc, onSnapshot } from "firebase/firestore";

// Set initial title
document.title = "Digital Menu & Ordering System";

// Listen for settings changes to update the title
if (typeof window !== "undefined") {
  const settingsDocRef = doc(db, "settings", "app");
  onSnapshot(settingsDocRef, (doc) => {
    if (doc.exists()) {
      const settings = doc.data();
      if (settings.restaurantName) {
        document.title = settings.restaurantName;
      }
    }
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);