import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './ui';
import type { Any } from '../api';

export function NewEvaluationModal({ busy, value, onChange, onClose, onCreate }: Any) {
  return <Modal title="Nova avaliação" onClose={onClose}>
    <div className="formSection">
      <div className="formSectionTitle">Identificação da avaliação</div>
      <div className="formGrid">
        <label>Número<input value={value.numero} disabled={busy} onChange={e => onChange({ ...value, numero: e.target.value })} /></label>
        <label>Título<input value={value.titulo} disabled={busy} onChange={e => onChange({ ...value, titulo: e.target.value })} /></label>
        <label>Finalidade<select value={value.finalidade} disabled={busy} onChange={e => onChange({ ...value, finalidade: e.target.value })}>
          <option value="AVALIACAO">Avaliação imobiliária</option>
          <option value="COMPRA_VENDA">Compra e venda</option>
          <option value="LOCACAO">Locação</option>
          <option value="GARANTIA">Garantia</option>
          <option value="JUDICIAL">Judicial</option>
          <option value="INVENTARIO">Inventário</option>
          <option value="OUTRA">Outra finalidade</option>
        </select></label>
        <label>Tipo de imóvel<select value={value.tipoImovel} disabled={busy} onChange={e => onChange({ ...value, tipoImovel: e.target.value })}>
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
        <label>Município<input value={value.municipio} disabled={busy} onChange={e => onChange({ ...value, municipio: e.target.value })} /></label>
        <label>UF<input maxLength={2} value={value.estado} disabled={busy} onChange={e => onChange({ ...value, estado: e.target.value.toUpperCase() })} /></label>
        <label>Responsável<input value={value.responsavel} disabled={busy} onChange={e => onChange({ ...value, responsavel: e.target.value })} /></label>
      </div>
    </div>
    <div className="formSection">
      <div className="formSectionTitle">Dados do imóvel avaliando</div>
      <div className="formGrid">
        <label>Bairro<input value={value.bairro} disabled={busy} onChange={e => onChange({ ...value, bairro: e.target.value })} /></label>
        <label>Logradouro<input value={value.logradouro} disabled={busy} onChange={e => onChange({ ...value, logradouro: e.target.value })} /></label>
        <label>Área do terreno (m²)<input type="number" min="0" step="any" value={value.areaTerreno} disabled={busy} onChange={e => onChange({ ...value, areaTerreno: e.target.value })} /></label>
        <label>Testada principal (m)<input type="number" min="0" step="any" value={value.testadaPrincipal} disabled={busy} onChange={e => onChange({ ...value, testadaPrincipal: e.target.value })} /></label>
        <label>Profundidade (m)<input type="number" min="0" step="any" value={value.profundidade} disabled={busy} onChange={e => onChange({ ...value, profundidade: e.target.value })} /></label>
        <label>Situação da quadra<select value={value.situacaoQuadra} disabled={busy} onChange={e => onChange({ ...value, situacaoQuadra: e.target.value })}>
          <option value="MEIO_QUADRA">Meio de quadra</option>
          <option value="ESQUINA">Esquina</option>
          <option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option>
        </select></label>
        <label>Distância do centro<input type="number" min="0" step="any" value={value.distanciaCentro} disabled={busy} onChange={e => onChange({ ...value, distanciaCentro: e.target.value })} /></label>
        <label>Padrão<select value={value.padrao} disabled={busy} onChange={e => onChange({ ...value, padrao: e.target.value })}>
          <option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option><option value="LUXO">Luxo</option>
        </select></label>
        <label>Conservação<select value={value.conservacao} disabled={busy} onChange={e => onChange({ ...value, conservacao: e.target.value })}>
          <option value="REGULAR">Regular</option><option value="NOVO">Novo</option><option value="REPAROS_SIMPLES">Reparos simples</option><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option>
        </select></label>
        <label>Idade (anos)<input type="number" min="0" step="1" value={value.idade} disabled={busy} onChange={e => onChange({ ...value, idade: e.target.value })} /></label>
        <label>Vida útil (anos)<input type="number" min="0" step="1" value={value.vidaUtil} disabled={busy} onChange={e => onChange({ ...value, vidaUtil: e.target.value })} /></label>
        <label>Número de vagas<input type="number" min="0" step="1" value={value.numeroVagas} disabled={busy} onChange={e => onChange({ ...value, numeroVagas: e.target.value })} /></label>
      </div>
    </div>
    <label className="check"><input type="checkbox" checked={value.elevador} disabled={busy} onChange={e => onChange({ ...value, elevador: e.target.checked })} /> Possui elevador</label>
    <div className="modalActions">
      <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="primary" disabled={busy} onClick={onCreate}>Criar</button>
    </div>
  </Modal>;
}

