// Firebase 9 SDK 설정
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    where,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Firebase 설정
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const FieldValue = { serverTimestamp };

export { app, db, FieldValue };

// 전역 플래그 설정
window.firebaseInitialized = true;

// API 래퍼 클래스
class BoardGameAPI {
    constructor() {
        this.collectionName = 'boardgames';
    }

    // 모든 게임 조회
    async getAllGames() {
        try {
            const q = query(
                collection(db, this.collectionName), 
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('게임 데이터 조회 실패:', error);
            throw error;
        }
    }

    // 특정 게임 조회
    async getGame(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            const snapshot = await getDoc(docRef);
            
            if (!snapshot.exists()) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            return {
                id: snapshot.id,
                ...snapshot.data()
            };
        } catch (error) {
            console.error('게임 조회 실패:', error);
            throw error;
        }
    }

    // 새 게임 추가
    async addGame(gameData) {
        try {
            const data = {
                ...gameData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            const docRef = await addDoc(collection(db, this.collectionName), data);
            
            // 추가된 문서 다시 조회해서 반환
            const newDoc = await getDoc(docRef);
            return {
                id: newDoc.id,
                ...newDoc.data()
            };
        } catch (error) {
            console.error('게임 추가 실패:', error);
            throw error;
        }
    }

    // 게임 수정
    async updateGame(id, gameData) {
        try {
            const docRef = doc(db, this.collectionName, id);
            
            // 문서 존재 확인
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            const updateData = {
                ...gameData,
                updatedAt: serverTimestamp()
            };
            
            await updateDoc(docRef, updateData);
            
            // 수정된 문서 반환
            const updatedDoc = await getDoc(docRef);
            return {
                id: updatedDoc.id,
                ...updatedDoc.data()
            };
        } catch (error) {
            console.error('게임 수정 실패:', error);
            throw error;
        }
    }

    // 게임 삭제
    async deleteGame(id) {
        try {
            const docRef = doc(db, this.collectionName, id);
            
            // 문서 존재 확인
            const snapshot = await getDoc(docRef);
            if (!snapshot.exists()) {
                throw new Error('게임을 찾을 수 없습니다.');
            }
            
            await deleteDoc(docRef);
            
            return { message: '게임이 삭제되었습니다.', id };
        } catch (error) {
            console.error('게임 삭제 실패:', error);
            throw error;
        }
    }

    // 검색
    async searchGames(searchTerm, field = null) {
        try {
            let q;
            
            if (field) {
                // 특정 필드에서 검색 (Firestore는 contains 지원 안함)
                q = query(
                    collection(db, this.collectionName),
                    where(field, '>=', searchTerm),
                    where(field, '<=', searchTerm + '\uf8ff')
                );
            } else {
                // 전체 검색은 클라이언트에서 처리
                q = query(collection(db, this.collectionName));
            }
            
            const snapshot = await getDocs(q);
            let results = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // 전체 필드 검색인 경우 클라이언트 필터링
            if (!field) {
                const searchLower = searchTerm.toLowerCase();
                results = results.filter(item => {
                    return Object.values(item).some(value => 
                        value && value.toString().toLowerCase().includes(searchLower)
                    );
                });
            }
            
            return results;
        } catch (error) {
            console.error('검색 실패:', error);
            throw error;
        }
    }

    // 필터링
    async filterGames(filters) {
        try {
            let q = collection(db, this.collectionName);
            
            // 필터 조건 적용
            Object.keys(filters).forEach(key => {
                if (filters[key] && key !== 'createdAt' && key !== 'updatedAt') {
                    q = query(q, where(key, '==', filters[key]));
                }
            });
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('필터링 실패:', error);
            throw error;
        }
    }
}

// 전역 API 인스턴스
window.boardGameAPI = new BoardGameAPI();
console.log('Firebase 초기화 완료');
