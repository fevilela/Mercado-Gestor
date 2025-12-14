import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    companyId: number;
    roleId: number;
  }
}
