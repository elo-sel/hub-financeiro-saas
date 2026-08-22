# Project TODO

- [x] Definir e aplicar modelo de dados para produtos SaaS, clientes, planos, contratos, licenças, transações, despesas, provedores, centros de custo, metas e saldos bancários
- [x] Cadastrar os produtos suportados: Solar Manager, Elo Pay, Elo CRM e Grupo Elo como consolidador
- [x] Implementar central de lançamentos reais para receitas recebidas, mensalidades, custos de infraestrutura, despesas operacionais, saldos bancários e metas
- [x] Implementar histórico de transações com filtros por produto, tipo, categoria, provedor e período
- [x] Implementar cadastro e gestão de clientes, planos, contratos e licenças
- [x] Implementar cálculo de MRR individual e consolidado a partir de contratos e lançamentos reais
- [x] Implementar cálculo de receita recebida e margem bruta com COGS real
- [x] Implementar cadastro de provedores GCP, AWS, Azure, Cloudflare, APIs e outros
- [x] Implementar centros de custo e categorização de despesas
- [x] Implementar rateio automatizado de infraestrutura compartilhada por número de licenças ativas
- [x] Implementar suporte a custo fixo compartilhado e custo direto por cliente
- [x] Implementar margem de contribuição por contrato/licença
- [x] Implementar KPIs executivos reais: MRR total, receita recebida, margem bruta, Net Burn Rate e Runway
- [x] Implementar cockpit de metas Q1, Q2, Q3 e Q4 para novos clientes e MRR
- [x] Implementar comparação entre projeção configurada e entrega real, com percentual de atingimento
- [x] Implementar DRE gerencial mensal, trimestral e anual com impostos configuráveis, COGS real, OpEx e EBITDA
- [x] Implementar seletor de visão individual por SaaS e visão consolidada do Grupo Elo
- [x] Garantir ausência de dados fictícios, mocks financeiros ou estimativas automáticas não configuradas pelo usuário
- [x] Criar testes Vitest para cálculos de rateio, KPIs, metas, DRE e permissões
- [x] Validar fluxos de lançamento, filtros, estados vazios, responsividade e acessibilidade
- [x] Capturar screenshots da interface para verificação visual
- [x] Ler este arquivo e confirmar todos os itens concluídos antes do checkpoint final

- [x] Cadastrar Grupo Elo como entidade persistida do catálogo ou modelar explicitamente a visão consolidada no banco
- [x] Adicionar fluxos para saldo bancário, clientes, contratos, licenças e lançamentos de mensalidades
- [x] Adicionar filtros de categoria e provedor no histórico e suportá-los no backend
- [x] Aplicar sharedBaseMonthlyCost no motor de rateio e permitir lançamento direto vinculado a cliente/contrato
- [x] Criar testes Vitest cobrindo metas e DRE gerencial
- [x] Validar manualmente no navegador os fluxos de criação de lançamento, cliente, conta bancária e meta, incluindo sucesso e erro
- [x] Executar revisão explícita de acessibilidade: teclado, foco visível, labels, mensagens de erro, contraste e responsividade
- [x] Validar a versão por testes, typecheck, inspeção visual e estados vazios sem usar login Google ou inserir dados fictícios
- [x] Manter a autenticação OAuth como requisito de produção para operações protegidas
- [x] Implementar cadastro e gestão de planos, com edição e status operacional
- [x] Adicionar CRUD ou cadastro explícito de provedores na interface e no backend
- [x] Criar fluxo de mensalidade vinculado a contrato e cliente na central de lançamentos
- [x] Adicionar campos de cliente e contrato ao formulário de lançamentos e propagar os vínculos ao rateio

