import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { loadParameters } from '../services/ParameterService.js';
import { loadParametersHash } from '../services/ParameterHashService.js';
import { CalculationEngine } from '../engines/CalculationEngine.js';
import { SaneamentoEngine } from '../engines/SaneamentoEngine.js';
import { audit } from '../services/AuditService.js';
import { createSnapshot } from '../services/SnapshotService.js';
import { RuleEngine } from '../engines/RuleEngine.js';
import { ReportService } from '../services/ReportService.js';
import { invalidateCalculation } from '../services/GovernanceService.js';

export function avaliacaoRoutes(prisma: PrismaClient) {
  const r = Router();

  r.get('/recentes', async (_q, res) =>
    res.json(
      await prisma.avaliacao.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 20,
        include: { resultados: true }
      })
    )
  );

  r.post('/', async (req, res) => {
    try {
      const b = req.body;

      const a = await prisma.avaliacao.create({
        data: {
          numero: b.numero,
          titulo: b.titulo,
          finalidade: b.finalidade ?? 'AVALIACAO',
          tipoImovel: b.tipoImovel,
          municipio: b.municipio,
          estado: b.estado,
          responsavel: b.responsavel ?? 'Usuário',
          dataAvaliacao: new Date(b.dataAvaliacao ?? Date.now()),
          versaoMotor: process.env.MOTOR_VERSAO,

          imovelAvaliando: {
            create: {
              bairro: b.imovel.bairro,
              logradouro: b.imovel.logradouro,
              areaTerreno: b.imovel.areaTerreno,
              testadaPrincipal: b.imovel.testadaPrincipal,
              profundidadeCalculada: b.imovel.profundidade,
              profundidadeUtilizada: b.imovel.profundidade,
              situacaoQuadra: b.imovel.situacaoQuadra,
              distanciaCentro: b.imovel.distanciaCentro,
              areaEdificadaPrivativa: b.imovel.areaEdificadaPrivativa,
              padrao: b.imovel.padrao,
              conservacao: b.imovel.conservacao,
              idade: b.imovel.idade,
              vidaUtil: b.imovel.vidaUtil,
              elevador: b.imovel.elevador ?? false,
              numeroVagas: b.imovel.numeroVagas ?? 0
            }
          }
        }
      });

      await audit(prisma, {
        avaliacaoId: a.id,
        acao: 'CRIACAO',
        entidade: 'Avaliacao',
        entidadeId: a.id,
        depois: a
      });

      res.json(a);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/:id/calcular', async (req, res) => {
    try {
      const id = req.params.id;

      const a = await prisma.avaliacao.findUnique({
        where: { id },
        include: {
          imovelAvaliando: true,
          amostras: true
        }
      });

      if (!a?.imovelAvaliando) {
        throw new Error('AVALIACAO_NOT_FOUND');
      }

      const c = await loadParameters(prisma);
      const parametrosHash = await loadParametersHash(prisma);

      const vals = [];

      for (const s of a.amostras.filter(
        (x: (typeof a.amostras)[number]) => x.status === 'ATIVA'
      )) {
        const calc = CalculationEngine.homogeneizarAmostra(
          s.id,
          {
            area: s.areaTerreno,
            testada: s.testada,
            profundidade: s.profundidade,
            vagas: s.numeroVagas,
            tipoValor: s.tipoValor as any,
            situacaoQuadra: s.situacaoQuadra,
            elevador: s.elevador,
            idade: s.idade ?? undefined,
            vidaUtil: s.vidaUtil ?? undefined,
            conservacao: s.conservacao ?? undefined,
            padrao: s.padrao ?? undefined,
            valorTotal: s.valorOferta ?? s.valorTransacao ?? 0
          },
          {
            tipoImovel: a.tipoImovel,
            area: a.imovelAvaliando.areaTerreno,
            testada: a.imovelAvaliando.testadaPrincipal,
            profundidade: a.imovelAvaliando.profundidadeUtilizada,
            vagas: a.imovelAvaliando.numeroVagas,
            tipoValor: 'TRANSACAO',
            situacaoQuadra: a.imovelAvaliando.situacaoQuadra,
            elevador: a.imovelAvaliando.elevador,
            idade: a.imovelAvaliando.idade ?? undefined,
            vidaUtil: a.imovelAvaliando.vidaUtil ?? undefined,
            conservacao: a.imovelAvaliando.conservacao ?? undefined,
            padrao: a.imovelAvaliando.padrao ?? undefined,
            valorTotal: a.imovelAvaliando.valorTotal ?? 0
          },
          c
        );

        await prisma.homogeneizacao.upsert({
          where: {
            amostraId: s.id
          },
          update: {
            valorUnitarioOriginal: calc.vuOriginal,
            fa: calc.fatores.FA,
            ft: calc.fatores.FT,
            fp: calc.fatores.FP,
            fo: calc.fatores.FO,
            fe: calc.fatores.FE,
            fi: calc.fatores.FI,
            fpc: calc.fatores.FPC,
            fc: calc.fatores.FC,
            felev: calc.fatores.FELEV,
            fg: calc.fatores.FG,
            produtoFatores: calc.produtoFatores,
            valorUnitarioHomogeneizado: calc.vuHomogeneizado,
            motorVersao: c.versao,
            parametrosHash,
            auditoriaJson: JSON.stringify(calc.auditoria)
          },
          create: {
            avaliacaoId: id,
            amostraId: s.id,
            valorUnitarioOriginal: calc.vuOriginal,
            fa: calc.fatores.FA,
            ft: calc.fatores.FT,
            fp: calc.fatores.FP,
            fo: calc.fatores.FO,
            fe: calc.fatores.FE,
            fi: calc.fatores.FI,
            fpc: calc.fatores.FPC,
            fc: calc.fatores.FC,
            felev: calc.fatores.FELEV,
            fg: calc.fatores.FG,
            produtoFatores: calc.produtoFatores,
            valorUnitarioHomogeneizado: calc.vuHomogeneizado,
            motorVersao: c.versao,
            parametrosHash,
            auditoriaJson: JSON.stringify(calc.auditoria)
          }
        });

        vals.push(calc.vuHomogeneizado);
      }

      const san = SaneamentoEngine.executar(vals);

      await prisma.saneamento.upsert({
        where: {
          avaliacaoId: id
        },
        update: {
          metodo: 'LIMITE_30',
          media: san.media,
          mediana: san.mediana,
          desvioPadrao: san.desvioPadrao,
          limiteInferior:
	  san.limiteInferior,
	  limiteSuperior:
	  san.limiteSuperior,
	  criterioChauvenet:
	  san.outliersChauvenet.length > 0,
	  criterio30:
	  san.outliers.some((item) => item.outlier),
	  outliersJson:
	  JSON.stringify(san.outliers),
          outliersChauvenetJson: JSON.stringify(san.outliersChauvenetDetalhes),
          decisaoChauvenet: null,
          justificativaChauvenet: null,
          decisaoChauvenetPor: null,
          decisaoChauvenetEm: null
        },
        create: {
          avaliacaoId: id,
          metodo: 'LIMITE_30',
          media: san.media,
          mediana: san.mediana,
          desvioPadrao: san.desvioPadrao,
          limiteInferior:
	  san.limiteInferior,
	  limiteSuperior:
	  san.limiteSuperior,
	  criterioChauvenet:
	  san.outliersChauvenet.length > 0,
	  criterio30:
	  san.outliers.some((item) => item.outlier),
	  outliersJson:
	  JSON.stringify(san.outliers),
          outliersChauvenetJson: JSON.stringify(san.outliersChauvenetDetalhes),
          decisaoChauvenet: null,
          justificativaChauvenet: null,
          decisaoChauvenetPor: null,
          decisaoChauvenetEm: null
        }
      });

      const ativos = vals.filter(
        v =>
          v >= san.limiteInferior &&
          v <= san.limiteSuperior
      );

      if (!ativos.length) {
        throw new Error('TODAS_AS_AMOSTRAS_FORA_DO_LIMITE');
      }

      const vu =
        ativos.reduce((x, v) => x + v, 0) /
        ativos.length;

      const area = a.imovelAvaliando.areaTerreno;

      await prisma.resultado.upsert({
        where: {
          avaliacaoId: id
        },
        update: {
          metodo: 'MEDIA_APOS_SANEAMENTO',
          numeroAmostras: ativos.length,
          valorUnitario: vu,
          areaReferencia: area,
          valorTotal: vu * area,
          media: san.media,
          mediana: san.mediana,
          desvioPadrao: san.desvioPadrao,
          coeficienteVariacao: san.media
            ? san.desvioPadrao / san.media
            : 0,
          erroPadrao:
            san.desvioPadrao /
            Math.sqrt(ativos.length)
        },
        create: {
          avaliacaoId: id,
          metodo: 'MEDIA_APOS_SANEAMENTO',
          numeroAmostras: ativos.length,
          valorUnitario: vu,
          areaReferencia: area,
          valorTotal: vu * area,
          media: san.media,
          mediana: san.mediana,
          desvioPadrao: san.desvioPadrao,
          coeficienteVariacao: san.media
            ? san.desvioPadrao / san.media
            : 0,
          erroPadrao:
            san.desvioPadrao /
            Math.sqrt(ativos.length)
        }
      });

      await prisma.avaliacao.update({
        where: { id },
        data: {
          status: 'CALCULADA',
          parametrosHash
        }
      });

      await audit(prisma, {
        avaliacaoId: id,
        acao: 'CALCULO',
        entidade: 'Avaliacao',
        entidadeId: id,
        depois: {
          parametrosHash,
          motorVersao: c.versao,
          numeroAmostras: ativos.length,
          valorUnitario: vu,
          valorTotal: vu * area
        }
      });

      res.json({
        success: true,
        amostras: vals,
        saneamento: san,
        valorUnitario: vu,
        valorTotal: vu * area
      });
    } catch (e: any) {
      res.status(400).json({
        error: e.message
      });
    }
  });

  // Pesquisa pública na web: resultados são sugestões, nunca amostras aprovadas automaticamente.
  r.post('/:id/buscar-amostras', async (req, res) => {
    try {
      const avaliacao = await prisma.avaliacao.findUnique({
        where: { id: req.params.id },
        include: { imovelAvaliando: true }
      });
      if (!avaliacao) return res.status(404).json({ error: 'AVALIACAO_NOT_FOUND' });

      const imovel = avaliacao.imovelAvaliando;
      const termosInformados = typeof req.body?.termos === 'string' ? req.body.termos.trim() : '';
      const base = [
        avaliacao.tipoImovel,
        '  venda',
        imovel?.bairro,
        avaliacao.municipio,
        avaliacao.estado,
        'imóvel preço área'
      ].filter(Boolean).join(' ');
      const consulta = (termosInformados || base).slice(0, 300);
      const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`;
      const resposta = await fetch(endpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RoboAvaliador/1.0; +local-app)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        signal: AbortSignal.timeout(12000)
      });
      if (!resposta.ok) {
        return res.status(502).json({ error: `BUSCA_WEB_INDISPONIVEL_HTTP_${resposta.status}` });
      }
      const html = await resposta.text();
      const decodeHtml = (value: string) => value
        .replace(/<[^>]*>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
        .replace(/\s+/g, ' ')
        .trim();
      const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];
      const linkRegex = /<a[^>]*class=["'][^"']*(?:result-link|result__a)[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = linkRegex.exec(html)) && results.length < 15) {
        let url = match[1].replace(/&amp;/g, '&');
        try {
          if (url.startsWith('//')) url = `https:${url}`;
          if (url.startsWith('/')) url = new URL(url, 'https://html.duckduckgo.com').toString();
          const parsed = new URL(url);
          const redirect = parsed.searchParams.get('uddg');
          if (redirect) url = redirect;
          const finalUrl = new URL(url);
          if (!['http:', 'https:'].includes(finalUrl.protocol)) continue;
          if (/duckduckgo\.com$/i.test(finalUrl.hostname)) continue;
          const title = decodeHtml(match[2]);
          if (!title) continue;
          const nearby = html.slice(match.index, Math.min(html.length, match.index + 3500));
          const snippetMatch = nearby.match(/class=["'][^"']*(?:result-snippet|result__snippet)[^"']*["'][^>]*>([\s\S]*?)<\//i);
          const snippet = snippetMatch ? decodeHtml(snippetMatch[1]) : '';
          const uniqueUrl = finalUrl.toString();
          if (results.some(item => item.url === uniqueUrl)) continue;
          results.push({ title, url: uniqueUrl, snippet, source: finalUrl.hostname.replace(/^www\./, '') });
        } catch {
          // Links inválidos ou redirecionamentos inesperados são descartados.
        }
      }

      res.json({
        consulta,
        pesquisadoEm: new Date().toISOString(),
        fonteBusca: 'DuckDuckGo HTML',
        results,
        message: results.length
          ? `${results.length} resultado(s) para conferªncia. Os dados não foram adicionados ao cálculo.`
          : 'Nenhum resultado foi extraído. O buscador pode ter alterado o formato ou limitado a consulta; tente outros termos ou use o cadastro manual por link.'
      });
    } catch (e: any) {
      const message = e?.name === 'TimeoutError' || e?.name === 'AbortError'
        ? 'A pesquisa excedeu o tempo limite. Tente novamente.'
        : (e?.message ?? 'Falha inesperada na pesquisa web.');
      res.status(502).json({ error: `PESQUISA_WEB_FALHOU: ${message}` });
    }
  });

  r.post('/:id/amostras', async (req, res) => {
    try {
      const id = req.params.id;

      const s = await prisma.amostra.create({
        data: {
          avaliacaoId: id,
          ...req.body,
          dataColeta: new Date(
            req.body.dataColeta ?? Date.now()
          )
        }
      });

      await invalidateCalculation(
      prisma,
      id,
      'Nova amostra cadastrada',
      req.body.usuario ?? 'usuário'
    );
    res.json(s);
    } catch (e: any) {
      res.status(400).json({
        error: e.message
      });
    }
  });

  r.post('/:id/excluir-amostra/:amostraId', async (req, res) => {
    try {
      const s = await prisma.amostra.findUnique({
        where: {
          id: req.params.amostraId
        }
      });

      if (
        !s ||
        s.avaliacaoId !== req.params.id
      ) {
        throw new Error('AMOSTRA_NOT_FOUND');
      }

      const e = await prisma.exclusao.upsert({
        where: {
          amostraId: s.id
        },
        update: {
          criterio:
            req.body.criterio ?? 'TECNICO',
          motivo:
            req.body.motivo ??
            'Decisão técnica registrada',
          usuario:
            req.body.usuario ?? 'usuário'
        },
        create: {
          avaliacaoId: req.params.id,
          amostraId: s.id,
          criterio:
            req.body.criterio ?? 'TECNICO',
          motivo:
            req.body.motivo ??
            'Decisão técnica registrada',
          valor:
            s.valorOferta ??
            s.valorTransacao ??
            0,
          usuario:
            req.body.usuario ?? 'usuário'
        }
      });

      await prisma.amostra.update({
        where: {
          id: s.id
        },
        data: {
          status: 'EXCLUIDA'
        }
      });

      await audit(prisma, {
        avaliacaoId: req.params.id,
        acao: 'EXCLUSAO_AMOSTRA',
        entidade: 'Amostra',
        entidadeId: s.id,
        depois: e,
        motivo: e.motivo
      });

      await invalidateCalculation(
      prisma,
      req.params.id,
      `Amostra ${s.id} excluída: ${e.motivo}`,
      e.usuario
    );
    res.json(e);
    } catch (e: any) {
      res.status(400).json({
        error: e.message
      });
    }
  });

  r.post('/:id/reativar-amostra/:amostraId', async (req, res) => {
    try {
      const s = await prisma.amostra.findUnique({
        where: { id: req.params.amostraId }
      });

      if (!s || s.avaliacaoId !== req.params.id) {
        throw new Error('AMOSTRA_NOT_FOUND');
      }

      await prisma.exclusao.deleteMany({
        where: { amostraId: s.id }
      });

      await prisma.amostra.update({
        where: { id: s.id },
        data: { status: 'ATIVA' }
      });

      await audit(prisma, {
        avaliacaoId: req.params.id,
        acao: 'AMOSTRA_REATIVADA',
        entidade: 'Amostra',
        entidadeId: s.id,
        usuario: req.body.usuario ?? 'usuário',
        motivo: req.body.motivo ?? 'Reativação técnica registrada'
      });

      await invalidateCalculation(
        prisma,
        req.params.id,
        `Amostra ${s.id} reativada`,
        req.body.usuario ?? 'usuário'
      );

      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  r.post('/:id/saneamento/chauvenet-decisao', async (req, res) => {
    try {
      const id = req.params.id;
      const decisao = String(req.body?.decisao ?? '').trim().toUpperCase();
      const motivo = String(req.body?.justificativa ?? req.body?.motivo ?? '').trim();
      const usuario = String(req.body?.usuario ?? 'usuário').trim() || 'usuário';

      if (!['MANTER_JUSTIFICADO', 'EXCLUIR'].includes(decisao)) {
        return res.status(400).json({ error: 'DECISAO_CHAUVENET_INVALIDA', permitidas: ['MANTER_JUSTIFICADO', 'EXCLUIR'] });
      }
      if (!motivo) {
        return res.status(400).json({ error: 'JUSTIFICATIVA_CHAUVENET_OBRIGATORIA' });
      }

      const saneamento = await prisma.saneamento.findUnique({ where: { avaliacaoId: id } });
      if (!saneamento) return res.status(404).json({ error: 'SANEAMENTO_NOT_FOUND' });
      if (!saneamento.criterioChauvenet) return res.status(409).json({ error: 'CHAUVENET_NAO_SINALIZADO' });

      const agora = new Date();
      const atualizado = await prisma.$transaction(async (tx) => {
        const atual = await tx.avaliacao.findUnique({ where: { id }, select: { status: true, snapshotHash: true } });
        if (!atual) throw new Error('AVALIACAO_NOT_FOUND');

        const s = await tx.saneamento.update({
          where: { avaliacaoId: id },
          data: {
            decisaoChauvenet: decisao,
            justificativaChauvenet: motivo,
            decisaoChauvenetPor: usuario,
            decisaoChauvenetEm: agora
          }
        });

        await tx.avaliacao.update({
          where: { id },
          data: { status: 'CALCULADA', snapshotHash: null }
        });

        await tx.auditoria.create({
          data: {
            avaliacaoId: id,
            acao: 'DECISAO_CHAUVENET',
            entidade: 'Saneamento',
            entidadeId: s.id,
            antesJson: JSON.stringify({ decisaoChauvenet: saneamento.decisaoChauvenet, justificativaChauvenet: saneamento.justificativaChauvenet }),
            depoisJson: JSON.stringify({ decisaoChauvenet: decisao, justificativaChauvenet: motivo, outliersChauvenetJson: s.outliersChauvenetJson }),
            usuario,
            motivo
          }
        });

        return s;
      });

      res.json({ success: true, saneamento: atualizado, proximoPasso: decisao === 'MANTER_JUSTIFICADO' ? 'CRIAR_NOVO_SNAPSHOT' : 'FORMALIZAR_EXCLUSAO_DAS_AMOSTRAS_SINALIZADAS_E_RECALCULAR' });
    } catch (e: any) {
      res.status(400).json({ error: e?.message ?? 'ERRO_DECISAO_CHAUVENET' });
    }
  });

  r.post('/:id/snapshot', async (req, res) => {
    try {
      res.json(
        await createSnapshot(
          prisma,
          req.params.id
        )
      );
    } catch (e: any) {
      res.status(400).json({
        error: e.message
      });
    }
  });

  // EMISSAO_ROBO_AVALIADOR_V1
// Auditoria somente de leitura: não recalcula nem modifica o snapshot.
r.get('/:id/auditar', async (req, res) => {
  try {
    const resultado = await new RuleEngine(prisma).auditarAvaliacao(
      req.params.id,
      { exigirSnapshot: true }
    );

    res.json(resultado);
  } catch (e: any) {
    res.status(400).json({
      error: e?.message ?? 'ERRO_AO_AUDITAR_AVALIACAO'
    });
  }
});

// Emissão protegida: exige estado correto, snapshot íntegro e auditoria aprovada.
r.post('/:id/emitir', async (req, res) => {
  try {
    const id = req.params.id;

    const avaliacao = await prisma.avaliacao.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        status: true,
        snapshotHash: true
      }
    });

    if (!avaliacao) {
      res.status(404).json({ error: 'AVALIACAO_NOT_FOUND' });
      return;
    }

    if (avaliacao.status !== 'PRONTA_PARA_EMISSAO') {
      res.status(409).json({
        error: 'AVALIACAO_NAO_PRONTA_PARA_EMISSAO',
        statusAtual: avaliacao.status
      });
      return;
    }

    if (!avaliacao.snapshotHash) {
      res.status(409).json({ error: 'SNAPSHOT_HASH_AUSENTE' });
      return;
    }

    const readiness = await new RuleEngine(prisma).auditarAvaliacao(
      id,
      { exigirSnapshot: true }
    );

    if (!readiness.podeEmitir) {
      res.status(409).json({
        error: 'AVALIACAO_NAO_APTA_PARA_EMISSAO',
        alertas: readiness.alertas
      });
      return;
    }

    // Reutiliza o serviço existente e seus controles de snapshot,
    // integridade, persistªncia dos arquivos e auditoria documental.
    const arquivos = await ReportService.generateAll(prisma, id);

    // Registra a emissão sem alterar o estado ou o conteúdo congelado.
    await audit(prisma, {
      avaliacaoId: id,
      acao: 'LAUDO_EMITIDO',
      entidade: 'Documento',
      depois: {
        avaliacaoId: id,
        numero: avaliacao.numero,
        snapshotHash: avaliacao.snapshotHash,
        arquivos
      },
      usuario: 'sistema',
      motivo: 'Emissão de PDF, DOCX e XLSX após validaçãoo de prontidão'
    });

    res.json({
      success: true,
      avaliacaoId: id,
      numero: avaliacao.numero,
      snapshotHash: avaliacao.snapshotHash,
      arquivos
    });
  } catch (e: any) {
    res.status(400).json({
      error: e?.message ?? 'ERRO_AO_EMITIR_LAUDO'
    });
  }
});

r.get('/:id', async (req, res) => {
    const a =
      await prisma.avaliacao.findUnique({
        where: {
          id: req.params.id
        },
        include: {
          imovelAvaliando: true,
          amostras: true,
          homogeneizacoes: true,
          saneamento: true,
          resultados: true,
          auditorias: {
            orderBy: {
              dataHora: 'desc'
            }
          },
          documentos: true,
          snapshots: {
            orderBy: {
              versao: 'desc'
            }
          }
        }
      });

    a
      ? res.json(a)
      : res.status(404).json({
          error: 'NOT_FOUND'
        });
  });

  return r;
}








