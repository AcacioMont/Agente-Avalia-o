$ErrorActionPreference = 'Stop'

$root = (Get-Location).Path
$files = @(
  "frontend\src\main.tsx",
  "frontend\src\style.css",
  "backend\src\routes\avaliacao.routes.ts",
  "backend\src\services\ReportService.ts"
)

foreach ($f in $files) {
  if (-not (Test-Path (Join-Path $root $f))) {
    throw "Arquivo não encontrado: $f. Execute este script na raiz do projeto roboavaliador."
  }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $root "backup-correcao-organizada-$stamp"
New-Item -ItemType Directory -Path $backup | Out-Null

foreach ($f in $files) {
  $src = Join-Path $root $f
  $dst = Join-Path $backup $f
  New-Item -ItemType Directory -Path (Split-Path $dst) -Force | Out-Null
  Copy-Item $src $dst -Force
}

function Save-Utf8NoBom([string]$Path, [string]$Text) {
  [System.IO.File]::WriteAllText(
    $Path,
    $Text,
    (New-Object System.Text.UTF8Encoding($false))
  )
}

function Replace-Once([string]$Text, [string]$Old, [string]$New, [string]$Label) {
  if (-not $Text.Contains($Old)) {
    throw "Ponto de substituição não encontrado: $Label"
  }
  return $Text.Replace($Old, $New)
}

# ============================================================
# 1) FRONTEND main.tsx
# ============================================================
$p = Join-Path $root "frontend\src\main.tsx"
$s = [System.IO.File]::ReadAllText($p)

$s = Replace-Once $s `
"  const [showSample, setShowSample] = useState(false);"` `
"  const [showSample, setShowSample] = useState(false);
  const [showProperty, setShowProperty] = useState(false);
  const [propertyForm, setPropertyForm] = useState<any>(null);" `
"estado inicial do editor do imóvel"

$s = Replace-Once $s `
"    finally { setBusy(false); }
  };

  const create = () =>"` `
"    finally { setBusy(false); }
  };

  const propertyPayload = (p: Any) => ({
    bairro: p.bairro ?? '',
    logradouro: p.logradouro ?? '',
    numero: p.numero ?? '',
    complemento: p.complemento ?? '',
    cep: p.cep ?? '',
    areaTerreno: Number(p.areaTerreno),
    testadaPrincipal: Number(p.testadaPrincipal),
    profundidade: Number(p.profundidadeUtilizada ?? p.profundidadeInformada ?? p.profundidadeCalculada),
    situacaoQuadra: p.situacaoQuadra ?? 'MEIO_QUADRA',
    distanciaCentro: Number(p.distanciaCentro ?? 0),
    areaEdificadaPrivativa: p.areaEdificadaPrivativa == null ? undefined : Number(p.areaEdificadaPrivativa),
    padrao: p.padrao ?? '',
    conservacao: p.conservacao ?? '',
    idade: p.idade == null ? undefined : Number(p.idade),
    vidaUtil: p.vidaUtil == null ? undefined : Number(p.vidaUtil),
    elevador: Boolean(p.elevador),
    numeroVagas: Number(p.numeroVagas ?? 0)
  });

  const openPropertyEditor = () => {
    if (!sel?.imovelAvaliando) return;
    setPropertyForm(propertyPayload(sel.imovelAvaliando));
    setShowProperty(true);
  };

  const saveProperty = () => run('Atualizar dados do imóvel', async () => {
    if (!sel?.id || !propertyForm) throw new Error('Abra uma avaliação primeiro.');
    const r = await api('/avaliacoes/' + sel.id, {
      method: 'PUT',
      body: JSON.stringify({ imovel: propertyPayload(propertyForm), usuario: 'usuario' })
    });
    setShowProperty(false);
    return r;
  });

  const create = () =>"` `
"editor e atualização do imóvel"

$s = Replace-Once $s `
"    setShowNew(false); setSel(a); return a;
  });

  const addSample"` `
"    setShowNew(false); setSel(a); setPropertyForm(propertyPayload(a.imovelAvaliando)); return a;
  });

  const addSample"` `
"após criação"

