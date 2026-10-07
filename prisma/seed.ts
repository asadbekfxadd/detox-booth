import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// --- детерминированный random, чтобы демо-данные были одинаковыми ---
let s = 20261007;
const rnd = () => {
  s |= 0; s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const DAY = 86400000;
const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * DAY);
const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Задайте ${k} в файле .env`);
  return v;
};
async function chunked<T>(rows: T[], fn: (c: T[]) => Promise<unknown>, size = 500) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function reset() {
  await prisma.$transaction([
    prisma.loyaltyTransaction.deleteMany(), prisma.loyaltyAccount.deleteMany(),
    prisma.payment.deleteMany(), prisma.orderItem.deleteMany(), prisma.order.deleteMany(),
    prisma.shift.deleteMany(), prisma.writeOff.deleteMany(), prisma.inventoryTransaction.deleteMany(),
    prisma.purchaseItem.deleteMany(), prisma.purchaseOrder.deleteMany(),
    prisma.batch.deleteMany(), prisma.stockItem.deleteMany(),
    prisma.modifierOption.deleteMany(), prisma.modifier.deleteMany(),
    prisma.recipeItem.deleteMany(), prisma.recipe.deleteMany(),
    prisma.product.deleteMany(), prisma.category.deleteMany(),
    prisma.ingredient.deleteMany(), prisma.supplier.deleteMany(),
    prisma.customer.deleteMany(), prisma.promoCode.deleteMany(), prisma.expense.deleteMany(),
    prisma.notification.deleteMany(), prisma.auditLog.deleteMany(), prisma.setting.deleteMany(),
    prisma.user.deleteMany(), prisma.location.deleteMany(),
  ]);
}

// sku, name, category, unit, min, max, cost per unit (UZS), shelf life days
const ING = [
  ["MNG", "Mango", "Fruit", "G", 5000, 40000, 35, 5],
  ["BAN", "Banana", "Fruit", "G", 5000, 40000, 18, 4],
  ["STR", "Strawberry", "Fruit", "G", 4000, 30000, 60, 3],
  ["ORG", "Orange", "Fruit", "G", 8000, 60000, 12, 10],
  ["APL", "Apple", "Fruit", "G", 4000, 30000, 10, 14],
  ["SPN", "Spinach", "Vegetable", "G", 2000, 15000, 25, 3],
  ["YOG", "Yogurt", "Dairy", "G", 4000, 30000, 20, 7],
  ["MLK", "Milk", "Dairy", "ML", 5000, 40000, 12, 5],
  ["CHI", "Chia", "Dry goods", "G", 500, 5000, 90, 365],
  ["GRN", "Granola", "Dry goods", "G", 1500, 12000, 45, 120],
  ["HNY", "Honey", "Dry goods", "G", 1000, 8000, 120, 365],
  ["PRO", "Protein Powder", "Dry goods", "G", 500, 4000, 250, 365],
  ["CUP", "Cup", "Packaging", "PC", 200, 1500, 800, null],
  ["LID", "Lid", "Packaging", "PC", 200, 1500, 300, null],
  ["BTL", "Water Bottle", "Beverage", "PC", 50, 400, 2500, null],
] as const;

type P = {
  slug: string; name: string; cat: string; price: number; cal: number; pr: number; cb: number; ft: number;
  vol: number; prep: number; allergens: string[]; vegan?: boolean; hp?: boolean; sf?: boolean;
  recipe: [string, number][]; drink?: boolean; weight: number; desc: string;
};
const PRODUCTS: P[] = [
  { slug: "mango-smoothie", name: "Mango Smoothie", cat: "smoothies", price: 32000, cal: 210, pr: 3, cb: 48, ft: 1, vol: 300, prep: 3, allergens: [], vegan: true, drink: true, weight: 20,
    desc: "Спелое манго, банан и апельсин.", recipe: [["MNG", 150], ["BAN", 80], ["ORG", 120], ["CUP", 1], ["LID", 1]] },
  { slug: "strawberry-banana-smoothie", name: "Strawberry Banana Smoothie", cat: "smoothies", price: 32000, cal: 240, pr: 7, cb: 44, ft: 4, vol: 300, prep: 3, allergens: ["milk"], hp: true, drink: true, weight: 18,
    desc: "Клубника, банан, йогурт и молоко.", recipe: [["STR", 120], ["BAN", 100], ["YOG", 100], ["MLK", 50], ["CUP", 1], ["LID", 1]] },
  { slug: "green-detox", name: "Green Detox", cat: "detox", price: 30000, cal: 160, pr: 3, cb: 34, ft: 1, vol: 300, prep: 3, allergens: [], vegan: true, drink: true, weight: 14,
    desc: "Шпинат, яблоко, банан и апельсин.", recipe: [["SPN", 40], ["APL", 150], ["BAN", 60], ["ORG", 100], ["CUP", 1], ["LID", 1]] },
  { slug: "berry-bowl", name: "Berry Bowl", cat: "bowls", price: 45000, cal: 380, pr: 12, cb: 60, ft: 9, vol: 350, prep: 5, allergens: ["milk", "gluten"], hp: true, weight: 9,
    desc: "Клубника, банан, йогурт, гранола и чиа.", recipe: [["STR", 150], ["BAN", 100], ["YOG", 120], ["GRN", 40], ["CHI", 8], ["HNY", 10]] },
  { slug: "tropical-bowl", name: "Tropical Bowl", cat: "bowls", price: 48000, cal: 410, pr: 11, cb: 66, ft: 10, vol: 350, prep: 5, allergens: ["milk", "gluten"], weight: 8,
    desc: "Манго, банан, йогурт, гранола и чиа.", recipe: [["MNG", 150], ["BAN", 100], ["YOG", 100], ["GRN", 40], ["CHI", 8]] },
  { slug: "fresh-orange", name: "Fresh Orange", cat: "fresh", price: 28000, cal: 150, pr: 2, cb: 34, ft: 0, vol: 300, prep: 2, allergens: [], vegan: true, sf: true, drink: true, weight: 16,
    desc: "Свежевыжатый апельсиновый сок.", recipe: [["ORG", 450], ["CUP", 1], ["LID", 1]] },
  { slug: "water", name: "Water", cat: "fresh", price: 8000, cal: 0, pr: 0, cb: 0, ft: 0, vol: 500, prep: 1, allergens: [], vegan: true, sf: true, weight: 8,
    desc: "Питьевая вода 0.5 л.", recipe: [["BTL", 1]] },
  { slug: "granola", name: "Granola", cat: "healthy-snacks", price: 18000, cal: 320, pr: 8, cb: 48, ft: 11, vol: 120, prep: 1, allergens: ["gluten"], vegan: true, weight: 5,
    desc: "Хрустящая гранола в стаканчике.", recipe: [["GRN", 100], ["CUP", 1], ["LID", 1]] },
  { slug: "fruit-cup", name: "Fruit Cup", cat: "fruits", price: 25000, cal: 140, pr: 2, cb: 34, ft: 0, vol: 300, prep: 3, allergens: [], vegan: true, sf: true, weight: 7,
    desc: "Нарезка: яблоко, апельсин, манго.", recipe: [["APL", 100], ["ORG", 100], ["MNG", 80], ["CUP", 1], ["LID", 1]] },
];

const ADDONS = [
  { name: "Protein", d: 8000, sku: "PRO", q: 20 },
  { name: "Chia", d: 4000, sku: "CHI", q: 8 },
  { name: "Granola", d: 5000, sku: "GRN", q: 25 },
  { name: "Honey", d: 3000, sku: "HNY", q: 10 },
];

async function main() {
  console.log("Очистка базы...");
  await reset();

  // ---------- Locations ----------
  const locs = await Promise.all(
    [["Detox Booth Chilonzor", "Chilonzor, Tashkent"], ["Detox Booth Yunusobod", "Yunusobod, Tashkent"], ["Detox Booth Mirobod", "Mirobod, Tashkent"]]
      .map(([name, address]) => prisma.location.create({ data: { name, address } })),
  );

  // ---------- Users (demo) ----------
  const demo: [Role, string, string, string, string | null][] = [
    ["OWNER", "owner@detoxbooth.uz", "Demo Owner", "SEED_OWNER_PASSWORD", null],
    ["ADMIN", "admin@detoxbooth.uz", "Demo Admin", "SEED_ADMIN_PASSWORD", locs[0].id],
    ["CASHIER", "cashier@detoxbooth.uz", "Demo Cashier", "SEED_CASHIER_PASSWORD", locs[0].id],
    ["WAREHOUSE", "warehouse@detoxbooth.uz", "Demo Warehouse", "SEED_WAREHOUSE_PASSWORD", locs[0].id],
    ["BARISTA", "barista@detoxbooth.uz", "Demo Barista", "SEED_BARISTA_PASSWORD", locs[0].id],
  ];
  const users: Record<string, string> = {};
  for (const [role, email, name, key, locationId] of demo) {
    const u = await prisma.user.create({ data: { role, email, name, passwordHash: await hash(env(key), 10), locationId } });
    users[role] = u.id;
  }

  // ---------- Suppliers & Ingredients ----------
  const sup = {
    fresh: await prisma.supplier.create({ data: { name: "Fresh Fruits LLC", phone: "+998901110011" } }),
    dairy: await prisma.supplier.create({ data: { name: "Dairy & Dry Goods Co", phone: "+998901110022" } }),
    pack: await prisma.supplier.create({ data: { name: "Packaging Plus", phone: "+998901110033" } }),
  };
  const ingBy: Record<string, { id: string; cost: number; shelf: number | null; max: number; min: number; unit: string }> = {};
  for (const [sku, name, category, unit, min, max, cost, shelf] of ING) {
    const supplierId = ["Fruit", "Vegetable"].includes(category) ? sup.fresh.id : ["Dairy", "Dry goods"].includes(category) ? sup.dairy.id : sup.pack.id;
    const i = await prisma.ingredient.create({
      data: { sku, name, category, unit, minStock: min, maxStock: max, avgCost: cost, shelfLifeDays: shelf, supplierId },
    });
    ingBy[sku] = { id: i.id, cost, shelf, max, min, unit };
  }

  // ---------- Categories, Products, Recipes, Modifiers ----------
  const cats: Record<string, string> = {};
  const catList: [string, string][] = [["smoothies", "Smoothies"], ["fresh", "Fresh"], ["bowls", "Bowls"], ["fruits", "Fruits"], ["detox", "Detox"], ["healthy-snacks", "Healthy Snacks"], ["add-ons", "Add-ons"]];
  for (const [i, [slug, name]] of catList.entries()) cats[slug] = (await prisma.category.create({ data: { slug, name, sort: i } })).id;

  type Opt = { id: string; modifierId: string; name: string; priceDelta: number; mult: number; extraCost: number };
  type Prod = { id: string; price: number; cost: number; weight: number; drink: boolean; size: Opt[]; addons: Opt[]; ice: Opt[]; sugar: Opt[] };
  const prods: Prod[] = [];

  for (const p of PRODUCTS) {
    const created = await prisma.product.create({
      data: {
        name: p.name, slug: p.slug, description: p.desc, categoryId: cats[p.cat], price: p.price,
        calories: p.cal, protein: p.pr, carbs: p.cb, fat: p.ft, volumeMl: p.vol, prepMinutes: p.prep,
        allergens: p.allergens, isVegan: !!p.vegan, isHighProtein: !!p.hp, isSugarFree: !!p.sf,
        recipe: { create: { items: { create: p.recipe.map(([sku, quantity]) => ({ ingredientId: ingBy[sku].id, quantity })) } } },
      },
    });
    const cost = p.recipe.reduce((sum, [sku, q]) => sum + q * ingBy[sku].cost, 0);
    const entry: Prod = { id: created.id, price: p.price, cost, weight: p.weight, drink: !!p.drink, size: [], addons: [], ice: [], sugar: [] };

    const mk = async (name: string, multiple: boolean, required: boolean, options: { name: string; d?: number; mult?: number; sku?: string; q?: number }[]) => {
      const m = await prisma.modifier.create({ data: { productId: created.id, name, multiple, required } });
      const res: Opt[] = [];
      for (const o of options) {
        const r = await prisma.modifierOption.create({
          data: {
            modifierId: m.id, name: o.name, priceDelta: o.d ?? 0, recipeMultiplier: o.mult ?? 1,
            extraIngredientId: o.sku ? ingBy[o.sku].id : null, extraQty: o.q ?? null,
          },
        });
        res.push({ id: r.id, modifierId: m.id, name: o.name, priceDelta: o.d ?? 0, mult: o.mult ?? 1, extraCost: o.sku ? (o.q ?? 0) * ingBy[o.sku].cost : 0 });
      }
      return res;
    };
    if (p.drink) {
      entry.size = await mk("Size", false, true, [{ name: "300 ml" }, { name: "500 ml", d: 12000, mult: 1.6 }]);
      entry.addons = await mk("Add-ons", true, false, ADDONS.map((a) => ({ name: a.name, d: a.d, sku: a.sku, q: a.q })));
      entry.ice = await mk("Ice", false, false, [{ name: "Normal" }, { name: "Less ice" }, { name: "No ice" }]);
      entry.sugar = await mk("Sugar", false, false, [{ name: "Normal" }, { name: "Less sugar" }, { name: "No sugar" }]);
    } else if (p.cat === "bowls") {
      entry.addons = await mk("Add-ons", true, false, ADDONS.map((a) => ({ name: a.name, d: a.d, sku: a.sku, q: a.q })));
    }
    prods.push(entry);
  }

  // ---------- Stock, Batches, Transactions ----------
  for (const [li, loc] of locs.entries()) {
    for (const [sku, ing] of Object.entries(ingBy)) {
      let total = Math.round(ing.max * (0.5 + rnd() * 0.4));
      if (li === 0 && sku === "STR") total = 2500; // LOW STOCK демо (min = 4000)
      const batches: { qty: number; exp: Date | null; recv: Date }[] = [];
      if (ing.shelf && ing.shelf <= 14) {
        batches.push({ qty: Math.round(total * 0.4), exp: daysFromNow(1 + Math.floor(rnd() * 2)), recv: daysFromNow(-(ing.shelf - 1)) });
        batches.push({ qty: total - Math.round(total * 0.4), exp: daysFromNow(ing.shelf - 1), recv: daysFromNow(-1) });
        if (li === 0 && sku === "SPN") batches.push({ qty: 600, exp: daysFromNow(-1), recv: daysFromNow(-4) }); // Expired демо
      } else {
        batches.push({ qty: total, exp: ing.shelf ? daysFromNow(ing.shelf - 10) : null, recv: daysFromNow(-10) });
      }
      const sum = batches.reduce((a, b) => a + b.qty, 0);
      await prisma.stockItem.create({ data: { locationId: loc.id, ingredientId: ing.id, quantity: sum } });
      for (const [bi, b] of batches.entries()) {
        const batch = await prisma.batch.create({
          data: { locationId: loc.id, ingredientId: ing.id, code: `${sku}-${li + 1}-${bi + 1}`, quantity: b.qty, unitCost: ing.cost, receivedAt: b.recv, expiresAt: b.exp },
        });
        await prisma.inventoryTransaction.create({
          data: { locationId: loc.id, ingredientId: ing.id, type: "PURCHASE", quantity: b.qty, unitCost: ing.cost, batchId: batch.id, refType: "Seed", userId: users.WAREHOUSE, createdAt: b.recv },
        });
      }
    }
  }

  // ---------- Customers & Promo ----------
  const names = ["Aziz", "Dilnoza", "Sardor", "Madina", "Jasur", "Nilufar", "Bekzod", "Malika", "Otabek", "Zarina", "Timur", "Shahnoza", "Rustam", "Lola", "Umid", "Kamila", "Farhod", "Sevara", "Anvar", "Gulnora", "Jamshid", "Aziza", "Doniyor", "Nargiza", "Sherzod"];
  const customers = await Promise.all(
    names.map((name, i) => prisma.customer.create({ data: { name, phone: `+99890${String(1000000 + i * 7919).slice(0, 7)}`, createdAt: daysFromNow(-Math.floor(rnd() * 60)) } })),
  );
  await prisma.promoCode.createMany({
    data: [
      { code: "WELCOME10", type: "PERCENT", value: 10, minOrder: 30000, usageLimit: 1000 },
      { code: "FRESH5000", type: "FIXED", value: 5000, minOrder: 50000, expiresAt: daysFromNow(30) },
    ],
  });

  // ---------- Orders (30 дней) ----------
  const orders: any[] = [], items: any[] = [], payments: any[] = [], loyaltyTx: any[] = [];
  const points: Record<string, number> = {};
  const totalWeight = prods.reduce((a, p) => a + p.weight, 0);
  const pickProd = () => { let r = rnd() * totalWeight; for (const p of prods) { r -= p.weight; if (r <= 0) return p; } return prods[0]; };
  const locFactor = [1, 0.8, 0.65];

  for (let li = 0; li < locs.length; li++) {
    const todayIdx: number[] = [];
    for (let d = 29; d >= 0; d--) {
      const day = new Date(now.getTime() - d * DAY);
      const weekend = [0, 6].includes(day.getDay());
      const n = Math.round((8 + rnd() * 7) * locFactor[li] * (weekend ? 1.3 : 1));
      for (let k = 0; k < n; k++) {
        const ts = new Date(day); ts.setHours(9 + Math.floor(rnd() * 13), Math.floor(rnd() * 60), 0, 0);
        if (ts > now) ts.setTime(now.getTime() - rnd() * 3 * 3600000);
        const id = randomUUID();
        const lines = 1 + (rnd() < 0.35 ? 1 : 0) + (rnd() < 0.1 ? 1 : 0);
        let subtotal = 0, cogs = 0;
        for (let l = 0; l < lines; l++) {
          const p = pickProd();
          const qty = rnd() < 0.8 ? 1 : 2;
          const chosen: Opt[] = [];
          if (p.size.length) chosen.push(rnd() < 0.3 ? p.size[1] : p.size[0]);
          for (const a of p.addons) if (rnd() < 0.1) chosen.push(a);
          if (p.ice.length) chosen.push(pick(p.ice), pick(p.sugar));
          const mult = chosen.reduce((m, o) => m * o.mult, 1);
          const unitPrice = p.price + chosen.reduce((a, o) => a + o.priceDelta, 0);
          const unitCost = p.cost * mult + chosen.reduce((a, o) => a + o.extraCost, 0);
          subtotal += unitPrice * qty; cogs += unitCost * qty;
          items.push({ id: randomUUID(), orderId: id, productId: p.id, quantity: qty, unitPrice,
            modifiers: chosen.map((o) => ({ modifierId: o.modifierId, optionId: o.id, name: o.name, priceDelta: o.priceDelta })) });
        }
        const web = rnd() < 0.3;
        const delivery = web && rnd() < 0.4;
        const promo = rnd() < 0.1 && subtotal >= 30000;
        const discount = promo ? Math.round(subtotal * 0.1) : 0;
        const deliveryFee = delivery ? 12000 : 0;
        const total = subtotal - discount + deliveryFee;
        const customer = rnd() < 0.45 ? pick(customers) : null;
        const cancelled = rnd() < 0.03;
        const idx = orders.length;
        orders.push({
          id, locationId: locs[li].id, customerId: customer?.id ?? null, cashierId: web ? null : users.CASHIER,
          source: web ? "WEB" : "POS", fulfillment: delivery ? "DELIVERY" : "PICKUP", status: cancelled ? "CANCELLED" : "COMPLETED",
          subtotal, discount, deliveryFee, total, cogs: cancelled ? 0 : Math.round(cogs), promoCode: promo ? "WELCOME10" : null,
          pointsEarned: 0, inventoryDeducted: !cancelled, address: delivery ? "Tashkent, demo address" : null,
          createdAt: ts, completedAt: cancelled ? null : new Date(ts.getTime() + 6 * 60000),
        });
        payments.push({ id: randomUUID(), orderId: id, method: web ? "ONLINE" : pick(["CASH", "CARD"] as const), status: cancelled ? "REFUNDED" : "PAID", amount: total, createdAt: ts });
        if (d === 0) todayIdx.push(idx);
        if (customer && !cancelled) {
          orders[idx].pointsEarned = Math.floor(total);
          points[customer.id] = (points[customer.id] ?? 0) + Math.floor(total);
          loyaltyTx.push({ customerId: customer.id, orderId: id, points: Math.floor(total), createdAt: ts });
        }
      }
    }
    // последние 3 заказа сегодня — «живые» веб-заказы в работе
    const live = todayIdx.slice(-3);
    (["NEW", "PREPARING", "READY"] as const).forEach((status, i) => {
      const o = orders[live[i]]; if (!o) return;
      Object.assign(o, { source: "WEB", cashierId: null, status, cogs: 0, inventoryDeducted: false, completedAt: null, pointsEarned: 0, createdAt: new Date(now.getTime() - (20 - i * 6) * 60000) });
      const pay = payments.find((p) => p.orderId === o.id); pay.method = "ONLINE"; pay.status = status === "NEW" ? "PENDING" : "PAID";
      const lt = loyaltyTx.findIndex((x) => x.orderId === o.id);
      if (lt >= 0) { points[o.customerId] -= loyaltyTx[lt].points; loyaltyTx.splice(lt, 1); }
    });
  }

  await chunked(orders, (c) => prisma.order.createMany({ data: c }));
  await chunked(items, (c) => prisma.orderItem.createMany({ data: c }));
  await chunked(payments, (c) => prisma.payment.createMany({ data: c }));
  for (const c of customers) {
    const acc = await prisma.loyaltyAccount.create({ data: { customerId: c.id, points: Math.max(0, points[c.id] ?? 0) } });
    const tx = loyaltyTx.filter((t) => t.customerId === c.id).map((t) => ({ accountId: acc.id, type: "EARN" as const, points: t.points, orderId: t.orderId, createdAt: t.createdAt }));
    if (tx.length) await prisma.loyaltyTransaction.createMany({ data: tx });
  }

  // ---------- Write-offs, Expenses, Notifications, Settings ----------
  const wo: [number, string, number, any][] = [
    [0, "SPN", 600, "EXPIRED"], [0, "STR", 400, "SPOILED"], [1, "BAN", 900, "SPOILED"],
    [1, "CUP", 25, "DAMAGED"], [2, "MNG", 500, "PRODUCTION_WASTE"], [0, "YOG", 800, "EXPIRED"],
  ];
  for (const [li, sku, quantity, reason] of wo) {
    await prisma.writeOff.create({ data: { locationId: locs[li].id, ingredientId: ingBy[sku].id, quantity, reason, cost: quantity * ingBy[sku].cost, userId: users.WAREHOUSE, createdAt: daysFromNow(-Math.floor(rnd() * 10)) } });
  }
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1), m1 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  for (const loc of locs) for (const date of [m0, m1]) {
    await prisma.expense.createMany({ data: [
      { locationId: loc.id, category: "RENT", amount: 6000000, date },
      { locationId: loc.id, category: "SALARY", amount: 9000000, date },
      { locationId: loc.id, category: "UTILITIES", amount: 800000, date },
    ] });
  }
  await prisma.expense.createMany({ data: [{ category: "MARKETING", amount: 1500000, date: m0 }, { category: "MARKETING", amount: 1200000, date: m1 }] });
  await prisma.notification.createMany({ data: [
    { locationId: locs[0].id, type: "LOW_STOCK", message: "LOW STOCK: Strawberry — 2500 G (min 4000)" },
    { locationId: locs[0].id, type: "EXPIRATION", message: "EXPIRED: Spinach batch SPN-1-3 (600 G)" },
  ] });
  await prisma.setting.createMany({ data: [
    { key: "loyalty.earnRate", value: 1 }, { key: "delivery.fee", value: 12000 }, { key: "writeoff.largeThreshold", value: 200000 },
  ] });

  console.log(`Готово: ${orders.length} заказов, ${items.length} позиций, ${customers.length} клиентов.`);
  console.log("Логины: owner@ / admin@ / cashier@ / warehouse@ / barista@ detoxbooth.uz (пароли из SEED_*_PASSWORD в .env)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
