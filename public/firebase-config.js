// Firebase 설정 및 초기화
const firebaseConfig = {
  apiKey: "AIzaSyA4Q7fbrhlXG9LU67MpUovSLkXrqtHhftc",
  authDomain: "boardgame-bymile.firebaseapp.com",
  projectId: "boardgame-bymile",
  storageBucket: "boardgame-bymile.firebasestorage.app",
  messagingSenderId: "450054853638",
  appId: "1:450054853638:web:f0c7895aa7e38cd7915f87",
  measurementId: "G-F5FS0S6VTE"
};

// Firebase 초기화
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();

// --- API 래퍼 클래스 ---
class BoardGameAPI {
    constructor() { this.db = db; }
    
    // Games
    async getAllGames() { 
        const snap = await this.db.collection('boardgames').get(); 
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
    }
    async addGame(data) { 
        const docRef = await this.db.collection('boardgames').add({...data, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); 
        return {id: docRef.id, ...data}; 
    }
    async updateGame(id, data) { 
        await this.db.collection('boardgames').doc(id).update({...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp()}); 
    }
    async deleteGame(id) { 
        await this.db.collection('boardgames').doc(id).delete(); 
    }

    // Visit Logs
    async getVisitLogs() {
        const snapshot = await this.db.collection('visitLogs').orderBy('timestamp', 'desc').limit(100).get();
        return snapshot.docs.map(doc => doc.data());
    }
}

// --- 방문자 로그 기록 (사용자 페이지에만 적용) ---
class VisitLogger {
    constructor() {
        this.db = db;
        // 관리자 페이지에서는 로그를 기록하지 않으므로, 이 부분을 비워두거나
        // window.location.pathname.includes('admin.html') 등으로 분기처리할 수 있습니다.
        // 여기서는 사용자 페이지에서만 new VisitLogger()를 호출한다고 가정합니다.
    }

    async getIpAddress() {
        try {
            // CORS 이슈나 AD Blocker로 실패할 수 있음
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

        const logData = {
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            identifier: ipAddress, // IP 주소로만 기록
            isLoggedIn: false, // 로그인 기능이 없으므로 항상 false
            userAgent: navigator.userAgent
        };

        await this.db.collection('visitLogs').add(logData);
        sessionStorage.setItem('visitLogged', 'true');
    }
}


window.boardGameAPI = new BoardGameAPI();
window.firebaseInitialized = true;

// admin.html이 아닌 페이지에서만 방문 로그를 기록합니다.
if (!window.location.pathname.includes('admin.html')) {
    const visitLogger = new VisitLogger();
    visitLogger.logVisit();
}