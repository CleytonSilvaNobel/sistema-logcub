/**
 * LogCub - Cubagem Rodoviária
 * Unified Logic for manual and file operations
 */

// --- CALCULATIONS ---
const CR_CALC = {
    calcVolumeM3: (comprimento, largura, altura) => {
        if (!comprimento || !largura || !altura) return 0;
        return (comprimento * largura * altura) / 1000000;
    },
    calcPesoMedio: (pesos) => {
        const validPesos = pesos.filter(p => p !== null && p !== undefined && p !== '' && !isNaN(p) && p > 0);
        if (validPesos.length === 0) return null;
        let sorted = [...validPesos].sort((a, b) => a - b);
        if (sorted.length >= 5) {
            sorted = sorted.slice(1, sorted.length - 1);
        }
        const sum = sorted.reduce((acc, val) => acc + val, 0);
        return sum / sorted.length;
    },
    calcDensidade: (pesoMedio, volumeM3) => {
        if (!pesoMedio || !volumeM3 || volumeM3 <= 0) return null;
        return pesoMedio / volumeM3;
    },
    calcPesoCubado: (volumeM3, fator) => {
        if (volumeM3 === null || volumeM3 === undefined) return 0;
        return volumeM3 * (fator || 300);
    },
    formatValue: (value, decimals = 2) => {
        if (value === null || value === undefined) return '-';
        return Number(value).toLocaleString('pt-BR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },
    checkPalletConsistency: (product, tolerance = 5) => {
        if (!product.pallet_comprimento || !product.pallet_largura || !product.pallet_altura || !product.pallet_qtd_pacotes) {
            return { status: 'incompleto', delta: 0 };
        }
        const m3PalletTotal = (product.pallet_comprimento * product.pallet_largura * product.pallet_altura) / 1000000;
        const m3PalletUnit = m3PalletTotal / product.pallet_qtd_pacotes;
        const volNominal = product.volume_m3_calc;
        
        if (!volNominal || volNominal <= 0) return { status: 'incompleto', delta: 0 };
        
        const delta = Math.abs((m3PalletUnit - volNominal) / volNominal) * 100;
        if (delta <= (tolerance || 5)) return { status: 'coerente', delta };
        return { status: 'inconsistente', delta };
    }
};

// --- STATE MANAGEMENT ---
const STORAGE_KEYS = {
    PRODUCTS: 'cr_products',
    PARAMETERS: 'cr_parameters',
    SIMULATIONS: 'cr_simulations',
    USERS: 'cr_users',
    SESSION: 'cr_session',
    THEME: 'cr_theme'
};

const DEFAULT_PARAMETERS = {
    fator_kg_m3: 300,
    decimais_volume: 6,
    decimais_peso: 2,
    tolerancia_paletizacao: 5,
    gemini_api_key: '',
    gemini_model: 'gemini-2.0-flash',
    brand_app_name: 'LogCub',
    brand_company_name: 'NobelPack',
    brand_logo_url: ''
};

const state = {
    products: (() => {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
        let migrated = false;
        const updated = stored.map(p => {
            let changed = false;
            if (p.ativo === undefined) {
                p.ativo = true;
                changed = true;
            }
            if (!p.criado_por || p.criado_por === 'Sistema') {
                p.criado_por = 'Cleyton';
                changed = true;
            }
            if (changed) migrated = true;
            return p;
        });
        if (migrated) {
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));
        }
        return updated;
    })(),
    parameters: JSON.parse(localStorage.getItem(STORAGE_KEYS.PARAMETERS) || JSON.stringify(DEFAULT_PARAMETERS)),
    simulations: JSON.parse(localStorage.getItem(STORAGE_KEYS.SIMULATIONS) || '[]'),
    users: (() => {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
        const defaults = [
            { id: '1', username: 'adm', password: 'Senha123', roles: ['adm'], name: 'Administrador' },
            { id: '2', username: 'supervisor', password: 'Senha123', roles: ['supervisor'], name: 'Supervisor' },
            { id: '3', username: 'operador', password: 'Senha123', roles: ['operador'], name: 'Operador' },
            { id: '4', username: 'visitante', password: 'Senha123', roles: ['visitante'], name: 'Visitante' }
        ];

        if (stored.length === 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaults));
            return defaults;
        }

        // Migration: Ensure 'visitante' user exists in existing bases
        if (!stored.find(u => u.username === 'visitante')) {
            stored.push(defaults[3]);
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(stored));
        }
        return stored;
    })(),

    theme: (() => {
        const stored = localStorage.getItem(STORAGE_KEYS.THEME) || 'dark';
        document.body.className = `${stored}-theme`;
        return stored;
    })(),
    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEYS.THEME, this.theme);
        document.body.className = `${this.theme}-theme`;
        this.notify();
    },
    currentUser: JSON.parse(sessionStorage.getItem(STORAGE_KEYS.SESSION) || localStorage.getItem(STORAGE_KEYS.SESSION) || 'null'),
    listeners: [],
    subscribe(callback) { this.listeners.push(callback); },
    notify() { this.listeners.forEach(callback => callback()); },
    persist(key, data, persistent = true) { 
        const json = JSON.stringify(data);
        if (persistent) localStorage.setItem(key, json);
        else sessionStorage.setItem(key, json);
        this.notify(); 
    },
    
    login: (username, password, remember = false) => {
        // Função original de login substituída pelo Firebase Auth
        return false;
    },
    logout() {
        if (typeof firebase !== 'undefined') {
            firebase.auth().signOut().then(() => {
                location.reload();
            });
        } else {
            this.currentUser = null;
            localStorage.removeItem(STORAGE_KEYS.SESSION);
            sessionStorage.removeItem(STORAGE_KEYS.SESSION);
            location.reload();
        }
    },
    changePassword(oldPass, newPass) {
        if (this.currentUser.password !== oldPass) return { success: false, message: 'Senha atual incorreta.' };
        const user = this.users.find(u => u.id === this.currentUser.id);
        user.password = newPass;
        this.currentUser.password = newPass;
        this.persist(STORAGE_KEYS.USERS, this.users);
        const storedSession = localStorage.getItem(STORAGE_KEYS.SESSION) ? localStorage : sessionStorage;
        storedSession.setItem(STORAGE_KEYS.SESSION, JSON.stringify(this.currentUser));
        return { success: true };
    },
    hasRole(role) {
        return this.currentUser && this.currentUser.roles.includes(role);
    },
    can(action) {
        if (!this.currentUser) return false;
        if (this.hasRole('adm')) return true;
        const roles = this.currentUser.roles;
        const isVisitante = roles.includes('visitante');
        
        switch(action) {
            case 'manage_users': return roles.includes('adm');
            case 'delete_product':
            case 'import_data':
            case 'inactivate_product': return (roles.includes('supervisor') || roles.includes('adm')) && !isVisitante;
            case 'add_product': 
            case 'edit_product': return !isVisitante;
            case 'view_dashboard': 
            case 'view_results':
            case 'view_simulation': return true;
            case 'sync_cloud': return !isVisitante;
            default: return false;
        }
    },
    saveProduct(product) {
        const index = this.products.findIndex(p => p.id === product.id || p.codigo === product.codigo);
        if (index >= 0) {
            this.products[index] = { 
                ...this.products[index], 
                ...product, 
                ativo: product.ativo !== undefined ? product.ativo : (this.products[index].ativo !== undefined ? this.products[index].ativo : true),
                updated_at: new Date().toISOString(),
                alterado_por: state.currentUser ? state.currentUser.name : (this.products[index].criado_por || 'Cleyton')
            };
        } else {
            product.id = crypto.randomUUID();
            product.ativo = product.ativo !== undefined ? product.ativo : true;
            product.created_at = new Date().toISOString();
            product.updated_at = product.created_at;
            product.criado_por = state.currentUser ? state.currentUser.name : 'Cleyton';
            this.products.push(product);
        }
        this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    },
    toggleProductStatus(id) {
        const index = this.products.findIndex(p => p.id === id);
        if (index >= 0) {
            this.products[index].ativo = !this.products[index].ativo;
            this.products[index].updated_at = new Date().toISOString();
            this.persist(STORAGE_KEYS.PRODUCTS, this.products);
        }
    },
    deleteProduct(id) {
        this.products = this.products.filter(p => p.id !== id);
        this.persist(STORAGE_KEYS.PRODUCTS, this.products);
    },
    saveParameters(params) {
        this.parameters = { ...this.parameters, ...params };
        this.persist(STORAGE_KEYS.PARAMETERS, this.parameters);
    },
    persist(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
        if (window.FirebaseDB) window.FirebaseDB.syncSave();
        this.notify();
        this.updateBranding();
    },
    updateBranding() {
        const p = this.parameters || DEFAULT_PARAMETERS;
        const appNameEl = document.getElementById('cub-app-name');
        const companyNameEl = document.getElementById('cub-company-name');
        const logoEl = document.querySelector('.logo .logo-icon');

        if (appNameEl) appNameEl.textContent = p.brand_app_name || 'LogCub';
        if (companyNameEl) companyNameEl.textContent = p.brand_company_name || 'NobelPack';
        
        if (logoEl && p.brand_logo_url) {
            if (logoEl.tagName === 'I') {
                const img = document.createElement('img');
                img.src = p.brand_logo_url;
                img.className = 'logo-icon';
                img.style.width = '32px';
                img.style.height = '32px';
                img.style.objectFit = 'contain';
                logoEl.parentNode.replaceChild(img, logoEl);
            } else if (logoEl.tagName === 'IMG') {
                logoEl.src = p.brand_logo_url;
            }
        } else if (logoEl && !p.brand_logo_url && logoEl.tagName === 'IMG') {
            const icon = document.createElement('i');
            icon.setAttribute('data-lucide', 'truck');
            icon.className = 'logo-icon';
            logoEl.parentNode.replaceChild(icon, logoEl);
            if (window.lucide) window.lucide.createIcons();
        }
    }
};

// --- UI HELPERS ---
const renderToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} fade-in`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const clearContent = () => {
    const main = document.getElementById('tab-content');
    main.innerHTML = '';
};

// --- TAB RENDERING ---
const renderProductList = (filter = '') => {
    const container = document.getElementById('product-list');
    const filtered = state.products
        .filter(p => 
            p.codigo.toLowerCase().includes(filter.toLowerCase()) || 
            p.descricao.toLowerCase().includes(filter.toLowerCase()) ||
            (p.cliente && p.cliente.toLowerCase().includes(filter.toLowerCase()))
        )
        .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { sensitivity: 'base' }));

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align: center; padding: 3rem; color: var(--text-secondary);">Nenhum produto encontrado.</p>`;
        return;
    }

    container.innerHTML = `
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Consist.</th>
                        <th>Código</th>
                        <th>Descrição</th>
                        <th>Cliente</th>
                        <th>Dimensões (cm)</th>
                        <th>Peso Médio</th>
                        <th>Autor</th>
                        ${!state.isVisitante() ? '<th>Ações</th>' : ''}
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(p => `
                        <tr style="${p.ativo === false ? 'opacity: 0.5; background: rgba(0,0,0,0.1);' : ''}">
                            <td>
                                <span class="badge ${p.ativo !== false ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">
                                    ${p.ativo !== false ? 'Ativo' : 'Inativo'}
                                </span>
                            </td>
                            <td>
                                ${(() => {
                                    const c = CR_CALC.checkPalletConsistency(p, state.parameters.tolerancia_paletizacao);
                                    if (c.status === 'incompleto') return '<span class="badge" style="background:#6b7280; color:white; font-size:0.6rem;" title="Dados de paletização incompletos">Incompleto</span>';
                                    if (c.status === 'coerente') return `<span class="badge badge-success" style="font-size:0.6rem;" title="Variação: ${c.delta.toFixed(1)}%">Coerente</span>`;
                                    return `<span class="badge badge-danger" style="font-size:0.6rem;" title="Variação: ${c.delta.toFixed(1)}%">Inconsistente</span>`;
                                })()}
                            </td>
                            <td><strong>${p.codigo}</strong></td>
                            <td>${p.descricao}</td>
                            <td>${p.cliente || '-'}</td>
                            <td>${p.comprimento_cm}x${p.largura_cm}x${p.altura_cm}</td>
                            <td>${CR_CALC.formatValue(p.peso_medio_calc, state.parameters.decimais_peso)} kg</td>
                            <td style="font-size: 0.75rem; color: var(--text-secondary);">${p.criado_por || '-'}</td>
                            ${!state.isVisitante() ? `
                            <td style="display: flex; gap: 0.5rem;">
                                ${state.can('inactivate_product') ? `
                                <button class="btn btn-secondary toggle-status" data-id="${p.id}" title="${p.ativo ? 'Inativar' : 'Ativar'}" style="padding: 0.4rem;">
                                    <i data-lucide="${p.ativo ? 'eye-off' : 'eye'}"></i>
                                </button>
                                ` : ''}
                                <button class="btn btn-secondary edit-product" data-id="${p.id}" style="padding: 0.4rem;"><i data-lucide="edit-2"></i></button>
                                ${state.can('delete_product') ? `
                                <button class="btn btn-secondary delete-product" data-id="${p.id}" style="padding: 0.4rem; color: var(--danger);"><i data-lucide="trash"></i></button>
                                ` : ''}
                            </td>
                            ` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    lucide.createIcons();

    document.querySelectorAll('.toggle-status').forEach(btn => {
        btn.onclick = () => {
            state.toggleProductStatus(btn.dataset.id);
            renderProductList(document.getElementById('search-products').value);
        };
    });

    document.querySelectorAll('.edit-product').forEach(btn => {
        btn.addEventListener('click', () => openProductModal(state.products.find(p => p.id === btn.dataset.id)));
    });
    document.querySelectorAll('.delete-product').forEach(btn => {
        btn.addEventListener('click', () => {
            if(confirm('Tem certeza que deseja excluir este produto?')) {
                state.deleteProduct(btn.dataset.id);
                renderProductList(document.getElementById('search-products').value);
                renderToast('Produto excluído!');
            }
        });
    });
};

