# Guia de implementação local e backend Node.js com Firebase

**Projeto:** Elo Finance Hub — Hub Financeiro SaaS do Grupo Elo  
**Autor:** Manus AI  
**Última revisão:** 21 de agosto de 2026

> Este documento descreve duas camadas complementares: a execução do projeto atual, que utiliza React, tRPC, Express, Drizzle ORM, MySQL/TiDB e autenticação Manus OAuth; e uma implementação de referência para substituir ou adicionar um backend Node.js usando Firebase. O backend Firebase descrito aqui não deve ser ativado em produção sem decidir formalmente se ele substituirá o banco atual ou funcionará como uma integração paralela.

## 1. Visão geral da solução

O Hub Financeiro é uma aplicação interna para registrar fatos financeiros reais de produtos SaaS, contratos, clientes, licenças, infraestrutura, metas, DRE, margem contratual, notas fiscais e indicadores executivos. A aplicação foi construída com React 19 no frontend, Express 4 e tRPC 11 no backend, Drizzle ORM para persistência relacional e MySQL/TiDB como banco principal.

| Camada | Implementação atual | Responsabilidade |
|---|---|---|
| Interface | React 19, Vite, Tailwind CSS 4 e componentes Radix/shadcn | Dashboard, formulários, filtros, gráficos, tema e relatórios |
| API | Express + tRPC | Contratos tipados entre interface e servidor |
| Persistência | MySQL/TiDB via Drizzle ORM | Produtos, clientes, contratos, transações, rateios, metas e documentos fiscais |
| Autenticação | Manus OAuth | Sessão e proteção de procedimentos tRPC |
| Arquivos | Storage compatível com S3 da plataforma | Arquivos que eventualmente sejam anexados às notas fiscais |
| Testes | Vitest e TypeScript | Regras financeiras, rateio, DRE, margem e transformações de exportação |

A documentação oficial do Firebase descreve o Admin SDK como uma biblioteca para ambientes privilegiados, como servidores, e disponibiliza APIs para Node.js, Firestore e Storage [1]. O Firebase Authentication oferece APIs administrativas para gerenciamento de usuários e validação de tokens [2]. Para desenvolvimento local, a Firebase Emulator Suite fornece emuladores de serviços como Authentication, Firestore e Storage [3].

## 2. Pré-requisitos locais

Instale Node.js em uma versão LTS compatível com o projeto, pnpm, Git e, caso vá utilizar o backend atual, acesso a uma instância MySQL/TiDB. Para o backend Firebase, instale também a Firebase CLI.

```bash
node --version
pnpm --version
git --version
npm install -g firebase-tools
firebase --version
```

Clone o repositório e entre no diretório do projeto:

```bash
git clone <URL_DO_REPOSITORIO>
cd hub-financeiro-saas
pnpm install
```

Nunca execute o servidor com credenciais de produção embutidas no código. Arquivos `.env`, certificados de contas de serviço e chaves privadas devem permanecer fora do controle de versão.

## 3. Executar a versão atual localmente

A versão atual depende das variáveis de ambiente fornecidas pelo ambiente Manus, especialmente `DATABASE_URL`, `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL` e as variáveis do Forge. Em uma máquina fora da plataforma, crie um arquivo `.env` local a partir de um modelo seguro e preencha os valores reais.

```bash
cp .env.example .env
pnpm install
pnpm drizzle-kit generate
pnpm run dev
```

O servidor de desenvolvimento executa o entrypoint `server/_core/index.ts`, inicia o Express e expõe a interface por meio do Vite. O navegador deve abrir a URL exibida no log do servidor. Para validar sem iniciar o modo de desenvolvimento, use:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm run build
pnpm start
```

O fluxo de banco segue a ordem: alterar `drizzle/schema.ts`, gerar a migração, revisar o SQL, aplicar a migração no banco e somente então usar os novos helpers em `server/db.ts` e procedimentos em `server/routers.ts`. Não aplique SQL destrutivo sem backup e revisão.

## 4. Organização recomendada do código atual

```text
client/
  src/
    components/       Componentes reutilizáveis e layout do dashboard
    contexts/         ThemeProvider e contexto de interface
    pages/Home.tsx    Rotas internas e telas operacionais
    lib/trpc.ts       Cliente tRPC tipado
server/
  db.ts               Queries e comandos persistentes
  routers.ts          Contratos tRPC protegidos
  _core/              Express, OAuth, contexto e infraestrutura
shared/
  finance.ts          Funções financeiras puras e testáveis
drizzle/
  schema.ts           Modelo relacional
  migrations/         Migrações SQL geradas
docs/
  GUIA_IMPLEMENTACAO_LOCAL_E_FIREBASE.md
