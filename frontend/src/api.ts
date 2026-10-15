export type Any = any;

/** Cliente HTTP mínimo da API /api/v1 com extração tolerante de erro. */
export const api = async <T = Any>(path: string, options?: RequestInit): Promise<T> => {
  const r = await fetch('/api/v1' + path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options
  });
  const text = await r.text();
  let data: Any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data.error ?? data.message ?? data.raw ?? `HTTP ${r.status}`);
  return data;
};

export const money = (v: Any) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const number = (v: Any, d = 2) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

// Converte números digitados no padrão brasileiro (ex.: 300,00 ou 750.000,00)
// e também aceita ponto decimal (ex.: 300.5). Não converte campo vazio em zero.
export const parseNumericInput = (value: Any): number => {
  if (typeof value === 'number') return value;
  let raw = String(value ?? '').trim().replace(/[\sR$]/g, '');
  if (!raw) return Number.NaN;
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.includes(',')) {
    raw = raw.replace(',', '.');
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, '');
  }
  return Number(raw);
};
