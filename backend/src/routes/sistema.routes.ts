import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

export function sistemaRoutes(prisma: PrismaClient) {
  const r = Router();
  r.get('/health', async (_q, res) => {
    try { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true, banco: 'sqlite', hora: new Date().toISOString() }); }
    catch (e: any) { res.status(503).json({ ok: false, error: e.message }); }
  });
  r.get('/status', async (_q, res) => res.json({
    avaliacoes: await prisma.avaliacao.count(),
    amostras: await prisma.amostra.count(),
    snapshots: await prisma.snapshot.count(),
    documentos: await prisma.documento.count(),
    emissoes: await prisma.auditoria.count({ where: { acao: 'LAUDO_EMITIDO' } })
  }));
  r.get('/backup', async (_q, res) => { const db = path.resolve(process.cwd(), '../../data/robo_avaliacao.db'); res.json({ exists: fs.existsSync(db), path: db }); });
  return r;
}
