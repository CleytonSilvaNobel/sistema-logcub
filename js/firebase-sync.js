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

    // Puxa toda a árvore de dados da nuvem para preencher o LocalStorage (Chamado 1x no login)
    syncLoad: async () => {
        if (!isFirebaseInitialized) return null;
        try {
            const snapshot = await dbRef.once('value');
            if (snapshot.exists()) {
                const cloudData = snapshot.val();
                if (cloudData.products) localStorage.setItem('cr_products', cloudData.products);
                if (cloudData.parameters) localStorage.setItem('cr_parameters', cloudData.parameters);
                if (cloudData.simulations) localStorage.setItem('cr_simulations', cloudData.simulations);
                if (cloudData.users) localStorage.setItem('cr_users', cloudData.users);
                return cloudData;
            }
            return null; // DB was empty
        } catch (error) {
            console.error('Erro ao baixar os dados do Firebase:', error);
            throw error;
        }
    },

    // Empurra a versão do LocalStorage atualizada para a Nuvem de forma silenciosa e no background
    syncSave: () => {
        if (!isFirebaseInitialized) return;
        
        const latestLocalData = {
            products: localStorage.getItem('cr_products'),
            parameters: localStorage.getItem('cr_parameters'),
            simulations: localStorage.getItem('cr_simulations'),
            users: localStorage.getItem('cr_users')
        };
        
        // The process runs asynchronously not blocking the UI thread
        dbRef.set(latestLocalData)
            .then(() => {
                // Sincronização concluída invisivelmente
            })
            .catch((error) => {
                console.error('Erro ao sincronizar as modificações do sistema com o Firebase:', error);
            });
    }
};

// Initialize as soon as script is parsed
FirebaseDB.init();
