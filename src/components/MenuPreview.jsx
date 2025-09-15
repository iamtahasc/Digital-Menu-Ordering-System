export default function MenuPreview() {
  const items = [
    { id: 1, name: "Margherita Pizza", price: "₹299", img: "https://via.placeholder.com/150" },
    { id: 2, name: "Cheese Burger", price: "₹199", img: "https://via.placeholder.com/150" },
    { id: 3, name: "Pasta Alfredo", price: "₹249", img: "https://via.placeholder.com/150" },
  ];

  return (
    <section className="py-12 px-4">
      <h2 className="text-3xl font-bold text-center text-gray-800 mb-8">Popular Dishes</h2>
      <div className="grid gap-8 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-6xl mx-auto">
        {items.map(item => (
          <div key={item.id} className="bg-white shadow-md rounded-lg overflow-hidden hover:shadow-xl transition">
            <img src={item.img} alt={item.name} className="w-full h-48 object-cover" />
            <div className="p-4">
              <h3 className="text-lg font-semibold">{item.name}</h3>
              <p className="text-red-500 font-bold">{item.price}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
