import { route } from '@/lib/api';
import { issue } from '@/lib/inventory';
export const POST = route(['staff', 'admin'], async ({ user, body }) => issue(user.id, body));
