'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/* ---------- helpers ---------- */
async function api(path, method = 'GET', body) {
  const res = await fetch('/api/' + path, {
    method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status });
  return data;
}
function useGet(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => api(path).then((d) => { setData(d); setError(''); }).catch((e) => setError(e.message)), [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}
const Notify = createContext(() => {});
const useNotify = () => useContext(Notify);
const fmt = (n) => Number(n).toLocaleString('en-US');
const money = (n) => Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const when = (s) => new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

function Field({ label, children, wide }) {
  return <label className={'field' + (wide ? ' wide' : '')}><span>{label}</span>{children}</label>;
}
function Table({ cols, rows, empty = 'Nothing to show yet.', rowClass }) {
  if (!rows) return <p className="empty">Loading…</p>;
  if (!rows.length) return <p className="empty">{empty}</p>;
  return (
    <div className="tablewrap"><table>
      <thead><tr>{cols.map((c) => <th key={c.h} className={c.num ? 'num' : ''}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className={rowClass?.(r)}>{cols.map((c) => <td key={c.h} className={c.num ? 'num' : ''}>{c.f(r)}</td>)}</tr>)}</tbody>
    </table></div>
  );
}
function Page({ title, sub, children, aside }) {
  return <>
    <div className="head"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>{aside}</div>
    {children}
  </>;
}
function Lines({ products, lines, setLines, withCost }) {
  const upd = (i, k, v) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return (
    <div className="lines">
      {lines.map((l, i) => (
        <div className={'line' + (withCost ? '' : ' nocost')} key={i}>
          <select aria-label="Product" value={l.productId} onChange={(e) => upd(i, 'productId', e.target.value)} required>
            <option value="">Select product</option>
            {(products || []).map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}
          </select>
          <input aria-label="Quantity" type="number" min="1" step="1" placeholder="Quantity" value={l.quantity} onChange={(e) => upd(i, 'quantity', e.target.value)} required />
          {withCost && <input aria-label="Unit cost" type="number" min="0" step="0.01" placeholder="Unit cost" value={l.unitCost} onChange={(e) => upd(i, 'unitCost', e.target.value)} />}
          <button type="button" className="ghost" disabled={lines.length === 1} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
        </div>
      ))}
      <button type="button" className="ghost" onClick={() => setLines([...lines, { productId: '', quantity: '', unitCost: '' }])}>Add line</button>
    </div>
  );
}
function useSubmit(fn) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const run = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try { await fn(); } catch (err) { notify(err.message, true); } finally { setBusy(false); }
  };
  return [run, busy];
}

/* ---------- login ---------- */
const DEMO = [['Administrator', 'admin@iwms.test'], ['Warehouse manager', 'manager@iwms.test'], ['Warehouse staff', 'staff@iwms.test'], ['Purchasing staff', 'purchasing@iwms.test']];
function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try { onLogin(await api('auth/login', 'POST', { email, password })); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <h1>IWMS</h1>
        <p>Sign in to manage products, stock and purchase orders.</p>
        <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></Field>
          <Field label="Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></Field>
          <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
        {error && <p className="err-text" role="alert">{error}</p>}
        <div className="demo">Demo accounts (password Password123!)
          {DEMO.map(([n, e]) => <button type="button" key={e} onClick={() => { setEmail(e); setPassword('Password123!'); }}>{n}</button>)}
        </div>
      </form>
    </div>
  );
}

