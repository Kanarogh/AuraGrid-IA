import { JWT_SECRET } from "./env";

const DEV_JWT_SECRET = "dev-jwt-secret-change-me";

/** Falha no boot se JWT_SECRET padrão em produção cloud. */
export function assertProductionJwtSecret(): void {
  const isProduction = process.env.NODE_ENV === "production";
  const isCloudDeploy = process.env.AURAGRID_CLOUD_DEPLOY === "1";
  if (!isProduction && !isCloudDeploy) return;
  if (JWT_SECRET === DEV_JWT_SECRET || JWT_SECRET.length < 32) {
    throw new Error(
      "JWT_SECRET deve ser definido com pelo menos 32 caracteres em produção (AURAGRID_CLOUD_DEPLOY=1)."
    );
  }
}
