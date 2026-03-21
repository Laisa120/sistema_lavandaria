function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window === 'undefined') return '/api';

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return '/api';
  if (host.endsWith('vercel.app')) return 'https://api.genomni.com/api';
  if (host.endsWith('genomni.com')) return 'https://api.genomni.com/api';

  return '/api';
}

const API_BASE = resolveApiBase();
const LOCAL_API_FALLBACK = 'http://127.0.0.1:8000/api';
const LOCAL_API_FALLBACK_ALT = 'http://localhost:8000/api';

class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function canUseLocalFallback(): boolean {
  if (typeof window === 'undefined') return false;
  if (!API_BASE.startsWith('/')) return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function doApiRequest<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'message' in data && typeof (data as { message?: unknown }).message === 'string'
        ? (data as { message: string }).message
        : `Erro na API (${response.status})`;
    throw new ApiRequestError(message, response.status);
  }

  if (contentType.includes('text/html')) {
    throw new ApiRequestError('Resposta inválida da API.', 502);
  }

  return data as T;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await doApiRequest<T>(API_BASE, path, init);
  } catch (error) {
    if (canUseLocalFallback()) {
      if (error instanceof TypeError) {
        try {
          return await doApiRequest<T>(LOCAL_API_FALLBACK, path, init);
        } catch {
          return doApiRequest<T>(LOCAL_API_FALLBACK_ALT, path, init);
        }
      }

      if (error instanceof ApiRequestError && error.status === 404) {
        try {
          return await doApiRequest<T>(LOCAL_API_FALLBACK, path, init);
        } catch {
          return doApiRequest<T>(LOCAL_API_FALLBACK_ALT, path, init);
        }
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Erro de comunicação com a API.');
  }
}

export type LicenseCheck = {
  valid: boolean;
  status: 'active' | 'suspended';
  licenseType: 'annual' | 'semiannual';
  expiresAt: string | null;
  daysRemaining: number | null;
  message: string;
};

export type SupportMessageDto = {
  id: number;
  ticketId: number;
  senderType: 'user' | 'support';
  message: string;
  createdAt: string;
};

export type SupportTicketDto = {
  id: number;
  companyId: number;
  userId: number;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  createdAt: string;
  user: { id: string; name: string; email: string };
  messages: SupportMessageDto[];
};

export function checkLicense(actorId: string) {
  return apiRequest<LicenseCheck>('/license/check', {
    headers: { 'X-Actor-Id': actorId },
  });
}

export function listSupportTickets(actorId: string) {
  return apiRequest<SupportTicketDto[]>('/support/tickets', {
    headers: { 'X-Actor-Id': actorId },
  });
}

export function getSupportTicket(actorId: string, id: number) {
  return apiRequest<SupportTicketDto>(`/support/tickets/${id}`, {
    headers: { 'X-Actor-Id': actorId },
  });
}

export function createSupportTicket(actorId: string, payload: { subject: string; message: string }) {
  return apiRequest<SupportTicketDto>('/support/tickets', {
    method: 'POST',
    headers: { 'X-Actor-Id': actorId },
    body: JSON.stringify(payload),
  });
}

export function sendSupportMessage(actorId: string, payload: { ticket_id: number; message: string }) {
  return apiRequest<SupportMessageDto>('/support/messages', {
    method: 'POST',
    headers: { 'X-Actor-Id': actorId },
    body: JSON.stringify(payload),
  });
}

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  platformRole: 'super_admin' | 'support' | 'client_admin' | 'user' | null;
  status: string;
  isBlocked: boolean;
  companyId: number | null;
};

export type AdminCompany = {
  id: number;
  name: string;
  email: string | null;
  status: 'active' | 'suspended';
  licenseType: 'annual' | 'semiannual';
  licenseExpiryDate: string | null;
  createdAt: string;
};

export type AuditLogDto = {
  id: number;
  adminId: number | null;
  action: string;
  targetId: string | null;
  companyId: number | null;
  ipAddress: string | null;
  createdAt: string;
};

export function adminLogin(payload: { email: string; password: string }) {
  return apiRequest<{ token: string; user: AdminUser }>('/admin/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function adminHeaders(token: string): HeadersInit {
  return { 'X-Admin-Token': token };
}

export function adminListCompanies(token: string) {
  return apiRequest<AdminCompany[]>('/admin/companies', { headers: adminHeaders(token) });
}

export function adminSuspendCompany(
  token: string,
  id: number,
  payload: { status: 'active' | 'suspended'; licenseType?: 'annual' | 'semiannual'; licenseExpiryDate?: string },
) {
  return apiRequest<{ ok: boolean }>(`/admin/companies/${id}/suspend`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify(payload),
  });
}

export function adminListUsers(token: string) {
  return apiRequest<AdminUser[]>('/admin/users', { headers: adminHeaders(token) });
}

export function adminBlockUser(token: string, id: string) {
  return apiRequest<{ ok: boolean }>(`/admin/users/${id}/block`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export function adminResetPassword(token: string, id: string) {
  return apiRequest<{ ok: boolean; resetId: number; resetToken: string; expiresAt: string }>(`/admin/users/${id}/reset-password`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export function adminImpersonate(token: string, id: string) {
  return apiRequest<{ ok: boolean; token: string; expiresAt: string }>(`/admin/impersonate/${id}`, {
    method: 'POST',
    headers: adminHeaders(token),
  });
}

export function adminListAuditLogs(token: string) {
  return apiRequest<AuditLogDto[]>('/admin/audit-logs', { headers: adminHeaders(token) });
}
