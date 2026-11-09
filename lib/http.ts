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
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
