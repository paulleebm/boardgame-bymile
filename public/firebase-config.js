// Firebase 설정 및 초기화
const firebaseConfig = {
  apiKey: "AIzaSyA4Q7fbrhlXG9LU67MpUovSLkXrqtHhftc",
  authDomain: "boardgame-bymile.firebaseapp.com",
  projectId: "boardgame-bymile",
  storageBucket: "boardgame-bymile.appspot.com",
  messagingSenderId: "450054853638",
  appId: "1:450054853638:web:f0c7895aa7e38cd7915f87",
  measurementId: "G-F5FS0S6VTE"
};

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

db.settings({
  timestampsInSnapshots: true,
  merge: true
});

const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authCallbacks = [];
        this.initializeAuth();
    }

    initializeAuth() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.notifyAuthCallbacks(user);
            if (user) {
                this.ensureUserDocument(user);
            }
        });
    }

    async ensureUserDocument(user) {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        const userData = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!userDoc.exists) {
            userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await userRef.set(userData);
        } else {
            await userRef.update({ lastLoginAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }

    onAuthStateChanged(callback) {
        this.authCallbacks.push(callback);
        if (this.currentUser) {
            callback(this.currentUser);
        }
    }

    notifyAuthCallbacks(user) {
        this.authCallbacks.forEach(callback => callback(user));
    }

    async signInWithGoogle() {
        try {
            return (await auth.signInWithPopup(googleProvider)).user;
        } catch (error) {
            if (error.code === 'auth/popup-blocked') {
                await auth.signInWithRedirect(googleProvider);
            } else {
                console.error('Google 로그인 실패:', error);
                throw new Error(`로그인 실패: ${error.message}`);
            }
        }
    }

    async signOut() {
        await auth.signOut();
    }

    getCurrentUser() {
        return auth.currentUser;
    }
}

class FavoriteManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.favorites = new Set();
        this.favoriteCallbacks = [];
    }

    onFavoritesChanged(callback) {
        this.favoriteCallbacks.push(callback);
    }

    notifyFavoriteCallbacks() {
        this.favoriteCallbacks.forEach(callback => callback(Array.from(this.favorites)));
    }

    async loadUserFavorites(userId) {
        const doc = await db.collection('userFavorites').doc(userId).get();
        this.favorites = doc.exists ? new Set(doc.data().gameIds || []) : new Set();
        this.notifyFavoriteCallbacks();
        return Array.from(this.favorites);
    }

    async toggleFavorite(gameId) {
        const user = this.authManager.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다.');

        this.favorites.has(gameId) ? this.favorites.delete(gameId) : this.favorites.add(gameId);
        
        await db.collection('userFavorites').doc(user.uid).set({
            gameIds: Array.from(this.favorites),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        this.notifyFavoriteCallbacks();
        return this.favorites.has(gameId);
    }
}

class BoardGameAPI {
    constructor() {
        this.collectionName = 'boardgames';
        this.db = db;
    }

    // getAllGames에서 orderBy 제거
    async getAllGames() {
        try {
            const snapshot = await this.db.collection(this.collectionName).get();
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('게임 데이터 조회 실패:', error);
            throw new Error('게임 목록을 불러올 수 없습니다.');
        }
    }

    async addGame(gameData) {
        const data = {
            ...this.sanitizeGameData(gameData),
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await this.db.collection(this.collectionName).add(data);
        const newDoc = await docRef.get();
        return { id: newDoc.id, ...newDoc.data() };
    }

    async updateGame(id, gameData) {
        const updateData = {
            ...this.sanitizeGameData(gameData),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        await this.db.collection(this.collectionName).doc(id).update(updateData);
    }

    async deleteGame(id) {
        await this.db.collection(this.collectionName).doc(id).delete();
    }

    sanitizeGameData(data) {
        const sanitized = {};
        for (const key in data) {
            const value = data[key];
            if (value !== undefined && value !== null && value !== '') {
                sanitized[key] = typeof value === 'string' ? value.trim() : value;
            }
        }
        if (sanitized.status === 'normal') {
            delete sanitized.status;
        }
        return sanitized;
    }
}

window.authManager = new AuthManager();
window.favoriteManager = new FavoriteManager(window.authManager);
window.boardGameAPI = new BoardGameAPI();
window.firebaseInitialized = true;

auth.getRedirectResult().catch(error => console.error('리디렉션 로그인 실패:', error));

console.log('Firebase 모듈 초기화 완료.');