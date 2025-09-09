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
const googleProvider = new firebase.auth.GoogleAuthProvider();

// --- 인증 관리 클래스 ---
class AuthManager {
    constructor() {
        this.currentUser = undefined; // 초기 상태를 undefined로 설정
        this.authCallbacks = [];
        this._init();
    }
    _init() {
        auth.onAuthStateChanged(user => {
            this.currentUser = user;
            this.notifyAuthCallbacks(user);
            if(user) this.ensureUserDocument(user);
        });
    }
    async ensureUserDocument(user) {
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            await userRef.set({
                displayName: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            await userRef.update({ lastLoginAt: firebase.firestore.FieldValue.serverTimestamp() });
        }
    }
    onAuthStateChanged(callback) {
        this.authCallbacks.push(callback);
        if(this.currentUser !== undefined) callback(this.currentUser);
    }
    notifyAuthCallbacks(user) {
        (this.authCallbacks || []).forEach(cb => cb(user));
    }
    async signInWithGoogle() { return (await auth.signInWithPopup(googleProvider)).user; }
    async signOut() { await auth.signOut(); }
    getCurrentUser() { return auth.currentUser; }
}

// --- 즐겨찾기 관리 클래스 ---
class FavoriteManager {
    constructor(authManager) {
        this.authManager = authManager;
        this.favorites = new Set();
        this.favoriteCallbacks = [];
    }
    onFavoritesChanged(callback) { this.favoriteCallbacks.push(callback); }
    notifyFavoriteCallbacks() { (this.favoriteCallbacks || []).forEach(cb => cb(Array.from(this.favorites))); }
    async loadUserFavorites(userId) {
        const doc = await db.collection('userFavorites').doc(userId).get();
        this.favorites = doc.exists ? new Set(doc.data().gameIds || []) : new Set();
        this.notifyFavoriteCallbacks();
    }
    async toggleFavorite(gameId) {
        const user = this.authManager.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        this.favorites.has(gameId) ? this.favorites.delete(gameId) : this.favorites.add(gameId);
        await db.collection('userFavorites').doc(user.uid).set({ gameIds: Array.from(this.favorites) }, { merge: true });
        this.notifyFavoriteCallbacks();
        return this.favorites.has(gameId);
    }
}

// --- API 래퍼 클래스 ---
class BoardGameAPI {
    constructor() { this.db = db; }
    
    // Games
    async getAllGames() { const snap = await this.db.collection('boardgames').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addGame(data) { const docRef = await this.db.collection('boardgames').add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); return {id: docRef.id, ...data}; }
    async updateGame(id, data) { await this.db.collection('boardgames').doc(id).update({...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp()}); }
    async deleteGame(id) { await this.db.collection('boardgames').doc(id).delete(); }

    // Posts
    async getPosts() { const snap = await this.db.collection('posts').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async getPost(id) { const doc = await this.db.collection('posts').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }
    async addPost(data) { const docRef = await this.db.collection('posts').add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp()}); return {id: docRef.id, ...data}; }
    async updatePost(id, data) { await this.db.collection('posts').doc(id).update(data); }
    async deletePost(id) { await this.db.collection('posts').doc(id).delete(); }
    
    // Comments
    async getComments(postId) { const snap = await this.db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addComment(postId, text) { const user = auth.currentUser; if (!user) throw new Error("로그인이 필요합니다."); await this.db.collection('posts').doc(postId).collection('comments').add({ text, userId: user.uid, userName: user.displayName, userPhotoUrl: user.photoURL, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
}

window.authManager = new AuthManager();
window.favoriteManager = new FavoriteManager(window.authManager);
window.boardGameAPI = new BoardGameAPI();
window.firebaseInitialized = true;
