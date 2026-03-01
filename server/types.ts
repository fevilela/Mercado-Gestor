import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    companyId?: number;
    unitId?: number;
    roleId?: number;
    userPermissions?: string[];
    managerAuthenticated?: boolean;
    managerEmail?: string;
  }
}