const openProductModal = (product = null) => {
    const container = document.getElementById('modal-container');
    const isEdit = !!product;
    
    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal fade-in">
                <div class="modal-header">
                    <h3>${isEdit ? 'Editar Produto' : 'Novo Produto'}</h3>
                    <button class="modal-close" id="close-modal"><i data-lucide="x"></i></button>
                </div>
                <form id="product-form">
                    <div class="grid-2">
                        <div class="form-group">
                            <label>Código*</label>
                            <input type="text" id="p-codigo" value="${product?.codigo || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Cliente*</label>
                            <input type="text" id="p-cliente" value="${product?.cliente || ''}" list="client-suggestions" required>
                            <datalist id="client-suggestions">
                                ${[...new Set(state.products.map(p => p.cliente).filter(Boolean))].map(c => `<option value="${c}">`).join('')}
                            </datalist>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Descrição*</label>
                        <input type="text" id="p-descricao" value="${product?.descricao || ''}" required>
                    </div>
                    <div class="grid-3">
                        <div class="form-group">
                            <label>Comprimento (cm)*</label>
                            <input type="number" id="p-comp" value="${product?.comprimento_cm || ''}" step="0.1" required>
                        </div>
                        <div class="form-group">
                            <label>Largura (cm)*</label>
                            <input type="number" id="p-larg" value="${product?.largura_cm || ''}" step="0.1" required>
                        </div>
                        <div class="form-group">
                            <label>Altura (cm)*</label>
                            <input type="number" id="p-alt" value="${product?.altura_cm || ''}" step="0.1" required>
                        </div>
                    </div>
                               <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                        <label style="font-size: 0.875rem; font-weight: 600; color: var(--accent); margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i data-lucide="package-check" style="width: 16px;"></i> Informe Dimensional da Carga (Palete)
                        </label>
                        <div class="grid-3">
                            <div class="form-group">
                                <label>C. Palete (cm)*</label>
                                <input type="number" id="p-pallet-comp" value="${product?.pallet_comprimento || ''}" step="0.1" required>
                            </div>
                            <div class="form-group">
                                <label>L. Palete (cm)*</label>
                                <input type="number" id="p-pallet-larg" value="${product?.pallet_largura || ''}" step="0.1" required>
                            </div>
                            <div class="form-group">
                                <label>A. Palete (cm)*</label>
                                <input type="number" id="p-pallet-alt" value="${product?.pallet_altura || ''}" step="0.1" required>
                            </div>
                        </div>
                        <div class="form-group" style="margin-top: 0.5rem;">
                            <label>Quantidade de Pacotes no Palete*</label>
                            <input type="number" id="p-pallet-qtd" value="${product?.pallet_qtd_pacotes || ''}" min="1" required>
                        </div>
                        <div id="pallet-feedback" style="font-size: 0.8rem; margin-top: 0.5rem; padding: 0.5rem; border-radius: 4px; display: none;"></div>
                    </div>

                    <label style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 1.5rem; margin-bottom: 0.5rem; display: block;">Peso por Amostra (kg)*</label>
                    <div class="grid-5">
                        <input type="number" id="p-peso1" placeholder="P1" value="${product?.peso1_kg || ''}" step="0.01">
                        <input type="number" id="p-peso2" placeholder="P2" value="${product?.peso2_kg || ''}" step="0.01">
                        <input type="number" id="p-peso3" placeholder="P3" value="${product?.peso3_kg || ''}" step="0.01">
                        <input type="number" id="p-peso4" placeholder="P4" value="${product?.peso4_kg || ''}" step="0.01">
                        <input type="number" id="p-peso5" placeholder="P5" value="${product?.peso5_kg || ''}" step="0.01">
                    </div>
                    <div class="calc-display">
                        <div class="calc-item"><label>m³:</label><span id="calc-vol">-</span></div>
                        <div class="calc-item"><label>Peso Médio:</label><span id="calc-peso">-</span></div>
                        <div class="calc-item"><label>Densidade:</label><span id="calc-dens">-</span></div>
                        <div class="calc-item"><label>Peso Cubado:</label><span id="calc-cubado">-</span></div>
                    </div>
                    <div style="margin-top: 2rem; display: flex; gap: 1rem;">
                        <button type="button" class="btn btn-secondary" id="cancel-modal" style="flex: 1; justify-content: center;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1; justify-content: center;">Salvar Produto</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    lucide.createIcons();

    const form = document.getElementById('product-form');
    const updateCalcs = () => {
        const comp = parseFloat(document.getElementById('p-comp').value) || 0;
        const larg = parseFloat(document.getElementById('p-larg').value) || 0;
        const alt = parseFloat(document.getElementById('p-alt').value) || 0;
        
        const pComp = parseFloat(document.getElementById('p-pallet-comp').value) || 0;
        const pLarg = parseFloat(document.getElementById('p-pallet-larg').value) || 0;
        const pAlt = parseFloat(document.getElementById('p-pallet-alt').value) || 0;
        const pQtd = parseFloat(document.getElementById('p-pallet-qtd').value) || 0;

        const pesos = [
            parseFloat(document.getElementById('p-peso1').value),
            parseFloat(document.getElementById('p-peso2').value),
            parseFloat(document.getElementById('p-peso3').value),
            parseFloat(document.getElementById('p-peso4').value),
            parseFloat(document.getElementById('p-peso5').value)
        ];
        
        const vol = CR_CALC.calcVolumeM3(comp, larg, alt);
        const medio = CR_CALC.calcPesoMedio(pesos);
        const dens = CR_CALC.calcDensidade(medio, vol);
        const cubado = CR_CALC.calcPesoCubado(vol, state.parameters.fator_kg_m3);
        
        document.getElementById('calc-vol').textContent = CR_CALC.formatValue(vol, state.parameters.decimais_volume) + ' m³';
        document.getElementById('calc-peso').textContent = CR_CALC.formatValue(medio, state.parameters.decimais_peso) + ' kg';
        document.getElementById('calc-dens').textContent = CR_CALC.formatValue(dens, 2) + ' kg/m³';
        document.getElementById('calc-cubado').textContent = CR_CALC.formatValue(cubado, state.parameters.decimais_peso) + ' kg';
        
        // Pallet consistency feedback
        const feedback = document.getElementById('pallet-feedback');
        if (pComp && pLarg && pAlt && pQtd && vol > 0) {
            const consistency = CR_CALC.checkPalletConsistency({
                pallet_comprimento: pComp, pallet_largura: pLarg, pallet_altura: pAlt, 
                pallet_qtd_pacotes: pQtd, volume_m3_calc: vol
            }, state.parameters.tolerancia_paletizacao);
            
            feedback.style.display = 'block';
            if (consistency.status === 'coerente') {
                feedback.style.background = 'rgba(34, 197, 94, 0.1)';
                feedback.style.color = '#22c55e';
                feedback.innerHTML = `<i data-lucide="check-circle" style="width:14px; vertical-align:middle;"></i> Dados Coerentes (Variação: ${consistency.delta.toFixed(2)}%)`;
            } else {
                feedback.style.background = 'rgba(239, 68, 68, 0.1)';
                feedback.style.color = '#ef4444';
                feedback.innerHTML = `<i data-lucide="alert-triangle" style="width:14px; vertical-align:middle;"></i> Inconsistência Detectada! (Variação: ${consistency.delta.toFixed(2)}%)`;
            }
            lucide.createIcons();
        } else {
            feedback.style.display = 'none';
        }

        return { vol, medio, dens, cubado };
    };

    form.querySelectorAll('input').forEach(input => input.addEventListener('input', updateCalcs));
    updateCalcs();
    const close = () => container.innerHTML = '';
    document.getElementById('close-modal').onclick = close;
    document.getElementById('cancel-modal').onclick = close;
    form.onsubmit = (e) => {
        e.preventDefault();
        const calcs = updateCalcs();
        const newProduct = {
            id: product?.id,
            ativo: document.getElementById('p-ativo').checked,
            codigo: document.getElementById('p-codigo').value,
            descricao: document.getElementById('p-descricao').value,
            cliente: document.getElementById('p-cliente').value,
            comprimento_cm: parseFloat(document.getElementById('p-comp').value),
            largura_cm: parseFloat(document.getElementById('p-larg').value),
            altura_cm: parseFloat(document.getElementById('p-alt').value),
            pallet_comprimento: parseFloat(document.getElementById('p-pallet-comp').value) || null,
            pallet_largura: parseFloat(document.getElementById('p-pallet-larg').value) || null,
            pallet_altura: parseFloat(document.getElementById('p-pallet-alt').value) || null,
            pallet_qtd_pacotes: parseFloat(document.getElementById('p-pallet-qtd').value) || null,
            peso1_kg: parseFloat(document.getElementById('p-peso1').value) || null,
            peso2_kg: parseFloat(document.getElementById('p-peso2').value) || null,
            peso3_kg: parseFloat(document.getElementById('p-peso3').value) || null,
            peso4_kg: parseFloat(document.getElementById('p-peso4').value) || null,
            peso5_kg: parseFloat(document.getElementById('p-peso5').value) || null,
            peso_medio_calc: calcs.medio,
            volume_m3_calc: calcs.vol
        };
        state.saveProduct(newProduct);
        renderProductList(document.getElementById('search-products').value);
        close();
        renderToast(isEdit ? 'Produto atualizado!' : 'Produto salvo!');
    };
};

