export const dynamic = 'force-dynamic';

export async function POST() {
  const response = Response.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.headers.append(
    'Set-Cookie',
    'crm_auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
  response.headers.append(
    'Set-Cookie',
    'crm_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
  response.headers.append(
    'Set-Cookie',
    '__sites_local_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );

  return response;
}
