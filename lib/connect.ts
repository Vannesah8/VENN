import {
  getToken,
  startAuthorization,
  UserAuthorizationRequiredError,
  type ConnectTokenParams,
} from "@vercel/connect";

export const CONNECT_CONNECTOR = process.env.VERCEL_CONNECT_CONNECTOR ?? "opencode/venn";

export function isConnectConfigured(): boolean {
  return Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);
}

function userSubjectParams(userId: string): ConnectTokenParams {
  return { subject: { type: "user", id: userId } };
}

export async function getUserConnectToken(userId: string): Promise<string> {
  return getToken(CONNECT_CONNECTOR, userSubjectParams(userId));
}

export async function getUserConnectAuthUrl(userId: string): Promise<string> {
  const { url } = await startAuthorization(CONNECT_CONNECTOR, userSubjectParams(userId));
  return url;
}

export async function resolveUserConnectAuthorization(userId: string): Promise<{
  authorized: boolean;
  authUrl?: string;
}> {
  try {
    await getUserConnectToken(userId);
    return { authorized: true };
  } catch (error) {
    if (error instanceof UserAuthorizationRequiredError) {
      return { authorized: false, authUrl: await getUserConnectAuthUrl(userId) };
    }

    throw error;
  }
}