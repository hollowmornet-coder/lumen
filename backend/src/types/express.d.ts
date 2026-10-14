import type { Role } from '../modules/auth/auth.types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by `requireAuth`. Absent on public routes. */
      user?: {
        id: number;
        username: string;
        fullName: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