const exportToExcel = () => {
    if (state.products.length === 0) { renderToast('Nenhum produto para exportar.', 'error'); return; }
    const data = state.products.map(p => ({
        'Status': p.ativo !== false ? 'Ativo' : 'Inativo',
        'Código': p.codigo, 
        'Descrição': p.descricao, 
        'Cliente': p.cliente || '',
        'Comprimento (cm)': p.comprimento_cm, 
        'Largura (cm)': p.largura_cm, 
        'Altura (cm)': p.altura_cm,
        'Peso 1': p.peso1_kg || '',
        'Peso 2': p.peso2_kg || '',
        'Peso 3': p.peso3_kg || '',
        'Peso 4': p.peso4_kg || '',
        'Peso 5': p.peso5_kg || '',
        'Peso Médio (kg)': p.peso_medio_calc, 
        'm³': p.volume_m3_calc,
        'Densidade (kg/m³)': CR_CALC.calcDensidade(p.peso_medio_calc, p.volume_m3_calc),
        'Comp. Palete (cm)': p.pallet_comprimento || '',
        'Larg. Palete (cm)': p.pallet_largura || '',
        'Alt. Palete (cm)': p.pallet_altura || '',
        'Qtd. Pacotes no Palete': p.pallet_qtd_pacotes || '',
        'Consistência': CR_CALC.checkPalletConsistency(p, state.parameters.tolerancia_paletizacao).status,
        'Autor': p.criado_por || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos_logcub.xlsx");
    renderToast('Exportação concluída!');
};

const importFromExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        const existingCodes = new Set(state.products.map(p => p.codigo));
        const duplicates = rows.filter(row => {
            const code = String(row['codigo'] || row['Código'] || '');
            return code && existingCodes.has(code);
        });

        const parseExcelNumber = (val) => {
            if (val === undefined || val === null || val === '') return 0;
            if (typeof val === 'number') return val;
            // Se for string, remove espaços e troca vírgula por ponto
            const clean = String(val).replace(/\s/g, '').replace(',', '.');
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        };

        const processImport = (overwrite) => {
            let count = 0; let errors = 0;
            rows.forEach(row => {
                const codigo = String(row['codigo'] || row['Código'] || '');
                if (!codigo) return;
                
                const exists = existingCodes.has(codigo);
                if (exists && !overwrite) return; // Skip if user chose not to overwrite
                
                const pesos = [
                    row['peso1_kg'] || row['Peso 1'], 
                    row['peso2_kg'] || row['Peso 2'], 
                    row['peso3_kg'] || row['Peso 3'], 
                    row['peso4_kg'] || row['Peso 4'], 
                    row['peso5_kg'] || row['Peso 5']
                ].map(p => parseExcelNumber(p));

                const statusParsed = String(row['Status'] || row['status'] || 'Ativo').toLowerCase() === 'inativo' ? false : true;
                const comp = parseExcelNumber(row['Comprimento (cm)'] || row['Comprimento'] || 0);
                const larg = parseExcelNumber(row['Largura (cm)'] || row['Largura'] || 0);
                const alt = parseExcelNumber(row['Altura (cm)'] || row['Altura'] || 0);
                
                if (comp <= 0 || larg <= 0 || alt <= 0) { errors++; return; }
                
                state.saveProduct({
                    codigo, 
                    descricao: row['Descrição'] || row['Descrição'] || 'Importado', 
                    cliente: row['Cliente'] || row['Cliente'] || '',
                    ativo: statusParsed,
                    comprimento_cm: comp, largura_cm: larg, altura_cm: alt,
                    pallet_comprimento: parseExcelNumber(row['Comp. Palete (cm)'] || row['pallet_comprimento'] || 0) || null,
                    pallet_largura: parseExcelNumber(row['Larg. Palete (cm)'] || row['pallet_largura'] || 0) || null,
                    pallet_altura: parseExcelNumber(row['Alt. Palete (cm)'] || row['pallet_altura'] || 0) || null,
                    pallet_qtd_pacotes: parseExcelNumber(row['Qtd. Pacotes no Palete'] || row['pallet_qtd_pacotes'] || 0) || null,
                    peso1_kg: pesos[0] || null, peso2_kg: pesos[1] || null, peso3_kg: pesos[2] || null, peso4_kg: pesos[3] || null, peso5_kg: pesos[4] || null,
                    peso_medio_calc: CR_CALC.calcPesoMedio(pesos), volume_m3_calc: CR_CALC.calcVolumeM3(comp, larg, alt)
                });
                count++;
            });
            renderProductList();
            renderToast(`${count} produtos processados! ${errors ? `${errors} erros.` : ''}`);
        };

        if (duplicates.length > 0) {
            const container = document.getElementById('modal-container');
            container.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal fade-in" style="max-width: 500px;">
                        <div class="modal-header">
                            <h3>Itens Duplicados</h3>
                            <button class="modal-close" id="close-import-confirm"><i data-lucide="x"></i></button>
                        </div>
                        <p style="margin-bottom: 1.5rem; color: var(--text-secondary);">Foram encontrados ${duplicates.length} códigos que já existem no cadastro. Deseja substituir as informações existentes pelas novas do arquivo?</p>
                        <div style="display: flex; gap: 1rem;">
                            <button class="btn btn-secondary" id="import-skip" style="flex: 1; justify-content: center;">Não (Manter atuais)</button>
                            <button class="btn btn-primary" id="import-overwrite" style="flex: 1; justify-content: center;">Sim (Substituir)</button>
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
            const close = () => container.innerHTML = '';
            document.getElementById('close-import-confirm').onclick = close;
            document.getElementById('import-skip').onclick = () => { processImport(false); close(); };
            document.getElementById('import-overwrite').onclick = () => { processImport(true); close(); };
        } else {
            processImport(true);
        }
    };
    reader.readAsArrayBuffer(file);
};

const openImportHelpModal = () => {
    const container = document.getElementById('modal-container');
    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal fade-in" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Instruções para Importação Excel</h3>
                    <button class="modal-close" id="close-modal-help"><i data-lucide="x"></i></button>
                </div>
                <div style="margin-bottom: 1.5rem; line-height: 1.6; color: var(--text-secondary);">
                    <p>Para importar produtos via Excel, sua planilha deve conter as seguintes colunas (os nomes devem ser exatos):</p>
                    <ul style="margin: 1rem 0; padding-left: 1.5rem; list-style-type: disc;">
                        <li><strong>Status</strong>: "Ativo" ou "Inativo".</li>
                        <li><strong>Código</strong> (obrigatório): Identificador único do produto.</li>
                        <li><strong>Descrição</strong> (obrigatório): Nome ou descrição curta.</li>
                        <li><strong>Cliente</strong>: Nome do cliente (opcional).</li>
                        <li><strong>Comprimento (cm)</strong>, <strong>Largura (cm)</strong>, <strong>Altura (cm)</strong>: Dimensões.</li>
                        <li><strong>Comp. Palete (cm)</strong>, <strong>Larg. Palete (cm)</strong>, <strong>Alt. Palete (cm)</strong>: Dimensões do palete.</li>
                        <li><strong>Qtd. Pacotes no Palete</strong>: Quantidade para cálculo de consistência.</li>
                        <li><strong>Peso 1</strong> a <strong>Peso 5</strong>: Amostras de peso em kg.</li>
                    </ul>
                    <p><strong>Atenção:</strong> Se um código já estiver cadastrado, o sistema perguntará se você deseja substituir o cadastro antigo ou apenas pular os itens repetidos.</p>
                    <p><strong>Inativação em Lote:</strong> Para desativar vários produtos de uma vez, utilize o botão "Inativação em Lote" e selecione um arquivo Excel que contenha uma coluna chamada <strong>Código</strong> com os itens que devem ser marcados como inativos.</p>
                    <p><em>Dica: Use o botão abaixo para baixar um modelo já formatado corretamente.</em></p>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-secondary" id="download-template" style="flex: 1; justify-content: center;"><i data-lucide="download-cloud"></i> Baixar Modelo Excel</button>
                    <button class="btn btn-primary" id="close-modal-help-btn" style="flex: 1; justify-content: center;">Entendi</button>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
    
    const close = () => container.innerHTML = '';
    document.getElementById('close-modal-help').onclick = close;
    document.getElementById('close-modal-help-btn').onclick = close;
    document.getElementById('download-template').onclick = () => {
        const templateData = [
            { 
                'Status': 'Ativo', 'Código': 'PROD-001', 'Descrição': 'Exemplo de Produto', 'Cliente': 'Cliente A', 
                'Comprimento (cm)': 100, 'Largura (cm)': 50, 'Altura (cm)': 30,
                'Comp. Palete (cm)': 120, 'Larg. Palete (cm)': 100, 'Alt. Palete (cm)': 110, 'Qtd. Pacotes no Palete': 20,
                'Peso 1': 10.5, 'Peso 2': 10.2, 'Peso 3': 10.8, 'Peso 4': '', 'Peso 5': '' 
            }
        ];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo Importação");
        XLSX.writeFile(wb, "modelo_importacao_logcub.xlsx");
    };
};

const importInactivationList = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        let count = 0;
        rows.forEach(row => {
            const codigo = String(row['codigo'] || row['Código'] || '');
            if (!codigo) return;
            const product = state.products.find(p => p.codigo === codigo);
            if (product) {
                product.ativo = false;
                product.updated_at = new Date().toISOString();
                count++;
            }
        });
        state.persist(STORAGE_KEYS.PRODUCTS, state.products);
        renderToast(`${count} produtos inativados com sucesso!`);
    };
    reader.readAsArrayBuffer(file);
};

