import { Customer, LaundryItem, LaundrySettings, Order, OrderStatus, User, UserRole } from '../types';
import { InstitutionalSettings } from '../types';

type BootstrapPayload = {
  isRegistered: boolean;
  settings: LaundrySettings | null;
  customers: Customer[];
  services: LaundryItem[];
  orders: Order[];
  users: User[];
};

function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window === 'undefined') return '/api';

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1') return '/api';
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

function shouldUseLocalFallback(status: number): boolean {
  if (status !== 404) return false;
  if (typeof window === 'undefined') return false;
  if (!API_BASE.startsWith('/')) return false;
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function shouldUseLocalFallbackForNetworkError(error: unknown): boolean {
  if (typeof window === 'undefined') return false;
  if (!API_BASE.startsWith('/')) return false;
  if (!(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) return false;
  return error instanceof TypeError;
}

async function doRequest<T>(base: string, path: string, init?: RequestInit): Promise<T> {
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
        : `Erro na requisição (${response.status})`;
    throw new ApiRequestError(message, response.status);
  }

  // Protects against SPA rewrites returning HTML (common when /api is misconfigured in static hosting).
  if (contentType.includes('text/html')) {
    throw new ApiRequestError('Resposta inválida da API.', 502);
  }

  return data as T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await doRequest<T>(API_BASE, path, init);
  } catch (error) {
    if (shouldUseLocalFallbackForNetworkError(error)) {
      try {
        return await doRequest<T>(LOCAL_API_FALLBACK, path, init);
      } catch {
        return doRequest<T>(LOCAL_API_FALLBACK_ALT, path, init);
      }
    }
    if (error instanceof ApiRequestError && shouldUseLocalFallback(error.status)) {
      try {
        return await doRequest<T>(LOCAL_API_FALLBACK, path, init);
      } catch {
        return doRequest<T>(LOCAL_API_FALLBACK_ALT, path, init);
      }
    }
    if (error instanceof ApiRequestError && error.status >= 500) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return doRequest<T>(API_BASE, path, init);
    }
    throw error;
  }
}

export function getBootstrap() {
  return request<BootstrapPayload>('/bootstrap').catch(async (firstError) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    try {
      return await request<BootstrapPayload>('/bootstrap');
    } catch {
      throw firstError;
    }
  });
}

export function registerSettings(settings: LaundrySettings) {
  return request<LaundrySettings>('/settings/register', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export function updateSettings(settings: LaundrySettings) {
  return request<LaundrySettings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export function updateInstitutionalSettings(payload: InstitutionalSettings) {
  return request<LaundrySettings>('/settings/institutional', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function login(payload: { role: UserRole; email: string; password: string }) {
  return request<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createCustomer(payload: Omit<Customer, 'id' | 'createdAt' | 'email'>) {
  return request<Customer>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCustomer(id: string, payload: Omit<Customer, 'id' | 'createdAt' | 'email'>) {
  return request<Customer>(`/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteCustomer(id: string) {
  return request<{ ok: boolean }>(`/customers/${id}`, { method: 'DELETE' });
}

export function createService(payload: Omit<LaundryItem, 'id'>) {
  return request<LaundryItem>('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteService(id: string) {
  return request<{ ok: boolean }>(`/services/${id}`, { method: 'DELETE' });
}

export function updateService(id: string, payload: Omit<LaundryItem, 'id'>) {
  return request<LaundryItem>(`/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function createUser(payload: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  status: User['status'];
}) {
  return request<User>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUser(
  id: string,
  payload: {
    name: string;
    email: string;
    password?: string;
    role: UserRole;
    status: User['status'];
  },
) {
  return request<User>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteUser(id: string) {
  return request<{ ok: boolean }>(`/users/${id}`, { method: 'DELETE' });
}

export function createOrder(payload: {
  customerId: string;
  userId: string;
  items: Array<{ itemId: string; quantity: number }>;
  status?: OrderStatus;
  paymentStatus?: Order['paymentStatus'];
  expectedDelivery?: string;
}) {
  return request<Order>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      ...payload,
      customerId: Number(payload.customerId),
      userId: Number(payload.userId),
      items: payload.items.map((item) => ({
        itemId: Number(item.itemId),
        quantity: item.quantity,
      })),
    }),
  });
}

export function updateOrder(payload: Order) {
  return request<Order>(`/orders/${payload.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      customerId: Number(payload.customerId),
      items: payload.items.map((item) => ({
        itemId: Number(item.itemId),
        quantity: item.quantity,
      })),
      status: payload.status,
      paymentStatus: payload.paymentStatus,
      expectedDelivery: payload.expectedDelivery,
    }),
  });
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  return request<Order>(`/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function deleteOrder(id: string) {
  return request<{ ok: boolean }>(`/orders/${id}`, { method: 'DELETE' });
}
