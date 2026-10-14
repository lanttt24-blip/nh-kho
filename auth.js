import jwt from 'jsonwebtoken';
export const COOKIE = 'iwms_token';
const secret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return process.env.JWT_SECRET;
};
export const sign = (u) => jwt.sign({ id: u.user_id, name: u.full_name, role: u.role_name }, secret(), { expiresIn: '8h' });
export function getUser(req) {
  const t = req.cookies.get(COOKIE)?.value;
  if (!t) return null;
  try { const p = jwt.verify(t, secret()); return { id: p.id, name: p.name, role: p.role }; }
  catch { return null; }
}