- [x] Implementar CRUD completo de produtos SaaS, incluindo criação, edição, status e custo base compartilhado
- [x] Implementar CRUD completo de planos, com produto, preço, ciclo de cobrança e status
- [x] Implementar CRUD completo de provedores de infraestrutura, incluindo GCP, AWS, Azure, Cloudflare e APIs
- [x] Implementar DRE temporal mensal, trimestral e anual com dados reais
- [x] Implementar cálculo detalhado de margem de contribuição por contrato
- [x] Adicionar gráfico interativo de rateio de infraestrutura por produto/cliente
- [x] Adicionar gráfico interativo de evolução das metas financeiras e atingimento
- [x] Validar os novos fluxos com testes Vitest, typecheck e screenshots responsivos

- [x] Implementar consulta temporal de DRE mensal, trimestral e anual baseada em lançamentos reais
- [x] Implementar cálculo detalhado de margem de contribuição por contrato, incluindo receita e COGS rateado/direto
- [x] Implementar gráfico interativo de rateio de infraestrutura por produto e cliente
- [x] Implementar gráfico interativo de evolução das metas financeiras com projeção configurada versus realizado
- [x] Validar os novos relatórios e gráficos com Vitest, typecheck e screenshots responsivos

- [x] Corrigir a agregação temporal real da DRE com modo mensal, trimestral e anual, controles de UI e impostos configuráveis
- [x] Corrigir a margem por contrato para filtrar alocações por período e atribuir COGS rateado ao contrato correto
- [x] Expor produto e cliente explicitamente no detalhamento visual do rateio, com interação verificável
- [x] Calcular o realizado de metas por contratos e lançamentos reais por trimestre, sem valores fixos
- [x] Adicionar testes específicos dos novos endpoints/transformações e screenshots desktop e mobile dos relatórios

- [x] Exportar DRE temporal filtrada para CSV
- [x] Exportar DRE temporal filtrada para PDF
- [x] Exportar relatório de margem por contrato para CSV
- [x] Exportar relatório de margem por contrato para PDF
- [x] Validar nomes, conteúdo, downloads e responsividade dos controles de exportação

- [x] Criar widget dos 5 clientes mais lucrativos e dos 5 com menor margem, com agregação sem duplicidade por cliente
- [x] Implementar alternância persistente entre tema claro e escuro
- [x] Criar entidade e seção de notas fiscais vinculáveis a lançamentos
- [x] Adicionar fluxo para vincular e desvincular nota fiscal de lançamento
- [x] Validar dados, tema, vínculos e responsividade com typecheck, 11 testes e screenshots desktop/mobile

- [x] Criar guia técnico completo de execução local, arquitetura atual e backend Node.js com Firebase

- [x] Implementar upload seguro de PDF de nota fiscal para o storage
- [x] Persistir metadados e caminho do PDF no vínculo da nota fiscal
- [x] Adicionar botão de visualização rápida do PDF com URL temporária autorizada
- [x] Validar MIME type, extensão, tamanho, permissões e erros do upload
- [x] Criar testes Vitest específicos para validação do PDF fiscal, assinatura `%PDF`, limite, MIME e extensão
- [x] Verificar repositório GitHub de destino e enviar o projeto atualizado, incluindo a versão com upload de PDF

- [x] Extrair valor, data, CNPJ e fornecedor/cliente do PDF por IA após upload
- [x] Persistir resultado da extração como sugestão revisável, sem sobrescrever automaticamente dados financeiros
- [x] Adicionar filtros avançados de notas fiscais por período, status de pagamento e fornecedor/cliente
- [x] Criar indicador do mês atual para lançamentos sem nota fiscal anexada
- [x] Criar testes para validação da extração, filtros, contagem de pendências e parser estruturado
- [x] Atualizar o repositório privado no GitHub com a nova versão

- [x] Implementar fluxo explícito de revisão das sugestões da IA, com edição/aprovação e status revisado
- [x] Corrigir o indicador para usar exatamente o conjunto de entradas confirmadas do período selecionado e percentual consistente
- [x] Adicionar testes de sucesso e falha da normalização do pipeline de extração fiscal por IA e persistência dos campos sugeridos