$s = Replace-Once $s `
"  const open = async (id: string) => run('Abrir avaliação', async () => { const a = await api('/avaliacoes/' + id); setSel(a); setAudit(null); return a; });"` `
"  const open = async (id: string) => run('Abrir avaliação', async () => { const a = await api('/avaliacoes/' + id); setSel(a); setAudit(null); setPropertyForm(a.imovelAvaliando ? propertyPayload(a.imovelAvaliando) : null); return a; });"` `
"sincronização do editor ao abrir"

$s = Replace-Once $s `
"<section className="actionBar panel">"` `
"<section className="panel propertyPanel">
              <div className="sectionTitle">
                <div><small>IMÓVEL AVALIANDO</small><h3>Dados do imóvel avaliando</h3></div>
                <button className="secondary small" disabled={busy || !sel.imovelAvaliando} onClick={openPropertyEditor}>Editar dados</button>
              </div>
              {sel.imovelAvaliando ? <div className="facts propertyFacts">
                <Fact l="Endereço" v={[sel.imovelAvaliando.logradouro, sel.imovelAvaliando.numero].filter(Boolean).join(', ') || '—'} />
                <Fact l="Bairro" v={sel.imovelAvaliando.bairro || '—'} />
                <Fact l="Área do terreno" v={`${number(sel.imovelAvaliando.areaTerreno)} m²`} />
                <Fact l="Testada principal" v={`${number(sel.imovelAvaliando.testadaPrincipal)} m`} />
                <Fact l="Profundidade utilizada" v={`${number(sel.imovelAvaliando.profundidadeUtilizada)} m`} />
                <Fact l="Situação da quadra" v={sel.imovelAvaliando.situacaoQuadra || '—'} />
                <Fact l="Padrão" v={sel.imovelAvaliando.padrao || '—'} />
                <Fact l="Conservação" v={sel.imovelAvaliando.conservacao || '—'} />
                <Fact l="Distância do centro" v={`${number(sel.imovelAvaliando.distanciaCentro)} m`} />
                <Fact l="Idade" v={sel.imovelAvaliando.idade == null ? '—' : `${number(sel.imovelAvaliando.idade)} anos`} />
                <Fact l="Vida útil" v={sel.imovelAvaliando.vidaUtil == null ? '—' : `${number(sel.imovelAvaliando.vidaUtil)} anos`} />
                <Fact l="Vagas" v={number(sel.imovelAvaliando.numeroVagas, 0)} />
                <Fact l="Elevador" v={sel.imovelAvaliando.elevador ? 'Sim' : 'Não'} />
              </div> : <div className="empty">Imóvel avaliando não cadastrado.</div>}
            </section>

            <section className="actionBar panel">"` `
"seção visual do imóvel"

$s = Replace-Once $s `
"<button className="secondary" onClick={() => setShowSample(true)}><Plus size={17}/> Adicionar amostra</button>"` `
"<button className="secondary" disabled={busy} onClick={() => setShowSample(true)}><Plus size={17}/> Adicionar amostra</button>"` `
"bloqueio de amostra durante processamento"

$modalPattern = '(?s)\{showNew && <Modal title="Nova avaliação".*?\{showSample && <Modal title="Adicionar amostra"'
$modalReplacement = @'
{showNew && <Modal title="Nova avaliação" onClose={() => setShowNew(false)}>
      <div className="formSection">
        <div className="formSectionTitle">Identificação da avaliação</div>
        <div className="formGrid">
          {[['numero','Número'],['titulo','Título'],['tipoImovel','Tipo de imóvel'],['municipio','Município'],['estado','UF'],['responsavel','Responsável']].map(([k,l]) => <label key={k}>{l}<input value={(newEval as Any)[k]} onChange={e => setNewEval({...newEval,[k]:e.target.value})}/></label>)}
        </div>
      </div>
      <div className="formSection">
        <div className="formSectionTitle">Dados do imóvel avaliando</div>
        <div className="formGrid">
          {[['bairro','Bairro'],['logradouro','Logradouro'],['areaTerreno','Área do terreno (m²)'],['testadaPrincipal','Testada principal (m)'],['profundidade','Profundidade (m)'],['distanciaCentro','Distância do centro (m)'],['padrao','Padrão'],['conservacao','Conservação'],['idade','Idade (anos)'],['vidaUtil','Vida útil (anos)'],['numeroVagas','Vagas']].map(([k,l]) => <label key={k}>{l}<input value={(newEval as Any)[k]} onChange={e => setNewEval({...newEval,[k]:e.target.value})}/></label>)}
        </div>
        <label className="check"><input type="checkbox" checked={newEval.elevador} onChange={e => setNewEval({...newEval,elevador:e.target.checked})}/> Possui elevador</label>
      </div>
      <div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowNew(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => create()}>Criar</button></div>
    </Modal>}
    {showProperty && propertyForm && <Modal title="Dados do imóvel avaliando" onClose={() => setShowProperty(false)}>
      <div className="formSection">
        <div className="formSectionTitle">Cadastro físico e localização</div>
        <div className="formGrid">
          {[['bairro','Bairro'],['logradouro','Logradouro'],['numero','Número'],['complemento','Complemento'],['cep','CEP'],['areaTerreno','Área do terreno (m²)'],['testadaPrincipal','Testada principal (m)'],['profundidade','Profundidade utilizada (m)'],['distanciaCentro','Distância do centro (m)'],['padrao','Padrão'],['conservacao','Conservação'],['idade','Idade (anos)'],['vidaUtil','Vida útil (anos)'],['numeroVagas','Vagas']].map(([k,l]) => <label key={k}>{l}<input value={(propertyForm as Any)[k] ?? ''} onChange={e => setPropertyForm({...propertyForm,[k]:e.target.value})}/></label>)}
        </div>
        <label>Situação da quadra<select value={propertyForm.situacaoQuadra ?? 'MEIO_QUADRA'} onChange={e => setPropertyForm({...propertyForm,situacaoQuadra:e.target.value})}><option>MEIO_QUADRA</option><option>ESQUINA</option><option>MAIS_DE_UMA_FRENTE</option></select></label>
        <label className="check"><input type="checkbox" checked={Boolean(propertyForm.elevador)} onChange={e => setPropertyForm({...propertyForm,elevador:e.target.checked})}/> Possui elevador</label>
      </div>
      <div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowProperty(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => saveProperty()}>Salvar alterações</button></div>
    </Modal>}
    {showSample && <Modal title="Adicionar amostra"
'@
$s = [regex]::Replace($s, $modalPattern, $modalReplacement, 1)
if ($s -eq $null) { throw "Falha na substituição do modal principal." }

# Disable sample modal buttons while busy
$s = Replace-Once $s `
"<div className="modalActions"><button className="secondary" onClick={() => setShowSample(false)}>Cancelar</button><button className="primary" onClick={() => addSample()}>Adicionar</button></div>"` `
"<div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowSample(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => addSample()}>Adicionar</button></div>"` `
"bloqueio dos botões do modal de amostra"

