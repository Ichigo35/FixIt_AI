import { apiGet } from './client';

export interface Me {
  id: string;
  email: string | null;
  plan: string;
  role?: string;
  quota: { used: number; limit: number };
}

export function getMe(): Promise<Me> {
  return apiGet<Me>('/me');
}
