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
firebase.initializeApp(firebaseConfig);

// Firebase 서비스 인스턴스
const db = firebase.firestore();
const auth = firebase.auth();

// 초기화 확인
console.log('Firebase 초기화 상태:', {
    app: firebase.app(),
    auth: auth,
    firestore: db,
    config: firebaseConfig
});

// Firestore 설정 (실제 Firebase 사용)
db.settings({
  timestampsInSnapshots: true,
  merge: true
});

// Google Auth Provider 설정
const googleProvider = new firebase.auth.GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

console.log('Google Provider 설정:', googleProvider);

// 인증 관리 클래스
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.authCallbacks = [];
        this.initializeAuth();
    }

    // 인증 상태 초기화
    initializeAuth() {
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.notifyAuthCallbacks(user);
            
            if (user) {
                console.log('사용자 로그인:', user.displayName, user.email);
                this.ensureUserDocument(user);
            } else {
                console.log('사용자 로그아웃');
            }
        });
    }

    // 사용자 문서 생성 확인
    async ensureUserDocument(user) {
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists) {
                await db.collection('users').doc(user.uid).set({
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('새 사용자 문서 생성');
            } else {
                // 마지막 로그인 시간 업데이트
                await db.collection('users').doc(user.uid).update({
                    lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (error) {
            console.error('사용자 문서 처리 실패:', error);
        }
    }

    // 인증 콜백 등록
    onAuthStateChanged(callback) {
        this.authCallbacks.push(callback);
        // 현재 사용자 상태를 즉시 콜백에 전달
        if (this.currentUser !== null) {
            callback(this.currentUser);
        }
    }

    // 인증 콜백 알림
    notifyAuthCallbacks(user) {
        this.authCallbacks.forEach(callback => {
            try {
                callback(user);
            } catch (error) {
                console.error('인증 콜백 실행 오류:', error);
            }
        });
    }

    // Google 로그인
    async signInWithGoogle() {
        try {
            console.log('Google 로그인 시도 시작...');
            
            // 먼저 popup 방식으로 시도 (개발 중에는 더 편함)
            const result = await auth.signInWithPopup(googleProvider);
            console.log('Google 로그인 성공:', result.user);
            return result.user;
        } catch (error) {
            console.error('Google 로그인 실패:', error);
            
            // 팝업이 차단된 경우 redirect 방식으로 시도
            if (error.code === 'auth/popup-blocked') {
                console.log('팝업 차단됨, redirect 방식으로 재시도...');
                try {
                    await auth.signInWithRedirect(googleProvider);
                    return; // redirect는 페이지가 새로고침되므로 여기서 return
                } catch (redirectError) {
                    console.error('Redirect 로그인도 실패:', redirectError);
                    throw new Error('로그인에 실패했습니다. 브라우저 설정을 확인해주세요.');
                }
            }
            
            // 에러 코드별 메시지 처리
            let errorMessage = '로그인에 실패했습니다.';
            
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = '로그인이 취소되었습니다.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = '네트워크 연결을 확인하고 다시 시도해주세요.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.';
                    break;
                case 'auth/configuration-not-found':
                    errorMessage = 'Firebase 설정을 확인해주세요.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Google 로그인이 활성화되지 않았습니다. 관리자에게 문의하세요.';
                    break;
                default:
                    errorMessage = `로그인 실패: ${error.message}`;
                    console.error('로그인 에러 상세:', {
                        code: error.code,
                        message: error.message,
                        stack: error.stack
                    });
            }
            
            throw new Error(errorMessage);
        }
    }

    // 로그아웃
    async signOut() {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('로그아웃 실패:', error);
            throw new Error('로그아웃에 실패했습니다.');
        }
    }

    // 현재 사용자 반환
    getCurrentUser() {
        return this.currentUser;
    }

    // 로그인 상태 확인
    isSignedIn() {
        return this.currentUser !== null;
    }
}

// 즐겨찾기 관리 클래스
class FavoriteManager {
    constructor() {
        this.authManager = window.authManager;
        this.favorites = new Set();
        this.favoriteCallbacks = [];
    }

    // 즐겨찾기 콜백 등록
    onFavoritesChanged(callback) {
        this.favoriteCallbacks.push(callback);
    }

    // 즐겨찾기 콜백 알림
    notifyFavoriteCallbacks() {
        console.log('즐겨찾기 콜백 알림:', Array.from(this.favorites));
        this.favoriteCallbacks.forEach(callback => {
            try {
                callback(Array.from(this.favorites));
            } catch (error) {
                console.error('즐겨찾기 콜백 실행 오류:', error);
            }
        });
    }

    // 사용자 즐겨찾기 로드
    async loadUserFavorites(userId) {
        try {
            console.log('Firestore에서 즐겨찾기 로드:', userId);
            const doc = await db.collection('userFavorites').doc(userId).get();
            
            if (doc.exists) {
                const data = doc.data();
                this.favorites = new Set(data.gameIds || []);
                console.log('로드된 즐겨찾기 데이터:', data.gameIds);
            } else {
                this.favorites = new Set();
                console.log('즐겨찾기 문서 없음, 빈 세트로 초기화');
            }
            
            this.notifyFavoriteCallbacks();
            return Array.from(this.favorites);
        } catch (error) {
            console.error('즐겨찾기 로드 실패:', error);
            this.favorites = new Set();
            return [];
        }
    }

    // 즐겨찾기 추가
    async addToFavorites(gameId) {
        const user = this.authManager.getCurrentUser();
        if (!user) {
            throw new Error('로그인이 필요합니다.');
        }

        try {
            this.favorites.add(gameId);
            
            await db.collection('userFavorites').doc(user.uid).set({
                gameIds: Array.from(this.favorites),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            this.notifyFavoriteCallbacks();
            return true;
        } catch (error) {
            console.error('즐겨찾기 추가 실패:', error);
            this.favorites.delete(gameId); // 롤백
            throw new Error('즐겨찾기 추가에 실패했습니다.');
        }
    }

    // 즐겨찾기 제거
    async removeFromFavorites(gameId) {
        const user = this.authManager.getCurrentUser();
        if (!user) {
            throw new Error('로그인이 필요합니다.');
        }

        try {
            this.favorites.delete(gameId);
            
            await db.collection('userFavorites').doc(user.uid).set({
                gameIds: Array.from(this.favorites),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            this.notifyFavoriteCallbacks();
            return true;
        } catch (error) {
            console.error('즐겨찾기 제거 실패:', error);
            this.favorites.add(gameId); // 롤백
            throw new Error('즐겨찾기 제거에 실패했습니다.');
        }
    }

    // 즐겨찾기 토글
    async toggleFavorite(gameId) {
        if (this.favorites.has(gameId)) {
            await this.removeFromFavorites(gameId);
            return false;
        } else {
            await this.addToFavorites(gameId);
            return true;
        }
    }

    // 즐겨찾기 여부 확인
    isFavorite(gameId) {
        return this.favorites.has(gameId);
    }

    // 즐겨찾기 목록 반환
    getFavorites() {
        return Array.from(this.favorites);
    }

    // 즐겨찾기 초기화
    clearFavorites() {
        this.favorites.clear();
        this.notifyFavoriteCallbacks();
    }
}

// API 래퍼 클래스 (기존 + 즐겨찾기 기능 추가)
class BoardGameAPI {
    constructor() {
        this.collectionName = 'boardgames';
        this.db = db;
    }

    // 모든 게임 조회
    async getAllGames() {
        try {
            const snapshot = await this.db.collection(this.collectionName)
                .orderBy('createdAt', 'desc')
                .get();
            
            const games = [];
            snapshot.forEach(doc => {
                games.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            return games;
        } catch (error) {
            console.error('게임 데이터 조회 실패:', error);
            throw new Error('게임 목록을 불러올 수 없습니다.');
        }
    }

    // 즐겨찾기 게임 조회
    async getFavoriteGames(gameIds) {
        if (!gameIds || gameIds.length === 0) {
            return [];
        }

        try {
            // Firestore in 쿼리는 최대 10개까지만 지원하므로 배치로 처리
            const batches = [];
            const batchSize = 10;
            
            for (let i = 0; i < gameIds.length; i += batchSize) {
                const batch = gameIds.slice(i, i + batchSize);
                batches.push(batch);
            }
            
            const games = [];
            
            for (const batch of batches) {
                const snapshot = await this.db.collection(this.collectionName)
                    .where(firebase.firestore.FieldPath.documentId(), 'in', batch)
                    .get();
                
                snapshot.forEach(doc => {
                    games.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
            }
            
            return games;
        } catch (error) {
            console.error('즐겨찾기 게임 조회 실패:', error);
            throw new Error('즐겨찾기 게임을 불러올 수 없습니다.');
        }
    }

    // 특정 게임 조회
    async getGame(id) {
        try {
            const doc = await this.db.collection(this.collectionName)
                .doc(id)
                .get();
            
            if (!doc.exists) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('게임 조회 실패:', error);
            throw new Error('게임 정보를 불러올 수 없습니다.');
        }
    }

    // 새 게임 추가
    async addGame(gameData) {
        try {
            // 데이터 검증
            this.validateGameData(gameData);
            
            const data = {
                ...this.sanitizeGameData(gameData),
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            const docRef = await this.db.collection(this.collectionName).add(data);
            
            // 추가된 문서 조회
            const newDoc = await docRef.get();
            
            return {
                id: newDoc.id,
                ...newDoc.data()
            };
        } catch (error) {
            console.error('게임 추가 실패:', error);
            throw new Error('게임을 추가할 수 없습니다.');
        }
    }

    // 게임 수정
    async updateGame(id, gameData) {
        try {
            // 데이터 검증
            this.validateGameData(gameData, true);
            
            const docRef = this.db.collection(this.collectionName).doc(id);
            
            // 문서 존재 확인
            const doc = await docRef.get();
            if (!doc.exists) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            const updateData = {
                ...this.sanitizeGameData(gameData),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await docRef.update(updateData);
            
            // 수정된 문서 조회
            const updatedDoc = await docRef.get();
            
            return {
                id: updatedDoc.id,
                ...updatedDoc.data()
            };
        } catch (error) {
            console.error('게임 수정 실패:', error);
            throw new Error('게임을 수정할 수 없습니다.');
        }
    }

    // 게임 삭제
    async deleteGame(id) {
        try {
            const docRef = this.db.collection(this.collectionName).doc(id);
            
            // 문서 존재 확인
            const doc = await docRef.get();
            if (!doc.exists) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            await docRef.delete();
            
            return { message: '게임이 삭제되었습니다.', id };
        } catch (error) {
            console.error('게임 삭제 실패:', error);
            throw new Error('게임을 삭제할 수 없습니다.');
        }
    }

    // 게임 데이터 검증
    validateGameData(data, isUpdate = false) {
        if (!isUpdate && !data.name) {
            throw new Error('게임 이름은 필수입니다.');
        }
        
        if (data.difficulty !== undefined && data.difficulty !== null && data.difficulty !== '') {
            const difficulty = parseFloat(data.difficulty);
            if (isNaN(difficulty) || difficulty < 0 || difficulty > 5) {
                throw new Error('난이도는 0.0에서 5.0 사이의 값이어야 합니다.');
            }
        }
        
        if (data.minPlayers && data.maxPlayers) {
            const min = parseInt(data.minPlayers);
            const max = parseInt(data.maxPlayers);
            if (min > max) {
                throw new Error('최소 인원이 최대 인원보다 클 수 없습니다.');
            }
        }
    }

    // 게임 데이터 정리
    sanitizeGameData(data) {
        const sanitized = {};
        
        // 문자열 필드
        const stringFields = ['name', 'status', 'bestPlayers', 'genre', 'buyer', 'imageUrl', 'youtubeUrl'];
        stringFields.forEach(field => {
            if (data[field] !== undefined) {
                sanitized[field] = data[field] ? String(data[field]).trim() : '';
            }
        });
        
        // 숫자 필드
        if (data.difficulty !== undefined && data.difficulty !== null && data.difficulty !== '') {
            sanitized.difficulty = parseFloat(data.difficulty);
        }
        
        const intFields = ['minPlayers', 'maxPlayers', 'playTime'];
        intFields.forEach(field => {
            if (data[field] !== undefined && data[field] !== null && data[field] !== '') {
                const value = parseInt(data[field]);
                if (!isNaN(value)) {
                    sanitized[field] = value;
                }
            }
        });
        
        // status 값 정리
        if (sanitized.status === 'normal' || sanitized.status === '') {
            sanitized.status = '';
        }
        
        return sanitized;
    }
}

// 전역 인스턴스 생성
window.authManager = new AuthManager();
window.favoriteManager = new FavoriteManager();
window.boardGameAPI = new BoardGameAPI();

// 리디렉션 결과 처리
auth.getRedirectResult().then((result) => {
    if (result.user) {
        console.log('리디렉션으로 로그인 성공:', result.user.displayName);
    }
}).catch((error) => {
    console.error('리디렉션 로그인 실패:', error);
});

// 초기화 상태
window.firebaseInitialized = true;

console.log('Firebase 초기화 완료 (인증 및 즐겨찾기 포함)');