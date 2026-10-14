import { HttpError } from './errors';
export function int(v, name, min = 1) {
  const n = Number(v);
  if (v === '' || v === null || v === undefined || !Number.isInteger(n) || n < min)
    throw new HttpError(400, min > 0 ? `${name} must be a whole number greater than 0` : `${name} must be a whole number of 0 or more`);
  return n;
}
export function str(v, name, { required = true } = {}) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (required && !s) throw new HttpError(400, `${name} is required`);
  return s;
}
export function date(v, name) {
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, `${name} must be a date (YYYY-MM-DD)`);
  return v;
}
export function money(v, name) {
  const n = Number(v || 0);
  if (!(n >= 0)) throw new HttpError(400, `${name} must be 0 or more`);
  return n;
}