export function EditPropertyModal({ busy, value, onChange, onClose, onSave }: Any) {
  return <Modal title="Editar dados do imóvel avaliando" onClose={onClose}>
    <div className="formGrid">
      <label>Bairro<input value={value.bairro ?? ''} disabled={busy} onChange={e => onChange({ ...value, bairro: e.target.value })} /></label>
      <label>Logradouro<input value={value.logradouro ?? ''} disabled={busy} onChange={e => onChange({ ...value, logradouro: e.target.value })} /></label>
      <label>Número<input value={value.numero ?? ''} disabled={busy} onChange={e => onChange({ ...value, numero: e.target.value })} /></label>
      <label>CEP<input value={value.cep ?? ''} disabled={busy} onChange={e => onChange({ ...value, cep: e.target.value })} /></label>
      <label>Área do terreno (m²)<input type="number" value={value.areaTerreno ?? ''} disabled={busy} onChange={e => onChange({ ...value, areaTerreno: e.target.value })} /></label>
      <label>Testada principal (m)<input type="number" value={value.testadaPrincipal ?? ''} disabled={busy} onChange={e => onChange({ ...value, testadaPrincipal: e.target.value })} /></label>
      <label>Profundidade (m)<input type="number" value={value.profundidade ?? ''} disabled={busy} onChange={e => onChange({ ...value, profundidade: e.target.value })} /></label>
      <label>Situação da quadra<select value={value.situacaoQuadra ?? 'MEIO_QUADRA'} disabled={busy} onChange={e => onChange({ ...value, situacaoQuadra: e.target.value })}><option value="MEIO_QUADRA">Meio de quadra</option><option value="ESQUINA">Esquina</option><option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option></select></label>
      <label>Distância do centro<input type="number" value={value.distanciaCentro ?? 0} disabled={busy} onChange={e => onChange({ ...value, distanciaCentro: e.target.value })} /></label>
      <label>Padrão<select value={value.padrao ?? 'NORMAL'} disabled={busy} onChange={e => onChange({ ...value, padrao: e.target.value })}><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option><option value="LUXO">Luxo</option></select></label>
      <label>Conservação<select value={value.conservacao ?? 'REGULAR'} disabled={busy} onChange={e => onChange({ ...value, conservacao: e.target.value })}><option value="REGULAR">Regular</option><option value="NOVO">Novo</option><option value="REPAROS_SIMPLES">Reparos simples</option><option value="BAIXO">Baixo</option><option value="NORMAL">Normal</option><option value="ALTO">Alto</option></select></label>
      <label>Idade<input type="number" value={value.idade ?? ''} disabled={busy} onChange={e => onChange({ ...value, idade: e.target.value })} /></label>
      <label>Vida útil<input type="number" value={value.vidaUtil ?? ''} disabled={busy} onChange={e => onChange({ ...value, vidaUtil: e.target.value })} /></label>
      <label>Área edificada privativa<input type="number" value={value.areaEdificadaPrivativa ?? ''} disabled={busy} onChange={e => onChange({ ...value, areaEdificadaPrivativa: e.target.value })} /></label>
      <label>Vagas<input type="number" value={value.numeroVagas ?? 0} disabled={busy} onChange={e => onChange({ ...value, numeroVagas: e.target.value })} /></label>
    </div>
    <label className="check"><input type="checkbox" checked={Boolean(value.elevador)} disabled={busy} onChange={e => onChange({ ...value, elevador: e.target.checked })} /> Possui elevador</label>
    <div className="modalWarning">Ao salvar, o cálculo/snapshot existente será invalidado pela regra de governança. Será necessário recalcular e, quando aplicável, gerar novo snapshot.</div>
    <div className="modalActions">
      <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="primary" disabled={busy} onClick={onSave}>Salvar alterações</button>
    </div>
  </Modal>;
}

