const fs = require('fs');
const path = require('path');

const root = process.cwd();
const mainPath = path.join(root, 'frontend', 'src', 'main.tsx');
const cssPath = path.join(root, 'frontend', 'src', 'style.css');

function backup(file) {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
  const dest = `${file}.patch-${stamp}.bak`;
  fs.copyFileSync(file, dest);
  return dest;
}
function replaceOnce(text, needle, replacement, label) {
  const i = text.indexOf(needle);
  if (i < 0) throw new Error(`ÂNCORA NÃO ENCONTRADA: ${label}`);
  if (text.indexOf(needle, i + needle.length) >= 0) throw new Error(`ÂNCORA DUPLICADA: ${label}`);
  return text.slice(0,i) + replacement + text.slice(i + needle.length);
}

const mainBackup = backup(mainPath);
const cssBackup = backup(cssPath);

let main = fs.readFileSync(mainPath, 'utf8');

main = replaceOnce(main,
  "const [showSample, setShowSample] = useState(false);",
  "const [showSample, setShowSample] = useState(false);\n  const [showEditProperty, setShowEditProperty] = useState(false);\n  const [editProperty, setEditProperty] = useState<Any>({});",
  'estado do modal de edição'
);

main = replaceOnce(main,
  "  const addSample = () => run('Adicionar amostra', async () => {",
  `  const openEditProperty = () => {
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

  const addSample = () => run('Adicionar amostra', async () => {`,
  'funções de edição do imóvel'
);

main = replaceOnce(main,
  "const emissions = (sel?.auditorias ?? []).filter((x: Any) => x.acao === 'LAUDO_EMITIDO');",
  "const emissions = (sel?.auditorias ?? []).filter((x: Any) => x.acao === 'LAUDO_EMITIDO');\n  const snapshotLatest = sel?.snapshots?.[0] ?? sel?.snapshots?.[sel?.snapshots?.length - 1];",
  'snapshot atual'
);

main = replaceOnce(main,
  '<section className="actionBar panel"><button className="primary" disabled={busy} onClick={calculate}><BarChart3 size={17}/> Calcular</button><button disabled={busy} onClick={auditNow}><ShieldCheck size={17}/> Auditar</button><button disabled={busy} onClick={snapshot}><LockKeyhole size={17}/> Congelar snapshot</button><button className="success" disabled={busy || sel.status !== \'PRONTA_PARA_EMISSAO\' || audit?.podeEmitir !== true} onClick={emit}><CheckCircle2 size={17}/> Emitir laudo</button><button className="secondary" onClick={() => setShowSample(true)}><Plus size={17}/> Adicionar amostra</button></section>',
  '<section className="actionBar panel"><button className="primary" disabled={busy} onClick={calculate}><BarChart3 size={17}/> Calcular</button><button disabled={busy} onClick={auditNow}><ShieldCheck size={17}/> Auditar</button><button disabled={busy} onClick={snapshot}><LockKeyhole size={17}/> Congelar snapshot</button><button className="success" disabled={busy || sel.status !== \'PRONTA_PARA_EMISSAO\' || audit?.podeEmitir !== true} onClick={emit}><CheckCircle2 size={17}/> Emitir laudo</button><button className="secondary" disabled={busy} onClick={() => setShowSample(true)}><Plus size={17}/> Adicionar amostra</button></section>',
  'bloqueio do botão de amostra'
);

