import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const api = axios.create({ baseURL: '/api' });

export function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value != null) {
      params.set(key, value);
    }
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function buildSettingsUpdate(updates) {
  const payload = structuredClone(updates);
  if (payload.leverage?.downPaymentPct != null && payload.leverage.ltvPct == null) {
    payload.leverage.ltvPct = 100 - Number(payload.leverage.downPaymentPct);
  }
  if (payload.leverage?.ltvPct != null && payload.leverage.downPaymentPct == null) {
    payload.leverage.downPaymentPct = 100 - Number(payload.leverage.ltvPct);
  }
  return payload;
}

async function getJson(path) {
  const response = await api.get(path);
  return response.data;
}

export function useOverview() {
  return useQuery({ queryKey: ['overview'], queryFn: () => getJson('/overview') });
}

export function useProperties(filters = {}) {
  return useQuery({
    queryKey: ['properties', filters],
    queryFn: () => getJson(`/properties${buildQueryString(filters)}`)
  });
}

export function useProperty(id) {
  return useQuery({
    queryKey: ['property', id],
    queryFn: () => getJson(`/properties/${id}`),
    enabled: Boolean(id)
  });
}

export function useStrategy(name, filters = {}) {
  return useQuery({
    queryKey: ['strategy', name, filters],
    queryFn: () => getJson(`/strategies/${name}${buildQueryString(filters)}`),
    enabled: Boolean(name)
  });
}

export function useNeighborhoods() {
  return useQuery({ queryKey: ['neighborhoods'], queryFn: () => getJson('/neighborhoods') });
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await getJson('/settings')).settings,
    staleTime: 30000
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates) => {
      const response = await api.put('/settings', buildSettingsUpdate(updates));
      return response.data.settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });
}

export function useScraperStatus(enabled = true) {
  return useQuery({
    queryKey: ['scraper-status'],
    queryFn: () => getJson('/scraper/status'),
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 2000 : false),
    enabled
  });
}

export function useStartScraper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body = {}) => {
      const response = await api.post('/scraper/start', body);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scraper-status'] });
    }
  });
}
