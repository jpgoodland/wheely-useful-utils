import { NextResponse } from 'next/server';

export async function GET() {
  const appId = process.env.MICROSOFT_ASSOCIATION_APP_ID || process.env.OAUTH_MICROSOFT_CLIENT_ID;
  return NextResponse.json({
    associatedApplications: appId
      ? [{ applicationId: appId }]
      : []
  });
}
