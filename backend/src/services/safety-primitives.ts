import { createHash } from 'node:crypto';

export interface SnapshotIntegrityInput {
  dadosJson?: unknown;
  hashSha256?: unknown;
}

export interface ArtifactPersistenceOptions<TArtifact, TRecord> {
  write: () => TArtifact | Promise<TArtifact>;
  persist: (artifact: TArtifact) => TRecord | Promise<TRecord>;
  remove: (artifact: TArtifact) => unknown | Promise<unknown>;
}

export function calcularHashSnapshot(dadosJson: string): string {
  return createHash('sha256').update(dadosJson, 'utf8').digest('hex');
}

export function snapshotIntegro(
  snapshot: SnapshotIntegrityInput | null | undefined
): boolean {
  if (
    !snapshot ||
    typeof snapshot.dadosJson !== 'string' ||
    typeof snapshot.hashSha256 !== 'string'
  ) {
    return false;
  }

  if (!/^[a-f0-9]{64}$/i.test(snapshot.hashSha256)) {
    return false;
  }

  try {
    JSON.parse(snapshot.dadosJson);
  } catch {
    return false;
  }

  return calcularHashSnapshot(snapshot.dadosJson) === snapshot.hashSha256.toLowerCase();
}

export function assertSnapshotCanBeCreated(status: string): void {
  if (status !== 'CALCULADA') {
    throw new Error('AVALIACAO_DEVE_ESTAR_CALCULADA_ANTES_DO_SNAPSHOT');
  }
}

export type DecisaoChauvenet = 'PENDENTE' | 'MANTER_JUSTIFICADO' | 'EXCLUIR';

export function evaluateChauvenetEmissionGate(
  criterioChauvenet: boolean,
  decisaoChauvenet?: string | null
): { blocked: boolean; code: string | null } {
  if (!criterioChauvenet) {
    return { blocked: false, code: null };
  }

  if (decisaoChauvenet === 'MANTER_JUSTIFICADO') {
    return { blocked: false, code: null };
  }

  if (decisaoChauvenet === 'EXCLUIR') {
    return { blocked: true, code: 'SAN006' };
  }

  return { blocked: true, code: 'SAN004' };
}

/**
 * Coordena a criação do arquivo e a persistência no banco.
 * Remove o arquivo se a persistência falhar.
 * Não é uma transação distribuída.
 */
export async function persistArtifactWithCompensation<TArtifact, TRecord>(
  options: ArtifactPersistenceOptions<TArtifact, TRecord>
): Promise<{ artifact: TArtifact; record: TRecord }> {
  const artifact = await options.write();

  try {
    const record = await options.persist(artifact);
    return { artifact, record };
  } catch (persistenceError: unknown) {
    try {
      await options.remove(artifact);
    } catch (cleanupError: unknown) {
      throw Object.assign(
        new Error('FALHA_PERSISTENCIA_E_COMPENSACAO_DE_ARTEFATO'),
        {
          cause: persistenceError,
          cleanupError
        }
      );
    }

    throw persistenceError;
  }
}