export function ExcludeSampleModal({ busy, sample, motivo, onMotivo, onClose, onConfirm }: Any) {
  return <Modal title="Excluir amostra (decisão técnica)" onClose={onClose}>
    <p className="researchHelp">A exclusão é uma decisão técnica auditável. A amostra será marcada como Excluída e o cálculo será invalidado (será preciso recalcular).</p>
    <div className="formGrid">
      <label className="fullWidth">Amostra<input value={sample.identificador || String(sample.id).slice(0, 8)} disabled /></label>
      <label className="fullWidth">Motivo / critério técnico<textarea value={motivo} disabled={busy} rows={3} onChange={e => onMotivo(e.target.value)} placeholder="Ex.: outlier confirmado, dado não confiável na conferência..." /></label>
    </div>
    <div className="modalActions">
      <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="primary" disabled={busy || !motivo.trim()} onClick={onConfirm}><Trash2 size={16} /> Confirmar exclusão</button>
    </div>
  </Modal>;
}

export function ManualLinkModal({ busy, value, onChange, onClose, onContinue }: Any) {
  return <Modal title="Cadastrar amostra por link" onClose={onClose}>
    <p className="researchHelp">Cole o endereço do anúncio que você encontrou manualmente. Depois você poderá completar os dados necessários para a avaliação.</p>
    <div className="formGrid">
      <label className="fullWidth">Link do anúncio<input type="url" value={value.url} placeholder="https://..." disabled={busy} onChange={e => onChange({ ...value, url: e.target.value })} /></label>
      <label>Portal ou fonte (opcional)<input value={value.fonte} placeholder="Ex.: imobiliária, portal" disabled={busy} onChange={e => onChange({ ...value, fonte: e.target.value })} /></label>
    </div>
    <div className="modalWarning">O link será guardado como referência da amostra. Confirme manualmente preço, área, localização e se o anúncio representa oferta ou transação.</div>
    <div className="modalActions">
      <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="secondary" disabled={busy || !value.url.trim()} onClick={onContinue}>Continuar para os dados</button>
    </div>
  </Modal>;
}

export function AddSampleModal({ busy, value, onChange, error, onClose, onAdd }: Any) {
  return <Modal title="Adicionar amostra" onClose={onClose}>
    {error && <div className="alert error" role="alert"><div><b>Não foi possível adicionar a amostra</b><span>{error}</span></div></div>}
    <div className="formGrid">
      {[['identificador', 'Identificação'], ['fonte', 'Fonte'], ['bairro', 'Bairro'], ['areaTerreno', 'Área (m²)'], ['testada', 'Testada (m)'], ['profundidade', 'Profundidade (m)'], ['padrao', 'Padrão'], ['conservacao', 'Conservação'], ['idade', 'Idade'], ['vidaUtil', 'Vida útil'], ['numeroVagas', 'Vagas'], ['distanciaCentro', 'Distância do centro'], ['valorOferta', 'Valor oferta'], ['valorTransacao', 'Valor transação'], ['url', 'URL']].map(([k, l]) =>
        <label key={k}>{l}<input value={value[k]} onChange={e => onChange({ ...value, [k]: e.target.value })} /></label>)}
      <label>Tipo de valor<select value={value.tipoValor} onChange={e => onChange({ ...value, tipoValor: e.target.value })}><option value="OFERTA">Oferta</option><option value="TRANSACAO">Transação</option></select></label>
      <label>Situação quadra<select value={value.situacaoQuadra} onChange={e => onChange({ ...value, situacaoQuadra: e.target.value })}><option value="MEIO_QUADRA">Meio de quadra</option><option value="ESQUINA">Esquina</option><option value="MAIS_DE_UMA_FRENTE">Mais de uma frente</option></select></label>
    </div>
    <label className="check"><input type="checkbox" checked={value.elevador} onChange={e => onChange({ ...value, elevador: e.target.checked })} /> Possui elevador</label>
    <label className="wide">Observações<textarea value={value.observacoes} onChange={e => onChange({ ...value, observacoes: e.target.value })} /></label>
    <div className="modalActions">
      <button className="secondary" disabled={busy} onClick={onClose}>Cancelar</button>
      <button className="primary" disabled={busy} onClick={onAdd}>{busy ? 'Salvando...' : 'Adicionar amostra'}</button>
    </div>
  </Modal>;
}
