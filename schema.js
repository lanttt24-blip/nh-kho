import bcrypt from 'bcryptjs';
import { pool, tx } from './db';
import { newTx, applyDelta } from './inventory';

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS roles(role_id SERIAL PRIMARY KEY, role_name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS users(
  user_id SERIAL PRIMARY KEY, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role_id INT NOT NULL REFERENCES roles(role_id), is_active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS categories(category_id SERIAL PRIMARY KEY, category_name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS products(
  product_id SERIAL PRIMARY KEY, sku TEXT UNIQUE NOT NULL CHECK (length(trim(sku))>0), name TEXT NOT NULL,
  category_id INT REFERENCES categories(category_id), unit TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost>=0),
  reorder_level INT NOT NULL DEFAULT 0 CHECK (reorder_level>=0), is_active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS warehouses(
  warehouse_id SERIAL PRIMARY KEY, name TEXT NOT NULL, location TEXT, is_active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS stock_balances(
  stock_id SERIAL PRIMARY KEY, product_id INT NOT NULL REFERENCES products(product_id),
  warehouse_id INT NOT NULL REFERENCES warehouses(warehouse_id),
  quantity INT NOT NULL DEFAULT 0 CHECK (quantity>=0), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id));
CREATE TABLE IF NOT EXISTS suppliers(
  supplier_id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, is_active BOOLEAN NOT NULL DEFAULT true);
CREATE TABLE IF NOT EXISTS purchase_orders(
  po_id SERIAL PRIMARY KEY, supplier_id INT NOT NULL REFERENCES suppliers(supplier_id),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted','Approved','Partially Received','Received','Cancelled')),
  created_by INT REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expected_date DATE);
CREATE TABLE IF NOT EXISTS purchase_order_lines(
  line_id SERIAL PRIMARY KEY, po_id INT NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(product_id),
  ordered_qty INT NOT NULL CHECK (ordered_qty>0), received_qty INT NOT NULL DEFAULT 0 CHECK (received_qty>=0),
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost>=0));
CREATE TABLE IF NOT EXISTS stock_transactions(
  transaction_id SERIAL PRIMARY KEY, transaction_type TEXT NOT NULL, reference TEXT, note TEXT,
  created_by INT REFERENCES users(user_id), created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS stock_movements(
  movement_id SERIAL PRIMARY KEY, transaction_id INT NOT NULL REFERENCES stock_transactions(transaction_id),
  product_id INT NOT NULL REFERENCES products(product_id), warehouse_id INT NOT NULL REFERENCES warehouses(warehouse_id),
  movement_type TEXT NOT NULL, quantity_delta INT NOT NULL CHECK (quantity_delta<>0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), created_by INT REFERENCES users(user_id));
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_movements_wh ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
`;

export async function setupDatabase() {
  await pool.query(SCHEMA);
  const existing = await pool.query('SELECT count(*)::int n FROM users');
  if (existing.rows[0].n > 0) return { schema: 'ready', seeded: false };

  const hash = await bcrypt.hash('Password123!', 10);
  await tx(async (c) => {
    for (const r of ['admin', 'manager', 'staff', 'purchasing']) await c.query('INSERT INTO roles(role_name) VALUES($1) ON CONFLICT DO NOTHING', [r]);
    const users = [
      ['System Administrator', 'admin@iwms.test', 'admin'],
      ['Warehouse Manager', 'manager@iwms.test', 'manager'],
      ['Warehouse Staff', 'staff@iwms.test', 'staff'],
      ['Purchasing Staff', 'purchasing@iwms.test', 'purchasing'],
    ];
    for (const [n, e, r] of users)
      await c.query('INSERT INTO users(full_name,email,password_hash,role_id) SELECT $1,$2,$3,role_id FROM roles WHERE role_name=$4', [n, e, hash, r]);
    const adminId = (await c.query("SELECT user_id FROM users WHERE email='admin@iwms.test'")).rows[0].user_id;

    for (const n of ['Electronics', 'Office supplies', 'Packaging']) await c.query('INSERT INTO categories(category_name) VALUES($1)', [n]);
    const cat = async (n) => (await c.query('SELECT category_id FROM categories WHERE category_name=$1', [n])).rows[0].category_id;
    const [el, of, pk] = [await cat('Electronics'), await cat('Office supplies'), await cat('Packaging')];

    await c.query("INSERT INTO warehouses(name,location) VALUES('Main Warehouse','Ho Chi Minh City'),('Branch Warehouse','Thu Duc')");
    await c.query("INSERT INTO suppliers(name,email,phone,address) VALUES('An Phat Trading','sales@anphat.example','0901 000 111','District 7, HCMC'),('Viet Pack Co.','hello@vietpack.example','0902 000 222','Binh Duong')");

    const prods = [
      ['LAP-001', 'Laptop stand', el, 'pcs', 12.5, 15], ['USB-014', 'USB-C cable 1m', el, 'pcs', 2.2, 50],
      ['PEN-100', 'Ballpoint pens (box of 50)', of, 'box', 4.8, 20], ['PAP-A4', 'A4 paper ream', of, 'ream', 3.1, 40],
      ['BOX-M', 'Shipping carton, medium', pk, 'pcs', 0.6, 200], ['TAP-48', 'Packing tape 48mm', pk, 'roll', 0.9, 60],
    ];
    for (const [sku, name, cid, unit, cost, ro] of prods)
      await c.query('INSERT INTO products(sku,name,category_id,unit,unit_cost,reorder_level) VALUES($1,$2,$3,$4,$5,$6)', [sku, name, cid, unit, cost, ro]);

    // Opening balances are written through the ledger like any other movement.
    const opening = [['LAP-001', 1, 40], ['USB-014', 1, 180], ['PEN-100', 1, 12], ['PAP-A4', 1, 150], ['BOX-M', 1, 600], ['TAP-48', 1, 90], ['USB-014', 2, 60], ['PAP-A4', 2, 30]];
    const t = await newTx(c, 'OPENING', adminId, 'Opening balances (demo data)');
    for (const [sku, wid, q] of opening) {
      const pid = (await c.query('SELECT product_id FROM products WHERE sku=$1', [sku])).rows[0].product_id;
      await applyDelta(c, t.id, pid, wid, 'RECEIPT', q, adminId);
    }
  });
  return { schema: 'ready', seeded: true, demoPassword: 'Password123!' };
}