/* ---------- views ---------- */
function Dashboard({ user }) {
  const { data: s, error } = useGet('reports/summary');
  const canReport = ['manager', 'admin'].includes(user.role);
  const low = useGet(canReport ? 'reports/low-stock' : 'products?q=zzzz-none');
  return (
    <Page title="Dashboard" sub="Current state of stock and open orders.">
      {error && <p className="err-text">{error}</p>}
      {s && <div className="stats">
        <div className="stat"><div className="muted">Active products</div><div className="v">{fmt(s.products)}</div></div>
        <div className="stat"><div className="muted">Warehouses</div><div className="v">{fmt(s.warehouses)}</div></div>
        <div className={'stat' + (s.low_stock ? ' warn' : '')}><div className="muted">Products below reorder level</div><div className="v">{fmt(s.low_stock)}</div></div>
        <div className="stat"><div className="muted">Open purchase orders</div><div className="v">{fmt(s.open_orders)}</div></div>
        <div className="stat"><div className="muted">Stock value (at unit cost)</div><div className="v">{money(s.stock_value)}</div></div>
        <div className="stat"><div className="muted">Movements, last 7 days</div><div className="v">{fmt(s.movements_7d)}</div></div>
      </div>}
      {canReport && <div className="panel"><h2>Low-stock items</h2>
        <Table rows={low.data} empty="All products are at or above their reorder level."
          cols={[{ h: 'SKU', f: (r) => r.sku }, { h: 'Product', f: (r) => r.name },
            { h: 'On hand', num: true, f: (r) => `${fmt(r.total_qty)} ${r.unit}` }, { h: 'Reorder level', num: true, f: (r) => fmt(r.reorder_level) },
            { h: 'Status', f: () => <span className="tag low">Reorder</span> }]} />
      </div>}
    </Page>
  );
}

