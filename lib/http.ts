import { NextResponse } from 'next/server';

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  const mysqlCode = (error as { code?: string })?.code;
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  if (mysqlCode === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'That email or item already exists.' }, { status: 409 });
  if (mysqlCode === 'ER_NO_REFERENCED_ROW_2' || mysqlCode === 'ER_ROW_IS_REFERENCED_2') {
    return NextResponse.json({ error: 'This record is still in use or references a missing record.' }, { status: 409 });
  }
  if (mysqlCode === 'ER_SIGNAL_EXCEPTION') return NextResponse.json({ error: message }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: 'The request could not be completed.' }, { status: 500 });
}

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function sameOrigin(request: Request) {
  const rawOrigin = request.headers.get('origin');
  if (!rawOrigin) return true;

  let origin: URL;
  try {
    origin = new URL(rawOrigin);
  } catch {
    return false;
  }

  const requestUrl = new URL(request.url);
  if (origin.origin === requestUrl.origin) return true;

  // Behind a reverse proxy, Next's request URL can use the internal host or
  // protocol. Compare against the public host/protocol forwarded by the proxy.
  const firstHeaderValue = (value: string | null) => value?.split(',')[0]?.trim();
  const host = firstHeaderValue(request.headers.get('x-forwarded-host'))
    ?? request.headers.get('host');
  const protocol = firstHeaderValue(request.headers.get('x-forwarded-proto'))
    ?? requestUrl.protocol.slice(0, -1);

  return Boolean(host && origin.origin === `${protocol}://${host}`);
}