const tabs = {
    cadastros: () => {
        clearContent();
        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Cadastro de Produtos</h2>
                    <div style="display: flex; gap: 0.75rem;">
                        <input type="file" id="import-inactivation-file" style="display: none;" accept=".xlsx, .xls">
                        ${state.can('inactivate_product') ? `<button class="btn btn-secondary" onclick="document.getElementById('import-inactivation-file').click()"><i data-lucide="eye-off"></i> Inativação em Lote</button>` : ''}
                        ${state.can('import_data') ? `<button class="btn btn-secondary" id="open-help"><i data-lucide="help-circle"></i> Instruções</button>` : ''}
                        <input type="file" id="import-file" style="display: none;" accept=".xlsx, .xls">
                        ${state.can('import_data') ? `<button class="btn btn-secondary" id="import-trigger"><i data-lucide="upload"></i> Importar</button>` : ''}
                        <button class="btn btn-secondary" id="export-trigger"><i data-lucide="download"></i> Exportar</button>
                        ${state.can('add_product') ? `<button class="btn btn-primary" id="add-product"><i data-lucide="plus"></i> Novo Produto</button>` : ''}
                    </div>
                </div>
                <div class="card">
                     <div class="search-bar" style="margin-bottom: 1.5rem;">
                        <input type="text" id="search-products" placeholder="Pesquisar por código, descrição ou cliente..." style="width: 100%; padding: 0.75rem; border-radius: 0.5rem; background: var(--bg-input); border: 1px solid var(--border); color: white;">
                     </div>
                     <div id="product-list"></div>
                </div>
            </div>
        `;
        renderProductList();
        if (document.getElementById('add-product')) {
            document.getElementById('add-product').onclick = () => openProductModal();
        }
        document.getElementById('search-products').oninput = (e) => renderProductList(e.target.value);
        document.getElementById('import-inactivation-file').onchange = (e) => {
            if (e.target.files.length > 0) importInactivationList(e.target.files[0]);
        };
        document.getElementById('export-trigger').onclick = exportToExcel;
        if (state.can('import_data')) {
            document.getElementById('import-trigger').onclick = () => {
                const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx, .xls';
                input.onchange = (e) => importFromExcel(e.target.files[0]); input.click();
            };
        }
        document.getElementById('open-help').onclick = openImportHelpModal;
        lucide.createIcons();
    },
    simulacao: () => {
        clearContent();
        let simItems = [];
        let simFator = state.parameters.fator_kg_m3;
        let selectedClientSim = '';

        const renderSimTable = () => {
            const container = document.getElementById('sim-items');
            if (simItems.length === 0) { 
                container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Adicione produtos para iniciar a simulação.</p>`; 
                return; 
            }
            let totalVol = 0; let totalBruto = 0; let totalCubado = 0;
            const sortedSimItems = [...simItems].sort((a, b) => a.product.codigo.localeCompare(b.product.codigo, undefined, { sensitivity: 'base' }));
            const rows = sortedSimItems.map((item, index) => {
                let volUnit, pesoUnit;
                const isPallet = !!item.isPallet;
                
                if (isPallet) {
                    volUnit = (item.product.pallet_comprimento * item.product.pallet_largura * item.product.pallet_altura) / 1000000;
                    pesoUnit = (item.product.peso_medio_calc || 0) * (item.product.pallet_qtd_pacotes || 1);
                } else {
                    volUnit = item.product.volume_m3_calc || 0;
                    pesoUnit = item.product.peso_medio_calc || 0;
                }

                const volTotal = volUnit * item.qtd; 
                const pesoBruto = pesoUnit * item.qtd; 
                const pesoCubado = volTotal * simFator;
                
                totalVol += volTotal; 
                totalBruto += pesoBruto; 
                totalCubado += pesoCubado;

                return `
                    <tr>
                        <td>${item.product.codigo}</td>
                        <td>${item.product.descricao} ${isPallet ? '<span class="badge" style="background:var(--accent); color:white; font-size:0.6rem; vertical-align:middle; margin-left:5px;">PALETE</span>' : ''}</td>
                        <td>
                            <input type="number" class="item-qtd" data-idx="${index}" value="${item.qtd}" min="1" style="width: 80px;">
                            <span style="font-size: 0.7rem; color: var(--text-secondary); display: block;">${isPallet ? 'Paletes' : 'Unidades'}</span>
                        </td>
                        <td>${CR_CALC.formatValue(volUnit, 6)}</td>
                        <td>${CR_CALC.formatValue(volTotal, 6)}</td>
                        <td>${CR_CALC.formatValue(pesoBruto, 2)}</td>
                        <td>${CR_CALC.formatValue(pesoCubado, 2)}</td>
                        <td>${CR_CALC.formatValue(pesoCubado, 2)}</td>
                        <td>${!state.isVisitante() ? `<button class="remove-sim-item btn btn-secondary" data-idx="${index}" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>` : ''}</td>
                    </tr>
                `;
            });
            const densidadeMedia = totalVol > 0 ? totalBruto / totalVol : 0;
            container.innerHTML = `
                <div class="table-container">
                    <table>
                        <thead>
                            <tr><th>Código</th><th>Descrição</th><th>Qtd</th><th>m³ Unit</th><th>m³ Total</th><th>Peso Bruto</th><th>Peso Cubado</th><th></th></tr>
                        </thead>
                        <tbody>${rows.join('')}</tbody>
                        <tfoot>
                            <tr style="background: rgba(56, 189, 248, 0.1);">
                                <td colspan="4" style="text-align: right;">TOTAIS:</td>
                                <td>${CR_CALC.formatValue(totalVol, 6)}</td>
                                <td>${CR_CALC.formatValue(totalBruto, 2)}</td>
                                <td>${CR_CALC.formatValue(totalCubado, 2)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="card" style="margin-top: 1rem; border: 1px dashed var(--accent); display: flex; gap: 2rem; justify-content: center;">
                    <div><span>Densidade Média:</span> <strong style="color: var(--accent);">${CR_CALC.formatValue(densidadeMedia, 2)} kg/m³</strong></div>
                    <div><span>Cubagem Total:</span> <strong style="color: var(--accent);">${CR_CALC.formatValue(totalVol, 6)} m³</strong></div>
                </div>`;
            lucide.createIcons();
            document.querySelectorAll('.item-qtd').forEach(input => { 
                input.onchange = (e) => { 
                    const idx = parseInt(e.target.dataset.idx);
                    if (sortedSimItems[idx]) {
                        // Find the item in the original simItems array
                        const originalItem = simItems.find(i => i.product.id === sortedSimItems[idx].product.id && i.isPallet === sortedSimItems[idx].isPallet);
                        if (originalItem) originalItem.qtd = parseInt(e.target.value) || 1; 
                        renderSimTable(); 
                    }
                }; 
            });
            document.querySelectorAll('.remove-sim-item').forEach(btn => { 
                btn.onclick = () => { 
                    const idx = parseInt(btn.dataset.idx);
                    if (sortedSimItems[idx]) {
                        const originalIdx = simItems.findIndex(i => i.product.id === sortedSimItems[idx].product.id && i.isPallet === sortedSimItems[idx].isPallet);
                        if (originalIdx !== -1) simItems.splice(originalIdx, 1); 
                        updateSimProductSelect();
                        renderSimTable(); 
                    }
                }; 
            });
        };

        const updateSimProductSelect = () => {
            const select = document.getElementById('sim-add-product');
            const addedIds = new Set(simItems.map(item => item.product.id));
            const filteredProducts = state.products.filter(p => {
                const isAtivo = p.ativo !== false;
                const matchesClient = !selectedClientSim || p.cliente === selectedClientSim;
                const notAdded = !addedIds.has(p.id);
                return isAtivo && matchesClient && notAdded;
            }).sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { sensitivity: 'base' }));
            select.innerHTML = `<option value="">Selecione...</option>` + filteredProducts.map(p => `<option value="${p.id}">${p.codigo} - ${p.descricao}</option>`).join('');
        };

        const clients = [...new Set(state.products.map(p => p.cliente).filter(Boolean))].sort();

        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Simulação de Pedidos</h2>
                    <button id="export-sim" class="btn btn-primary"><i data-lucide="download"></i> Exportar Simulação</button>
                </div>
                <div class="card" style="margin-bottom: 2rem;">
                    <div style="display: flex; gap: 1.5rem; align-items: flex-end; flex-wrap: wrap;">
                        <div class="form-group"><label>Fator Cubagem</label><input type="number" id="sim-fator" value="${simFator}" style="width: 100px;"></div>
                        <div class="form-group" style="width: 220px;"><label>Filtrar Cliente</label>
                            <select id="sim-client-filter">
                                <option value="">Todos os Clientes</option>
                                ${clients.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group" style="width: 150px;">
                            <label>Modo de Adição</label>
                            <select id="sim-add-mode">
                                <option value="unit">Unidades</option>
                                <option value="pallet">Paletes</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1; min-width: 250px;"><label>Adicionar Produto</label><select id="sim-add-product"></select></div>
                    </div>
                </div>
                <div class="card"><div id="sim-items"></div></div>
            </div>`;

        updateSimProductSelect();
        document.getElementById('sim-fator').oninput = (e) => { simFator = parseFloat(e.target.value) || 0; renderSimTable(); };
        document.getElementById('sim-client-filter').onchange = (e) => { selectedClientSim = e.target.value; updateSimProductSelect(); };
        document.getElementById('sim-add-product').onchange = (e) => {
            const prod = state.products.find(p => p.id === e.target.value);
            const mode = document.getElementById('sim-add-mode').value;
            
            if (prod) { 
                if (mode === 'pallet' && (!prod.pallet_comprimento || !prod.pallet_largura || !prod.pallet_altura)) {
                    renderToast('Este produto não possui dimensões de palete cadastradas.', 'error');
                    e.target.value = '';
                    return;
                }
                
                // Allow adding same product as both unit and pallet
                const exists = simItems.find(i => i.product.id === prod.id && i.isPallet === (mode === 'pallet'));
                if (exists) {
                    exists.qtd++;
                } else {
                    simItems.push({ product: prod, qtd: 1, isPallet: mode === 'pallet' }); 
                }
                
                updateSimProductSelect();
                renderSimTable(); 
                e.target.value = ''; 
            }
        };
        document.getElementById('export-sim').onclick = () => {
            const data = simItems.map(item => { const vt = item.product.volume_m3_calc * item.qtd; return { 'Código': item.product.codigo, 'Quantidade': item.qtd, 'm³ Total': vt, 'Peso Bruto': item.product.peso_medio_calc * item.qtd, 'Peso Cubado': vt * simFator }; });
            const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Simulação"); XLSX.writeFile(wb, "simulacao_logcub.xlsx");
        };
        renderSimTable(); lucide.createIcons();
    },
    resultados: () => {
        clearContent();
        let selectedItems = new Set(); let currentClient = ''; let localFator = state.parameters.fator_kg_m3; let itemQuantities = {};
        const clients = [...new Set(state.products.filter(p => p.ativo !== false).map(p => p.cliente).filter(Boolean))].sort();
        const renderResTable = () => {
            const container = document.getElementById('res-content');
            const summaryContainer = document.getElementById('res-summary-top');
            
            if (!currentClient && currentClient !== 'all') { 
                container.innerHTML = `<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Selecione um cliente para visualizar produtos.</p>`; 
                summaryContainer.innerHTML = '';
                return; 
            }
            
            const clientProducts = (currentClient === 'all' 
                ? state.products.filter(p => p.ativo !== false) 
                : state.products.filter(p => p.cliente === currentClient && p.ativo !== false))
                .sort((a, b) => a.codigo.localeCompare(b.codigo, undefined, { sensitivity: 'base' }));
                
            let totalVol = 0; let totalBruto = 0; let totalCubado = 0;
            const rows = clientProducts.map(p => {
                const isSelected = selectedItems.has(p.id); const q = itemQuantities[p.id] || 0;
                const volUnit = p.volume_m3_calc || 0; const pesoUnit = p.peso_medio_calc || 0; const pesoCubadoUnit = volUnit * localFator;
                if (isSelected) { const realQ = q || 1; totalVol += volUnit * realQ; totalBruto += pesoUnit * realQ; totalCubado += pesoCubadoUnit * realQ; }
                return `<tr><td><input type="checkbox" class="res-select" data-id="${p.id}" ${isSelected ? 'checked' : ''}></td><td>${p.codigo}</td><td>${p.descricao}</td><td><input type="number" class="res-qtd" data-id="${p.id}" value="${q || ''}" placeholder="1" style="width: 60px;"></td><td>${CR_CALC.formatValue(volUnit, 6)}</td><td>${CR_CALC.formatValue(pesoUnit, 2)}</td><td>${CR_CALC.formatValue(pesoCubadoUnit, 2)}</td></tr>`;
            });

            // Update Top Summary
            const densidadeMedia = totalVol > 0 ? totalBruto / totalVol : 0;
            summaryContainer.innerHTML = `
                <div class="card" style="margin-bottom: 1.5rem; background: rgba(56, 189, 248, 0.05); border: 1px dashed var(--accent);">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
                        <div><label style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Total m³</label><strong style="font-size: 1.1rem; color: var(--accent);">${CR_CALC.formatValue(totalVol, 6)} m³</strong></div>
                        <div><label style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Peso Bruto</label><strong style="font-size: 1.1rem; color: var(--accent);">${CR_CALC.formatValue(totalBruto, 2)} kg</strong></div>
                        <div><label style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Peso Cubado</label><strong style="font-size: 1.1rem; color: var(--accent);">${CR_CALC.formatValue(totalCubado, 2)} kg</strong></div>
                        <div><label style="font-size: 0.75rem; color: var(--text-secondary); display: block;">Densidade Média</label><strong style="font-size: 1.1rem; color: var(--accent);">${CR_CALC.formatValue(densidadeMedia, 2)} kg/m³</strong></div>
                    </div>
                </div>
            `;

            container.innerHTML = `<div style="margin-bottom: 1rem; display: flex; gap: 1rem;"><div class="form-group"><label>Fator Local</label><input type="number" id="res-fator" value="${localFator}" style="width: 100px;"></div><button id="res-sel-all" class="btn btn-secondary">Selecionar Todos</button><button id="res-desel-all" class="btn btn-secondary">Desmarcar Todos</button><button id="res-export" class="btn btn-primary" style="margin-left: auto;">Exportar</button></div><div class="table-container"><table><thead><tr><th></th><th>Código</th><th>Descrição</th><th>Qtd</th><th>m³ Unit</th><th>Peso Médio</th><th>Cubado Unit</th></tr></thead><tbody>${rows.join('')}</tbody><tfoot><tr style="background: rgba(56, 189, 248, 0.1);"><td colspan="4" style="text-align: right;">TOTAIS:</td><td>${CR_CALC.formatValue(totalVol, 6)}</td><td>${CR_CALC.formatValue(totalBruto, 2)}</td><td>${CR_CALC.formatValue(totalCubado, 2)}</td></tr></tfoot></table></div>`;
            lucide.createIcons();
            document.getElementById('res-fator').oninput = (e) => { localFator = parseFloat(e.target.value) || 0; renderResTable(); };
            document.getElementById('res-sel-all').onclick = () => { clientProducts.forEach(p => selectedItems.add(p.id)); renderResTable(); };
            document.getElementById('res-desel-all').onclick = () => { selectedItems.clear(); renderResTable(); };
            document.querySelectorAll('.res-select').forEach(cb => { cb.onchange = (e) => { if (e.target.checked) selectedItems.add(e.target.dataset.id); else selectedItems.delete(e.target.dataset.id); renderResTable(); }; });
            document.querySelectorAll('.res-qtd').forEach(input => { input.onchange = (e) => { itemQuantities[e.target.dataset.id] = parseInt(e.target.value) || 0; renderResTable(); }; });
            document.getElementById('res-export').onclick = () => {
                const data = clientProducts.filter(p => selectedItems.has(p.id)).map(p => ({ 
                    'Código': p.codigo, 
                    'Qtd': itemQuantities[p.id] || 1, 
                    'm³ Total': p.volume_m3_calc * (itemQuantities[p.id] || 1), 
                    'Peso Total': p.peso_medio_calc * (itemQuantities[p.id] || 1) 
                }));
                const ws = XLSX.utils.json_to_sheet(data); 
                const wb = XLSX.utils.book_new(); 
                XLSX.utils.book_append_sheet(wb, ws, "Resultados"); 
                XLSX.writeFile(wb, "resultados_logcub.xlsx");
            };
        };
        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in">
                <h2>Resultados</h2>
                <div id="res-summary-top"></div>
                <div class="card">
                    <div class="form-group">
                        <label>Selecionar Cliente</label>
                        <select id="res-client-filter">
                            <option value="">Selecione...</option>
                            <option value="all">TODOS OS CLIENTES</option>
                            ${clients.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <div id="res-content" style="margin-top: 1.5rem;"></div>
                </div>
            </div>`;
        document.getElementById('res-client-filter').onchange = (e) => { 
            currentClient = e.target.value; 
            selectedItems.clear(); 
            renderResTable(); 
        };
        renderResTable(); lucide.createIcons();
    },

    dashboards: () => {
        clearContent();
        const activeProducts = state.products.filter(p => p.ativo !== false);
        const allClients = [...new Set(activeProducts.map(p => p.cliente).filter(Boolean))].sort();
        if (!state.currentDashClients) state.currentDashClients = new Set();
        if (!state.currentDashItems) state.currentDashItems = new Set();

        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2>Dashboard</h2>
                    <button id="dash-ai-analyze" class="btn btn-primary" onclick="AIModule.analyzeBase()" style="background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%); border: none;">
                        <i data-lucide="sparkles"></i> Análise com IA
                    </button>
                    <button id="dash-clear-all" class="btn btn-secondary"><i data-lucide="filter-x"></i> Limpar Filtros</button>
                </div>
                
                <div class="dash-main-layout">
                    <aside class="dash-sidebar">
                        <div class="card">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                                <label style="font-weight: 600; font-size: 0.9rem;">Clientes</label>
                                <button id="dash-sel-all-clients" class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">Tudo</button>
                            </div>
                            <div id="dash-client-filter-container" style="max-height: 250px; overflow-y: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.5rem;">
                                ${allClients.map(c => `
                                    <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem; font-size: 0.85rem; cursor: pointer;">
                                        <input type="checkbox" class="dash-client-check" data-client="${c}" ${state.currentDashClients.has(c) ? 'checked' : ''}>
                                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c}</span>
                                    </label>
                                `).join('') || '<p style="font-size: 0.8rem; color: var(--text-secondary);">Nenhum cliente cadastrado.</p>'}
                            </div>
                        </div>

                        <div class="card">
                            <label style="display: block; font-weight: 600; font-size: 0.9rem; margin-bottom: 0.75rem;">Itens</label>
                            <div id="dash-item-filter-container" style="max-height: 400px; overflow-y: auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: 0.5rem; padding: 0.5rem;">
                                <!-- Items will be rendered here -->
                            </div>
                        </div>
                    </aside>

                    <section class="dashboard-grid">
                        <div class="chart-card full-width">
                            <h4>Densidade Média por Cliente (kg/m³)</h4>
                            <div class="chart-container"><canvas id="chart-densidade"></canvas></div>
                        </div>
                        <div class="chart-card">
                            <h4>Peso Médio por Cliente (kg)</h4>
                            <div class="chart-container"><canvas id="chart-peso"></canvas></div>
                        </div>
                        <div class="chart-card">
                            <h4>m³ Médio por Cliente</h4>
                            <div class="chart-container"><canvas id="chart-volume"></canvas></div>
                        </div>
                    </section>
                </div>
            </div>
        `;

        const renderDashItems = () => {
            const container = document.getElementById('dash-item-filter-container');
            let filteredAndSortedProducts = [...activeProducts];
            if (state.currentDashClients.size > 0) {
                filteredAndSortedProducts = filteredAndSortedProducts.filter(p => state.currentDashClients.has(p.cliente));
            }
            filteredAndSortedProducts.sort((a,b) => a.codigo.localeCompare(b.codigo));
            
            const availableIds = new Set(filteredAndSortedProducts.map(p => p.id));
            state.currentDashItems.forEach(id => {
                if (!availableIds.has(id)) state.currentDashItems.delete(id);
            });

            container.innerHTML = filteredAndSortedProducts.map(p => `
                <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem; font-size: 0.875rem; cursor: pointer;">
                    <input type="checkbox" class="dash-item-check" data-id="${p.id}" ${state.currentDashItems.has(p.id) ? 'checked' : ''}>
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.codigo} - ${p.descricao}</span>
                </label>
            `).join('') || '<p style="font-size: 0.8rem; color: var(--text-secondary);">Nenhum item encontrado.</p>';

            document.querySelectorAll('.dash-item-check').forEach(cb => {
                cb.onchange = (e) => {
                    if (e.target.checked) state.currentDashItems.add(e.target.dataset.id);
                    else state.currentDashItems.delete(e.target.dataset.id);
                    updateCharts();
                };
            });
        };

        const updateCharts = () => {
            const clientStats = {};
            state.products.forEach(p => {
                if (!p.cliente || p.ativo === false) return;
                // Filter by Client Set (empty set means ALL)
                if (state.currentDashClients.size > 0 && !state.currentDashClients.has(p.cliente)) return;
                // Filter by Item Set (empty set means ALL items of those clients)
                if (state.currentDashItems.size > 0 && !state.currentDashItems.has(p.id)) return;

                if (!clientStats[p.cliente]) {
                    clientStats[p.cliente] = { sumDens: 0, sumPeso: 0, sumVol: 0, count: 0 };
                }
                const dens = (p.peso_medio_calc && p.volume_m3_calc) ? p.peso_medio_calc / p.volume_m3_calc : 0;
                clientStats[p.cliente].sumDens += dens;
                clientStats[p.cliente].sumPeso += (p.peso_medio_calc || 0);
                clientStats[p.cliente].sumVol += (p.volume_m3_calc || 0);
                clientStats[p.cliente].count++;
            });

            const dashboardData = Object.entries(clientStats).map(([name, stats]) => ({
                name,
                avgDens: stats.sumVol > 0 ? stats.sumPeso / stats.sumVol : 0,
                avgPeso: stats.sumPeso / stats.count,
                avgVol: stats.sumVol / stats.count
            }));

            const sortedByDens = [...dashboardData].sort((a, b) => b.avgDens - a.avgDens);
            const sortedByPeso = [...dashboardData].sort((a, b) => b.avgPeso - a.avgPeso);
            const sortedByVol = [...dashboardData].sort((a, b) => b.avgVol - a.avgVol);

            renderCharts(sortedByDens, sortedByPeso, sortedByVol);
        };

        const renderCharts = (sortedByDens, sortedByPeso, sortedByVol) => {
            Chart.register(ChartDataLabels);
            
            ['chart-densidade', 'chart-peso', 'chart-volume'].forEach(id => {
                const chart = Chart.getChart(id);
                if (chart) chart.destroy();
            });

            const isDark = state.theme === 'dark';
            const textColor = isDark ? '#94a3b8' : '#64748b';
            const primaryTextColor = isDark ? '#f8fafc' : '#1e293b';
            const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

            const commonOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: { backgroundColor: isDark ? '#1e293b' : '#fff', titleColor: '#38bdf8', bodyColor: isDark ? '#fff' : '#1e293b', borderColor: 'var(--border)', borderWidth: 1 },
                    datalabels: { display: false }
                },
                scales: {
                    y: { type: 'linear', beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor } },
                    x: { type: 'category', grid: { display: false }, ticks: { color: textColor } }
                }
            };

            const horizontalOptions = {
                ...commonOptions,
                indexAxis: 'y',
                scales: {
                    x: { type: 'linear', beginAtZero: true, grid: { color: gridColor }, border: { display: false }, ticks: { color: textColor } },
                    y: { type: 'category', grid: { display: false }, ticks: { color: textColor } }
                }
            };

            new Chart(document.getElementById('chart-densidade'), {
                type: 'bar',
                data: {
                    labels: sortedByDens.map(d => d.name),
                    datasets: [{ label: 'Densidade', data: sortedByDens.map(d => d.avgDens), backgroundColor: '#38bdf8', borderRadius: 6 }]
                },
                options: {
                    ...commonOptions,
                    layout: { padding: { top: 30 } },
                    plugins: {
                        ...commonOptions.plugins,
                        datalabels: {
                            display: true,
                            anchor: 'end',
                            align: 'top',
                            formatter: (value) => Math.round(value),
                            color: primaryTextColor,
                            font: { weight: 'bold', size: 12 },
                            offset: 4
                        }
                    }
                }
            });

            new Chart(document.getElementById('chart-peso'), {
                type: 'bar',
                data: {
                    labels: sortedByPeso.map(d => d.name),
                    datasets: [{ label: 'Peso Médio', data: sortedByPeso.map(d => d.avgPeso), backgroundColor: '#0ea5e9', borderRadius: 4 }]
                },
                options: horizontalOptions
            });

            new Chart(document.getElementById('chart-volume'), {
                type: 'bar',
                data: {
                    labels: sortedByVol.map(d => d.name),
                    datasets: [{ label: 'm³ Médio', data: sortedByVol.map(d => d.avgVol), backgroundColor: '#0284c7', borderRadius: 4 }]
                },
                options: horizontalOptions
            });
        };

        document.getElementById('dash-sel-all-clients').onclick = () => {
            allClients.forEach(c => state.currentDashClients.add(c));
            tabs.dashboards(); // Re-render to update checkboxes
        };

        document.getElementById('dash-clear-all').onclick = () => {
            state.currentDashClients.clear();
            state.currentDashItems.clear();
            tabs.dashboards(); // Re-render to reset everything
        };

        document.querySelectorAll('.dash-client-check').forEach(cb => {
            cb.onchange = (e) => {
                if (e.target.checked) state.currentDashClients.add(e.target.dataset.client);
                else state.currentDashClients.delete(e.target.dataset.client);
                renderDashItems();
                updateCharts();
            };
        });

        renderDashItems();
        updateCharts();
        lucide.createIcons();
    },

    parametros: () => {
        clearContent();
        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in" style="max-width: 600px; margin: 0 auto;">
                <div style="margin-bottom: 2rem;"><h2>Parâmetros Globais</h2><p style="color: var(--text-secondary);">Configure as constantes do sistema.</p></div>
                <div class="card">
                    <form id="params-form">
                        <div class="form-group"><label>Fator de Cubagem Padrão (kg/m³)</label><input type="number" id="fator_kg_m3" value="${state.parameters.fator_kg_m3}" required></div>
                        <div class="grid-2">
                            <div class="form-group"><label>Decimais m³</label><input type="number" id="decimais_volume" value="${state.parameters.decimais_volume}" min="0" max="10" required></div>
                            <div class="form-group"><label>Decimais Peso</label><input type="number" id="decimais_peso" value="${state.parameters.decimais_peso}" min="0" max="10" required></div>
                        </div>
                        <div class="form-group">
                            <label>Tolerância de Paletização (%)</label>
                            <input type="number" id="tolerancia_paletizacao" value="${state.parameters.tolerancia_paletizacao || 5}" min="0" max="100" step="0.1" required>
                            <small style="color:var(--text-secondary);">Define o limite aceitável de variação entre o m³ unitário do palete e o volume nominal.</small>
                        </div>
                        <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;"><i data-lucide="save"></i> Salvar Configurações</button>
                    </form>
                </div>
            </div>`;
        lucide.createIcons();
        document.getElementById('params-form').onsubmit = (e) => {
            e.preventDefault();
            state.saveParameters({ 
                fator_kg_m3: parseFloat(document.getElementById('fator_kg_m3').value), 
                decimais_volume: parseInt(document.getElementById('decimais_volume').value), 
                decimais_peso: parseInt(document.getElementById('decimais_peso').value),
                tolerancia_paletizacao: parseFloat(document.getElementById('tolerancia_paletizacao').value)
            });
            renderToast('Parâmetros salvos com sucesso!');
        };
    },

    gestao: () => {
        if (!state.can('manage_users')) { tabs.cadastros(); return; }
        clearContent();
        document.getElementById('tab-content').innerHTML = `
            <div class="fade-in" style="max-width: 1200px; margin: 0 auto;">
                <div class="tabs-subnav">
                    <button class="subnav-item active" data-subtarget="sub-ges-usuarios">Usuários</button>
                    <button class="subnav-item" data-subtarget="sub-ges-parametros">Parâmetros</button>
                    <button class="subnav-item" data-subtarget="sub-ges-dados">Limpeza de Dados</button>
                    <button class="subnav-item" data-subtarget="sub-ges-integracoes">Integrações</button>
                    <button class="subnav-item" data-subtarget="sub-ges-administracao">Administração</button>
                </div>

                <!-- USUARIOS TAB -->
                <div id="sub-ges-usuarios" class="sub-content active">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                        <h2>Gestão de Usuários</h2>
                        <button class="btn btn-primary" id="add-user"><i data-lucide="user-plus"></i> Novo Usuário</button>
                    </div>
                    <div class="card" style="margin-bottom: 2rem;">
                        <div class="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Usuário</th>
                                        <th>Grupos</th>
                                        <th style="text-align: right;">Ações</th>
                                    </tr>
                                </thead>
                                <tbody id="user-list"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- PARAMETROS TAB -->
                <div id="sub-ges-parametros" class="sub-content">
                    <div style="margin-bottom: 2rem;"><h2>Parâmetros Globais</h2><p style="color: var(--text-secondary);">Configure as constantes do sistema.</p></div>
                    <div class="card" style="max-width: 600px;">
                        <div class="card-body">
                            <form id="params-form">
                                <div class="form-group"><label>Fator de Cubagem Padrão (kg/m³)</label><input type="number" id="fator_kg_m3" class="form-control" value="${state.parameters.fator_kg_m3}" required></div>
                                <div class="grid-2">
                                    <div class="form-group"><label>Decimais m³</label><input type="number" id="decimais_volume" class="form-control" value="${state.parameters.decimais_volume}" min="0" max="10" required></div>
                                    <div class="form-group"><label>Decimais Peso</label><input type="number" id="decimais_peso" class="form-control" value="${state.parameters.decimais_peso}" min="0" max="10" required></div>
                                </div>
                                <div class="form-group">
                                    <label>Tolerância de Paletização (%)</label>
                                    <input type="number" id="tolerancia_paletizacao" class="form-control" value="${state.parameters.tolerancia_paletizacao || 5}" min="0" max="100" step="0.1" required>
                                    <small style="color:var(--text-secondary);">Define o limite aceitável de variação entre o m³ unitário do palete e o volume nominal.</small>
                                </div>
                                <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem;"><i data-lucide="save"></i> Salvar Configurações</button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- LIMPEZA DE DADOS TAB -->
                <div id="sub-ges-dados" class="sub-content">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h2>Limpeza de Dados (Ações Irreversíveis)</h2>
                    </div>
                    <div style="display:flex; gap:20px;">
                        <!-- RESET CARD -->
                        <div class="card" style="flex:1; border-color: var(--danger);">
                            <div class="card-body">
                                <h3 style="color:var(--danger); display:flex; align-items:center; gap:8px;">
                                    <i data-lucide="alert-octagon"></i> Apagar Tudo (Factory Reset)
                                </h3>
                                <p style="font-size:0.9rem; color:var(--text-muted); margin: 10px 0 20px 0;">
                                    Apaga todos os Produtos Cadastrados e Simulações. Usuários e Parâmetros <b>não</b> serão apagados.
                                </p>
                                <button class="btn" id="btn-wipe-all" style="background:var(--danger); color:white;">
                                    <i data-lucide="trash-2"></i> Confirmar Restauração
                                </button>
                            </div>
                        </div>

                        <!-- PURGE CARD -->
                        <div class="card" style="flex:1; border-color: var(--warning);">
                            <div class="card-body">
                                <h3 style="color:var(--warning); display:flex; align-items:center; gap:8px;">
                                    <i data-lucide="calendar-x"></i> Apagar por Período
                                </h3>
                                <p style="font-size:0.9rem; color:var(--text-muted); margin: 10px 0 15px 0;">
                                    Exclui os Produtos baseados na Data de Criação (created_at).
                                </p>
                                <div style="display:flex; gap:10px; margin-bottom: 15px;">
                                    <div style="flex:1;">
                                        <label style="font-size:0.8rem;">Data Início</label>
                                        <input type="date" id="purge-start" class="form-control" />
                                    </div>
                                    <div style="flex:1;">
                                        <label style="font-size:0.8rem;">Data Fim</label>
                                        <input type="date" id="purge-end" class="form-control" />
                                    </div>
                                </div>
                                <button class="btn" id="btn-purge-date" style="background:var(--warning); color:white;">
                                    <i data-lucide="eraser"></i> Limpar Período
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- INTEGRACOES TAB -->
                <div id="sub-ges-integracoes" class="sub-content">
                    <div class="gestao-grid">
                        <!-- SYNC SECTION -->
                        <div class="card" style="grid-column: 1 / -1; background: rgba(56, 189, 248, 0.03); border-color: rgba(56, 189, 248, 0.2);">
                            <div class="card-body">
                                <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <i data-lucide="refresh-cw"></i> Sincronização e Backup Manual
                                </h3>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                                    <div>
                                        <h4 style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.5rem;">Exportar Base</h4>
                                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Gera um arquivo .json com todos os produtos, usuários e parâmetros.</p>
                                        <button class="btn btn-primary" onclick="window.LogCubDB.exportDatabase()" style="width: 100%;">
                                            <i data-lucide="download"></i> Baixar Backup Atual
                                        </button>
                                    </div>
                                    <div style="border-left: 1px solid var(--border); padding-left: 2rem;">
                                        <h4 style="font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.5rem;">Importar / Mesclar</h4>
                                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">Carrega dados de outra máquina para esta base local.</p>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <input type="file" id="db-import-file" accept=".json" style="font-size: 0.8rem; flex: 1;" />
                                            <button class="btn btn-secondary" onclick="window.LogCubDB.importDatabase()">Sincronizar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- IA SECTION -->
                        <div class="card" style="border-left: 4px solid var(--accent);">
                            <div class="card-body">
                                <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <i data-lucide="sparkles"></i> Inteligência Artificial (Gemini)
                                </h3>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                                    Ative o assistente para análise de densidade e Q&A logístico.
                                </p>
                                <form id="form-ai-config" onsubmit="event.preventDefault(); state.saveParameters({ gemini_api_key: document.getElementById('ai-key').value, gemini_model: document.getElementById('ai-model').value }); renderToast('Configurações de IA salvas!', 'success');">
                                    <div class="form-group">
                                        <label>Modelo de IA (Atual: ${state.parameters.gemini_model || 'gemini-2.0-flash'})</label>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <input list="model-suggestions" id="ai-model" class="form-control" value="${state.parameters.gemini_model || 'gemini-2.0-flash'}" placeholder="Ex: gemini-3.1-flash-lite" style="flex: 1;" />
                                            <datalist id="model-suggestions">
                                                <option value="gemini-1.5-flash">
                                                <option value="gemini-1.5-flash-latest">
                                                <option value="gemini-2.0-flash">
                                                <option value="gemini-3.1-flash-lite">
                                            </datalist>
                                            <button type="button" class="btn btn-secondary" onclick="AIModule.listAvailableModels()" title="Testar Chave & Ver Modelos">
                                                <i data-lucide="search"></i> Sugerir
                                            </button>
                                        </div>
                                    </div>
                                    <div class="form-group">
                                        <label>Chave de API (Geralmente começa com AIza...)</label>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <input type="password" id="ai-key" class="form-control" value="${state.parameters.gemini_api_key || ''}" placeholder="Cole sua chave aqui..." required style="flex: 1;" />
                                            <button type="submit" class="btn btn-primary">Salvar</button>
                                        </div>
                                    </div>
                                    <small style="display: block; margin-top: 0.75rem; color: var(--text-secondary);">
                                        <i data-lucide="info" style="width: 12px; height: 12px; vertical-align: middle;"></i> 
                                        Use o modelo Gemini 1.5 Flash (Gratuito).
                                    </small>
                                </form>
                            </div>
                        </div>

                        <!-- BACKUP SECTION -->
                        <div class="card">
                            <div class="card-body">
                                <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                    <i data-lucide="clock"></i> Backup Automático
                                </h3>
                                <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                                    Programação de exportação automática baseada em frequência.
                                </p>
                                <form id="form-backup-config" onsubmit="window.LogCubDB.saveBackupConfig(event)">
                                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                                        <div class="form-group">
                                            <label>Status</label>
                                            <select id="bkp-active" class="form-control">
                                                <option value="false" ${!JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').active ? 'selected' : ''}>Desativado</option>
                                                <option value="true" ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').active ? 'selected' : ''}>Ativado</option>
                                            </select>
                                        </div>
                                        <div class="form-group">
                                            <label>Horário</label>
                                            <input type="time" id="bkp-time" class="form-control" value="${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').time || '09:00'}" required />
                                        </div>
                                        <div class="form-group" style="grid-column: span 2;">
                                            <label>Frequência</label>
                                            <select id="bkp-freq" class="form-control" onchange="window.LogCubDB.toggleBackupFields()">
                                                <option value="daily" ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').freq === 'daily' ? 'selected' : ''}>Diário</option>
                                                <option value="weekly" ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').freq === 'weekly' ? 'selected' : ''}>Semanal</option>
                                                <option value="monthly" ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').freq === 'monthly' ? 'selected' : ''}>Mensal</option>
                                            </select>
                                        </div>
                                        <div class="form-group" id="group-weekday" style="grid-column: span 2; display: ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').freq === 'weekly' ? 'block' : 'none'};">
                                            <label>Dia da Semana</label>
                                            <select id="bkp-weekday" class="form-control">
                                                <option value="1">Segunda-feira</option>
                                                <option value="2">Terça-feira</option>
                                                <option value="3">Quarta-feira</option>
                                                <option value="4">Quinta-feira</option>
                                                <option value="5">Sexta-feira</option>
                                                <option value="6">Sábado</option>
                                                <option value="0">Domingo</option>
                                            </select>
                                        </div>
                                        <div class="form-group" id="group-monthday" style="grid-column: span 2; display: ${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').freq === 'monthly' ? 'block' : 'none'};">
                                            <label>Dia do Mês</label>
                                            <input type="number" id="bkp-monthday" class="form-control" min="1" max="31" value="${JSON.parse(localStorage.getItem('LogCub_BackupConfig') || '{}').monthday || 1}" />
                                        </div>
                                    </div>
                                <button type="submit" class="btn btn-secondary" style="width: 100%; margin-top: 1rem;">Salvar Regras</button>
                            </form>
                        </div>
                    </div>
                </div>

                <!-- ADMINISTRACAO TAB -->
                <div id="sub-ges-administracao" class="sub-content">
                    <div style="margin-bottom: 2rem;"><h2>Administração da Unidade</h2><p style="color: var(--text-secondary);">Personalize a identidade visual da operação.</p></div>
                    <div class="card" style="max-width: 600px;">
                        <div class="card-body">
                            <form id="branding-form">
                                <div class="grid-2">
                                    <div class="form-group">
                                        <label>Nome do Sistema (Principal)</label>
                                        <input type="text" id="brand_app_name" class="form-control" value="${state.parameters.brand_app_name || 'LogCub'}" required>
                                    </div>
                                    <div class="form-group">
                                        <label>Nome da Empresa (Subtítulo)</label>
                                        <input type="text" id="brand_company_name" class="form-control" value="${state.parameters.brand_company_name || 'NobelPack'}" required>
                                    </div>
                                </div>
                                <div class="form-group" style="margin-top: 1rem;">
                                    <label>URL do Logotipo (ou Base64)</label>
                                    <input type="text" id="brand_logo_url" class="form-control" value="${state.parameters.brand_logo_url || ''}" placeholder="Ex: https://link.com/logo.png">
                                    <small style="color:var(--text-secondary);">Deixe vazio para usar o ícone padrão.</small>
                                </div>
                                <div style="display:flex; gap:10px; margin-top: 1.5rem;">
                                    <button type="submit" class="btn btn-primary" style="flex:1;"><i data-lucide="save"></i> Salvar Identidade</button>
                                    <button type="button" class="btn btn-secondary" id="btn-reset-branding">Restaurar Padrão</button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>`;

        // Setup Subnav routing
        const subnavItemsArr = document.querySelectorAll('#tab-content .subnav-item');
        subnavItemsArr.forEach(btn => {
            btn.onclick = () => {
                subnavItemsArr.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                document.querySelectorAll('#tab-content .sub-content').forEach(c => c.classList.remove('active'));
                const targetId = btn.dataset.subtarget;
                const activeContent = document.getElementById(targetId);
                if (activeContent) activeContent.classList.add('active');
            };
        });

        // Setup Params Submission
        const paramsForm = document.getElementById('params-form');
        if (paramsForm) {
            paramsForm.onsubmit = (e) => {
                e.preventDefault();
                state.saveParameters({ 
                    fator_kg_m3: parseFloat(document.getElementById('fator_kg_m3').value), 
                    decimais_volume: parseInt(document.getElementById('decimais_volume').value), 
                    decimais_peso: parseInt(document.getElementById('decimais_peso').value),
                    tolerancia_paletizacao: parseFloat(document.getElementById('tolerancia_paletizacao').value)
                });
                renderToast('Parâmetros salvos com sucesso!');
            };
        }

        // Setup Branding Submission
        const brandingForm = document.getElementById('branding-form');
        if (brandingForm) {
            brandingForm.onsubmit = (e) => {
                e.preventDefault();
                state.saveParameters({
                    brand_app_name: document.getElementById('brand_app_name').value,
                    brand_company_name: document.getElementById('brand_company_name').value,
                    brand_logo_url: document.getElementById('brand_logo_url').value
                });
                renderToast('Identidade visual atualizada!');
            };
        }

        const btnResetBranding = document.getElementById('btn-reset-branding');
        if (btnResetBranding) {
            btnResetBranding.onclick = () => {
                if (confirm('Restaurar padrões originais?')) {
                    state.saveParameters({
                        brand_app_name: 'LogCub',
                        brand_company_name: 'NobelPack',
                        brand_logo_url: ''
                    });
                    state.gestao();
                    renderToast('Padrões restaurados!');
                }
            };
        }

        renderUsers();
        lucide.createIcons();

        function renderUsers() {
            const tbody = document.getElementById('user-list');
            if (!tbody) return;
            tbody.innerHTML = state.users.map(u => `
                <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.username}</td>
                    <td>${u.roles.map(r => `<span class="badge badge-success" style="margin-right:0.25rem">${r}</span>`).join('')}</td>
                    <td style="text-align: right;">
                        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-sm edit-user" data-id="${u.id}" title="Editar"><i data-lucide="edit-2" style="width:14px;"></i></button>
                            <button class="btn btn-secondary btn-sm reset-user" data-id="${u.id}" title="Resetar Senha"><i data-lucide="refresh-cw" style="width:14px;"></i></button>
                            ${u.username !== 'adm' ? `<button class="btn btn-danger btn-sm delete-user" data-id="${u.id}" title="Excluir"><i data-lucide="trash-2" style="width:14px;"></i></button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');
            
            document.querySelectorAll('.edit-user').forEach(btn => {
                btn.onclick = () => renderUserModal(state.users.find(u => u.id === btn.dataset.id));
            });
            document.querySelectorAll('.reset-user').forEach(btn => {
                btn.onclick = () => {
                    const user = state.users.find(u => u.id === btn.dataset.id);
                    if (confirm(`Deseja enviar o e-mail de redefinição de senha do Firebase para ${user.name}?`)) {
                        firebase.auth().sendPasswordResetEmail(user.username)
                            .then(() => {
                                renderToast('E-mail enviado com sucesso!');
                            })
                            .catch(error => {
                                console.error(error);
                                renderToast('Erro ao enviar e-mail. Verifique o formato.', 'error');
                            });
                    }
                };
            });
            document.querySelectorAll('.delete-user').forEach(btn => {
                btn.onclick = () => {
                    const user = state.users.find(u => u.id === btn.dataset.id);
                    if (confirm(`Tem certeza que deseja excluir o usuário ${user.name}?`)) {
                        state.users = state.users.filter(u => u.id !== btn.dataset.id);
                        state.persist(STORAGE_KEYS.USERS, state.users);
                        renderUsers();
                        renderToast('Usuário excluído!');
                    }
                };
            });
            lucide.createIcons();
        }

        renderUsers();
        document.getElementById('add-user').onclick = () => renderUserModal();
        const requireAuth = (callback) => {
            const formHtml = `
                <div style="color: var(--danger); margin-bottom:15px; font-size:0.85rem; font-weight: 500;">
                    <i data-lucide="alert-triangle" style="width:16px;height:16px;"></i>
                    AÇÃO DESTRUTIVA: Confirme suas credenciais de Administrador.
                </div>
                <div class="form-group">
                    <label>Usuário</label>
                    <input type="text" id="confirm_user" required style="width: 100%; padding: 0.625rem; background: var(--bg-input); border: 1px solid var(--border); color: white; border-radius: 0.375rem;" />
                </div>
                <div class="form-group" style="margin-top: 10px;">
                    <label>Senha</label>
                    <input type="password" id="confirm_pass" required style="width: 100%; padding: 0.625rem; background: var(--bg-input); border: 1px solid var(--border); color: white; border-radius: 0.375rem;" />
                </div>
            `;

            const container = document.getElementById('modal-container');
            container.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal fade-in" style="max-width: 400px; border: 1px solid var(--danger);">
                        <div class="modal-header">
                            <h3 style="color: var(--danger);">Autenticação Necessária</h3>
                            <button class="modal-close" id="close-auth-modal"><i data-lucide="x"></i></button>
                        </div>
                        <form id="auth-confirm-form">
                            ${formHtml}
                            <div class="modal-footer" style="margin-top: 1.5rem;">
                                <button type="button" class="btn btn-secondary" id="cancel-auth-modal">Cancelar</button>
                                <button type="submit" class="btn btn-primary" style="background: var(--danger);">Confirmar</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            lucide.createIcons();

            const close = () => container.innerHTML = '';
            document.getElementById('close-auth-modal').onclick = close;
            document.getElementById('cancel-auth-modal').onclick = close;

            document.getElementById('auth-confirm-form').onsubmit = (e) => {
                e.preventDefault();
                const u = document.getElementById('confirm_user').value;
                const p = document.getElementById('confirm_pass').value;
                const user = state.users.find(x => x.username === u && x.password === p);

                if (!user || (!user.roles.includes('adm') && !user.roles.includes('Administrador'))) {
                    renderToast('Credenciais inválidas ou sem permissão de ADM.', 'error');
                    return;
                }

                close();
                callback();
            };
        };

        document.getElementById('btn-wipe-all').onclick = () => {
            requireAuth(() => {
                state.products = [];
                state.persist(STORAGE_KEYS.PRODUCTS, state.products);
                localStorage.removeItem(STORAGE_KEYS.SIMULATIONS);
                renderToast('Todos os dados operacionais foram limpos.', 'success');
            });
        };

        document.getElementById('btn-purge-date').onclick = () => {
            const startStr = document.getElementById('purge-start').value;
            const endStr = document.getElementById('purge-end').value;

            if (!startStr || !endStr) {
                renderToast('Informe a Data Início e a Data Fim.', 'error');
                return;
            }

            requireAuth(() => {
                const sDate = new Date(startStr + 'T00:00:00');
                const eDate = new Date(endStr + 'T23:59:59');

                const filteredProducts = state.products.filter(p => {
                    if (!p.created_at) return true; // keep items without date
                    const pDate = new Date(p.created_at);
                    // Return TRUE if it falls OUTSIDE the purge range
                    return pDate < sDate || pDate > eDate;
                });

                state.products = filteredProducts;
                state.persist(STORAGE_KEYS.PRODUCTS, state.products);
                renderToast('Dados do período selecionado removidos.', 'success');
            });
        };

        lucide.createIcons();

        // Load existing config
        const rawBkp = localStorage.getItem('LogCub_BackupConfig');
        const bkpConfig = rawBkp ? JSON.parse(rawBkp) : null;
        if (bkpConfig && Object.keys(bkpConfig).length > 0) {
            document.getElementById('bkp-active').value = String(bkpConfig.active);
            document.getElementById('bkp-freq').value = bkpConfig.freq;
            document.getElementById('bkp-weekday').value = String(bkpConfig.weekday);
            document.getElementById('bkp-monthday').value = String(bkpConfig.monthday);
            document.getElementById('bkp-time').value = bkpConfig.time;
        } else {
            document.getElementById('bkp-active').value = 'false';
            document.getElementById('bkp-freq').value = 'weekly';
            document.getElementById('bkp-weekday').value = '5';
            document.getElementById('bkp-monthday').value = '1';
            document.getElementById('bkp-time').value = '18:00';
        }
        if(window.LogCubDB) window.LogCubDB.toggleBackupFields();
    }
};

