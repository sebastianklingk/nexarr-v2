import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId:   number;
    username: string;
    userRole: 'admin' | 'viewer' | 'requester';
  }
}