```

A regra de negócio financeira deve permanecer em funções puras sempre que possível. Assim, rateio, DRE, margem, metas e transformação de exportações podem ser testados sem depender de banco ou dados fictícios.

## 5. Modelo financeiro que deve ser preservado

O núcleo financeiro deve manter a separação entre competência e caixa. `financial_transactions` representa lançamentos reais, com tipo de entrada ou saída, status, data de ocorrência e mês de competência. Contratos e licenças determinam MRR e unidades ativas. `infrastructure_allocations` registra o resultado do rateio, permitindo auditoria do custo por produto, cliente e licença. `financial_invoices` registra o vínculo documental entre uma nota fiscal e um lançamento.

Ao migrar para Firestore, não coloque todos os dados em um único documento. Use coleções separadas, IDs estáveis e registros de auditoria. Uma estrutura inicial é:

```text
saasProducts/{productId}
customers/{customerId}
plans/{planId}
contracts/{contractId}
licenses/{licenseId}
transactions/{transactionId}
infrastructureAllocations/{allocationId}
financialGoals/{goalId}
invoices/{invoiceId}
users/{userId}
```

Cada transação deve conter `productId`, `customerId`, `contractId`, `type`, `category`, `amount`, `occurredAt`, `competenceMonth`, `status`, `source` e `createdBy`. Valores monetários devem ser armazenados em centavos inteiros ou em representação decimal controlada; não use ponto flutuante para persistir dinheiro.

## 6. Criar um projeto Firebase

Acesse o [Firebase Console](https://console.firebase.google.com/), crie um projeto para desenvolvimento e habilite Authentication, Cloud Firestore e Cloud Storage. Para ambientes separados, use projetos distintos para desenvolvimento, homologação e produção.

Na Firebase CLI:

```bash
firebase login
firebase projects:list
firebase use --add
firebase init firestore
firebase init storage
firebase init emulators
```

Ao inicializar os emuladores, habilite Authentication, Firestore e Storage. Um arquivo `firebase.json` pode conter:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true, "port": 4000 }
  }
}
```

Inicie o ambiente local com:

```bash
firebase emulators:start --import=./.firebase-data --export-on-exit
```

Os emuladores permitem testar regras e operações sem escrever dados no projeto de produção [3].

## 7. Instalar e inicializar o Firebase Admin SDK no Node.js

No backend Node.js separado ou em uma camada de integração do servidor atual, instale:

```bash
pnpm add firebase-admin
```

Crie `server/firebase/admin.ts`:

```ts
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const app = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
});

export const firebaseAuth = getAuth(app);
export const firestore = getFirestore(app);
export const firebaseStorage = getStorage(app);
export { FieldValue };
```

Em produção, prefira credenciais de workload identity ou o mecanismo de credenciais recomendado pelo provedor. Em desenvolvimento local, a variável `GOOGLE_APPLICATION_CREDENTIALS` pode apontar para uma credencial restrita de desenvolvimento. Nunca commit um JSON de conta de serviço.

Para usar os emuladores, configure antes de inicializar o cliente:

```ts
if (process.env.FIRESTORE_EMULATOR_HOST) {
  firestore.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
}
```

## 8. Variáveis de ambiente Firebase

Use um arquivo `.env.example` sem segredos:

```dotenv
# Firebase Admin
FIREBASE_PROJECT_ID=seu-projeto-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@seu-projeto-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nREPLACE_ME\\n-----END PRIVATE KEY-----\\n"
FIREBASE_STORAGE_BUCKET=seu-projeto-dev.appspot.com

# Emuladores locais
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
STORAGE_EMULATOR_HOST=127.0.0.1:9199
```

A aplicação deve falhar explicitamente quando uma variável obrigatória estiver ausente. Não use valores vazios como fallback para credenciais.

## 9. Autenticação Firebase no backend

O cliente Firebase Authentication realiza o login e envia um ID token no cabeçalho `Authorization`. O backend valida o token com o Admin SDK. Um middleware Express de referência é:

```ts
import type { NextFunction, Request, Response } from "express";
import { firebaseAuth } from "./firebase/admin";

export async function processamento_requireFirebaseUser(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }

  try {
    const token = header.slice("Bearer ".length);
    const decoded = await firebaseAuth.verifyIdToken(token);
    res.locals.firebaseUser = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido ou expirado" });
  }
}
```

No Hub atual, o OAuth Manus continua sendo o mecanismo de autenticação ativo. A adoção do Firebase Authentication requer uma decisão de arquitetura: substituir o OAuth, oferecer Firebase como segundo provedor ou usar Firebase somente em um serviço de integração.

## 10. Repositório Firestore para transações

