// Firebase 설정 및 초기화
const firebaseConfig = {
  apiKey: "AIzaSyA4Q7fbrhlXG9LU67MpUovSLkXrqtHhftc",
  authDomain: "boardgame-bymile.firebaseapp.com",
  projectId: "boardgame-bymile",
  storageBucket: "boardgame-bymile.firebasestorage.app", // 올바른 버킷 주소로 수정
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
let storage;
if (typeof firebase.storage === 'function') {
    storage = firebase.storage();
}

// --- 인증 관리 클래스 ---
class AuthManager {
    constructor() {
        this.currentUser = undefined;
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
    async updateUserProfile(updates) {
        const user = this.getCurrentUser();
        if (!user) throw new Error('로그인이 필요합니다.');
        await user.updateProfile(updates);
        await db.collection('users').doc(user.uid).update(updates);
        this.currentUser = auth.currentUser; // 최신 정보로 갱신
        this.notifyAuthCallbacks(this.currentUser);
    }
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
    async getPosts() { const snap = await this.db.collection('posts').orderBy('createdAt', 'desc').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async getPost(id) {
        const docRef = this.db.collection('posts').doc(id);
        const doc = await docRef.get();
        if (doc.exists) {
            await this.db.runTransaction(async (transaction) => {
                const postDoc = await transaction.get(docRef);
                if (!postDoc.exists) throw "문서가 존재하지 않습니다!";
                const newViewCount = (postDoc.data().viewCount || 0) + 1;
                transaction.update(docRef, { viewCount: newViewCount });
            });
            const updatedDoc = await docRef.get();
            return { id: updatedDoc.id, ...updatedDoc.data() };
        }
        return null;
    }
    
    async uploadPostMedia(postId, file, fileNamePrefix = '') {
        if (!storage) throw new Error("Firebase Storage가 초기화되지 않았습니다.");
        
        // Handle cases where file might not have a name (e.g., a Blob from canvas)
        const originalFileName = file.name || `thumbnail-${Date.now()}.jpg`;
        const fileExtension = originalFileName.split('.').pop();
        
        const fileName = `${fileNamePrefix}${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
        const filePath = `posts/${postId}/${fileName}`;
        const fileRef = storage.ref(filePath);
        const metadata = { contentType: file.type };
        const snapshot = await fileRef.put(file, metadata);
        return await snapshot.ref.getDownloadURL();
    }

    async addPost(data) {
        const docRef = this.db.collection('posts').doc();
        const postDataForFirestore = {
            title: data.title,
            author: data.author,
            postType: data.postType,
            viewCount: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        };
        
        if (data.postType === 'card-news') {
            postDataForFirestore.media = [];
            postDataForFirestore.thumbnailUrl = '';

            if (data.thumbnailFile) {
                 postDataForFirestore.thumbnailUrl = await this.uploadPostMedia(docRef.id, data.thumbnailFile, 'thumbnail_');
            }

            if (data.files && data.files.length > 0) {
                const filesToUpload = data.files.map(mediaObject => mediaObject.file);
                const uploadPromises = filesToUpload.map(file => this.uploadPostMedia(docRef.id, file));
                const urls = await Promise.all(uploadPromises);
                
                postDataForFirestore.media = data.files.map((mediaObject, index) => ({
                    url: urls[index],
                    type: mediaObject.type
                }));

                if (!postDataForFirestore.thumbnailUrl && postDataForFirestore.media.length > 0) {
                    if (postDataForFirestore.media[0].type === 'image') {
                        postDataForFirestore.thumbnailUrl = postDataForFirestore.media[0].url;
                    }
                }
            }
        } else if (data.postType === 'standard') {
            postDataForFirestore.content = data.content || '';
            postDataForFirestore.thumbnailUrl = data.thumbnailUrl || '';
        }

        await docRef.set(postDataForFirestore);
        return {id: docRef.id, ...postDataForFirestore};
    }
    
    async updatePost(id, data) {
        const postDataForFirestore = {
            title: data.title,
            author: data.author,
            postType: data.postType,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    
        if (data.postType === 'card-news') {
            postDataForFirestore.content = firebase.firestore.FieldValue.delete();
            
            let thumbnailUrl = '';
            if (data.thumbnailFile) {
                thumbnailUrl = await this.uploadPostMedia(id, data.thumbnailFile, 'thumbnail_');
            }
    
            const uploadPromises = data.files.map(fileOrMedia => {
                if (fileOrMedia.file instanceof File) {
                    return this.uploadPostMedia(id, fileOrMedia.file);
                }
                return Promise.resolve(fileOrMedia.url);
            });
            const urls = await Promise.all(uploadPromises);

            const newMedia = data.files.map((fileOrMedia, index) => ({
                url: urls[index],
                type: fileOrMedia.type
            }));
    
            postDataForFirestore.media = newMedia;
            postDataForFirestore.thumbnailUrl = thumbnailUrl;

            if (!postDataForFirestore.thumbnailUrl && newMedia.length > 0) {
                 if (newMedia[0].type === 'image') {
                    postDataForFirestore.thumbnailUrl = newMedia[0].url;
                 } else {
                    const existingData = (await this.db.collection('posts').doc(id).get()).data();
                    postDataForFirestore.thumbnailUrl = existingData.thumbnailUrl || '';
                 }
            }

        } else {
            postDataForFirestore.media = firebase.firestore.FieldValue.delete();
            postDataForFirestore.content = data.content || '';
            postDataForFirestore.thumbnailUrl = data.thumbnailUrl || '';
        }
        
        await this.db.collection('posts').doc(id).update(postDataForFirestore); 
    }
    
    async deletePost(id) { await this.db.collection('posts').doc(id).delete(); }
    
    // Comments
    async getComments(postId) { const snap = await this.db.collection('posts').doc(postId).collection('comments').orderBy('createdAt', 'asc').get(); return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); }
    async addComment(postId, text) { const user = auth.currentUser; if (!user) throw new Error("로그인이 필요합니다."); await this.db.collection('posts').doc(postId).collection('comments').add({ text, userId: user.uid, userName: user.displayName, userPhotoUrl: user.photoURL, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
    async deleteComment(postId, commentId) {
        const user = auth.currentUser;
        if (!user) throw new Error("로그인이 필요합니다.");
        const commentRef = this.db.collection('posts').doc(postId).collection('comments').doc(commentId);
        const commentDoc = await commentRef.get();
        if (commentDoc.exists && commentDoc.data().userId === user.uid) {
            await commentRef.delete();
        } else {
            throw new Error("댓글을 삭제할 권한이 없습니다.");
        }
    }

    // Profile Images
    async uploadProfileImage(userId, file) {
        if (!storage) throw new Error("Firebase Storage가 초기화되지 않았습니다.");
        const filePath = `profileImages/${userId}/${Date.now()}_${file.name}`;
        const fileRef = storage.ref(filePath);
        await fileRef.put(file);
        return await fileRef.getDownloadURL();
    }
    
    // Visit Logs
    async getVisitLogs() {
        const snapshot = await this.db.collection('visitLogs').orderBy('timestamp', 'desc').limit(100).get();
        return snapshot.docs.map(doc => doc.data());
    }
}

// --- 방문자 로그 기록 클래스 ---
class VisitLogger {
    constructor(authManager) {
        this.db = db;
        this.authManager = authManager;
        this.logVisit();
    }

    async getIpAddress() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            if (!response.ok) return 'unknown';
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('IP 주소를 가져오는 데 실패했습니다.', error);
            return 'unknown';
        }
    }

    async logVisit() {
        if (sessionStorage.getItem('visitLogged')) return;

        const ipAddress = await this.getIpAddress();
        this.authManager.onAuthStateChanged(async (user) => {
            if (sessionStorage.getItem('visitLogged')) return;

            const logData = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                identifier: user ? user.displayName : ipAddress,
                isLoggedIn: !!user,
                email: user ? user.email : null,
                userAgent: navigator.userAgent
            };

            await this.db.collection('visitLogs').add(logData);
            sessionStorage.setItem('visitLogged', 'true');
        });
    }
}


window.authManager = new AuthManager();
window.favoriteManager = new FavoriteManager(window.authManager);
window.boardGameAPI = new BoardGameAPI();
if (!window.visitLogger) {
    window.visitLogger = new VisitLogger(window.authManager);
}
window.firebaseInitialized = true;