Save-Utf8NoBom $p $s

# ============================================================
# 2) FRONTEND style.css
# ============================================================
$p = Join-Path $root "frontend\src\style.css"
$s = [System.IO.File]::ReadAllText($p)

$s = $s.Replace(
".facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.facts div{background:#f8fafc;border-radius:10px;padding:10px}",
".facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.facts div{background:#f8fafc;border-radius:10px;padding:10px}.propertyPanel{margin-top:12px}.propertyFacts{grid-template-columns:repeat(4,1fr)}.propertyFacts div{min-width:0}.formSection{margin-top:16px;padding-top:14px;border-top:1px solid #edf0f4}.formSection:first-child{margin-top:0;padding-top:0;border-top:0}.formSectionTitle{font-size:13px;font-weight:800;color:#1e3a8a;margin-bottom:10px}.propertyPanel .sectionTitle{margin-bottom:4px}"
)

$s = $s.Replace(
"@media(max-width:700px){.topbar{height:auto;padding:16px;gap:12px;align-items:flex-start}.topActions{display:none}main{padding:0 12px}.stats,.metrics{grid-template-columns:1fr 1fr}.formGrid{grid-template-columns:1fr}.auditRow{grid-template-columns:1fr}.downloads{grid-template-columns:1fr}.detailHead{align-items:flex-start;gap:10px}.detailHead h2{font-size:19px}}",
"@media(max-width:700px){.topbar{height:auto;padding:16px;gap:12px;align-items:flex-start}.topActions{display:flex;flex-wrap:wrap;justify-content:flex-end}.health{display:none}main{padding:0 12px}.stats,.metrics{grid-template-columns:1fr 1fr}.propertyFacts{grid-template-columns:1fr 1fr}.formGrid{grid-template-columns:1fr}.auditRow{grid-template-columns:1fr}.downloads{grid-template-columns:1fr}.detailHead{align-items:flex-start;gap:10px}.detailHead h2{font-size:19px}}"
)

Save-Utf8NoBom $p $s

# ============================================================
# 3) BACKEND avaliacao.routes.ts
# ============================================================
$p = Join-Path $root "backend\src\routes\avaliacao.routes.ts"
$s = [System.IO.File]::ReadAllText($p)

