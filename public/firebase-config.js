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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

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
            if (user) this.ensureUserDocument(user);
        });
    }

    async ensureUserDocument(user) {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    }

    onAuthStateChanged(callback) { this.authCallbacks.push(callback); }
    notifyAuthCallbacks(user) { this.authCallbacks.forEach(cb => cb(user)); }
    async signInWithGoogle() { return (await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())).user; }
    async signOut() { await auth.signOut(); }
    async updateUserProfile(profile) {
        if (!auth.currentUser) throw new Error("Not logged in");
        await auth.currentUser.updateProfile(profile);
        this.notifyAuthCallbacks(auth.currentUser);
    }
}

class FavoriteManager {
    constructor(authManager) { this.authManager = authManager; this.favorites = new Set(); this.callbacks = []; }
    onFavoritesChanged(callback) { this.callbacks.push(callback); }
    notify() { this.callbacks.forEach(cb => cb(Array.from(this.favorites))); }
    async loadUserFavorites(userId) {
        const doc = await db.collection('userFavorites').doc(userId).get();
        this.favorites = new Set(doc.data()?.gameIds || []);
        this.notify();
    }
    async toggleFavorite(gameId) {
        const user = this.authManager.currentUser;
        if (!user) throw new Error("Login required");
        this.favorites.has(gameId) ? this.favorites.delete(gameId) : this.favorites.add(gameId);
        await db.collection('userFavorites').doc(user.uid).set({ gameIds: Array.from(this.favorites) }, { merge: true });
        this.notify();
        return this.favorites.has(gameId);
    }
}

class BoardGameAPI {
    constructor() { this.db = db; }
    
    // Games
    async getAllGames() { const snap = await this.db.collection('boardgames').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addGame(data) { return await this.db.collection('boardgames').add({ ...this.sanitizeData(data), createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    async updateGame(id, data) { await this.db.collection('boardgames').doc(id).update({ ...this.sanitizeData(data), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    async deleteGame(id) { await this.db.collection('boardgames').doc(id).delete(); }

    // Comics
    async getAllComics() { const snap = await this.db.collection('comics').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addComic(data) { return await this.db.collection('comics').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    async updateComic(id, data) { await this.db.collection('comics').doc(id).update(data); }
    async deleteComic(id) { await this.db.collection('comics').doc(id).delete(); }
    
    // Comments
    async getComments(comicId) {
        const snap = await this.db.collection('comments').where('comicId', '==', comicId).orderBy('createdAt', 'asc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    async addComment(data) { return await this.db.collection('comments').add({ ...data, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }

    sanitizeData(data) {
        const sanitized = {};
        for (const key in data) {
            const value = data[key];
            if (value !== undefined && value !== null && value !== '') {
                const numValue = Number(value);
                sanitized[key] = !isNaN(numValue) && value !== '' ? numValue : value;
            }
        }
        return sanitized;
    }
}

window.authManager = new AuthManager();
window.favoriteManager = new FavoriteManager(window.authManager);
window.boardGameAPI = new BoardGameAPI();
window.firebaseInitialized = true;

