# RoboAvaliador — correções e estrutura do laudo

## Base

Correções aplicadas sobre a coleta `_COLETA_ROBO_AVALIADOR_20261005_073240`.

## Correções técnicas

1. Snapshot v2 com envelope explícito e hash SHA-256 do JSON congelado.
2. Snapshot passa a congelar:
   - avaliação;
   - imóvel avaliando;
   - amostras;
   - homogeneizações;
   - saneamento;
   - exclusões formais;
   - resultados;
   - histórico;
   - metadados de fotografias;
   - auditorias existentes antes do congelamento;
   - fatores e parâmetros ativos.
3. `Snapshot.avaliacaoId + versao` passa a possuir `UNIQUE`, além do índice.
4. Emissão exige snapshot v2 íntegro.
5. Auditoria identifica incompatibilidade entre quantidade de amostras ativas e quantidade usada no resultado.
6. Relatórios passam a expor exclusões formais e parâmetros/fatores congelados.
7. XLSX não inventa o status atual; registra que o status foi validado no momento da emissão.
8. Foi acrescentado teste do contrato do snapshot v2.
9. Correção de caracteres corrompidos nos arquivos ativos alterados.

## Laudo e ABNT

A estrutura do relatório foi alinhada, na medida suportada pelo modelo de dados, à lógica de apresentação de avaliação de imóveis urbanos da série ABNT NBR 14653.

Referências consideradas:
- ABNT NBR 14653-1:2019 — Avaliação de bens — Parte 1: Procedimentos gerais.
- ABNT NBR 14653-2:2011 — Avaliação de bens — Parte 2: Imóveis urbanos.
- ABNT NBR 13752:2024 somente quando o trabalho concreto tiver natureza de perícia de engenharia.

O sistema NÃO declara automaticamente "conformidade integral", nem inventa grau de fundamentação ou grau de precisão. Esses itens ficam explicitamente como não determinados pelo motor quando os dados/cálculos necessários não estiverem implementados.

## Limite importante

O laudo automatizado é um artefato técnico de apoio. A adequação final ao caso concreto, à documentação, à metodologia, à especificação normativa e à responsabilidade profissional precisa ser revisada pelo profissional habilitado.