$anchor = @'
  r.get('/:id/auditar', async (req, res) => {
'@

$route = @'
  r.put('/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const i = req.body.imovel;
      if (!i) throw new Error('DADOS_IMOVEL_INCOMPLETOS');

      const anterior = await prisma.imovelAvaliando.findUnique({ where: { avaliacaoId: id } });
      if (!anterior) throw new Error('IMOVEL_AVALIANDO_NOT_FOUND');

      const areaTerreno = Number(i.areaTerreno);
      const testadaPrincipal = Number(i.testadaPrincipal);
      const profundidade = Number(i.profundidade);

      if (!(areaTerreno > 0) || !(testadaPrincipal > 0) || !(profundidade > 0)) {
        throw new Error('DADOS_IMOVEL_INVALIDOS');
      }

      const atualizado = await prisma.imovelAvaliando.update({
        where: { avaliacaoId: id },
        data: {
          bairro: i.bairro ?? anterior.bairro,
          logradouro: i.logradouro ?? anterior.logradouro,
          numero: i.numero ?? anterior.numero,
          complemento: i.complemento ?? anterior.complemento,
          cep: i.cep ?? anterior.cep,
          areaTerreno,
          testadaPrincipal,
          profundidadeInformada: profundidade,
          profundidadeCalculada: profundidade,
          profundidadeUtilizada: profundidade,
          situacaoQuadra: i.situacaoQuadra ?? anterior.situacaoQuadra,
          distanciaCentro: Number(i.distanciaCentro ?? anterior.distanciaCentro ?? 0),
          areaEdificadaPrivativa: i.areaEdificadaPrivativa == null ? anterior.areaEdificadaPrivativa : Number(i.areaEdificadaPrivativa),
          padrao: i.padrao ?? anterior.padrao,
          conservacao: i.conservacao ?? anterior.conservacao,
          idade: i.idade == null ? anterior.idade : Number(i.idade),
          vidaUtil: i.vidaUtil == null ? anterior.vidaUtil : Number(i.vidaUtil),
          elevador: i.elevador == null ? anterior.elevador : Boolean(i.elevador),
          numeroVagas: i.numeroVagas == null ? anterior.numeroVagas : Number(i.numeroVagas)
        }
      });

      await invalidateCalculation(prisma, id, 'Dados do imóvel avaliando alterados', req.body.usuario ?? 'usuário');

      await audit(prisma, {
        avaliacaoId: id,
        acao: 'IMOVEL_AVALIANDO_ATUALIZADO',
        entidade: 'ImovelAvaliando',
        entidadeId: atualizado.id,
        antes: anterior,
        depois: atualizado,
        usuario: req.body.usuario ?? 'usuário',
        motivo: 'Atualização dos dados do imóvel avaliando'
      });

      res.json(atualizado);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  r.get('/:id/auditar', async (req, res) => {
'@

$s = Replace-Once $s $anchor $route "rota PUT do imóvel avaliando"
Save-Utf8NoBom $p $s

# ============================================================
# 4) BACKEND ReportService.ts
# ============================================================
$p = Join-Path $root "backend\src\services\ReportService.ts"
$s = [System.IO.File]::ReadAllText($p)

$old = @'
  const extensao = formato.toLowerCase();
  const nomeArquivo = `laudo-${id}.${extensao}`;
  const caminho = path.join(root, nomeArquivo);
'@

$new = @'
  const extensao = formato.toLowerCase();
  const versaoArquivo = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${crypto.randomBytes(4).toString('hex')}`;
  const nomeArquivo = `laudo-${id}-${versaoArquivo}.${extensao}`;
  const caminho = path.join(root, nomeArquivo);
'@

$s = Replace-Once $s $old $new "nome único dos documentos"

$old = @'
  const existente = await prisma.documento.findFirst({
    where: {
      avaliacaoId: id,
      formato,
      tipo
    },
    orderBy: {
      dataGeracao: 'desc'
    }
  });

  let documentoId = existente?.id;
  if (existente) {
    await prisma.documento.update({
      where: { id: existente.id },
      data: { nomeArquivo, caminho, hashSha256, dataGeracao: new Date() }
    });
  } else {
    const criado = await prisma.documento.create({
      data: { avaliacaoId: id, tipo, nomeArquivo, caminho, formato, hashSha256 }
    });
    documentoId = criado.id;
  }
'@

$new = @'
  const criado = await prisma.documento.create({
    data: {
      avaliacaoId: id,
      tipo,
      nomeArquivo,
      caminho,
      formato,
      hashSha256
    }
  });

  const documentoId = criado.id;
'@

$s = Replace-Once $s $old $new "versionamento histórico dos documentos"
Save-Utf8NoBom $p $s

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "SUBSTITUIÇÃO ORGANIZADA CONCLUÍDA" -ForegroundColor Green
Write-Host "Backup criado em:" -ForegroundColor Cyan
Write-Host $backup -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Arquivos alterados:"
$files | ForEach-Object { Write-Host " - $_" }

Write-Host ""
Write-Host "IMPORTANTE: nenhum banco foi resetado e nenhum db:reset foi executado." -ForegroundColor Cyan
Write-Host ""
Write-Host "PRÓXIMA ETAPA: execute somente estes comandos de validação:" -ForegroundColor Cyan
Write-Host "  npm run build"
Write-Host "  npm test"
