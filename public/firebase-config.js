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

// Firestore 데이터베이스 인스턴스
const db = firebase.firestore();

// Firestore 설정
db.settings({
  timestampsInSnapshots: true,
  merge: true
});

// API 래퍼 클래스
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

// 전역 API 인스턴스
window.boardGameAPI = new BoardGameAPI();

// 초기화 상태
window.firebaseInitialized = true;

console.log('Firebase 초기화 완료');