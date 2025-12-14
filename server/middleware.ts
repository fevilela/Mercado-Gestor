import { Request, Response, NextFunction } from "express";
import "./types";
import { getUserPermissions } from "./auth";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }
  next();
}

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    try {
      const userPermissions = await getUserPermissions(req.session.userId);

      const hasPermission = requiredPermissions.some((perm) =>
        userPermissions.includes(perm)
      );

      if (!hasPermission) {
        return res.status(403).json({ error: "Sem permissão para esta ação" });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Erro ao verificar permissões" });
    }
  };
}

export function getCompanyId(req: Request): number | null {
  return req.session.companyId || null;
}

export function getUserId(req: Request): string | null {
  return req.session.userId || null;
}
