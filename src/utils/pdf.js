import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function generateOrderBillPDF({
  order,
  settings,
  title = 'Restaurant Bill',
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 1), 0);
  const taxRate = Number(order.taxPercent ?? settings?.taxPercent ?? 5);
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  const currentDate = new Date().toLocaleDateString();
  const currentTime = new Date().toLocaleTimeString();

  const billContent = document.createElement('div');
  billContent.style.cssText = `
    width: 300px;
    padding: 20px;
    background: white;
    color: black;
    font-family: 'Helvetica', 'Arial', sans-serif;
    line-height: 1.4;
    font-size: 13px;
  `;

  billContent.innerHTML = `
    <div style="text-align: center; margin-bottom: 25px; border-bottom: 2px solid #333; padding-bottom: 20px;">
      ${settings?.logoURL ? `<img src="${settings.logoURL}" alt="${settings?.restaurantName || 'Restaurant'}" style="max-height: 100px; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;">` : ''}
      <h1 style="margin: 0; font-size: 26px; color: #333; font-weight: bold;">${settings?.restaurantName || 'Smart Café'}</h1>
      ${settings?.address ? `<p style="margin: 5px 0; color: #666; font-size: 15px;">📍 ${settings.address}</p>` : ''}
      ${settings?.phone ? `<p style="margin: 5px 0; color: #666; font-size: 15px;">📞 ${settings.phone}</p>` : ''}
      ${settings?.contact ? `<p style="margin: 5px 0; color: #666; font-size: 15px;">✉️ ${settings.contact}</p>` : ''}
      <p style="margin: 15px 0 0 0; font-size: 20px; font-weight: bold; color: #333;">${title}</p>
    </div>
    <div style="margin-bottom: 25px; background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-weight: bold;">Bill No:</span>
        <span>#${String(order.id || '').slice(-8)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-weight: bold;">Table No:</span>
        <span>${order.tableNumber || 'N/A'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-weight: bold;">Customer:</span>
        <span>${order.customerName || 'Walk-in Customer'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-weight: bold;">Date:</span>
        <span>${currentDate}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
        <span style="font-weight: bold;">Time:</span>
        <span>${currentTime}</span>
      </div>
    </div>
    <div style="margin-bottom: 25px;">
      <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #333; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 8px;">Order Items</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f0f0f0;">
            <th style="padding: 10px; text-align: left; border-bottom: 2px solid #333; font-weight: bold;">Item</th>
            <th style="padding: 10px; text-align: center; border-bottom: 2px solid #333; font-weight: bold;">Qty</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #333; font-weight: bold;">Price</th>
            <th style="padding: 10px; text-align: right; border-bottom: 2px solid #333; font-weight: bold;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.length > 0 ? items.map(item => `
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name || 'Item'}</td>
              <td style="padding: 10px; text-align: center; border-bottom: 1px solid #eee;">${item.quantity || 1}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">₹${Number(item.price || 0).toFixed(2)}</td>
              <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">₹${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</td>
            </tr>
          `).join('') : '<tr><td colspan="4" style="padding: 15px; text-align: center; font-style: italic; color: #999;">No items ordered</td></tr>'}
        </tbody>
      </table>
    </div>
    <div style="border-top: 2px solid #333; padding-top: 20px; margin-bottom: 30px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-weight: bold;">Subtotal:</span>
        <span>₹${subtotal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-weight: bold;">Tax (${taxRate}%):</span>
        <span>₹${taxAmount.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; border-top: 1px solid #333; padding-top: 12px; margin-top: 10px;">
        <span>Total Amount:</span>
        <span>₹${total.toFixed(2)}</span>
      </div>
    </div>
    <div style="text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
      <p style="margin: 8px 0; font-size: 14px;">Thank you for dining with us!</p>
      <p style="margin: 8px 0; font-size: 13px;">Generated on ${currentDate} at ${currentTime}</p>
    </div>
  `;

  document.body.appendChild(billContent);
  const canvas = await html2canvas(billContent, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');
  
  // Calculate dimensions for continuous page
  const imgWidth = 80; // mm - smaller width for receipt format
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  // Create PDF with custom size to fit content
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [imgWidth + 10, imgHeight + 10] // Add small margins
  });
  
  pdf.addImage(imgData, 'PNG', 5, 5, imgWidth, imgHeight);
  document.body.removeChild(billContent);
  const fileName = `Bill_${String(order.id || '').slice(-8)}_${order.tableNumber || 'N/A'}_${new Date().toISOString().slice(0,10)}.pdf`;
  pdf.save(fileName);
}