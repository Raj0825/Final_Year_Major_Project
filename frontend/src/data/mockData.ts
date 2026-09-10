export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  expiry: string;
  days: number;
  status: string;
  batch: string;
  aisle: string;
};

export type AvailableFood = {
  id: string;
  name: string;
  category: string;
  qty: number;
  unit: string;
  deadline: string;
  distance: string;
  store: string;
  address: string;
  fit: string;
};

export const inventorySeed: InventoryItem[] = [
  { id: "INV-1048", name: "Amul Taaza Milk", category: "Dairy", qty: 42, unit: "litres", expiry: "Today, 8:00 PM", days: 0, status: "Urgent", batch: "AT-2406", aisle: "Chiller 02" },
  { id: "INV-1052", name: "Britannia Brown Bread", category: "Bakery", qty: 28, unit: "packs", expiry: "Tomorrow, 7:00 AM", days: 1, status: "Near expiry", batch: "BB-7189", aisle: "Bakery 01" },
  { id: "INV-1037", name: "Fresh Coriander", category: "Produce", qty: 16, unit: "bundles", expiry: "Tomorrow, 6:00 PM", days: 1, status: "Near expiry", batch: "FC-5512", aisle: "Produce 04" },
  { id: "INV-1021", name: "MTR Vegetable Pulav", category: "Ready meals", qty: 35, unit: "packs", expiry: "16 Jun, 11:00 PM", days: 3, status: "Watch", batch: "MV-8821", aisle: "Grocery 08" },
  { id: "INV-1019", name: "Tata Salt 1kg", category: "Staples", qty: 90, unit: "packs", expiry: "18 Jun, 12:00 PM", days: 5, status: "Safe", batch: "TS-1409", aisle: "Grocery 02" },
  { id: "INV-1004", name: "Bananas - Robusta", category: "Produce", qty: 24, unit: "kg", expiry: "Today, 6:00 PM", days: 0, status: "Urgent", batch: "BR-0941", aisle: "Produce 01" },
];

export const foodSeed: AvailableFood[] = [
  { id: "FOOD-221", name: "Amul Taaza Milk", category: "Dairy", qty: 42, unit: "litres", deadline: "Today, 8:00 PM", distance: "2.4 km", store: "FreshMart Koramangala", address: "80 Feet Road, Bengaluru", fit: "Children's nutrition" },
  { id: "FOOD-224", name: "Britannia Brown Bread", category: "Bakery", qty: 28, unit: "packs", deadline: "Tomorrow, 7:00 AM", distance: "3.1 km", store: "FreshMart Koramangala", address: "80 Feet Road, Bengaluru", fit: "Breakfast kits" },
  { id: "FOOD-219", name: "Fresh Coriander", category: "Produce", qty: 16, unit: "bundles", deadline: "Tomorrow, 6:00 PM", distance: "5.8 km", store: "Green Basket Indiranagar", address: "12th Main, Bengaluru", fit: "Community kitchen" },
  { id: "FOOD-210", name: "MTR Vegetable Pulav", category: "Ready meals", qty: 35, unit: "packs", deadline: "16 Jun, 11:00 PM", distance: "7.2 km", store: "Daily Needs HSR", address: "27th Main, Bengaluru", fit: "Shelter meals" },
];