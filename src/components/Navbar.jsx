export default function Navbar() {
  return (
    <nav className="bg-white shadow-md p-4 flex justify-between items-center">
      <h1 className="text-2xl font-bold text-red-500">🍽️ My Restaurant</h1>
      <div className="space-x-6">
        <a href="#" className="text-gray-700 hover:text-red-500">Home</a>
        <a href="#" className="text-gray-700 hover:text-red-500">Menu</a>
        <a href="#" className="text-gray-700 hover:text-red-500">Order</a>
        <a href="#" className="text-gray-700 hover:text-red-500">Contact</a>
      </div>
    </nav>
  );
}