const renderUserModal = (user = null) => {
    const container = document.getElementById('modal-container');
    const isEdit = !!user;
    
    container.innerHTML = `
        <div class="modal-overlay">
            <div class="modal fade-in">
                <div class="modal-header">
                    <h3>${isEdit ? 'Editar Usuário' : 'Novo Usuário'}</h3>
                    <button class="modal-close" id="close-user-modal"><i data-lucide="x"></i></button>
                </div>
                <form id="user-form">
                    <div class="form-group">
                        <label>Nome Completo*</label>
                        <input type="text" id="u-name" value="${user?.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label>E-mail (Nome de Usuário)*</label>
                        <input type="email" id="u-username" value="${user?.username || ''}" placeholder="usuario@nobelpack.com.br" required ${isEdit ? 'disabled style="background:var(--bg-main);"' : ''}>
                    </div>
                    <div class="form-group">
                        <label>Grupos de Acesso*</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                                <input type="checkbox" class="u-role" value="adm" ${user?.roles.includes('adm') ? 'checked' : ''}> Administrador
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                                <input type="checkbox" class="u-role" value="supervisor" ${user?.roles.includes('supervisor') ? 'checked' : ''}> Supervisor
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                                <input type="checkbox" class="u-role" value="operador" ${user?.roles.includes('operador') || (!isEdit && !user) ? 'checked' : ''}> Operador
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem;">
                                <input type="checkbox" class="u-role" value="visitante" ${user?.roles.includes('visitante') ? 'checked' : ''}> Visitante
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" id="cancel-user-modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${isEdit ? 'Salvar Alterações' : 'Criar Usuário'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    const close = () => container.innerHTML = '';
    document.getElementById('close-user-modal').onclick = close;
    document.getElementById('cancel-user-modal').onclick = close;
    
    document.getElementById('user-form').onsubmit = (e) => {
        e.preventDefault();
        const selectedRoles = Array.from(document.querySelectorAll('.u-role:checked')).map(cb => cb.value);
        if (selectedRoles.length === 0) { renderToast('Selecione pelo menos um grupo.', 'error'); return; }
        
        if (isEdit) {
            const index = state.users.findIndex(u => u.id === user.id);
            state.users[index] = { ...state.users[index], name: document.getElementById('u-name').value, roles: selectedRoles };
            state.persist(STORAGE_KEYS.USERS, state.users);
            close();
            tabs.gestao();
            renderToast('Usuário atualizado!');
        } else {
            const username = document.getElementById('u-username').value.toLowerCase();
            if (state.users.some(u => u.username.toLowerCase() === username)) { renderToast('Este e-mail de usuário já existe.', 'error'); return; }
            
            const pass = prompt('Digite uma senha inicial para o usuário no Google (Mínimo 6 caracteres):');
            if (!pass || pass.length < 6) {
                renderToast('Senha inválida ou muito curta.', 'error');
                return;
            }

            const secondaryApp = firebase.initializeApp(firebaseConfig, "Secondary" + Date.now());
            secondaryApp.auth().createUserWithEmailAndPassword(username, pass)
                .then(() => {
                    secondaryApp.auth().signOut();
                    secondaryApp.delete();
                    
                    state.users.push({
                        id: crypto.randomUUID(),
                        name: document.getElementById('u-name').value,
                        username: username,
                        password: 'Protegida (Firebase)',
                        roles: selectedRoles
                    });
                    
                    state.persist(STORAGE_KEYS.USERS, state.users);
                    close();
                    tabs.gestao();
                    renderToast('Usuário criado com sucesso no Firebase!');
                })
                .catch(error => {
                    secondaryApp.delete();
                    console.error(error);
                    if(error.code === 'auth/email-already-in-use') {
                        state.users.push({
                            id: crypto.randomUUID(),
                            name: document.getElementById('u-name').value,
                            username: username,
                            password: 'Protegida (Firebase)',
                            roles: selectedRoles
                        });
                        state.persist(STORAGE_KEYS.USERS, state.users);
                        close();
                        tabs.gestao();
                        renderToast('Usuário já existe no Google. Permissões vinculadas a este sistema com sucesso!', 'success');
                    } else {
                        let msg = 'Erro ao criar conta no Firebase.';
                        if(error.code === 'auth/invalid-email') msg = 'Formato de e-mail inválido.';
                        renderToast(msg, 'error');
                    }
                });
        }
    };
    lucide.createIcons();
};

const renderLogin = () => {
    // Esconde a aplicação principal ao invés de destruí-la
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = 'none';

    // Remove login overlay anterior se existir
    const existing = document.getElementById('logcub-login-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'logcub-login-overlay';
    overlay.innerHTML = `
        <div class="login-screen">
            <div class="login-card fade-in">
                <div class="logo" style="justify-content: center; margin-bottom: 2rem;">
                    <i data-lucide="truck" style="width: 48px; height: 48px;"></i>
                    <h1 style="font-size: 2.5rem;">LogCub</h1>
                    <span class="brand-nobel" style="font-size: 1.5rem;">NobelPack</span>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label>E-mail de Acesso</label>
                        <input type="email" id="login-username" placeholder="ex: admin@nobelpack.com.br" required autofocus>
                    </div>
                    <div class="form-group">
                        <div style="display:flex; justify-content: space-between;">
                            <label>Senha</label>
                            <a href="#" id="forgot-password" style="font-size: 0.8rem; text-decoration: none; color: var(--primary);">Esqueci a senha</a>
                        </div>
                        <input type="password" id="login-password" placeholder="Digite sua senha" required>
                    </div>
                    <button type="submit" class="btn btn-primary" id="btn-login-submit" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">Conectar (Google Auth)</button>
                    <div id="login-error" style="color: var(--danger); font-size: 0.875rem; text-align: center; margin-top: 1rem; display: none;">
                        Usuário ou senha incorretos.
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('forgot-password').onclick = (e) => {
        e.preventDefault();
        const login = document.getElementById('login-username').value.trim();
        const err = document.getElementById('login-error');
        
        if (!login) {
            err.style.color = 'var(--danger)';
            err.textContent = 'Preencha seu e-mail no campo acima primeiro.';
            err.style.display = 'block';
            return;
        }

        firebase.auth().sendPasswordResetEmail(login)
            .then(() => {
                err.style.color = 'var(--success)';
                err.textContent = 'E-mail de recuperação enviado! Verifique sua caixa de entrada.';
                err.style.display = 'block';
            })
            .catch((error) => {
                err.style.color = 'var(--danger)';
                err.textContent = 'Erro ao enviar e-mail. Verifique se o formato está correto.';
                err.style.display = 'block';
            });
    };

    document.getElementById('login-form').onsubmit = (e) => {
        e.preventDefault();
        const u = document.getElementById('login-username').value;
        const p = document.getElementById('login-password').value;
        const err = document.getElementById('login-error');
        const btn = document.getElementById('btn-login-submit');

        const originalText = btn.innerHTML;
        btn.innerHTML = 'Verificando no Firebase...';
        btn.disabled = true;
        err.style.display = 'none';

        firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
            .then(() => {
                return firebase.auth().signInWithEmailAndPassword(u, p);
            })
            .then(() => {
                // onAuthStateChanged no initApp cuidará do redirecionamento
            })
            .catch((error) => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                let msg = 'Erro no login.';
                if (error.code === 'auth/invalid-credential') msg = 'E-mail ou senha incorretos.';
                err.style.color = 'var(--danger)';
                err.textContent = msg;
                err.style.display = 'block';
            });
    };
    lucide.createIcons();
};

