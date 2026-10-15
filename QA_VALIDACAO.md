# Validação do RoboAvaliador

Antes de usar o pacote no Windows, execute na raiz:

```powershell
npm install
npm run install:all
npm run db:init
npm run build
npm test
```

O pacote foi revisado estaticamente. A validação completa com npm depende do acesso ao registry e das dependências instaladas no computador.

Correções aplicadas nesta versão:
- tipagem explícita de React/React DOM no tsconfig do frontend;
- dependências @types/react e @types/react-dom no frontend;
- CalculationEngine usa `Big` para o produto e para o VU homogeneizado;
- testes usam imports ESM com `.js`;
- tipagens explícitas nos callbacks já corrigidos.


## Validações desta revisão

- Backend TypeScript compila após as correções.
- Frontend TypeScript (`tsc -b`) compila após as correções.
- O build final do Vite não foi executado neste ambiente Linux porque o pacote entregue contém binários opcionais do Rollup para Windows; no Windows alvo, `npm install` recompõe os binários corretos.
- Prisma `generate/validate` não pôde ser executado neste ambiente porque o pacote entregue contém engines Prisma para Windows e este ambiente é Linux sem acesso ao registry.
- O teste direto do `CalculationEngine` foi executado com Node 22 e TypeScript nativo e produziu fatores, produto e VU homogeneizado válidos.
- O teste direto do `SaneamentoEngine` foi executado com os cenários existentes.
