import 'express-session';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      fullName: string;
      phone?: string | null;
      address?: string | null;
      avatar?: string | null;
      accountType: string;
      roleId: number;
      role: {
        id: number;
        name: string;
        description: string;
      };
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    messages?: string[];
  }
}

export {};