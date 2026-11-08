import { env } from 'cloudflare:workers';
// @ts-ignore JavaScript module shared with the account integration tests.
import { handleAccountRequest } from '@/lib/accounts/http-handler.mjs';

async function handle(request: Request) {
  // Shared conservative limiter until a trustworthy per-client identity is
  // available from the hosting layer. Do not trust forwarded user headers.
  try {
    const db = (env as unknown as { DB?: unknown }).DB;
    return await handleAccountRequest(request, db, 'site-wide-account-requests');
  } catch {
    return Response.json({ error: 'SERVICE_UNAVAILABLE' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}

export const GET = handle;
export const POST = handle;
