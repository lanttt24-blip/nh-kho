import { route } from '@/lib/api';
import { receive } from '@/lib/inventory';
export const POST = route(['staff', 'admin'], async ({ user, body }) => receive(user.id, body));