main = replaceOnce(main,
  '<section className="panel detailHead"><div><div className="eyebrow">{sel.finalidade} • {sel.tipoImovel}</div><h2>{sel.numero} — {sel.titulo}</h2><p>{sel.municipio}/{sel.estado} • Responsável: {sel.responsavel}</p></div><StatusBadge status={sel.status}/></section>',
  '<section className="panel detailHead"><div><div className="eyebrow">{sel.finalidade} • {sel.tipoImovel}</div><h2>{sel.numero} — {sel.titulo}</h2><p>{sel.municipio}/{sel.estado} • Responsável: {sel.responsavel}</p><div className="traceLine">Avaliação: {sel.dataAvaliacao ? new Date(sel.dataAvaliacao).toLocaleDateString(\'pt-BR\') : \'—\'} • Motor: {sel.versaoMotor ?? \'—\'}</div></div><StatusBadge status={sel.status}/></section>\n\n            <section className="panel propertyPanel"><div className="sectionTitle"><div><small>IMÓVEL AVALIANDO</small><h3>Dados do imóvel avaliando</h3></div><button className="secondary small" disabled={busy} onClick={openEditProperty}>Editar imóvel</button></div>{sel.imovelAvaliando ? <div className="facts propertyFacts"><Fact l="Bairro" v={sel.imovelAvaliando.bairro || \'—\'}/><Fact l="Logradouro" v={sel.imovelAvaliando.logradouro || \'—\'}/><Fact l="Área do terreno" v={`${number(sel.imovelAvaliando.areaTerreno)} m²`}/><Fact l="Testada principal" v={`${number(sel.imovelAvaliando.testadaPrincipal)} m`}/><Fact l="Profundidade utilizada" v={`${number(sel.imovelAvaliando.profundidadeUtilizada ?? sel.imovelAvaliando.profundidadeInformada)} m`}/><Fact l="Situação da quadra" v={sel.imovelAvaliando.situacaoQuadra || \'—\'}/><Fact l="Distância do centro" v={number(sel.imovelAvaliando.distanciaCentro)}/><Fact l="Padrão" v={sel.imovelAvaliando.padrao || \'—\'}/><Fact l="Conservação" v={sel.imovelAvaliando.conservacao || \'—\'}/><Fact l="Idade" v={sel.imovelAvaliando.idade == null ? \'—\' : `${number(sel.imovelAvaliando.idade, 0)} anos`}/><Fact l="Vida útil" v={sel.imovelAvaliando.vidaUtil == null ? \'—\' : `${number(sel.imovelAvaliando.vidaUtil, 0)} anos`}/><Fact l="Elevador" v={sel.imovelAvaliando.elevador ? \'Sim\' : \'Não\'}/><Fact l="Vagas" v={number(sel.imovelAvaliando.numeroVagas, 0)}/></div> : <div className="empty">Dados do imóvel avaliando não encontrados.</div>}</section>\n\n            <section className="panel tracePanel"><div className="sectionTitle"><div><small>RASTREABILIDADE TÉCNICA</small><h3>Snapshot e versão</h3></div></div><div className="facts"><Fact l="Versão do motor" v={sel.versaoMotor ?? \'—\'}/><Fact l="Hash do snapshot" v={sel.snapshotHash ? `${String(sel.snapshotHash).slice(0, 20)}…` : \'—\'}/><Fact l="Snapshot" v={snapshotLatest ? `v${snapshotLatest.versao}` : \'—\'}/><Fact l="Status" v={statusLabel[sel.status] ?? sel.status}/></div></section>',
  'seções do imóvel e rastreabilidade'
);

main = replaceOnce(main,
  '{showNew && <Modal title="Nova avaliação" onClose={() => setShowNew(false)}><div className="formGrid">',
  `{showNew && <Modal title="Nova avaliação" onClose={() => !busy && setShowNew(false)}><div className="formSection"><div className="formSectionTitle">Identificação e dados do imóvel</div><div className="formGrid">`,
  'abertura do formulário de nova avaliação'
);

main = replaceOnce(main,
  '</div><label className="check"><input type="checkbox" checked={newEval.elevador}',
  '</div></div><label className="check"><input type="checkbox" checked={newEval.elevador}',
  'fechamento da seção do formulário'
);

main = replaceOnce(main,
  '<div className="modalActions"><button className="secondary" onClick={() => setShowNew(false)}>Cancelar</button><button className="primary" onClick={() => create()}>Criar</button></div></Modal>}',
  '<div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowNew(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => create()}>Criar</button></div></Modal>}',
  'bloqueio modal nova avaliação'
);

main = replaceOnce(main,
  '<div className="modalActions"><button className="secondary" onClick={() => setShowSample(false)}>Cancelar</button><button className="primary" onClick={() => addSample()}>Adicionar</button></div></Modal>}',
  '<div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowSample(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => addSample()}>Adicionar</button></div></Modal>}',
  'bloqueio modal amostra'
);

