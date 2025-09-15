// src/components/QRCodeGenerator.jsx
import React, { useState } from "react";
import { motion } from "framer-motion";
import { QrCode, Download, Copy, Check } from "lucide-react";

const QRCodeGenerator = () => {
  const [tableNumber, setTableNumber] = useState("T1");
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState(window.location.origin);

  const generateQRUrl = () => {
    return `${baseUrl}/menu?table=${tableNumber}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateQRUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadQRCode = () => {
    // Create a simple QR code using a service
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generateQRUrl())}`;
    
    // Create a temporary link to download the QR code
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `QR_Code_Table_${tableNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-xl p-6">
      <div className="flex items-center space-x-2 mb-6">
        <QrCode className="h-6 w-6 text-white" />
        <h3 className="text-xl font-bold text-white">QR Code Generator</h3>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="https://your-restaurant.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">Table Number</label>
          <input
            type="text"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="w-full px-3 py-2 bg-white/10 backdrop-blur-sm border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            placeholder="T1, T2, T3..."
          />
        </div>

        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-white font-medium mb-2">Generated URL:</h4>
          <p className="text-white/70 text-sm break-all">{generateQRUrl()}</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={copyToClipboard}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 rounded-lg transition-all duration-300"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? 'Copied!' : 'Copy URL'}</span>
          </button>

          <button
            onClick={downloadQRCode}
            className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/30 rounded-lg transition-all duration-300"
          >
            <Download className="h-4 w-4" />
            <span>Download QR</span>
          </button>
        </div>

        <div className="text-center">
          <div className="bg-white p-4 rounded-lg inline-block">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generateQRUrl())}`}
              alt={`QR Code for Table ${tableNumber}`}
              className="w-48 h-48"
            />
          </div>
          <p className="text-white/70 text-sm mt-2">QR Code for Table {tableNumber}</p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;

