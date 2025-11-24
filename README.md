# Digital Menu Ordering System

A modern, responsive restaurant ordering system that allows customers to browse menus, place orders via QR codes, and enables staff to manage orders efficiently. Built with React, Firebase, and Vite.

## 🍽️ Features

### For Customers
- **QR Code Ordering**: Scan QR codes at tables to access digital menus
- **Real-time Menu**: Browse menu items with images, descriptions, and prices
- **Shopping Cart**: Add/remove items and adjust quantities
- **Order Placement**: Submit orders with customer details
- **Order Tracking**: View order status in real-time
- **Bill Generation**: Download PDF bills for completed orders

### For Staff
- **Dashboard**: Real-time view of all orders
- **Order Management**: Update order statuses (Pending, Preparing, Ready, Served, Completed, Cancelled)
- **Audio Notifications**: Automatic alerts for new orders
- **Order Details**: View order contents and customer information
- **Filtering & Search**: Easily find specific orders

### For Admin
- **Multi-role Access**: Admin and staff roles with appropriate permissions
- **Menu Management**: Add, edit, and remove menu items
- **Order Management**: Full control over all orders
- **Staff Management**: Add and manage staff accounts
- **Settings Configuration**: Customize restaurant details, tax rates, and contact information
- **Reports & Analytics**: Generate sales reports and export data
- **QR Code Generation**: Create table-specific QR codes

## 🛠️ Tech Stack

- **Frontend**: React.js, Tailwind CSS, Framer Motion
- **Build Tool**: Vite
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **PDF Generation**: jsPDF, html2canvas
- **UI Components**: Lucide React icons

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Environment Setup

Create a `.env` file in the project root with your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/iamtahasc/digital-menu-ordering-system.git
   ```

2. Navigate to the project directory:
   ```bash
   cd digital-menu-ordering-system
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Build for production:
   ```bash
   npm run build
   ```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/               # Page components
├── utils/               # Utility functions
├── App.jsx             # Main app component
├── main.jsx            # Entry point
└── firebaseConfig.js   # Firebase configuration
```

## 🔐 Authentication

The system supports three user roles:
- **Admin**: Full access to all features
- **Staff**: Order management and dashboard access
- **Customers**: Menu browsing and order placement (no login required)

## 🎨 UI/UX Features

- **Responsive Design**: Works on mobile, tablet, and desktop
- **Dark Mode**: Modern dark theme for reduced eye strain
- **Animations**: Smooth transitions and micro-interactions
- **Real-time Updates**: Live order status changes

## 📱 User Flows

1. **Customer Flow**:
   - Scan QR code → Browse menu → Add to cart → Checkout → View order status

2. **Staff Flow**:
   - Login → View dashboard → Manage orders → Update statuses → Receive notifications

3. **Admin Flow**:
   - Login → Access dashboard → Manage menu/staff/settings → Generate reports

## 🎵 Audio Notifications

- **Customer**: Plays sound when order is successfully placed
- **Staff**: Plays sound when new orders are received
- Audio files located in the `public/` directory

## 📄 PDF Generation

- Automatic bill generation for completed orders
- Professional formatting with restaurant branding
- Downloadable PDF files with order details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Authors

- Taha Contractor (https://github.com/iamtahasc) - Lead Developer

## 🙏 Acknowledgments

- React and Vite communities
- Firebase for backend services
- Tailwind CSS for styling
