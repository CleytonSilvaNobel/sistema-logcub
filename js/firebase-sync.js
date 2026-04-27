/**
 * Firebase Sync Controller for LogCub
 * This script initializes Firebase and provides an async bridge to sync with LocalStorage
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

const FirebaseDB = {
    init: () => {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            // Use Realtime Database connection
            dbRef = firebase.database().ref('logcub_db'); 
            isFirebaseInitialized = true;
            console.log('Firebase Cloud Database Conectado (LogCub).');
        } catch (error) {
            console.error('Falha ao inicializar o Firebase. Verifique suas chaves.', error);
        }
    },

    // Escuta constante da nuvem, injetando dados na tela em tempo real
    listen: (onUpdateCallback) => {
        if (!isFirebaseInitialized) return;
        
        dbRef.on('value', (snapshot) => {
            if (snapshot.exists()) {
                const cloudData = snapshot.val();
                
                const localStr = JSON.stringify({
                    products: localStorage.getItem('cr_products'),
                    parameters: localStorage.getItem('cr_parameters'),
                    simulations: localStorage.getItem('cr_simulations'),
                    users: localStorage.getItem('cr_users')
                });
                
                if (localStr !== JSON.stringify(cloudData)) {
                    console.log('Firebase: Nova atualização recebida da nuvem.');
                    if (cloudData.products) localStorage.setItem('cr_products', cloudData.products);
                    if (cloudData.parameters) localStorage.setItem('cr_parameters', cloudData.parameters);
                    if (cloudData.simulations) localStorage.setItem('cr_simulations', cloudData.simulations);
                    if (cloudData.users) localStorage.setItem('cr_users', cloudData.users);
                    if (onUpdateCallback) onUpdateCallback();
                }
            }
        });
    },

    // Empurra a versão do LocalStorage para a Nuvem com Transação Anti-Concorrência
    syncSave: (isManualWipe = false) => {
        if (!isFirebaseInitialized) return;
        
        console.log('Firebase (LogCub): Iniciando sincronização...');
        
        const latestLocalData = {
            products: localStorage.getItem('cr_products'),
            parameters: localStorage.getItem('cr_parameters'),
            simulations: localStorage.getItem('cr_simulations'),
            users: localStorage.getItem('cr_users')
        };
        
        // Transação para evitar concorrência (Race Condition) no exato milissegundo
        dbRef.transaction((currentCloudData) => {
            // ANTI-WIPE SAFETY: Impede que um dispositivo novo/vazio zere a nuvem
            if (currentCloudData && !isManualWipe) {
                let cloudProdsCount = 0;
                let localProdsCount = 0;
                
                try {
                    if (currentCloudData.products) cloudProdsCount = JSON.parse(currentCloudData.products).length || 0;
                    if (latestLocalData.products) localProdsCount = JSON.parse(latestLocalData.products).length || 0;
                } catch(e) {}

                if (cloudProdsCount > 0 && localProdsCount === 0) {
                    console.warn('SAFETY LOCK (LogCub): Tentativa de sobrescrever nuvem com dados vazios bloqueada.');
                    return; // Aborta transação
                }
            }

            return latestLocalData;
        }, (error, committed, snapshot) => {
            if (error) {
                console.error('Firebase (LogCub): Erro na gravação transacional:', error);
            } else if (!committed) {
                console.log('Firebase (LogCub): Gravação abortada (Trava de Segurança Anti-Wipe acionada).');
            } else {
                console.log('Firebase (LogCub): Dados sincronizados com sucesso.');
            }
        });
    }
};

// Initialize as soon as script is parsed
FirebaseDB.init();

// Expor para o escopo global para que o App.js consiga enxergar
window.FirebaseDB = FirebaseDB;
