import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, BarChart3, CheckCircle2, ClipboardCheck, Database, ExternalLink, FileDown, FileSpreadsheet, FileText, Link as LinkIcon, LockKeyhole, Plus, RefreshCw, Search, ShieldCheck, Trash2, XCircle } from 'lucide-react';
import './style.css';

type Any = any;
const api = async <T = Any>(path: string, options?: RequestInit): Promise<T> => {
  const r = await fetch('/api/v1' + path, { headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) }, ...options });
  const text = await r.text();
  let data: Any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(data.error ?? data.message ?? data.raw ?? `HTTP ${r.status}`);
  return data;
};

const money = (v: Any) => Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const number = (v: Any, d = 2) => Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

// Converte números digitados no padrão brasileiro (ex.: 300,00 ou 750.000,00)
// e também aceita ponto decimal (ex.: 300.5). Não converte campo vazio em zero.
const parseNumericInput = (value: Any): number => {
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
const statusLabel: Record<string, string> = { EM_ELABORACAO: 'Em elaboração', CALCULADA: 'Calculada', PRONTA_PARA_EMISSAO: 'Pronta para emissão' };

function App() {
  const [status, setStatus] = useState<Any>({});
  const [avaliacoes, setAvaliacoes] = useState<Any[]>([]);
  const [sel, setSel] = useState<Any>(null);
  const [audit, setAudit] = useState<Any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showSample, setShowSample] = useState(false);
  const [showManualLink, setShowManualLink] = useState(false);
  const [sampleError, setSampleError] = useState('');
  const [manualLink, setManualLink] = useState({ url: '', fonte: '' });
  const [searchTerms, setSearchTerms] = useState('');
  const [searchResults, setSearchResults] = useState<Any[]>([]);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [chauvenetJustificativa, setChauvenetJustificativa] = useState('');
  const [excluindo, setExcluindo] = useState<Any>(null);
  const [motivoExclusao, setMotivoExclusao] = useState('');
  const [showEditProperty, setShowEditProperty] = useState(false);
  const [editProperty, setEditProperty] = useState<Any>({});
  const [newEval, setNewEval] = useState({ numero: '', titulo: '', finalidade: 'AVALIACAO', tipoImovel: 'Terreno', municipio: '', estado: 'SC', responsavel: '', bairro: '', logradouro: '', areaTerreno: '', testadaPrincipal: '', profundidade: '', situacaoQuadra: 'MEIO_QUADRA', distanciaCentro: '0', padrao: 'NORMAL', conservacao: 'REGULAR', idade: '0', vidaUtil: '60', elevador: false, numeroVagas: '0' });
  const [newSample, setNewSample] = useState({ identificador: '', fonte: '', tipoFonte: 'MANUAL', bairro: '', situacaoQuadra: 'MEIO_QUADRA', areaTerreno: '', testada: '', profundidade: '', padrao: 'NORMAL', conservacao: 'REGULAR', idade: '0', vidaUtil: '60', elevador: false, numeroVagas: '0', distanciaCentro: '0', tipoValor: 'OFERTA', valorOferta: '', valorTransacao: '', url: '', observacoes: '' });

  const refresh = async () => {
    const [s, a] = await Promise.all([api('/sistema/status'), api('/avaliacoes/recentes')]);
    setStatus(s); setAvaliacoes(a);
    if (sel?.id) setSel(await api('/avaliacoes/' + sel.id));
  };
  useEffect(() => { refresh().catch(e => setError(e.message)); }, []);

  const run = async (label: string, fn: () => Promise<any>) => {
    setBusy(true); setError('');
    try { const result = await fn(); await refresh(); return result; }
    catch (e: any) { setError(`${label}: ${e.message}`); }
    finally { setBusy(false); }
  };

  const create = () => run('Criar avaliação', async () => {
    const a = await api('/avaliacoes', { method: 'POST', body: JSON.stringify({ numero: newEval.numero, titulo: newEval.titulo, finalidade: newEval.finalidade, tipoImovel: newEval.tipoImovel, municipio: newEval.municipio, estado: newEval.estado, responsavel: newEval.responsavel, imovel: { bairro: newEval.bairro, logradouro: newEval.logradouro, areaTerreno: Number(newEval.areaTerreno), testadaPrincipal: Number(newEval.testadaPrincipal), profundidade: Number(newEval.profundidade), situacaoQuadra: newEval.situacaoQuadra, distanciaCentro: Number(newEval.distanciaCentro), padrao: newEval.padrao, conservacao: newEval.conservacao, idade: Number(newEval.idade), vidaUtil: Number(newEval.vidaUtil), elevador: newEval.elevador, numeroVagas: Number(newEval.numeroVagas) } }) });
    setShowNew(false); setSel(a); return a;
  });

  const openEditProperty = () => {
    if (!sel?.imovelAvaliando) return;
    setEditProperty({
      ...sel.imovelAvaliando,
      profundidade: sel.imovelAvaliando.profundidadeUtilizada ?? sel.imovelAvaliando.profundidadeInformada ?? '',
      areaTerreno: sel.imovelAvaliando.areaTerreno ?? '',
      testadaPrincipal: sel.imovelAvaliando.testadaPrincipal ?? '',
      distanciaCentro: sel.imovelAvaliando.distanciaCentro ?? 0,
      idade: sel.imovelAvaliando.idade ?? 0,
      vidaUtil: sel.imovelAvaliando.vidaUtil ?? 60,
      numeroVagas: sel.imovelAvaliando.numeroVagas ?? 0,
      elevador: Boolean(sel.imovelAvaliando.elevador)
    });
    setShowEditProperty(true);
  };

  const saveEditProperty = () => run('Atualizar imóvel', async () => {
    if (!sel?.id) throw new Error('Abra uma avaliação primeiro.');
    const body = {
      imovel: {
        bairro: editProperty.bairro ?? '',
        logradouro: editProperty.logradouro ?? '',
        numero: editProperty.numero ?? undefined,
        complemento: editProperty.complemento ?? undefined,
        cep: editProperty.cep ?? undefined,
        areaTerreno: Number(editProperty.areaTerreno),
        testadaPrincipal: Number(editProperty.testadaPrincipal),
        profundidade: Number(editProperty.profundidade),
        situacaoQuadra: editProperty.situacaoQuadra ?? 'MEIO_QUADRA',
        distanciaCentro: Number(editProperty.distanciaCentro ?? 0),
        areaEdificadaPrivativa: editProperty.areaEdificadaPrivativa == null || editProperty.areaEdificadaPrivativa === '' ? undefined : Number(editProperty.areaEdificadaPrivativa),
        padrao: editProperty.padrao ?? 'NORMAL',
        conservacao: editProperty.conservacao ?? 'REGULAR',
        idade: editProperty.idade == null || editProperty.idade === '' ? undefined : Number(editProperty.idade),
        vidaUtil: editProperty.vidaUtil == null || editProperty.vidaUtil === '' ? undefined : Number(editProperty.vidaUtil),
        elevador: Boolean(editProperty.elevador),
        numeroVagas: Number(editProperty.numeroVagas ?? 0)
      }
    };
    await api('/avaliacoes/' + sel.id, { method: 'PUT', body: JSON.stringify(body) });
    setShowEditProperty(false);
    setAudit(null);
    return await api('/avaliacoes/' + sel.id);
  });

  const addSample = () => run('Adicionar amostra', async () => {
    setSampleError('');
    try {
      if (!sel?.id) throw new Error('Abra uma avaliação primeiro.');
      const areaTerreno = parseNumericInput(newSample.areaTerreno);
      const valor = parseNumericInput(newSample.tipoValor === 'OFERTA' ? newSample.valorOferta : newSample.valorTransacao);
      if (!String(newSample.identificador ?? '').trim()) throw new Error('Informe a identificação da amostra.');
      if (!String(newSample.fonte ?? '').trim()) throw new Error('Informe a fonte do anúncio.');
      if (!String(newSample.url ?? '').trim()) throw new Error('Informe o link ou registre a fonte da amostra.');
      if (!Number.isFinite(areaTerreno) || !(areaTerreno > 0)) throw new Error('Informe a área da amostra em m² com um número válido, por exemplo 300,00.');
      if (!Number.isFinite(valor) || !(valor > 0)) throw new Error('Informe um valor de oferta ou de transação maior que zero, por exemplo 750.000,00.');
      const numero = (value: Any, fallback = 0) => {
        if (value == null || String(value).trim() === '') return fallback;
        const parsed = parseNumericInput(value);
        if (!Number.isFinite(parsed)) throw new Error(`Valor numérico inválido: ${String(value)}`);
        return parsed;
      };
      const body = {
        ...newSample,
        areaTerreno,
        testada: numero(newSample.testada),
        profundidade: numero(newSample.profundidade),
        idade: numero(newSample.idade),
        vidaUtil: numero(newSample.vidaUtil, 60),
        numeroVagas: numero(newSample.numeroVagas),
        distanciaCentro: numero(newSample.distanciaCentro),
        valorOferta: newSample.tipoValor === 'OFERTA' ? valor : undefined,
        valorTransacao: newSample.tipoValor === 'TRANSACAO' ? valor : undefined
      };
      const r = await api('/avaliacoes/' + sel.id + '/amostras', { method: 'POST', body: JSON.stringify(body) });
      setShowSample(false);
      setSampleError('');
      setSearchMessage('Amostra cadastrada. Revise os dados e execute novamente o cálculo quando estiver pronta.');
      return r;
    } catch (e: any) {
      const mensagem = e?.message || 'Erro desconhecido ao salvar a amostra.';
      setSampleError(mensagem);
      throw e;
    }
  });

  const searchWebSamples = () => run('Pesquisa automática de amostras', async () => {
    if (!sel?.id) throw new Error('Abra uma avaliação primeiro.');
    const result = await api('/avaliacoes/' + sel.id + '/buscar-amostras', { method: 'POST', body: JSON.stringify({ termos: searchTerms }) });
    setSearchResults(result.results ?? []);
    setSearchMessage(result.message ?? 'Pesquisa concluída.');
    setSearchDate(result.pesquisadoEm ?? new Date().toISOString());
    return result;
  });

  const useSearchResult = (item: Any) => {
    let fonte = item.source ?? 'Pesquisa na internet';
    try { fonte = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
    setSampleError('');
    setNewSample({ identificador: item.title ?? '', fonte, tipoFonte: 'PESQUISA_WEB', bairro: sel?.imovelAvaliando?.bairro ?? '', situacaoQuadra: 'MEIO_QUADRA', areaTerreno: '', testada: '', profundidade: '', padrao: 'NORMAL', conservacao: 'REGULAR', idade: '0', vidaUtil: '60', elevador: false, numeroVagas: '0', distanciaCentro: '0', tipoValor: 'OFERTA', valorOferta: '', valorTransacao: '', url: item.url ?? '', observacoes: `Resultado encontrado por pesquisa web. Conferir preço, área, localização, data e natureza da informação. ${item.snippet ?? ''}` });
    setShowSample(true);
  };

  const continueManualLink = () => {
    const url = manualLink.url.trim();
    if (!/^https?:\/\//i.test(url)) { setError('Informe um link completo iniciado por http:// ou https://.'); return; }
    let host = manualLink.fonte.trim();
    try { if (!host) host = new URL(url).hostname.replace(/^www\./, ''); } catch {}
    setSampleError('');
    setNewSample({ identificador: '', fonte: host || 'Fonte informada manualmente', tipoFonte: 'MANUAL', bairro: sel?.imovelAvaliando?.bairro ?? '', situacaoQuadra: 'MEIO_QUADRA', areaTerreno: '', testada: '', profundidade: '', padrao: 'NORMAL', conservacao: 'REGULAR', idade: '0', vidaUtil: '60', elevador: false, numeroVagas: '0', distanciaCentro: '0', tipoValor: 'OFERTA', valorOferta: '', valorTransacao: '', url, observacoes: 'Link informado manualmente. Conferir os dados no anúncio e preencher área e valor antes de cadastrar.' });
    setShowManualLink(false);
    setShowSample(true);
  };

  const calculate = () => run('Cálculo', async () => { const r = await api('/avaliacoes/' + sel.id + '/calcular', { method: 'POST', body: '{}' }); return r; });
  const auditNow = () => run('Auditoria', async () => { const r = await api('/avaliacoes/' + sel.id + '/auditar'); setAudit(r); return r; });
  const snapshot = () => run('Snapshot', async () => api('/avaliacoes/' + sel.id + '/snapshot', { method: 'POST', body: '{}' }));
  const emit = () => run('Emissão', async () => { const r = await api('/avaliacoes/' + sel.id + '/emitir', { method: 'POST', body: '{}' }); return r; });

  const decidirChauvenet = (decisao: 'MANTER_JUSTIFICADO' | 'EXCLUIR') => {
    const j = chauvenetJustificativa.trim();
    if (!j) { setError('Informe a justificativa técnica da decisão.'); return; }
    run('Decisão técnica Chauvenet', async () => {
      await api('/avaliacoes/' + sel.id + '/saneamento/chauvenet-decisao', { method: 'POST', body: JSON.stringify({ decisao, justificativa: j }) });
      setChauvenetJustificativa('');
      const r = await api('/avaliacoes/' + sel.id + '/auditar'); setAudit(r); return r;
    });
  };

  const excluirAmostra = () => {
    const m = motivoExclusao.trim();
    if (!excluindo || !m) { setError('Informe o motivo da exclusão técnica.'); return; }
    run('Excluir amostra', async () => {
      await api(`/avaliacoes/${sel.id}/excluir-amostra/${excluindo.id}`, { method: 'POST', body: JSON.stringify({ criterio: 'TECNICO', motivo: m, usuario: 'usuário' }) });
      setExcluindo(null); setMotivoExclusao('');
      const a = await api('/avaliacoes/' + sel.id); setSel(a); return a;
    });
  };

  const reativarAmostra = (a: Any) => run('Reativar amostra', async () => {
    await api(`/avaliacoes/${sel.id}/reativar-amostra/${a.id}`, { method: 'POST', body: JSON.stringify({ motivo: 'Reativação técnica', usuario: 'usuário' }) });
    const r = await api('/avaliacoes/' + sel.id); setSel(r); return r;
  });
  const open = async (id: string) => run('Abrir avaliação', async () => { const a = await api('/avaliacoes/' + id); setSel(a); setAudit(null); setSearchResults([]); setSearchMessage(''); setSearchDate(''); setSearchTerms(''); return a; });

  const latest = useMemo(() => ['CALCULADA','PRONTA_PARA_EMISSAO'].includes(sel?.status) ? sel?.resultados?.[sel.resultados.length - 1] : null, [sel]);
  const activeSamples = (sel?.amostras ?? []).filter((a: Any) => a.status === 'ATIVA');
  const emissions = (sel?.auditorias ?? []).filter((x: Any) => x.acao === 'LAUDO_EMITIDO');
  const snapshotLatest = sel?.snapshots?.[0] ?? sel?.snapshots?.[sel?.snapshots?.length - 1];

  return <div className="app">
    <header className="topbar">
      <div className="brand"><div className="brandMark"><Activity size={24}/></div><div><h1>RoboAvaliador</h1><span>Avaliação imobiliária • cálculo • saneamento • governança</span></div></div>
      <div className="topActions"><span className="health"><span className="dot"/> SQLite conectado</span><button className="secondary" onClick={() => refresh()}><RefreshCw size={16}/> Atualizar</button></div>
    </header>

    <main>
      {error && <div className="alert error"><XCircle size={18}/><div><b>Operação não concluída</b><span>{error}</span></div><button className="iconBtn" onClick={() => setError('')}>×</button></div>}

      <section className="stats">
        <Stat icon={<ClipboardCheck/>} label="Avaliações" value={status.avaliacoes ?? 0}/>
        <Stat icon={<BarChart3/>} label="Amostras" value={status.amostras ?? 0}/>
        <Stat icon={<LockKeyhole/>} label="Snapshots" value={status.snapshots ?? 0}/>
        <Stat icon={<FileText/>} label="Documentos" value={status.documentos ?? 0}/>
        <Stat icon={<ShieldCheck/>} label="Emissões" value={status.emissoes ?? 0}/>
      </section>

      <div className="layout">
        <aside className="sidebar panel">
          <div className="sectionTitle"><div><small>PROJETOS</small><h2>Avaliações</h2></div><button className="primary small" onClick={() => setShowNew(true)}><Plus size={16}/> Nova</button></div>
          <div className="list">{avaliacoes.length === 0 && <div className="empty">Nenhuma avaliação cadastrada.</div>}{avaliacoes.map(a => <button key={a.id} className={`listItem ${sel?.id === a.id ? 'selected' : ''}`} onClick={() => open(a.id)}><div><b>{a.numero}</b><span>{a.titulo}</span><small>{a.municipio}/{a.estado}</small></div><StatusBadge status={a.status}/></button>)}</div>
        </aside>

        <section className="content">
          {!sel ? <div className="welcome panel"><div className="heroIcon"><Activity size={34}/></div><h2>Central de avaliação imobiliária</h2><p>Selecione uma avaliação ou crie uma nova para iniciar o fluxo de cálculo, saneamento, auditoria, snapshot e emissão.</p><button className="primary" onClick={() => setShowNew(true)}><Plus size={17}/> Criar avaliação</button></div> : <>
            <section className="panel detailHead"><div><div className="eyebrow">{sel.finalidade} • {sel.tipoImovel}</div><h2>{sel.numero} — {sel.titulo}</h2><p>{sel.municipio}/{sel.estado} • Responsável: {sel.responsavel}</p><div className="traceLine">Avaliação: {sel.dataAvaliacao ? new Date(sel.dataAvaliacao).toLocaleDateString('pt-BR') : '—'} • Motor: {sel.versaoMotor ?? '—'}</div></div><StatusBadge status={sel.status}/></section>

            <section className="panel propertyPanel"><div className="sectionTitle"><div><small>IMÓVEL AVALIANDO</small><h3>Dados do imóvel avaliando</h3></div><button className="secondary small" disabled={busy} onClick={openEditProperty}>Editar imóvel</button></div>{sel.imovelAvaliando ? <div className="facts propertyFacts"><Fact l="Tipo de imóvel" v={sel.tipoImovel || '—'}/><Fact l="Bairro" v={sel.imovelAvaliando.bairro || '—'}/><Fact l="Logradouro" v={sel.imovelAvaliando.logradouro || '—'}/><Fact l="Área do terreno" v={`${number(sel.imovelAvaliando.areaTerreno)} m²`}/><Fact l="Testada principal" v={`${number(sel.imovelAvaliando.testadaPrincipal)} m`}/><Fact l="Profundidade utilizada" v={`${number(sel.imovelAvaliando.profundidadeUtilizada ?? sel.imovelAvaliando.profundidadeInformada)} m`}/><Fact l="Situação da quadra" v={situacaoQuadraLabel(sel.imovelAvaliando.situacaoQuadra)}/><Fact l="Distância do centro" v={number(sel.imovelAvaliando.distanciaCentro)}/><Fact l="Padrão" v={padraoLabel(sel.imovelAvaliando.padrao)}/><Fact l="Conservação" v={conservacaoLabel(sel.imovelAvaliando.conservacao)}/><Fact l="Idade" v={sel.imovelAvaliando.idade == null ? '—' : `${number(sel.imovelAvaliando.idade, 0)} anos`}/><Fact l="Vida útil" v={sel.imovelAvaliando.vidaUtil == null ? '—' : `${number(sel.imovelAvaliando.vidaUtil, 0)} anos`}/><Fact l="Elevador" v={sel.imovelAvaliando.elevador ? 'Sim' : 'Não'}/><Fact l="Vagas" v={number(sel.imovelAvaliando.numeroVagas, 0)}/></div> : <div className="empty">Dados do imóvel avaliando não encontrados.</div>}</section>

            <section className="panel tracePanel"><div className="sectionTitle"><div><small>RASTREABILIDADE TÉCNICA</small><h3>Snapshot e versão</h3></div></div><div className="facts"><Fact l="Versão do motor" v={sel.versaoMotor ?? '—'}/><Fact l="Hash do snapshot" v={sel.snapshotHash ? `${String(sel.snapshotHash).slice(0, 20)}…` : '—'}/><Fact l="Snapshot" v={snapshotLatest ? `v${snapshotLatest.versao}` : '—'}/><Fact l="Status" v={statusLabel[sel.status] ?? sel.status}/></div></section>

            <section className="actionBar panel"><button className="primary" disabled={busy} onClick={calculate}><BarChart3 size={17}/> Calcular</button><button disabled={busy} onClick={auditNow}><ShieldCheck size={17}/> Auditar</button><button disabled={busy} onClick={snapshot}><LockKeyhole size={17}/> Congelar snapshot</button><button className="success" disabled={busy || sel.status !== 'PRONTA_PARA_EMISSAO' || audit?.podeEmitir !== true} onClick={emit}><CheckCircle2 size={17}/> Emitir laudo</button><button className="secondary" disabled={busy} onClick={() => { setSampleError(''); setShowSample(true); }}><Plus size={17}/> Adicionar amostra</button></section>

            <section className="panel researchPanel">
              <div className="sectionTitle"><div><small>PESQUISA DE MERCADO</small><h3><Search size={18} style={{verticalAlign:'-3px',marginRight:6}}/>Buscar amostras na internet</h3></div><span className="count">{searchResults.length} resultado(s)</span></div>
              <p className="researchHelp">A busca consulta resultados públicos da web. Confira cada anúncio: os resultados não são adicionados automaticamente ao cálculo.</p>
              <div className="researchControls">
                <label className="searchInput">Termos da busca<input value={searchTerms} disabled={busy} onChange={e => setSearchTerms(e.target.value)} placeholder={`${sel.tipoImovel} à venda ${sel.imovelAvaliando?.bairro ?? ''} ${sel.municipio}/${sel.estado}`} /></label>
                <button className="primary" disabled={busy} onClick={() => searchWebSamples()}><Search size={16}/> {busy ? 'Pesquisando…' : 'Pesquisar na internet'}</button>
                <button className="secondary" disabled={busy} onClick={() => { setManualLink({url:'',fonte:''}); setShowManualLink(true); }}><LinkIcon size={16}/> Cadastrar link manual</button>
              </div>
              {searchMessage && <div className="researchNotice">{searchMessage}{searchDate ? ` • ${new Date(searchDate).toLocaleString('pt-BR')}` : ''}</div>}
              {searchResults.length > 0 && <div className="searchResults">{searchResults.map((item: Any, index: number) => <article className="searchResult" key={`${item.url}-${index}`}>
                <div className="searchResultBody"><b>{item.title}</b><span className="searchSource">{item.source}</span>{item.snippet && <p>{item.snippet}</p>}<a href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={13}/> Abrir anúncio ou página original</a></div>
                <button className="secondary small" disabled={busy} onClick={() => useSearchResult(item)}><Plus size={15}/> Conferir e cadastrar</button>
              </article>)}</div>}
              {searchMessage && searchResults.length === 0 && <div className="empty">Nenhum resultado disponível nesta consulta. Você pode tentar outros termos ou cadastrar um link manualmente.</div>}
            </section>

            {audit && <section className="panel"><div className="sectionTitle"><div><small>CONTROLE TÉCNICO</small><h3>Resultado da auditoria</h3></div><span className={audit.podeEmitir ? 'pill ok' : 'pill critical'}>{audit.podeEmitir ? 'APTA' : 'BLOQUEADA'}</span></div>{audit.alertas.length === 0 ? <div className="clean"><CheckCircle2 size={18}/> Nenhum alerta crítico encontrado.</div> : <div className="alerts">{audit.alertas.map((x: Any, i: number) => <div className="auditRow" key={i}><span className={`severity ${x.severidade.toLowerCase()}`}>{x.severidade}</span><div><b>{x.codigo} — {x.titulo}</b><span>{x.mensagem}</span></div></div>)}</div>}</section>}

            <section className="metrics"><Metric title="Valor unitário" value={latest ? money(latest.valorUnitario) : '—'}/><Metric title="Valor total" value={latest ? money(latest.valorTotal) : '—'}/><Metric title="Amostras ativas" value={activeSamples.length}/><Metric title="CV" value={latest ? `${number(Number(latest.coeficienteVariacao) * 100, 2)}%` : '—'}/><Metric title="Erro padrão" value={latest ? number(latest.erroPadrao) : '—'}/></section>

            <div className="twoCol">
              <section className="panel"><div className="sectionTitle"><div><small>CÁLCULO</small><h3>Matriz de homogeneização</h3></div><span className="count">{sel.homogeneizacoes?.length ?? 0}</span></div><div className="tableWrap"><table><thead><tr><th>Amostra</th><th>VU</th><th>FA</th><th>FT</th><th>FP</th><th>FO</th><th>FE</th><th>FPC</th><th>FC</th><th>FELEV</th><th>FG</th><th>FI</th><th>Produto</th><th>VU homog.</th></tr></thead><tbody>{(sel.homogeneizacoes ?? []).map((h: Any) => <tr key={h.id}><td>{h.amostraId.slice(0,8)}</td><td>{number(h.valorUnitarioOriginal)}</td><td>{number(h.fa,4)}</td><td>{number(h.ft,4)}</td><td>{number(h.fp,4)}</td><td>{number(h.fo,4)}</td><td>{number(h.fe,4)}</td><td>{number(h.fpc,4)}</td><td>{number(h.fc,4)}</td><td>{number(h.felev,4)}</td><td>{number(h.fg,4)}</td><td>{number(h.fi,4)}</td><td>{number(h.produtoFatores,4)}</td><td><b>{number(h.valorUnitarioHomogeneizado)}</b></td></tr>)}</tbody></table></div></section>
              <section className="panel"><div className="sectionTitle"><div><small>SANEAMENTO</small><h3>Critérios e estatísticas</h3></div><span className="count">{sel.saneamento ? 'Executado' : 'Pendente'}</span></div>{sel.saneamento ? <div className="facts"><Fact l="Média" v={number(sel.saneamento.media)}/><Fact l="Mediana" v={number(sel.saneamento.mediana)}/><Fact l="Desvio padrão" v={number(sel.saneamento.desvioPadrao)}/><Fact l="Limite inferior" v={number(sel.saneamento.limiteInferior)}/><Fact l="Limite superior" v={number(sel.saneamento.limiteSuperior)}/><Fact l="Chauvenet" v={sel.saneamento.criterioChauvenet ? 'Sinalizado' : 'Não sinalizado'}/>{sel.saneamento.outliersJson && <Fact l="Outliers" v={(() => { try { const xs = JSON.parse(sel.saneamento.outliersJson); return Array.isArray(xs) ? `${xs.filter((x: Any) => x.outlier).length} sinalizado(s)` : 'Indisponível'; } catch { return 'Indisponível'; } })()}/>}</div> : <div className="empty">Execute o cálculo para gerar o saneamento.</div>}</section>
            </div>

            {sel.saneamento?.criterioChauvenet && <section className="panel"><div className="sectionTitle"><div><small>DECISÃO TÉCNICA</small><h3>Saneamento — critério de Chauvenet</h3></div></div><p className="researchHelp">Chauvenet sinalizou valor(es) atípico(s). Registre a decisão técnica: manter (com justificativa) ou excluir (requer excluir a(s) amostra(s) e recalcular).</p>{sel.saneamento.decisaoChauvenet ? <div className="clean"><CheckCircle2 size={18}/><div><b>{sel.saneamento.decisaoChauvenet === 'MANTER_JUSTIFICADO' ? 'Manter justificado' : 'Decisão de exclusão'}</b><span>{sel.saneamento.justificativaChauvenet || 'Sem justificativa registrada'}</span></div></div> : <><div className="formGrid"><label className="fullWidth">Justificativa técnica (obrigatória)<textarea value={chauvenetJustificativa} disabled={busy} rows={2} onChange={e => setChauvenetJustificativa(e.target.value)} placeholder="Ex.: valores mantidos por representatividade do mercado / amostra fora do domínio técnico..."/></label></div><div className="modalActions"><button className="secondary" disabled={busy || !chauvenetJustificativa.trim()} onClick={() => decidirChauvenet('MANTER_JUSTIFICADO')}><ShieldCheck size={16}/> Manter justificado</button><button className="primary" disabled={busy || !chauvenetJustificativa.trim()} onClick={() => decidirChauvenet('EXCLUIR')}><Trash2 size={16}/> Decidir por exclusão</button></div></>}</section>}

            <section className="panel"><div className="sectionTitle"><div><small>AMOSTRAS</small><h3>Base comparativa</h3></div><span className="count">{activeSamples.length} ativas</span></div><div className="tableWrap"><table><thead><tr><th>Identificação</th><th>Fonte</th><th>Tipo</th><th>Área</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead><tbody>{(sel.amostras ?? []).map((a: Any) => <tr key={a.id}><td>{a.identificador || a.id.slice(0,8)}</td><td>{a.fonte}</td><td>{a.tipoValor}</td><td>{number(a.areaTerreno)} m²</td><td>{money(a.tipoValor === 'OFERTA' ? a.valorOferta : a.valorTransacao)}</td><td><StatusBadge status={a.status}/></td><td>{a.status === 'ATIVA' ? <button className="secondary small" disabled={busy} onClick={() => { setExcluindo(a); setMotivoExclusao(''); }}><Trash2 size={14}/> Excluir</button> : <button className="secondary small" disabled={busy} onClick={() => reativarAmostra(a)}>Reativar</button>}</td></tr>)}</tbody></table></div></section>

            <div className="twoCol"><section className="panel"><div className="sectionTitle"><div><small>DOCUMENTOS</small><h3>Arquivos do laudo</h3></div></div><div className="downloads"><Download id={sel.id} fmt="pdf" icon={<FileText/>} label="PDF"/><Download id={sel.id} fmt="docx" icon={<FileText/>} label="DOCX"/><Download id={sel.id} fmt="xlsx" icon={<FileSpreadsheet/>} label="XLSX"/></div>{(sel.documentos ?? []).map((d: Any) => <div className="docLine" key={d.id}><span>{d.formato}</span><small>{d.hashSha256?.slice(0,16)}…</small></div>)}</section>
              <section className="panel"><div className="sectionTitle"><div><small>EMISSÕES</small><h3>Registro formal</h3></div></div>{emissions.length ? emissions.map((e: Any) => { const d = e.depoisJson ? JSON.parse(e.depoisJson) : {}; return <div className="emissao" key={e.id}><CheckCircle2 size={18}/><div><b>{d.numero ?? 'Laudo emitido'}</b><span>{new Date(e.dataHora).toLocaleString('pt-BR')} • snapshot {String(d.hashSnapshot ?? '').slice(0,12)}…</span></div></div>; }) : <div className="empty">Nenhum laudo emitido.</div>}</section></div>

            <section className="panel"><div className="sectionTitle"><div><small>RASTREABILIDADE</small><h3>Auditoria</h3></div><span className="count">{sel.auditorias?.length ?? 0} registros</span></div><div className="auditTable">{(sel.auditorias ?? []).map((x: Any) => <div className="auditRow" key={x.id}><span className="auditAction">{x.acao}</span><div><b>{x.entidade}</b><span>{x.motivo || 'Operação registrada pelo sistema'}</span></div><time>{new Date(x.dataHora).toLocaleString('pt-BR')}</time></div>)}</div></section>
          </>}
        </section>
      </div>
    </main>

    {showNew && <Modal title="Nova avaliação" onClose={() => !busy && setShowNew(false)}>
  <div className="formSection">
    <div className="formSectionTitle">Identificação da avaliação</div>
    <div className="formGrid">
      <label>Número<input value={newEval.numero} disabled={busy} onChange={e => setNewEval({...newEval,numero:e.target.value})}/></label>
      <label>Título<input value={newEval.titulo} disabled={busy} onChange={e => setNewEval({...newEval,titulo:e.target.value})}/></label>
      <label>Finalidade<select value={newEval.finalidade} disabled={busy} onChange={e => setNewEval({...newEval,finalidade:e.target.value})}>
        <option value="AVALIACAO">Avaliação imobiliária</option>
        <option value="COMPRA_VENDA">Compra e venda</option>
        <option value="LOCACAO">Locação</option>
        <option value="GARANTIA">Garantia</option>
        <option value="JUDICIAL">Judicial</option>
        <option value="INVENTARIO">Inventário</option>
        <option value="OUTRA">Outra finalidade</option>
      </select></label>
      <label>Tipo de imóvel<select value={newEval.tipoImovel} disabled={busy} onChange={e => setNewEval({...newEval,tipoImovel:e.target.value})}>
        <option value="Terreno">Terreno</option>
        <option value="Casa">Casa</option>
        <option value="Apartamento">Apartamento</option>
        <option value="Sala comercial">Sala comercial</option>
        <option value="Loja">Loja</option>
        <option value="Galpão">Galpão</option>
        <option value="Prédio comercial">Prédio comercial</option>
        <option value="Imóvel rural">Imóvel rural</option>
        <option value="Outro">Outro</option>
      </select></label>
      <label>Município<input value={newEval.municipio} disabled={busy} onChange={e => setNewEval({...newEval,municipio:e.target.value})}/></label>
      <label>UF<input maxLength={2} value={newEval.estado} disabled={busy} onChange={e => setNewEval({...newEval,estado:e.target.value.toUpperCase()})}/></label>
      <label>Responsável<input value={newEval.responsavel} disabled={busy} onChange={e => setNewEval({...newEval,responsavel:e.target.value})}/></label>
    </div>
  </div>
  <div className="formSection">
    <div className="formSectionTitle">Dados do imóvel avaliando</div>
    <div className="formGrid">
      <label>Bairro<input value={newEval.bairro} disabled={busy} onChange={e => setNewEval({...newEval,bairro:e.target.value})}/></label>
      <label>Logradouro<input value={newEval.logradouro} disabled={busy} onChange={e => setNewEval({...newEval,logradouro:e.target.value})}/></label>
      <label>Área do terreno (m²)<input type="number" min="0" step="any" value={newEval.areaTerreno} disabled={busy} onChange={e => setNewEval({...newEval,areaTerreno:e.target.value})}/></label>
      <label>Testada principal (m)<input type="number" min="0" step="any" value={newEval.testadaPrincipal} disabled={busy} onChange={e => setNewEval({...newEval,testadaPrincipal:e.target.value})}/></label>
      <label>Profundidade (m)<input type="number" min="0" step="any" value={newEval.profundidade} disabled={busy} onChange={e => setNewEval({...newEval,profundidade:e.target.value})}/></label>
      <label>Situação da quadra<select value={newEval.situacaoQuadra} disabled={busy} onChange={e => setNewEval({...newEval,situacaoQuadra:e.target.value})}>
        <option value="MEIO_QUADRA">Meio de quadra</option>
        <option value="ESQUINA">Esquina</option>
        <option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option>
      </select></label>
      <label>Distância do centro<input type="number" min="0" step="any" value={newEval.distanciaCentro} disabled={busy} onChange={e => setNewEval({...newEval,distanciaCentro:e.target.value})}/></label>
      <label>Padrão<select value={newEval.padrao} disabled={busy} onChange={e => setNewEval({...newEval,padrao:e.target.value})}>
        <option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option><option value="LUXO">Luxo</option>
      </select></label>
      <label>Conservação<select value={newEval.conservacao} disabled={busy} onChange={e => setNewEval({...newEval,conservacao:e.target.value})}>
        <option value="REGULAR">Regular</option><option value="NOVO">Novo</option><option value="REPAROS_SIMPLES">Reparos simples</option><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option>
      </select></label>
      <label>Idade (anos)<input type="number" min="0" step="1" value={newEval.idade} disabled={busy} onChange={e => setNewEval({...newEval,idade:e.target.value})}/></label>
      <label>Vida útil (anos)<input type="number" min="0" step="1" value={newEval.vidaUtil} disabled={busy} onChange={e => setNewEval({...newEval,vidaUtil:e.target.value})}/></label>
      <label>Número de vagas<input type="number" min="0" step="1" value={newEval.numeroVagas} disabled={busy} onChange={e => setNewEval({...newEval,numeroVagas:e.target.value})}/></label>
    </div>
  </div>
  <label className="check"><input type="checkbox" checked={newEval.elevador} disabled={busy} onChange={e => setNewEval({...newEval,elevador:e.target.checked})}/> Possui elevador</label>
  <div className="modalActions">
    <button className="secondary" disabled={busy} onClick={() => setShowNew(false)}>Cancelar</button>
    <button className="primary" disabled={busy} onClick={() => create()}>Criar</button>
  </div>
</Modal>}

    {showEditProperty && <Modal title="Editar dados do imóvel avaliando" onClose={() => !busy && setShowEditProperty(false)}><div className="formGrid"><label>Bairro<input value={editProperty.bairro ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,bairro:e.target.value})}/></label><label>Logradouro<input value={editProperty.logradouro ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,logradouro:e.target.value})}/></label><label>Número<input value={editProperty.numero ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,numero:e.target.value})}/></label><label>CEP<input value={editProperty.cep ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,cep:e.target.value})}/></label><label>Área do terreno (m²)<input type="number" value={editProperty.areaTerreno ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,areaTerreno:e.target.value})}/></label><label>Testada principal (m)<input type="number" value={editProperty.testadaPrincipal ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,testadaPrincipal:e.target.value})}/></label><label>Profundidade (m)<input type="number" value={editProperty.profundidade ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,profundidade:e.target.value})}/></label><label>Situação da quadra<select value={editProperty.situacaoQuadra ?? 'MEIO_QUADRA'} disabled={busy} onChange={e => setEditProperty({...editProperty,situacaoQuadra:e.target.value})}><option value="MEIO_QUADRA">Meio de quadra</option><option value="ESQUINA">Esquina</option><option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option></select></label><label>Distância do centro<input type="number" value={editProperty.distanciaCentro ?? 0} disabled={busy} onChange={e => setEditProperty({...editProperty,distanciaCentro:e.target.value})}/></label><label>Padrão<select value={editProperty.padrao ?? 'NORMAL'} disabled={busy} onChange={e => setEditProperty({...editProperty,padrao:e.target.value})}><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option><option value="LUXO">Luxo</option></select></label><label>Conservação<select value={editProperty.conservacao ?? 'REGULAR'} disabled={busy} onChange={e => setEditProperty({...editProperty,conservacao:e.target.value})}><option value="REGULAR">Regular</option><option value="NOVO">Novo</option><option value="REPAROS_SIMPLES">Reparos simples</option><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option></select></label><label>Idade<input type="number" value={editProperty.idade ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,idade:e.target.value})}/></label><label>Vida útil<input type="number" value={editProperty.vidaUtil ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,vidaUtil:e.target.value})}/></label><label>Área edificada privativa<input type="number" value={editProperty.areaEdificadaPrivativa ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,areaEdificadaPrivativa:e.target.value})}/></label><label>Vagas<input type="number" value={editProperty.numeroVagas ?? 0} disabled={busy} onChange={e => setEditProperty({...editProperty,numeroVagas:e.target.value})}/></label></div><label className="check"><input type="checkbox" checked={Boolean(editProperty.elevador)} disabled={busy} onChange={e => setEditProperty({...editProperty,elevador:e.target.checked})}/> Possui elevador</label><div className="modalWarning">Ao salvar, o cálculo/snapshot existente será invalidado pela regra de governança. Será necessário recalcular e, quando aplicável, gerar novo snapshot.</div><div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowEditProperty(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => saveEditProperty()}>Salvar alterações</button></div></Modal>}

    {excluindo && <Modal title="Excluir amostra (decisão técnica)" onClose={() => !busy && setExcluindo(null)}>
      <p className="researchHelp">A exclusão é uma decisão técnica auditável. A amostra será marcada como Excluída e o cálculo será invalidado (será preciso recalcular).</p>
      <div className="formGrid">
        <label className="fullWidth">Amostra<input value={excluindo.identificador || String(excluindo.id).slice(0, 8)} disabled/></label>
        <label className="fullWidth">Motivo / critério técnico<textarea value={motivoExclusao} disabled={busy} rows={3} onChange={e => setMotivoExclusao(e.target.value)} placeholder="Ex.: outlier confirmado, dado não confiável na conferência..."/></label>
      </div>
      <div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setExcluindo(null)}>Cancelar</button><button className="primary" disabled={busy || !motivoExclusao.trim()} onClick={excluirAmostra}><Trash2 size={16}/> Confirmar exclusão</button></div>
    </Modal>}

    {showManualLink && <Modal title="Cadastrar amostra por link" onClose={() => !busy && setShowManualLink(false)}>
      <p className="researchHelp">Cole o endereço do anúncio que você encontrou manualmente. Depois você poderá completar os dados necessários para a avaliação.</p>
      <div className="formGrid">
        <label className="fullWidth">Link do anúncio<input type="url" value={manualLink.url} placeholder="https://..." disabled={busy} onChange={e => setManualLink({...manualLink,url:e.target.value})}/></label>
        <label>Portal ou fonte (opcional)<input value={manualLink.fonte} placeholder="Ex.: imobiliária, portal" disabled={busy} onChange={e => setManualLink({...manualLink,fonte:e.target.value})}/></label>
      </div>
      <div className="modalWarning">O link será guardado como referência da amostra. Confirme manualmente preço, área, localização e se o anúncio representa oferta ou transação.</div>
      <div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowManualLink(false)}>Cancelar</button><button className="primary" disabled={busy || !manualLink.url.trim()} onClick={continueManualLink}>Continuar para os dados</button></div>
    </Modal>}

    {showSample && <Modal title="Adicionar amostra" onClose={() => !busy && setShowSample(false)}>{sampleError && <div className="alert error" role="alert"><XCircle size={18}/><div><b>Não foi possível adicionar a amostra</b><span>{sampleError}</span></div></div>}<div className="formGrid">{[['identificador','Identificação'],['fonte','Fonte'],['bairro','Bairro'],['areaTerreno','Área (m²)'],['testada','Testada (m)'],['profundidade','Profundidade (m)'],['padrao','Padrão'],['conservacao','Conservação'],['idade','Idade'],['vidaUtil','Vida útil'],['numeroVagas','Vagas'],['distanciaCentro','Distância do centro'],['valorOferta','Valor oferta'],['valorTransacao','Valor transação'],['url','URL']].map(([k,l]) => <label key={k}>{l}<input value={(newSample as Any)[k]} onChange={e => setNewSample({...newSample,[k]:e.target.value})}/></label>)}<label>Tipo de valor<select value={newSample.tipoValor} onChange={e => setNewSample({...newSample,tipoValor:e.target.value})}><option value="OFERTA">Oferta</option><option value="TRANSACAO">Transação</option></select></label><label>Situação quadra<select value={newSample.situacaoQuadra} onChange={e => setNewSample({...newSample,situacaoQuadra:e.target.value})}><option value="MEIO_QUADRA">Meio de quadra</option><option value="ESQUINA">Esquina</option><option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option></select></label></div><label className="check"><input type="checkbox" checked={newSample.elevador} onChange={e => setNewSample({...newSample,elevador:e.target.checked})}/> Possui elevador</label><label className="wide">Observações<textarea value={newSample.observacoes} onChange={e => setNewSample({...newSample,observacoes:e.target.value})}/></label><div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowSample(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => addSample()}>{busy ? 'Salvando...' : 'Adicionar amostra'}</button></div></Modal>}
  </div>;
}