Um repositório Node.js deve encapsular a persistência e não espalhar chamadas Firestore pelo router:

```ts
import { firestore, FieldValue } from "./firebase/admin";

type TransactionInput = {
  productId?: number;
  customerId?: number;
  contractId?: number;
  type: "income" | "expense";
  category: string;
  description: string;
  amountCents: number;
  occurredAt: string;
  competenceMonth: string;
  status: "confirmed" | "pending" | "cancelled";
};

export async function processamento_createFirestoreTransaction(
  input: TransactionInput,
  actorId: string,
) {
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new Error("O valor deve estar em centavos inteiros positivos");
  }

  const ref = firestore.collection("transactions").doc();
  await ref.set({
    ...input,
    createdBy: actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

export async function processamento_listFirestoreTransactions(
  competenceMonth: string,
) {
  const snapshot = await firestore
    .collection("transactions")
    .where("competenceMonth", "==", competenceMonth)
    .orderBy("occurredAt", "desc")
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

Para consultas combinadas por produto, status e data, o Firestore pode solicitar índices compostos. Quando o console fornecer um link para criação de índice, revise o índice e registre-o em `firestore.indexes.json`.

## 11. Notas fiscais e Storage

Os metadados da nota devem permanecer em `invoices/{invoiceId}` e o arquivo XML/PDF, quando houver, deve ser armazenado no Cloud Storage. O documento deve conter `transactionId`, `number`, `series`, `issueDate`, `accessKey`, `status`, `storagePath`, `createdBy` e timestamps.

```ts
import { firebaseStorage, firestore, FieldValue } from "./firebase/admin";

export async function processamento_createFirestoreInvoice(input: {
  transactionId: string;
  number: string;
  issueDate: string;
  accessKey?: string;
  actorId: string;
}) {
  const existing = await firestore
    .collection("invoices")
    .where("transactionId", "==", input.transactionId)
    .limit(1)
    .get();
  if (!existing.empty) {
    throw new Error("Este lançamento já possui uma nota fiscal vinculada");
  }

  const ref = firestore.collection("invoices").doc();
  await ref.set({
    transactionId: input.transactionId,
    number: input.number,
    issueDate: input.issueDate,
    accessKey: input.accessKey ?? null,
    status: "issued",
    createdBy: input.actorId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}
```

Para upload de arquivo, valide tamanho, MIME type, extensão e autorização antes de gravar. O caminho recomendado é `invoices/{invoiceId}/{filename}`. Não exponha diretamente credenciais administrativas ao navegador.

## 12. Rateio e KPIs com Firebase

O rateio não deve ser implementado como uma sequência de gravações independentes. Use uma transação Firestore ou um processo idempotente com `allocationRunId`. Primeiro leia o lançamento elegível e as licenças ativas, calcule as parcelas em centavos, ajuste o restante na última parcela e grave as alocações com uma chave idempotente composta por lançamento, licença e competência.

O dashboard deve ler apenas registros confirmados. MRR deve vir de contratos ativos; receita recebida deve vir de entradas confirmadas; COGS deve vir de custos reais e alocações; runway depende de saldo de caixa e queima líquida. Quando não houver fatos financeiros, a interface deve exibir estado vazio, não zero fictício ou projeção automática.

## 13. API Express de referência

Uma API Firebase independente pode ser montada com Express:

```ts
import express from "express";
import { processamento_requireFirebaseUser } from "./auth-middleware";
import { processamento_createFirestoreTransaction } from "./repositories/transactions";

const app = express();
app.use(express.json());

app.post("/api/transactions", processamento_requireFirebaseUser, async (req, res) => {
  try {
    const user = res.locals.firebaseUser;
    const result = await processamento_createFirestoreTransaction(req.body, user.uid);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ message: error instanceof Error ? error.message : "Erro ao criar lançamento" });
  }
});

