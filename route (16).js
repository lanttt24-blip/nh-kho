import { route } from '@/lib/api';
import { adjust } from '@/lib/inventory';
export const POST = route(['manager', 'admin'], async ({ user, body }) => adjust(user.id, body));
