import { db } from "./db";
import { products } from "@shared/schema";

const INITIAL_PRODUCTS = [
  { name: "Arroz Tio João 5kg", category: "Mercearia", price: "28.90", stock: 45, ean: "7891234567890" },
  { name: "Feijão Carioca Camil 1kg", category: "Mercearia", price: "8.50", stock: 120, ean: "7891234567891" },
  { name: "Leite Integral Italac 1L", category: "Laticínios", price: "4.89", stock: 240, ean: "7891234567892" },
  { name: "Café Pilão 500g", category: "Mercearia", price: "16.90", stock: 50, ean: "7891234567893" },
  { name: "Açúcar Refinado União 1kg", category: "Mercearia", price: "4.20", stock: 150, ean: "7891234567894" },
  { name: "Coca-Cola 2L", category: "Bebidas", price: "9.90", stock: 80, ean: "7891234567895" },
  { name: "Sabão em Pó Omo 1kg", category: "Limpeza", price: "14.50", stock: 60, ean: "7891234567896" },
  { name: "Detergente Ypê 500ml", category: "Limpeza", price: "2.30", stock: 300, ean: "7891234567897" },
  { name: "Papel Higiênico Neve 12un", category: "Higiene", price: "22.90", stock: 40, ean: "7891234567898" },
  { name: "Cerveja Heineken 330ml", category: "Bebidas", price: "5.90", stock: 200, ean: "7891234567899" },
  { name: "Pão de Forma Pullman", category: "Padaria", price: "7.50", stock: 25, ean: "7891234567800" },
  { name: "Manteiga Aviação 200g", category: "Laticínios", price: "11.90", stock: 35, ean: "7891234567801" },
];

async function seed() {
  try {
    const count = await db.select().from(products);
    if (count.length > 0) {
      console.log("Database already seeded, skipping...");
      return;
    }

    await db.insert(products).values(INITIAL_PRODUCTS);
    console.log("✅ Database seeded with initial products");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
  process.exit(0);
}

seed();