const initApp = (activeTabId) => {
    // A inicialização agora depende do Firebase Auth
    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                // PASSO CRÍTICO: Puxar dados da nuvem ANTES de verificar permissões
                if (typeof FirebaseDB !== 'undefined' && FirebaseDB.syncLoad) {
                    try {
                        await FirebaseDB.syncLoad();
                        // Recarregar state.users do localStorage atualizado
                        const stored = localStorage.getItem(STORAGE_KEYS.USERS);
                        if (stored) {
                            try { state.users = JSON.parse(stored); } catch(e) {}
                        }
                    } catch (e) {
                        console.warn('Falha ao sincronizar dados da nuvem antes do login:', e);
                    }
                }

                const localUser = state.users.find(u => u.username && u.username.toLowerCase() === user.email.toLowerCase());
                if (localUser) {
                    state.currentUser = localUser;
                    setupApplication(activeTabId);
                } else if (user.email.toLowerCase() === 'cleyton.silva@nobelpack.com.br' || user.email.toLowerCase() === 'admin@nobelpack.com.br') {
                    // Auto-criação de perfil de administrador para evitar lockout
                    const newAdm = {
                        id: crypto.randomUUID(),
                        name: 'Cleyton Silva (ADM)',
                        username: user.email.toLowerCase(),
                        password: 'Protegida (Firebase)',
                        roles: ['adm', 'Administrador', 'Supervisor', 'Operador']
                    };
                    state.users.push(newAdm);
                    state.persist('LogCub_Users', state.users);
                    state.currentUser = newAdm;
                    setupApplication(activeTabId);
                    alert('Perfil de Administrador vinculado com sucesso!');
                } else {
                    firebase.auth().signOut();
                    alert('Usuário logado no Google não possui cadastro interno de permissões no LogCub.');
                    state.currentUser = null;
                    renderLogin();
                }
            } else {
                state.currentUser = null;
                renderLogin();
            }
        });
    } else {
        if (!state.currentUser) {
            renderLogin();
            return;
        }
        setupApplication(activeTabId);
    }
};

