import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../lib/prisma';
import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import type { AuthenticatedRequest } from '../types/auth';

const getBackendUrl = (request: FastifyRequest) => {
  const host = request.headers.host || `localhost:${process.env.PORT || 3000}`;
  const protocol = request.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`;
};

const getFrontendUrl = () => {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
};

export class AuthController {
  async login(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = (request.body || {}) as { email?: string; password?: string };
      const email = body.email?.toLowerCase().trim();
      const password = body.password;

      if (!email || !password) {
        return reply.status(400).send({
          error: 'E-mail e senha são obrigatórios'
        });
      }

      const user = await prisma.user.findUnique({ 
        where: { email } 
      });

      let isPasswordValid = false;
      if (user && user.passwordHash) {
        try {
          isPasswordValid = await argon2.verify(user.passwordHash, password);
        } catch (argonErr) {
          request.log.error(argonErr, 'Argon2 verification error');
        }
      }

      if (!user || !isPasswordValid) {
        return reply.status(401).send({ 
          error: 'Invalid credentials' 
        });
      }

      const secret = process.env.JWT_SECRET || 'quota-default-jwt-secret';

      const token = jwt.sign(
        { 
          id: user.id, 
          role: user.role, 
          tenantId: user.tenantId 
        },
        secret,
        { 
          expiresIn: '8h' 
        }
      );

      return reply.send({
        token,
        user: { id: user.id, role: user.role, tenantId: user.tenantId, name: user.name, email: user.email }
      });

    } catch (error) {
      request.log.error(error, 'Login error occurred');
      console.error('Login error:', error);
      const details = error instanceof Error ? error.message : String(error);
      return reply.status(500).send({ 
        error: 'Internal server error',
        details
      });
    }
  }

  async googleRedirect(request: FastifyRequest, reply: FastifyReply) {
    const { redirect_url, state: queryState } = request.query as { redirect_url?: string; state?: string };
    // Captura a URL do frontend que chamou (web ou app) ou usa a padrão
    const rawTarget = redirect_url || queryState || getFrontendUrl();
    const state = encodeURIComponent(rawTarget);

    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id';
    const redirectUri = encodeURIComponent(`${getBackendUrl(request)}/auth/google/callback`);
    const scope = encodeURIComponent('openid profile email');
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}&prompt=select_account`;
    return reply.redirect(googleAuthUrl);
  }

  async googleCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code, error: oauthError, state } = request.query as { code?: string; error?: string; state?: string };
    
    // Determina dinamicamente o frontend de destino
    let frontendUrl = getFrontendUrl();
    if (state) {
      try {
        const decoded = decodeURIComponent(state);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          // Remove /login no final se já vier no state para não duplicar
          frontendUrl = decoded.replace(/\/login\/?$/, '').replace(/\/+$/, '');
        }
      } catch (e) {
        // fallback para o padrão se falhar
      }
    }

    if (oauthError || !code) {
      return reply.redirect(`${frontendUrl}/login?error=${encodeURIComponent(oauthError || 'Falha no login com Google')}`);
    }

    try {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      const redirectUri = `${getBackendUrl(request)}/auth/google/callback`;

      let userEmail = '';

      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = (await tokenRes.json()) as any;
        if (!tokenData.access_token) {
          return reply.redirect(`${frontendUrl}/login?error=google_token_failed`);
        }

        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userInfo = (await userRes.json()) as any;
        userEmail = userInfo.email;
      }

      if (!userEmail) {
        return reply.redirect(`${frontendUrl}/login?error=user_not_found`);
      }

      const user = await prisma.user.findUnique({
        where: { email: userEmail.toLowerCase().trim() },
      });

      if (!user) {
        return reply.redirect(`${frontendUrl}/login?error=user_not_found`);
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, tenantId: user.tenantId },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' }
      );

      const userObj = encodeURIComponent(
        JSON.stringify({ id: user.id, role: user.role, tenantId: user.tenantId, name: user.name, email: user.email })
      );

      return reply.redirect(`${frontendUrl}/login?token=${token}&user=${userObj}`);
    } catch (err: any) {
      return reply.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message || 'Erro no login SSO Google')}`);
    }
  }

  async microsoftRedirect(request: FastifyRequest, reply: FastifyReply) {
    const { redirect_url, state: queryState } = request.query as { redirect_url?: string; state?: string };
    const rawTarget = redirect_url || queryState || getFrontendUrl();
    const state = encodeURIComponent(rawTarget);

    const clientId = process.env.MICROSOFT_CLIENT_ID || 'dummy-ms-client-id';
    const redirectUri = encodeURIComponent(`${getBackendUrl(request)}/auth/microsoft/callback`);
    const scope = encodeURIComponent('openid profile email User.Read');
    const msAuthUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${state}&prompt=select_account`;
    return reply.redirect(msAuthUrl);
  }

  async microsoftCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code, error: oauthError, state } = request.query as { code?: string; error?: string; state?: string };
    
    let frontendUrl = getFrontendUrl();
    if (state) {
      try {
        const decoded = decodeURIComponent(state);
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          frontendUrl = decoded.replace(/\/login\/?$/, '').replace(/\/+$/, '');
        }
      } catch (e) {
        // fallback
      }
    }

    if (oauthError || !code) {
      return reply.redirect(`${frontendUrl}/login?error=${encodeURIComponent(oauthError || 'Falha no login com Microsoft')}`);
    }

    try {
      const clientId = process.env.MICROSOFT_CLIENT_ID || '';
      const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
      const redirectUri = `${getBackendUrl(request)}/auth/microsoft/callback`;

      let userEmail = '';

      if (clientId && clientSecret) {
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        const tokenData = (await tokenRes.json()) as any;
        if (!tokenData.access_token) {
          return reply.redirect(`${frontendUrl}/login?error=ms_token_failed`);
        }

        const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        const userInfo = (await userRes.json()) as any;
        userEmail = userInfo.mail || userInfo.userPrincipalName;
      }

      if (!userEmail) {
        return reply.redirect(`${frontendUrl}/login?error=user_not_found`);
      }

      const user = await prisma.user.findUnique({
        where: { email: userEmail.toLowerCase().trim() },
      });

      if (!user) {
        return reply.redirect(`${frontendUrl}/login?error=user_not_found`);
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, tenantId: user.tenantId },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' }
      );

      const userObj = encodeURIComponent(
        JSON.stringify({ id: user.id, role: user.role, tenantId: user.tenantId, name: user.name, email: user.email })
      );

      return reply.redirect(`${frontendUrl}/login?token=${token}&user=${userObj}`);
    } catch (err: any) {
      return reply.redirect(`${frontendUrl}/login?error=${encodeURIComponent(err.message || 'Erro no login SSO Microsoft')}`);
    }
  }

  async ssoLogin(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { email } = request.body as { email: string };

      if (!email) {
        return reply.status(400).send({ error: 'E-mail do SSO é obrigatório.' });
      }

      const cleanEmail = email.toLowerCase().trim();
      const user = await prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Acesso negado: Este e-mail não possui cadastro no sistema Quota. Peça ao seu administrador para cadastrar sua conta.',
        });
      }

      const token = jwt.sign(
        { id: user.id, role: user.role, tenantId: user.tenantId },
        process.env.JWT_SECRET as string,
        { expiresIn: '8h' }
      );

      return reply.send({
        token,
        user: { id: user.id, role: user.role, tenantId: user.tenantId, name: user.name, email: user.email },
      });
    } catch (error) {
      request.log.error({ error }, 'SSO Login error');
      console.error('SSO Login error:', error);
      return reply.status(500).send({ error: 'Erro no login SSO' });
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const authRequest = request as AuthenticatedRequest;
    request.log.info({ userId: authRequest.user?.id }, 'User logged out');
    return reply.send({ message: 'Logout realizado com sucesso' });
  }

  async updatePassword(request: AuthenticatedRequest, reply: FastifyReply) {
    try {
      const { newPassword } = request.body as { newPassword: string };
      const userId = request.user?.id;

      if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

      const newHash = await argon2.hash(newPassword);
      
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newHash }
      });

      return reply.send({ message: 'Senha atualizada com sucesso' });
    } catch (error) {
      request.log.error({ error }, 'Update password error');
      console.error('Update password error:', error);
      return reply.status(500).send({ error: 'Erro ao atualizar senha' });
    }
  }
}