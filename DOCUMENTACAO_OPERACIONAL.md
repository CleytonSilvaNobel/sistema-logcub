# Documentação Operacional - LogCub (Versão Beta)

## 1. Objetivo do Processo
O LogCub tem como objetivo o dimensionamento preciso de produtos e a simulação de ocupação de cargas, permitindo uma análise técnica volumétrica e por paletização.

## 2. Quando Usar
- Para cadastrar novos produtos e suas dimensões físicas.
- Para realizar simulações de pedidos e verificar a ocupação em m³.
- Para validar a consistência entre o m³ do volume e o m³/pacote do palete.

## 3. Passo a Passo

### Cadastro de Produtos e Paletização
1. Acesse a aba **Cadastros > Produtos**.
2. Clique em **Novo Produto**.
3. Preencha: Nome, SKU, Dimensões Individuais (C, L, A) e **Dados de Paletização** (Comprimento, Largura, Altura do Palete e Qtd de Pacotes).
4. O sistema calculará o m³ individual e o m³ por pacote no palete para comparação.

### Simulação de Carga
1. Vá para **Movimentações > Simulação**.
2. Selecione o modo: **Volume Individual** ou **Carga Paletizada**.
3. Adicione os produtos e as quantidades.
4. O sistema apresentará o m³ total ocupado e um alerta caso as dimensões de cadastro estejam inconsistentes.

### Assistente IA
1. Clique no ícone de chat no canto inferior direito.
2. Pergunte sobre estoque, ocupação ou recomendações de simulação.
3. Use para diagnósticos rápidos de volumetria.

## 4. Responsáveis
- **Administradores:** Gestão de usuários e parâmetros de tolerância.
- **Engenharia/Logística:** Cadastro técnico de produtos e simulações.

## 5. Entradas e Saídas
- **Entradas:** Dimensões (mm), pesos (kg), quantidades.
- **Saídas:** Relatórios de cubagem, simulação de carga, alertas de inconsistência.

## 6. Pontos de Atenção / Erros Comuns
- **Unidades de Medida:** Certifique-se de usar milímetros (mm) para dimensões.
- **Inconsistência de Cadastro:** Alerta disparado quando o m³ do volume vs m³ do palete/pacote diverge acima da tolerância permitida.

## 7. Controle de Versões
- **Versão Beta (Atual):** Primeira versão estável com suporte a paletização e simulação avançada.
