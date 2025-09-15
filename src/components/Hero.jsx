export default function Hero() {
  return (
    <section className="bg-gray-100 text-center py-16 px-4">
      <h1 className="text-4xl md:text-6xl font-bold text-gray-800">
        Fresh, Fast & Delicious 🍕
      </h1>
      <p className="text-lg text-gray-600 mt-4">
        Order your favorite dishes in just a few clicks!
      </p>
      <button className="mt-6 px-6 py-3 bg-red-500 text-white text-lg rounded-lg shadow-lg hover:bg-red-600 transition">
        Order Now
      </button>
    </section>
  );
}
