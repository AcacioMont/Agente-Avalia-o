# Correções desta versão

1. Corrigido o fechamento do `findUnique` em `backend/src/routes/avaliacao.routes.ts`.
2. Corrigido o caminho do executável compilado: o TypeScript gera `dist/src/server.js` com o `tsconfig` atual.
3. Corrigido `backend/package.json` para `npm start` executar `dist/src/server.js`.
4. Corrigido o caminho dos arquivos estáticos do frontend para funcionar a partir do backend compilado.
5. Corrigido `INICIAR_ROBO_AVALIADOR.bat` para:
   - preparar Node portátil;
   - instalar dependências;
   - gerar Prisma;
   - executar `db push`;
   - executar seed;
   - executar testes;
   - compilar backend;
   - compilar frontend;
   - somente iniciar o servidor se todas as etapas anteriores passarem.
6. O script agora interrompe na primeira falha e não tenta executar um `dist/server.js` inexistente.

Observação: a compilação completa não pôde ser validada neste ambiente porque a instalação npm excedeu o tempo disponível. Portanto, esta versão corrige os erros identificados no pacote, mas a validação final deve ser feita no Windows.
