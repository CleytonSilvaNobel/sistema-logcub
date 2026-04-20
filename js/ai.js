/**
 * AIModule - Intelligent Assistant for LogCub
 * Uses Google Gemini API for data analysis and Q&A
 */

const AIModule = (() => {
    let isOpen = false;
    let messages = [];

    const getApiKey = () => state.parameters.gemini_api_key || '';

    const generateContext = () => {
        const activeProducts = state.products.filter(p => p.ativo !== false);
        const count = activeProducts.length;
        
        // Take a representative sample of up to 30 products to stay within token limits
        const sample = activeProducts.slice(0, 30).map(p => {
            const density = p.volume_m3_calc > 0 ? (p.peso_medio_calc / p.volume_m3_calc).toFixed(2) : 0;
            return `[Cód:${p.codigo}|Cli:${p.cliente}||Dens:${density}kg/m³||Desc:${p.descricao}]`;
        }).join('\n');

        const today = new Date().toISOString().split('T')[0];

        return `
        DATA ATUAL DO SISTEMA: ${today}
        Configuração Atual: Fator=${state.parameters.fator_kg_m3}kg/m³
        Total de Produtos Ativos: ${count}
        Amostra da Base:
        ${sample || 'Nenhum produto cadastrado.'}
        `;
    };

    const renderMessages = () => {
        const container = document.getElementById('ai-chat-messages');
        if (!container) return;
        
        container.innerHTML = messages.map(msg => `
            <div class="chat-msg ${msg.role}">
                <div class="msg-bubble">
                    ${msg.content.replace(/\n/g, '<br>')}
                </div>
            </div>
        `).join('');
        
        container.scrollTop = container.scrollHeight;
    };

    const addMessage = (role, content) => {
        messages.push({ role, content });
        renderMessages();
        // Limit history to 20 messages to keep UI light
        if (messages.length > 20) messages.shift();
    };

    const callAPI = async (prompt) => {
        const key = getApiKey();
        const model = state.parameters.gemini_model || 'gemini-2.0-flash';
        
        if (!key) {
            return "Ops! A **Chave de API do Gemini** não está configurada. Peça ao administrador para inseri-la em **Gestão > Integrações**.";
        }

        if (!navigator.onLine) {
            return "Desculpe, você parece estar **offline**. Conecte-se à internet para usar o assistente de IA.";
        }

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 4096,
                    }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            console.error('AI Error:', err);
            return `Erro ao falar com a IA: ${err.message}. Verifique sua conexão e a validade da chave de API.`;
        }
    };

    return {
        toggle: () => {
            isOpen = !isOpen;
            const windowEl = document.getElementById('ai-chat-window');
            windowEl.classList.toggle('active', isOpen);
            
            if (isOpen && messages.length === 0) {
                addMessage('assistant', 'Olá! Sou seu Assistente LogCub. Posso responder dúvidas sobre cubagem, analisar sua base de produtos ou sugerir melhorias de densidade. Como posso ajudar?');
            }
        },

        sendMessage: async () => {
            const input = document.getElementById('ai-chat-input');
            const text = input.value.trim();
            if (!text) return;

            input.value = '';
            addMessage('user', text);
            
            // Show typing indicator
            const typingId = 'typing-' + Date.now();
            const container = document.getElementById('ai-chat-messages');
            container.innerHTML += `<div class="chat-msg assistant typing" id="${typingId}"><div class="msg-bubble">...</div></div>`;
            container.scrollTop = container.scrollHeight;

            const context = generateContext();
            const fullPrompt = `
                Você é o Assistente LogCub, especialista em cubagem rodoviária e logística da empresa NobelPack.
                Sua principal característica é ser EXTREMAMENTE OBJETIVO E DIRETO.
                NUNCA use introduções como "Como assistente logístico..." ou "Com certeza!". 
                Vá direto ao ponto, use listas (tópicos) e seja o mais breve possível.
                REGRAS:
                - Use termos técnicos corretamente (densidade, fator de cubagem, peso bruto vs cubado).
                - Seja conciso (máximo 3-4 frases por resposta).
                - Analise o contexto abaixo se necessário.
                
                CONTEXTO ATUAL:
                ${context}
                
                PERGUNTA: ${text}
            `;

            const response = await callAPI(fullPrompt);
            
            // Remove typing indicator and add response
            const typingEl = document.getElementById(typingId);
            if (typingEl) typingEl.remove();
            
            addMessage('assistant', response);
        },

        analyzeBase: async () => {
            if (!isOpen) AIModule.toggle();
            addMessage('user', 'Efetue uma análise de desempenho da minha base atual.');
            
            const context = generateContext();
            const analysisPrompt = `
                Com base na amostra da base de dados abaixo, identifique 3 a 5 oportunidades de melhoria.
                Foque em:
                1. Produtos com densidade muito baixa (abaixo de 150kg/m³).
                2. Possíveis erros de digitação (densidades extremas).
                3. Sugestões de revisão física de embalagens (se houver menção de 'Saco' ou 'Bag' na descrição, sugira padronização se a densidade for ruim).
                
                Apresente em formato de tópicos claros.
                
                DADOS:
                ${context}
            `;
            
            const response = await callAPI(analysisPrompt);
            addMessage('assistant', response);
        },

        listAvailableModels: async () => {
            const key = getApiKey();
            if (!key) {
                renderToast('Configure a chave de API primeiro.', 'error');
                return;
            }
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
                
                const modelList = data.models
                    .filter(m => m.supportedGenerationMethods.includes('generateContent'))
                    .map(m => m.name.replace('models/', ''))
                    .join('\n');
                
                alert(`Modelos disponíveis para sua chave:\n\n${modelList}\n\nCopie um destes nomes e cole no campo 'Modelo de IA' se necessário.`);
            } catch (err) {
                console.error(err);
                renderToast('Erro ao listar modelos: ' + err.message, 'error');
            }
        }
    };
})();
