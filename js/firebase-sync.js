/**
 * Firebase Sync Controller for LogCub
 * ProteÃ§Ã£o AvanÃ§ada contra Perda de Dados
 */

const firebaseConfig = {
    apiKey: "AIzaSyB8esLUJzqnumckLfjf5isY3qAcbw0pZ6s",
    authDomain: "nobelpack-systems-4d510.firebaseapp.com",
    databaseURL: "https://nobelpack-systems-4d510-default-rtdb.firebaseio.com",
    projectId: "nobelpack-systems-4d510",
    storageBucket: "nobelpack-systems-4d510.firebasestorage.app",
    messagingSenderId: "661674699484",
    appId: "1:661674699484:web:fa68c08bc3d9398d90e219",
    measurementId: "G-EWFDHF9CDE"
};

let dbRef = null;
let isFirebaseInitialized = false;
let isDataLoaded = false; // Trava de seguranÃ§a: impede salvar antes de carregar

const FirebaseDB = {
    init: () => {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            dbRef = firebase.database().ref('logcub_db');
            isFirebaseInitialized = true;
            console.log('Firebase Cloud Database Conectado (LogCub).');
        } catch (error) {
            console.error('Falha ao inicializar o Firebase:', error);
        }
    },

    // Carregamento inicial obrigatÃ³rio
    syncLoad: async () => {
        if (!isFirebaseInitialized) return null;
        try {
            console.log('Firebase (LogCub): Sincronizando entrada...');
            const snapshot = await dbRef.once('value');
            if (snapshot.exists()) {
                const cloudData = snapshot.val();
                if (cloudData.products) localStorage.setItem('cr_products', cloudData.products);
                if (cloudData.parameters) localStorage.setItem('cr_parameters', cloudData.parameters);
                if (cloudData.simulations) localStorage.setItem('cr_simulations', cloudData.simulations);
                if (cloudData.users) localStorage.setItem('cr_users', cloudData.users);

                isDataLoaded = true;
                console.log('Firebase (LogCub): Dados carregados. SincronizaÃ§Ã£o de saÃ­da liberada.');
                return cloudData;
            } else {
                isDataLoaded = true; // Nuvem vazia Ã© um estado vÃ¡lido
                console.log('Firebase (LogCub): Nuvem vazia. Pronto para novos dados.');
                return null;
            }
        } catch (error) {
            console.error('Firebase (LogCub): Erro no syncLoad:', error);
            return null;
        }
    },

    // Monitoramento em tempo real
    listen: (onUpdateCallback) => {
        if (!isFirebaseInitialized) return;

        dbRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const cloudData = snapshot.val();
                const localProds = localStorage.getItem('cr_products');

                // SÃ³ atualiza se houver mudanÃ§a real e nÃ£o for um downgrade de dados
                if (JSON.stringify(cloudData.products) !== JSON.stringify(localProds)) {
                    console.log('Firebase (LogCub): AtualizaÃ§Ã£o recebida da nuvem.');
                    if (cloudData.products) localStorage.setItem('cr_products', cloudData.products);
                    if (cloudData.parameters) localStorage.setItem('cr_parameters', cloudData.parameters);
                    if (cloudData.simulations) localStorage.setItem('cr_simulations', cloudData.simulations);
                    if (cloudData.users) localStorage.setItem('cr_users', cloudData.users);

                    isDataLoaded = true;
                    if (onUpdateCallback) onUpdateCallback();
                }
            } else {
                isDataLoaded = true;
            }
        });
    },

    // GravaÃ§Ã£o segura na nuvem
    syncSave: (isManualWipe = false) => {
        if (!isFirebaseInitialized) return;

        // SEGURANÃ‡A: Nunca salva se a flag isDataLoaded for falsa
        // Isso impede que um dispositivo recÃ©m-logado apague a nuvem antes de carregar os dados dela
        if (!isDataLoaded && !isManualWipe) {
            console.warn('Firebase (LogCub): syncSave BLOQUEADO. Aguardando carregamento inicial para evitar perda de dados.');
            return;
        }

        const latestLocalData = {
            products: localStorage.getItem('cr_products'),
            parameters: localStorage.getItem('cr_parameters'),
            simulations: localStorage.getItem('cr_simulations'),
            users: localStorage.getItem('cr_users')
        };

        dbRef.transaction((currentCloudData) => {
            if (currentCloudData && !isManualWipe) {
                let cloudProdsCount = 0;
                let localProdsCount = 0;

                try {
                    if (currentCloudData.products) {
                        const p = JSON.parse(currentCloudData.products);
                        cloudProdsCount = Array.isArray(p) ? p.length : 0;
                    }
                    if (latestLocalData.products) {
                        const p = JSON.parse(latestLocalData.products);
                        localProdsCount = Array.isArray(p) ? p.length : 0;
                    }
                } catch (e) { console.error('Erro no parser da transaÃ§Ã£o:', e); }

                // TRAVA DE SEGURANÃ‡A REFORÃ‡ADA:
                // Se a nuvem tem dados e o local estÃ¡ vindo vazio ou com perda massiva, aborta o salvamento automÃ¡tico.
                if (cloudProdsCount > 0 && localProdsCount === 0) {
                    console.warn('SAFETY LOCK (LogCub): Bloqueada tentativa de apagar produtos da nuvem.');
                    return; // Aborta a transaÃ§Ã£o
                }

                if (cloudProdsCount > (localProdsCount + 10) && localProdsCount > 0) {
                    console.warn(`SAFETY LOCK (LogCub): Nuvem tem ${cloudProdsCount} itens e Local tem apenas ${localProdsCount}. PossÃ­vel perda de dados detectada. Abortando syncSave.`);
                    return; // Aborta a transaÃ§Ã£o
                }
            }

            return latestLocalData;
        }, (error, committed) => {
            if (error) console.error('Firebase (LogCub) Erro no Sync:', error);
            else if (!committed) console.log('Firebase (LogCub) Sync Protegido contra Perda.');
            else console.log('Firebase (LogCub) Cloud Sincronizada.');
        });
    }
};

FirebaseDB.init();
window.FirebaseDB = FirebaseDB;
