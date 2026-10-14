import { route } from '@/lib/api';
import { transfer } from '@/lib/inventory';
export const POST = route(['staff', 'admin'], async ({ user, body }) => transfer(user.id, body));
