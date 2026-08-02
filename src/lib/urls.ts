import { publicEnvironment } from "./env";
export { safeNextPath } from "./redirects";

export function getSiteUrl(environment: NodeJS.ProcessEnv = process.env) {
  if (publicEnvironment.NEXT_PUBLIC_SITE_URL) {
    return publicEnvironment.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  const vercelHost =
    environment.VERCEL_PROJECT_PRODUCTION_URL || environment.VERCEL_URL;

  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  return "http://localhost:3000";
}