app.listen(process.env.PORT ?? 3000);
```

No projeto atual, prefira tRPC em vez de criar rotas REST paralelas. A mesma regra de autenticação e validação deve ser aplicada no procedimento tRPC, com Zod para validar o input.

## 14. Regras Firestore de referência

As regras são uma segunda camada de proteção; a autorização crítica deve permanecer no servidor. Um ponto de partida restritivo é:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Se o frontend acessar Firestore diretamente, substitua por regras específicas, valide `request.auth.uid`, restrinja campos modificáveis e impeça que o cliente altere `createdBy`, `status` financeiro ou valores já confirmados sem uma trilha de auditoria.

## 15. Testes locais com Firebase Emulator Suite

Inicie os emuladores e execute testes contra endereços locais:

```bash
firebase emulators:start --only auth,firestore,storage
pnpm test
```

Os testes devem cobrir criação de transação, rejeição de valores inválidos, autenticação sem token, isolamento por usuário, vínculo único de nota fiscal, desvinculação autorizada, rateio sem perda de centavos e cálculo de KPIs. Cada teste deve limpar a coleção ou usar um projeto/emulador isolado.

## 16. Migração do banco atual para Firebase

A migração deve ser faseada. Primeiro, mantenha MySQL/TiDB como fonte de verdade e exporte registros para um formato intermediário. Depois, carregue dados no Firestore preservando IDs de origem em campos como `legacyId`. Compare contagens, somas de receita, COGS, MRR e saldo por competência. Somente após a reconciliação habilite leitura dupla ou escrita dupla controlada.

| Fase | Fonte de verdade | Objetivo |
|---|---|---|
| Atual | MySQL/TiDB | Operação normal do Hub |
| Preparação | MySQL/TiDB + Firestore de desenvolvimento | Validar conversão e regras |
| Espelho | MySQL/TiDB com cópia assíncrona | Comparar resultados sem afetar produção |
| Corte | Firebase ou MySQL/TiDB, decisão formal | Operar uma única fonte de verdade |

Não execute uma migração destrutiva apenas para testar Firebase. O banco atual contém dados financeiros e deve ser preservado até a reconciliação final.

## 17. Checklist de execução

| Verificação | Comando ou ação |
|---|---|
| Dependências | `pnpm install` |
| TypeScript | `pnpm exec tsc --noEmit` |
| Testes | `pnpm test` |
| Build | `pnpm run build` |
| Banco atual | Revisar `drizzle/schema.ts` e migrações |
| Firebase local | `firebase emulators:start` |
| Segredos | Conferir `.env` fora do Git |
| Autorização | Testar token ausente, inválido e válido |
| Financeiro | Conferir caixa, DRE, MRR, COGS e rateio |
| Documentos | Conferir vínculo único de nota fiscal |

## 18. Decisão recomendada

Para a próxima etapa, a recomendação é manter o backend atual como fonte oficial e usar Firebase inicialmente em um ambiente de prova de conceito, com Authentication, Emulator Suite e uma coleção de espelho. Isso reduz o risco de misturar uma migração de banco com mudanças funcionais no núcleo financeiro. A substituição definitiva deve ocorrer somente depois de reconciliação contábil e de uma decisão explícita sobre autenticação, armazenamento e modelo de autorização.

## Referências

[1]: https://firebase.google.com/docs/reference/admin "Firebase Admin SDK Reference"

[2]: https://firebase.google.com/docs/auth/admin "Firebase Authentication — Admin SDK"

[3]: https://firebase.google.com/docs/emulator-suite "Firebase Local Emulator Suite"

[4]: https://firebase.google.com/docs/firestore "Cloud Firestore Documentation"

[5]: https://firebase.google.com/docs/storage "Cloud Storage for Firebase Documentation"

## 19. Revisão humana e validação de CNPJ

Após o upload de um PDF fiscal, a aplicação solicita uma extração estruturada por IA. O resultado é persistido como sugestão nos campos `extracted*` e não altera automaticamente o lançamento financeiro. O usuário deve abrir **Revisar sugestão**, editar valor, data, fornecedor e documentos no formulário modal e salvar explicitamente a revisão.

O CNPJ do emissor é validado no frontend e no backend por meio dos 14 dígitos e dos dois dígitos verificadores do algoritmo oficial de CNPJ. A máscara visual é aceita, mas caracteres não numéricos são ignorados na validação. CNPJs com todos os dígitos repetidos, quantidade incorreta de dígitos ou dígitos verificadores inválidos são bloqueados, exibindo alerta visual e impedindo o salvamento da revisão.

A validação automática é uma verificação de consistência, não uma consulta de existência cadastral. Para confirmar situação cadastral, razão social ou autorização fiscal, implemente posteriormente uma integração oficial ou licenciada, mantendo a resposta externa separada da sugestão extraída pela IA.

### Fluxo recomendado de revisão

1. Anexe um PDF fiscal válido a uma nota vinculada.
2. Aguarde o status **Sugestão pronta** ou verifique o status **Falhou**.
3. Abra **Revisar sugestão** e confira todos os campos.
4. Corrija o CNPJ caso o alerta visual seja exibido.
5. Salve somente depois de conferir a origem do documento e os valores.
6. Trate o status **Revisada** como confirmação operacional do usuário, não como autenticação fiscal externa.

No ambiente Firebase, mantenha o PDF no Cloud Storage com regras privadas e grave no Firestore apenas metadados, estado da extração e campos sugeridos. A chamada ao modelo deve ocorrer no backend Node.js usando credenciais de servidor; nunca exponha chaves administrativas no cliente.
