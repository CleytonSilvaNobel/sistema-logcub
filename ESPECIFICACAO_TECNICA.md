# Especificação Técnica - LogCub (Versão Beta)

## 1. Visão Geral
**Objetivo Técnico:** Sistema de dimensionamento volumétrico e simulação de carga.
**Requisitos:** Cálculo de m³, gestão de pesos, simulação de paletização e IA.
**Escopo:** Validar a cubagem de produtos e otimizar o carregamento de veículos.

## 2. Arquitetura
- **Frontend:** SPA baseada em Vanilla JS (ES6+).
- **Armazenamento:** `localStorage` para persistência local rápida e offline.
- **Módulo de Cálculo:** Lógica de volumetria encapsulada em `app.js`.

## 3. Tecnologias
- **Linguagens:** HTML5, CSS3, JavaScript.
- **IA:** Google Gemini (SDK v1/v2 compatível) via API Key.
- **Layout:** CSS Flexbox e Grid para responsividade.

## 4. Estrutura de Dados
- **Products:** `id, sku, nome, comp, larg, alt, peso, pallet_comp, pallet_larg, pallet_alt, pallet_qtd_pacotes`.
- **Parameters:** `tolerancia_paletizacao` (padrão 5%).
- **Users/Groups:** Controle de acesso por perfil (ADM/Normal).

## 5. Regras de Negócio
- **Cálculo de m³:** `(Comprimento * Largura * Altura) / 1.000.000.000` (quando em mm).
- **Consistência de Palete:** Verifica se o `m³ do volume individual * Qtd Pacotes` é próximo ao `m³ da carga no palete`.
- **Modo Simulação:** Permite alternar entre volumetria unitária e paletizada.

## 6. Integrações
- **Gemini API:** Processamento de linguagem natural para análise de dados do inventário.
- **Exportação:** CSV/Excel para base de dados.

## 7. Segurança
- **Persistência Local:** Dados restritos ao navegador do usuário.
- **Perfis:** Restrição de acesso ao menu de Configurações e IA por perfil.

## 8. Deploy
- **PWA:** Pode ser instalado como aplicativo desktop/mobile através do navegador.
- **Arquivos:** Contém `index.html`, `js/`, `css/` e `img/`.

## 9. Manutenção
- **Backup:** Exportação manual (JSON) na tela de Gestão.
- **Suporte:** Logs de erro capturados no console do navegador.

## 10. Controle de Versões
- **Versão Beta:** Primeira entrega com suporte completo a métricas de paletização.