const editModal = `
    {showEditProperty && <Modal title="Editar dados do imóvel avaliando" onClose={() => !busy && setShowEditProperty(false)}><div className="formGrid"><label>Bairro<input value={editProperty.bairro ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,bairro:e.target.value})}/></label><label>Logradouro<input value={editProperty.logradouro ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,logradouro:e.target.value})}/></label><label>Número<input value={editProperty.numero ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,numero:e.target.value})}/></label><label>CEP<input value={editProperty.cep ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,cep:e.target.value})}/></label><label>Área do terreno (m²)<input type="number" value={editProperty.areaTerreno ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,areaTerreno:e.target.value})}/></label><label>Testada principal (m)<input type="number" value={editProperty.testadaPrincipal ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,testadaPrincipal:e.target.value})}/></label><label>Profundidade (m)<input type="number" value={editProperty.profundidade ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,profundidade:e.target.value})}/></label><label>Situação da quadra<select value={editProperty.situacaoQuadra ?? 'MEIO_QUADRA'} disabled={busy} onChange={e => setEditProperty({...editProperty,situacaoQuadra:e.target.value})}><option>MEIO_QUADRA</option><option>ESQUINA</option><option>MAIS_DE_UMA_FRENTE</option></select></label><label>Distância do centro<input type="number" value={editProperty.distanciaCentro ?? 0} disabled={busy} onChange={e => setEditProperty({...editProperty,distanciaCentro:e.target.value})}/></label><label>Padrão<input value={editProperty.padrao ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,padrao:e.target.value})}/></label><label>Conservação<input value={editProperty.conservacao ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,conservacao:e.target.value})}/></label><label>Idade<input type="number" value={editProperty.idade ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,idade:e.target.value})}/></label><label>Vida útil<input type="number" value={editProperty.vidaUtil ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,vidaUtil:e.target.value})}/></label><label>Área edificada privativa<input type="number" value={editProperty.areaEdificadaPrivativa ?? ''} disabled={busy} onChange={e => setEditProperty({...editProperty,areaEdificadaPrivativa:e.target.value})}/></label><label>Vagas<input type="number" value={editProperty.numeroVagas ?? 0} disabled={busy} onChange={e => setEditProperty({...editProperty,numeroVagas:e.target.value})}/></label></div><label className="check"><input type="checkbox" checked={Boolean(editProperty.elevador)} disabled={busy} onChange={e => setEditProperty({...editProperty,elevador:e.target.checked})}/> Possui elevador</label><div className="modalWarning">Ao salvar, o cálculo/snapshot existente será invalidado pela regra de governança. Será necessário recalcular e, quando aplicável, gerar novo snapshot.</div><div className="modalActions"><button className="secondary" disabled={busy} onClick={() => setShowEditProperty(false)}>Cancelar</button><button className="primary" disabled={busy} onClick={() => saveEditProperty()}>Salvar alterações</button></div></Modal>}
`;
main = replaceOnce(main, '    {showSample && <Modal title="Adicionar amostra"', editModal + '\n    {showSample && <Modal title="Adicionar amostra"', 'modal de edição');

fs.writeFileSync(mainPath, main, 'utf8');

let css = fs.readFileSync(cssPath, 'utf8');
const cssAppend = `
.traceLine{margin-top:7px;font-size:11px;color:#8a96a8}.tracePanel{margin-top:12px}.modalWarning{margin-top:14px;padding:11px 12px;border:1px solid #fde68a;background:#fffbeb;color:#92400e;border-radius:10px;font-size:12px;line-height:1.45}.propertyPanel{margin-top:12px}.propertyFacts{grid-template-columns:repeat(4,1fr)}@media(max-width:1100px){.propertyFacts{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.propertyFacts{grid-template-columns:1fr 1fr}.traceLine{line-height:1.5}}
`;
if (!css.includes('.modalWarning{')) css += cssAppend;
fs.writeFileSync(cssPath, css, 'utf8');

console.log('CORREÇÃO APLICADA COM SUCESSO');
console.log(`Backup main: ${mainBackup}`);
console.log(`Backup css: ${cssBackup}`);
console.log('Arquivos alterados: frontend/src/main.tsx e frontend/src/style.css');
