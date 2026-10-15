import React from 'react';
import { FileDown } from 'lucide-react';
import { statusLabel } from '../labels';
import type { Any } from '../api';

export function Stat({ icon, label, value }: Any) {
  return <div className="stat"><div className="statIcon">{icon}</div><div><small>{label}</small><strong>{value}</strong></div></div>;
}

export function Metric({ title, value }: Any) {
  return <div className="metric"><small>{title}</small><b>{value}</b></div>;
}

export function Fact({ l, v }: Any) {
  return <div><span>{l}</span><b>{v}</b></div>;
}

export function StatusBadge({ status }: Any) {
  return <span className={`status ${String(status).toLowerCase()}`}>{statusLabel[status] ?? status}</span>;
}

export function Modal({ title, onClose, children }: Any) {
  return <div className="overlay"><div className="modal"><div className="sectionTitle"><h3>{title}</h3><button className="iconBtn" onClick={onClose}>×</button></div>{children}</div></div>;
}

/** Gera o relatório no backend e abre o arquivo recém-gerado em nova aba. */
export function Download({ id, fmt, icon, label }: Any) {
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
        throw new Error(result.error || 'Não foi possível gerar o relatório.');
      }

      // Depois abre o arquivo que acabou de ser gerado.
      if (tab) {
        tab.location.href = result.download;
      } else {
        window.location.href = result.download;
      }
    } catch (error: Any) {
      if (tab) tab.close();
      alert(`Erro ao gerar ${String(fmt).toUpperCase()}: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <a className="download" href={`/api/v1/export/${id}/${fmt}`} onClick={generateAndOpen}>
      {icon}
      <span>{label}</span>
      <FileDown size={14} />
    </a>
  );
}