const setupApplication = (activeTabId) => {
    // Remove o overlay de login e restaura a visibilidade do app
    const loginOverlay = document.getElementById('logcub-login-overlay');
    if (loginOverlay) loginOverlay.remove();
    const appEl = document.getElementById('app');
    if (appEl) appEl.style.display = '';

    // Setup Sidebar User Area
    const userArea = document.getElementById('user-area');
    userArea.innerHTML = `
        <div class="user-sidebar-card">
            <div class="user-sidebar-info">
                <span class="user-sidebar-name">${state.currentUser.name}</span>
                <span class="user-sidebar-role">${state.currentUser.roles.join(', ')}</span>
            </div>
            <div class="user-sidebar-actions">
                <button id="theme-toggle-btn" class="btn btn-sidebar btn-change-pass" title="Alternar Tema">
                    <i data-lucide="${state.theme === 'dark' ? 'sun' : 'moon'}"></i> 
                    Tema ${state.theme === 'dark' ? 'Claro' : 'Escuro'}
                </button>
                <button id="change-pass-btn" class="btn btn-sidebar btn-change-pass" title="Alterar Senha">
                    <i data-lucide="key"></i> Alterar Senha
                </button>
                <button id="logout-btn" class="btn btn-sidebar btn-logout" title="Sair">
                    <i data-lucide="log-out"></i> Sair do Sistema
            </div>
            <div style="text-align: center; margin-top: 1rem; font-size: 0.65rem; color: var(--text-muted); opacity: 0.6; width: 100%;">
                Versão: Beta
            </div>
        </div>
    `;

    document.getElementById('logout-btn').onclick = () => state.logout();
    document.getElementById('change-pass-btn').onclick = () => {
        if (confirm('Deseja receber o e-mail oficial de redefinição de senha para sua conta atual?')) {
            firebase.auth().sendPasswordResetEmail(state.currentUser.username)
                .then(() => {
                    renderToast('Verifique sua caixa de entrada para alterar a senha.', 'success');
                })
                .catch(error => {
                    console.error(error);
                    renderToast('Erro ao enviar o e-mail de redefinição.', 'error');
                });
        }
    };
    document.getElementById('theme-toggle-btn').onclick = () => {
        const activeTabBtn = document.querySelector('.nav-btn.active');
        const activeTabId = activeTabBtn ? activeTabBtn.dataset.tab : 'cadastros';
        state.toggleTheme();
        initApp(activeTabId); 
    };

    // Setup Navigation based on permissions
    const nav = document.getElementById('main-nav');
    const tabsList = [
        { id: 'cadastros', icon: 'database', label: 'Cadastros', show: true },
        { id: 'resultados', icon: 'bar-chart-3', label: 'Resultados', show: state.can('view_results') },
        { id: 'simulacao', icon: 'flask-conical', label: 'Simulação', show: state.can('view_simulation') },
        { id: 'dashboards', icon: 'pie-chart', label: 'Dashboard', show: state.can('view_dashboard') },
        { id: 'gestao', icon: 'settings', label: 'Gestão', show: state.can('manage_users') }
    ];

    nav.innerHTML = tabsList.filter(t => t.show).map(t => `
        <button class="nav-btn" data-tab="${t.id}">
            <i data-lucide="${t.icon}"></i>
            <span>${t.label}</span>
        </button>
    `).join('');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabs[btn.dataset.tab]();
        };
    });

    // Set active tab
    const finalTabId = activeTabId || 'cadastros';
    const targetBtn = document.querySelector(`.nav-btn[data-tab="${finalTabId}"]`);
    if (targetBtn) {
        targetBtn.classList.add('active');
        tabs[finalTabId]();
    }
    
    lucide.createIcons();
};