function StockView() {
  const [wid, setWid] = useState('');
  const wh = useGet('warehouses');
  const { data, error } = useGet('stock' + (wid ? `?warehouseId=${wid}` : ''));
  return (
    <Page title="Stock levels" sub="Quantity on hand by product and warehouse."
      aside={<Field label="Warehouse"><select value={wid} onChange={(e) => setWid(e.target.value)}><option value="">All warehouses</option>{wh.data?.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></Field>}>
      <div className="panel">{error && <p className="err-text">{error}</p>}
        <Table rows={data} empty="No stock recorded. Receive stock to get started."
          cols={[{ h: 'Warehouse', f: (r) => r.warehouse_name }, { h: 'SKU', f: (r) => r.sku }, { h: 'Product', f: (r) => r.name },
            { h: 'On hand', num: true, f: (r) => `${fmt(r.quantity)} ${r.unit}` }, { h: 'Reorder level', num: true, f: (r) => fmt(r.reorder_level) },
            { h: 'Status', f: (r) => (r.low ? <span className="tag low">Below reorder level</span> : <span className="tag ok">OK</span>) }]} />
      </div>
    </Page>
  );
}

function Products({ user }) {
  const [q, setQ] = useState('');
  const { data, error, reload } = useGet(`products?all=1&q=${encodeURIComponent(q)}`);
  const cats = useGet('categories');
  const isAdmin = user.role === 'admin';
  const [f, setF] = useState({ sku: '', name: '', categoryId: '', unit: 'pcs', unitCost: '', reorderLevel: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const notify = useNotify();
  const [add, busy] = useSubmit(async () => {
    await api('products', 'POST', f); notify('Product added');
    setF({ sku: '', name: '', categoryId: '', unit: 'pcs', unitCost: '', reorderLevel: '' }); reload();
  });
  const toggle = async (p) => {
    try { await api(`products/${p.product_id}`, 'PATCH', { isActive: !p.is_active }); notify(p.is_active ? 'Product deactivated' : 'Product reactivated'); reload(); }
    catch (e) { notify(e.message, true); }
  };
  return (
    <Page title="Products" sub="Catalog of items. Deactivated products stay in history but cannot be used in new transactions."
      aside={<Field label="Search by name or SKU"><input value={q} onChange={(e) => setQ(e.target.value)} /></Field>}>
      {isAdmin && <form className="panel grid" onSubmit={add}>
        <Field label="SKU"><input value={f.sku} onChange={set('sku')} required /></Field>
        <Field label="Name"><input value={f.name} onChange={set('name')} required /></Field>
        <Field label="Category"><select value={f.categoryId} onChange={set('categoryId')}><option value="">None</option>{cats.data?.map((c) => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}</select></Field>
        <Field label="Unit"><input value={f.unit} onChange={set('unit')} /></Field>
        <Field label="Unit cost"><input type="number" min="0" step="0.01" value={f.unitCost} onChange={set('unitCost')} /></Field>
        <Field label="Reorder level"><input type="number" min="0" step="1" value={f.reorderLevel} onChange={set('reorderLevel')} /></Field>
        <button className="btn" disabled={busy}>Add product</button>
      </form>}
      <div className="panel">{error && <p className="err-text">{error}</p>}
        <Table rows={data} empty="No products match your search." rowClass={(p) => (p.is_active ? '' : 'inactive')}
          cols={[{ h: 'SKU', f: (p) => p.sku }, { h: 'Name', f: (p) => p.name }, { h: 'Category', f: (p) => p.category_name || '' },
            { h: 'Unit cost', num: true, f: (p) => money(p.unit_cost) }, { h: 'Reorder level', num: true, f: (p) => fmt(p.reorder_level) },
            { h: 'Total on hand', num: true, f: (p) => `${fmt(p.total_qty)} ${p.unit}` },
            { h: 'Status', f: (p) => (p.is_active ? <span className="tag ok">Active</span> : <span className="tag">Inactive</span>) },
            ...(isAdmin ? [{ h: '', f: (p) => <button className="ghost small" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Reactivate'}</button> }] : [])]} />
      </div>
    </Page>
  );
}

function SimpleMaster({ title, sub, path, canAdd, fields, cols }) {
  const { data, error, reload } = useGet(path);
  const blank = Object.fromEntries(fields.map(([k]) => [k, '']));
  const [f, setF] = useState(blank);
  const notify = useNotify();
  const [add, busy] = useSubmit(async () => { await api(path, 'POST', f); notify('Saved'); setF(blank); reload(); });
  return (
    <Page title={title} sub={sub}>
      {canAdd && <form className="panel grid" onSubmit={add}>
        {fields.map(([k, label, req]) => <Field key={k} label={label}><input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} required={!!req} /></Field>)}
        <button className="btn" disabled={busy}>Add</button>
      </form>}
      <div className="panel">{error && <p className="err-text">{error}</p>}<Table rows={data} cols={cols} /></div>
    </Page>
  );
}
const active = (r) => (r.is_active ? <span className="tag ok">Active</span> : <span className="tag">Inactive</span>);

function PurchaseOrders({ user }) {
  const { data, error, reload } = useGet('purchase-orders');
  const sup = useGet('suppliers');
  const prods = useGet('products');
  const notify = useNotify();
  const canCreate = ['purchasing', 'admin'].includes(user.role);
  const [f, setF] = useState({ supplierId: '', expectedDate: '' });
  const [lines, setLines] = useState([{ productId: '', quantity: '', unitCost: '' }]);
  const [open, setOpen] = useState(null);
  const [create, busy] = useSubmit(async () => {
    const r = await api('purchase-orders', 'POST', { ...f, lines });
    notify(`Purchase order #${r.poId} created as Draft`);
    setF({ supplierId: '', expectedDate: '' }); setLines([{ productId: '', quantity: '', unitCost: '' }]); reload();
  });
  const setStatus = async (po, status) => {
    try { await api(`purchase-orders/${po.po_id}`, 'PATCH', { status }); notify(`PO #${po.po_id} is now ${status}`); reload(); }
    catch (e) { notify(e.message, true); }
  };
  const actions = (po) => {
    const r = user.role, out = [];
    if (po.status === 'Draft' && ['purchasing', 'admin'].includes(r)) out.push(['Submit', 'Submitted']);
    if (po.status === 'Submitted' && ['manager', 'admin'].includes(r)) out.push(['Approve', 'Approved']);
    if (['Draft', 'Submitted', 'Approved'].includes(po.status)) out.push(['Cancel', 'Cancelled', true]);
    return out;
  };
  const tagClass = (s) => (s === 'Partially Received' ? 'Partially' : s);
  return (
    <Page title="Purchase orders" sub="Draft, submit, approve, then receive against the order from Inventory operations.">
      {canCreate && <form className="panel grid" onSubmit={create}>
        <Field label="Supplier"><select value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })} required><option value="">Select supplier</option>{sup.data?.filter((s) => s.is_active).map((s) => <option key={s.supplier_id} value={s.supplier_id}>{s.name}</option>)}</select></Field>
        <Field label="Expected date"><input type="date" value={f.expectedDate} onChange={(e) => setF({ ...f, expectedDate: e.target.value })} /></Field>
        <Lines products={prods.data} lines={lines} setLines={setLines} withCost />
        <button className="btn" disabled={busy}>Create purchase order</button>
      </form>}
      <div className="panel">{error && <p className="err-text">{error}</p>}
        <Table rows={data} empty="No purchase orders yet."
          cols={[{ h: 'PO', f: (p) => `#${p.po_id}` }, { h: 'Supplier', f: (p) => p.supplier_name },
            { h: 'Status', f: (p) => <span className={'tag ' + tagClass(p.status)}>{p.status}</span> },
            { h: 'Expected', f: (p) => p.expected_date?.slice(0, 10) || '' },
            { h: 'Received / ordered', num: true, f: (p) => `${fmt(p.lines.reduce((a, l) => a + l.receivedQty, 0))} / ${fmt(p.lines.reduce((a, l) => a + l.orderedQty, 0))}` },
            { h: 'Items', f: (p) => (
              <div>
                <button className="ghost small" onClick={() => setOpen(open === p.po_id ? null : p.po_id)}>{open === p.po_id ? 'Hide' : `${p.lines.length} line(s)`}</button>
                {open === p.po_id && <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>{p.lines.map((l) => <li key={l.lineId}>{l.name} ({l.sku}): {l.receivedQty} of {l.orderedQty} at {money(l.unitCost)}</li>)}</ul>}
              </div>) },
            { h: '', f: (p) => <div className="actions">{actions(p).map(([label, st, danger]) => <button key={st} className={'ghost small' + (danger ? ' danger' : '')} onClick={() => setStatus(p, st)}>{label}</button>)}</div> }]} />
      </div>
    </Page>
  );
}

function Operations({ user }) {
  const all = [['receipt', 'Receive', ['staff', 'admin']], ['issue', 'Issue', ['staff', 'admin']], ['transfer', 'Transfer', ['staff', 'admin']], ['stocktake', 'Stocktake', ['manager', 'admin']]];
  const tabs = all.filter((t) => t[2].includes(user.role));
  const [tab, setTab] = useState(tabs[0]?.[0]);
  const prods = useGet('products');
  const wh = useGet('warehouses');
  const pos = useGet('purchase-orders');
  const notify = useNotify();
  const whs = wh.data?.filter((w) => w.is_active) || [];
  const blankLines = () => [{ productId: '', quantity: '' }];

  const [rc, setRc] = useState({ warehouseId: '', poId: '', note: '' });
  const [rcLines, setRcLines] = useState(blankLines());
  const [is, setIs] = useState({ warehouseId: '', productId: '', quantity: '', note: '' });
  const [tr, setTr] = useState({ fromWarehouseId: '', toWarehouseId: '', productId: '', quantity: '', note: '' });
  const [st, setSt] = useState({ warehouseId: '', productId: '', countedQty: '', reason: '' });

  const pickPo = (id) => {
    setRc({ ...rc, poId: id });
    const po = pos.data?.find((p) => String(p.po_id) === id);
    setRcLines(po ? po.lines.filter((l) => l.orderedQty > l.receivedQty).map((l) => ({ productId: String(l.productId), quantity: String(l.orderedQty - l.receivedQty) })) : blankLines());
  };
  const [doReceipt, b1] = useSubmit(async () => {
    const r = await api('receipts', 'POST', { ...rc, poId: rc.poId || null, lines: rcLines });
    notify(`Receipt ${r.reference} saved`); setRc({ warehouseId: rc.warehouseId, poId: '', note: '' }); setRcLines(blankLines()); pos.reload(); prods.reload();
  });
  const [doIssue, b2] = useSubmit(async () => {
    const r = await api('issues', 'POST', is);
    notify(`Issue ${r.reference} saved. ${r.balance} left in this warehouse`); setIs({ ...is, quantity: '', note: '' });
  });
  const [doTransfer, b3] = useSubmit(async () => {
    const r = await api('transfers', 'POST', tr); notify(`Transfer ${r.reference} saved`); setTr({ ...tr, quantity: '', note: '' });
  });
  const [doCount, b4] = useSubmit(async () => {
    const r = await api('stock-adjustments', 'POST', st);
    notify(`Adjustment ${r.reference}: ${r.previous} → ${r.counted} (${r.delta > 0 ? '+' : ''}${r.delta})`); setSt({ ...st, countedQty: '', reason: '' });
  });
  const whSelect = (v, on, label = 'Warehouse') => <Field label={label}><select value={v} onChange={(e) => on(e.target.value)} required><option value="">Select warehouse</option>{whs.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></Field>;
  const prodSelect = (v, on) => <Field label="Product"><select value={v} onChange={(e) => on(e.target.value)} required><option value="">Select product</option>{prods.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} ({p.sku})</option>)}</select></Field>;
  const receivable = pos.data?.filter((p) => ['Approved', 'Partially Received'].includes(p.status)) || [];

  return (
    <Page title="Inventory operations" sub="Every change is saved as a movement. Completed movements are never edited; corrections are new adjustments.">
      <div className="tabs" role="tablist">{tabs.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}</div>
      {tab === 'receipt' && <form className="panel grid" onSubmit={doReceipt}>
        {whSelect(rc.warehouseId, (v) => setRc({ ...rc, warehouseId: v }), 'Destination warehouse')}
        <Field label="Purchase order (optional)"><select value={rc.poId} onChange={(e) => pickPo(e.target.value)}><option value="">Direct receipt, no order</option>{receivable.map((p) => <option key={p.po_id} value={p.po_id}>#{p.po_id} {p.supplier_name} ({p.status})</option>)}</select></Field>
        <Lines products={prods.data} lines={rcLines} setLines={setRcLines} />
        <Field label="Note" wide><input value={rc.note} onChange={(e) => setRc({ ...rc, note: e.target.value })} /></Field>
        <button className="btn" disabled={b1}>Save receipt</button>
      </form>}
      {tab === 'issue' && <form className="panel grid" onSubmit={doIssue}>
        {whSelect(is.warehouseId, (v) => setIs({ ...is, warehouseId: v }), 'Issue from warehouse')}
        {prodSelect(is.productId, (v) => setIs({ ...is, productId: v }))}
        <Field label="Quantity"><input type="number" min="1" step="1" value={is.quantity} onChange={(e) => setIs({ ...is, quantity: e.target.value })} required /></Field>
        <Field label="Reason or reference"><input value={is.note} onChange={(e) => setIs({ ...is, note: e.target.value })} /></Field>
        <button className="btn" disabled={b2}>Issue stock</button>
      </form>}
      {tab === 'transfer' && <form className="panel grid" onSubmit={doTransfer}>
        {whSelect(tr.fromWarehouseId, (v) => setTr({ ...tr, fromWarehouseId: v }), 'From warehouse')}
        {whSelect(tr.toWarehouseId, (v) => setTr({ ...tr, toWarehouseId: v }), 'To warehouse')}
        {prodSelect(tr.productId, (v) => setTr({ ...tr, productId: v }))}
        <Field label="Quantity"><input type="number" min="1" step="1" value={tr.quantity} onChange={(e) => setTr({ ...tr, quantity: e.target.value })} required /></Field>
        <Field label="Note"><input value={tr.note} onChange={(e) => setTr({ ...tr, note: e.target.value })} /></Field>
        <button className="btn" disabled={b3}>Transfer stock</button>
      </form>}
      {tab === 'stocktake' && <form className="panel grid" onSubmit={doCount}>
        {whSelect(st.warehouseId, (v) => setSt({ ...st, warehouseId: v }))}
        {prodSelect(st.productId, (v) => setSt({ ...st, productId: v }))}
        <Field label="Counted quantity"><input type="number" min="0" step="1" value={st.countedQty} onChange={(e) => setSt({ ...st, countedQty: e.target.value })} required /></Field>
        <Field label="Reason for adjustment"><input value={st.reason} onChange={(e) => setSt({ ...st, reason: e.target.value })} required /></Field>
        <button className="btn" disabled={b4}>Record count</button>
      </form>}
    </Page>
  );
}

function Movements() {
  const [f, setF] = useState({ from: '', to: '', warehouseId: '', productId: '', type: '' });
  const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const { data, error } = useGet('reports/movements' + (qs ? `?${qs}` : ''));
  const wh = useGet('warehouses');
  const prods = useGet('products?all=1');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Page title="Movement history" sub="Latest 300 movements matching your filters.">
      <div className="panel grid">
        <Field label="From"><input type="date" value={f.from} onChange={set('from')} /></Field>
        <Field label="To"><input type="date" value={f.to} onChange={set('to')} /></Field>
        <Field label="Warehouse"><select value={f.warehouseId} onChange={set('warehouseId')}><option value="">All</option>{wh.data?.map((w) => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}</select></Field>
        <Field label="Product"><select value={f.productId} onChange={set('productId')}><option value="">All</option>{prods.data?.map((p) => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select></Field>
        <Field label="Type"><select value={f.type} onChange={set('type')}><option value="">All</option>{['RECEIPT', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'].map((t) => <option key={t}>{t}</option>)}</select></Field>
      </div>
      <div className="panel">{error && <p className="err-text">{error}</p>}
        <Table rows={data} empty="No movements match these filters."
          cols={[{ h: 'When', f: (m) => when(m.created_at) }, { h: 'Reference', f: (m) => m.reference }, { h: 'Type', f: (m) => <span className={'tag ' + m.movement_type}>{m.movement_type}</span> },
            { h: 'Warehouse', f: (m) => m.warehouse_name }, { h: 'Product', f: (m) => `${m.product_name} (${m.sku})` },
            { h: 'Change', num: true, f: (m) => <b className={m.quantity_delta > 0 ? 'pos' : 'neg'}>{m.quantity_delta > 0 ? '+' : ''}{fmt(m.quantity_delta)}</b> },
            { h: 'By', f: (m) => m.user_name || '' }, { h: 'Note', f: (m) => m.note || '' }]} />
      </div>
    </Page>
  );
}

/* ---------- shell ---------- */
const NAV = [
  ['dashboard', 'Dashboard', null], ['stock', 'Stock levels', null], ['products', 'Products', null],
  ['purchasing', 'Purchase orders', null], ['operations', 'Inventory operations', ['staff', 'manager', 'admin']],
  ['movements', 'Movement history', ['manager', 'admin']], ['warehouses', 'Warehouses', null], ['suppliers', 'Suppliers', null],
];

export default function App() {
  const [user, setUser] = useState(undefined);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const notify = useCallback((msg, err) => { setToast({ msg, err }); setTimeout(() => setToast(null), 5000); }, []);
  useEffect(() => { api('auth/me').then(setUser).catch(() => setUser(null)); }, []);
  const logout = async () => { await api('auth/logout', 'POST').catch(() => {}); setUser(null); setView('dashboard'); };

  if (user === undefined) return <div className="login"><p className="muted">Loading…</p></div>;
  if (!user) return <Login onLogin={setUser} />;

  const items = NAV.filter(([, , roles]) => !roles || roles.includes(user.role));
  const V = {
    dashboard: <Dashboard user={user} />, stock: <StockView />, products: <Products user={user} />, purchasing: <PurchaseOrders user={user} />,
    operations: <Operations user={user} />, movements: <Movements />,
    warehouses: <SimpleMaster title="Warehouses" sub="Locations where stock is held." path="warehouses" canAdd={user.role === 'admin'}
      fields={[['name', 'Name', true], ['location', 'Location']]} cols={[{ h: 'Name', f: (r) => r.name }, { h: 'Location', f: (r) => r.location || '' }, { h: 'Status', f: active }]} />,
    suppliers: <SimpleMaster title="Suppliers" sub="Companies you buy from." path="suppliers" canAdd={['admin', 'purchasing'].includes(user.role)}
      fields={[['name', 'Name', true], ['email', 'Email'], ['phone', 'Phone'], ['address', 'Address']]}
      cols={[{ h: 'Name', f: (r) => r.name }, { h: 'Email', f: (r) => r.email || '' }, { h: 'Phone', f: (r) => r.phone || '' }, { h: 'Address', f: (r) => r.address || '' }, { h: 'Status', f: active }]} />,
  };
  return (
    <Notify.Provider value={notify}>
      <div className="shell">
        <aside className="side">
          <div className="brand">IWMS<small>Inventory & Warehouse</small></div>
          <nav className="nav" aria-label="Main">{items.map(([k, label]) => <button key={k} className={view === k ? 'on' : ''} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>{label}</button>)}</nav>
          <div className="who"><b>{user.name}</b>{user.role}<br /><button onClick={logout}>Sign out</button></div>
        </aside>
        <main className="main" key={view}>{V[view]}</main>
      </div>
      {toast && <div className={'toast' + (toast.err ? ' err' : '')} role="status">{toast.msg}</div>}
    </Notify.Provider>
  );
}
