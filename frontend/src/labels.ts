import type { Any } from './api';

export const statusLabel: Record<string, string> = {
  EM_ELABORACAO: 'Em elaboração',
  CALCULADA: 'Calculada',
  PRONTA_PARA_EMISSAO: 'Pronta para emissão'
};

export function situacaoQuadraLabel(v: Any) {
  return ({ MEIO_QUADRA: 'Meio de quadra', ESQUINA: 'Esquina', MAIS_DE_UMA_FRENTE: 'Mais de uma frente' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}

export function padraoLabel(v: Any) {
  return ({ BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto', LUXO: 'Luxo' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}

export function conservacaoLabel(v: Any) {
  return ({ REGULAR: 'Regular', NOVO: 'Novo', REPAROS_SIMPLES: 'Reparos simples', BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}
