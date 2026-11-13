export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as any;
    const loginId = (body.email || body.username || '').trim().toLowerCase();
    const password = (body.password || '').trim();
    const requestedMode = (body.mode || '').trim().toLowerCase(); // 'admin' | 'user'

    if (!loginId || !password) {
      return Response.json(
        { error: 'Email/username and password are required.' },
        { status: 400 }
      );
    }

    const isAdminAttempt =
      requestedMode === 'admin' ||
      loginId === 'admin' ||
      loginId === 'admin@nexora.com' ||
      loginId === 'administrator';

    let userObj: {
      userId: string;
      displayName: string;
      email: string;
      role: 'admin' | 'user';
    };

    if (isAdminAttempt) {
      const isPasswordValid =
        password === 'admin' ||
        password === 'admin123' ||
        password === 'admin@123' ||
        password === 'password';

      if (!isPasswordValid) {
        return Response.json(
          { error: 'Invalid admin credentials. Use admin@nexora.com and admin123' },
          { status: 401 }
        );
      }

      userObj = {
        userId: 'admin_user',
        displayName: 'Administrator',
        email: 'admin@nexora.com',
        role: 'admin',
      };
    } else {
      // User login mode
      // Support default demo user `user@nexora.com` with `user123`
      if (loginId === 'user' || loginId === 'user@nexora.com') {
        const isPasswordValid =
          password === 'user' ||
          password === 'user123' ||
          password === 'password';

        if (!isPasswordValid) {
          return Response.json(
            { error: 'Invalid user credentials. Default: user@nexora.com and user123' },
            { status: 401 }
          );
        }

        userObj = {
          userId: 'user_sales',
          displayName: 'Alex Morgan',
          email: 'user@nexora.com',
          role: 'user',
        };
      } else {
        // Any valid email can sign in as a user with their chosen password (min 4 chars)
        if (password.length < 3) {
          return Response.json(
            { error: 'Password must be at least 3 characters long.' },
            { status: 400 }
          );
        }

        // Format a human-readable display name from email (e.g. "sarah.connor@example.com" -> "Sarah Connor")
        const namePart = loginId.split('@')[0].replace(/[._-]/g, ' ');
        const displayName = namePart
          .split(' ')
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');

        // Safe deterministic userId per email
        const safeId = 'user_' + encodeURIComponent(loginId.replace(/[^a-zA-Z0-9]/g, '_'));

        userObj = {
          userId: safeId,
          displayName: displayName || 'Sales User',
          email: loginId,
          role: 'user',
        };
      }
    }

    const sessionPayload = encodeURIComponent(JSON.stringify(userObj));

    const response = Response.json({
      success: true,
      user: userObj,
      message: `${userObj.role === 'admin' ? 'Admin' : 'User'} authenticated successfully`,
    });

    // Set cookie headers
    response.headers.append(
      'Set-Cookie',
      `crm_auth_session=${sessionPayload}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );
    if (userObj.role === 'admin') {
      response.headers.append(
        'Set-Cookie',
        `crm_admin_session=${sessionPayload}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
      );
    } else {
      // Clear admin cookie if switching to user
      response.headers.append(
        'Set-Cookie',
        `crm_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
      );
    }
    response.headers.append(
      'Set-Cookie',
      `__sites_local_auth=1; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
    );

    return response;
  } catch (err: any) {
    return Response.json(
      { error: err.message || 'Login failed' },
      { status: 400 }
    );
  }
}