// Modal de troca de senha removido na migração para o Firebase Auth

window.onload = () => {
    // --- Sincronização Inicial da Nuvem ---
    try {
        if (window.FirebaseDB) {
            FirebaseDB.listen(() => {
                console.log('Dados LogCub atualizados pela nuvem.');
                // Re-hydrate state from synced localStorage
                state.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRODUCTS) || '[]');
                state.parameters = JSON.parse(localStorage.getItem(STORAGE_KEYS.PARAMETERS) || JSON.stringify(DEFAULT_PARAMETERS));
                state.simulations = JSON.parse(localStorage.getItem(STORAGE_KEYS.SIMULATIONS) || '[]');
                state.users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
                
                // Relink Branding
                state.updateBranding();
                
                // Triggers re-render if user is already logged in
                if (state.currentUser) {
                    const activeTabLink = document.querySelector('.sidebar a.active');
                    if (activeTabLink) {
                        const viewId = activeTabLink.getAttribute('onclick').match(/'([^']+)'/)[1];
                        switchView(viewId);
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Erro ao inicializar Firebase Sync.', e);
    }
    
    initApp();
};

// ==========================================
// DB INTEGRATION & BACKUP SCHEDULER (LogCub)
// ==========================================
window.LogCubDB = {
    exportDatabase: () => {
        const fullDB = {
            products: state.products,
            simulations: localStorage.getItem(STORAGE_KEYS.SIMULATIONS) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.SIMULATIONS)) : [],
            users: state.users,
            theme: state.theme
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDB, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `logcub_backup_${new Date().toISOString().split('T')[0]}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        renderToast('Backup exportado com sucesso!', 'success');
    },

    importDatabase: () => {
        const fileInput = document.getElementById('db-import-file');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            renderToast('Por favor, selecione um arquivo .json primeiro.', 'error');
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedDB = JSON.parse(e.target.result);
                
                // Merge users (by username)
                if (importedDB.users && Array.isArray(importedDB.users)) {
                    importedDB.users.forEach(u => {
                        if (!state.users.some(existing => existing.username === u.username)) {
                            state.users.push(u);
                        }
                    });
                    state.persist(STORAGE_KEYS.USERS, state.users);
                }

                // Merge products (by id)
                if (importedDB.products && Array.isArray(importedDB.products)) {
                    importedDB.products.forEach(p => {
                        if (!state.products.some(existing => existing.id === p.id)) {
                            state.products.push(p);
                        }
                    });
                    state.persist(STORAGE_KEYS.PRODUCTS, state.products);
                }

                // Merge simulations (by id)
                if (importedDB.simulations && Array.isArray(importedDB.simulations)) {
                    const currentSims = localStorage.getItem(STORAGE_KEYS.SIMULATIONS) ? JSON.parse(localStorage.getItem(STORAGE_KEYS.SIMULATIONS)) : [];
                    importedDB.simulations.forEach(s => {
                        if (!currentSims.some(existing => existing.id === s.id)) {
                            currentSims.push(s);
                        }
                    });
                    localStorage.setItem(STORAGE_KEYS.SIMULATIONS, JSON.stringify(currentSims));
                }

                // Import theme
                if (importedDB.theme) {
                    state.theme = importedDB.theme;
                    state.persist(STORAGE_KEYS.THEME, state.theme);
                }

                renderToast('Base de dados sincronizada com sucesso! A página será recarregada.', 'success');
                setTimeout(() => window.location.reload(), 2000);

            } catch (err) {
                console.error(err);
                renderToast('Erro ao ler o arquivo. Certifique-se de que é um JSON válido do LogCub.', 'error');
            }
        };
        reader.readAsText(file);
    },

    toggleBackupFields: () => {
        const freq = document.getElementById('bkp-freq')?.value;
        const groupW = document.getElementById('group-weekday');
        const groupM = document.getElementById('group-monthday');
        if (!groupW || !groupM) return;
        groupW.style.display = freq === 'weekly' ? 'block' : 'none';
        groupM.style.display = freq === 'monthly' ? 'block' : 'none';
    },

    saveBackupConfig: (e) => {
        e.preventDefault();
        const config = {
            active: document.getElementById('bkp-active').value === 'true',
            freq: document.getElementById('bkp-freq').value,
            weekday: parseInt(document.getElementById('bkp-weekday').value),
            monthday: parseInt(document.getElementById('bkp-monthday').value),
            time: document.getElementById('bkp-time').value
        };
        localStorage.setItem('LogCub_BackupConfig', JSON.stringify(config));
        renderToast('Configuração de Backup Automático salva!', 'success');
    }
};

// Scheduler Polling
setInterval(() => {
    if (!state.currentUser) return; // Only run if logged in

    const rawBkp = localStorage.getItem('LogCub_BackupConfig');
    if (!rawBkp) return;
    const config = JSON.parse(rawBkp);
    if (!config.active) return;

    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMin = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${currentHour}:${currentMin}`;

    if (currentTime !== config.time) return;

    let shouldBackup = false;
    if (config.freq === 'daily') shouldBackup = true;
    else if (config.freq === 'weekly') shouldBackup = now.getDay() === parseInt(config.weekday);
    else if (config.freq === 'monthly') shouldBackup = now.getDate() === parseInt(config.monthday);

    if (!shouldBackup) return;

    const lastBackup = localStorage.getItem('LogCub_LastBackupDate');
    const todayStr = now.toISOString().split('T')[0];
    if (lastBackup === todayStr) return;

    localStorage.setItem('LogCub_LastBackupDate', todayStr);
    console.log('[Autobackup] Triggering scheduled LogCub backup...');
    try {
        window.LogCubDB.exportDatabase();
    } catch (e) {
        console.error('[Autobackup] Failed to export database:', e);
    }
}, 30000);