function Stat({ icon, label, value }: Any) { return <div className="stat"><div className="statIcon">{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>; }
function Metric({ title, value }: Any) { return <div className="metric"><small>{title}</small><b>{value}</b></div>; }
function situacaoQuadraLabel(v: Any) {
  return ({ MEIO_QUADRA: 'Meio de quadra', ESQUINA: 'Esquina', MAIS_DE_UMA_FRENTE: 'Mais de uma frente' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}
function padraoLabel(v: Any) {
  return ({ BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto', LUXO: 'Luxo' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}
function conservacaoLabel(v: Any) {
  return ({ REGULAR: 'Regular', NOVO: 'Novo', REPAROS_SIMPLES: 'Reparos simples', BAIXO: 'Baixo', NORMAL: 'Normal', ALTO: 'Alto' } as Record<string, string>)[String(v ?? '')] ?? String(v ?? '—');
}
function Fact({ l, v }: Any) { return <div><span>{l}</span><b>{v}</b></div>; }
function StatusBadge({ status }: Any) { return <span className={`status ${String(status).toLowerCase()}`}>{statusLabel[status] ?? status}</span>; }

function Download({ id, fmt, icon, label }: Any) {
  const generateAndOpen = async (e: Any) => {
    e.preventDefault();

    // Abre a nova aba durante o clique, evitando bloqueio do navegador.
    const tab = window.open('about:blank', '_blank');

    try {
      // Primeiro gera o relatório atualizado no backend.
      const response = await fetch(`/api/v1/export/${id}/${fmt}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const result = await response.json();

      if (!response.ok || !result.download) {
        throw new Error(
          result.error || 'Não foi possível gerar o relatório.'
        );
      }

      // Depois abre o arquivo que acabou de ser gerado.
      if (tab) {
        tab.location.href = result.download;
      } else {
        window.location.href = result.download;
      }
    } catch (error: Any) {
      if (tab) tab.close();

      alert(
        `Erro ao gerar ${String(fmt).toUpperCase()}: ${
          error?.message || 'Erro desconhecido'
        }`
      );
    }
  };

  return (
    <a
      className="download"
      href={`/api/v1/export/${id}/${fmt}`}
      onClick={generateAndOpen}
    >
      {icon}
      <span>{label}</span>
      <FileDown size={14} />
    </a>
  );
}
function Modal({ title, onClose, children }: Any) { return <div className="overlay"><div className="modal"><div className="sectionTitle"><h3>{title}</h3><button className="iconBtn" onClick={onClose}>×</button></div>{children}</div></div>; }

createRoot(document.getElementById('root')!).render(<App/>);




