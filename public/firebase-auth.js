// firebase-auth.js (Firebase v9+ 모듈 방식)
import {
    initializeApp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';

import {
    getAuth,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    getDocs,
    serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyA4Q7fbrhlXG9LU67MpUovSLkXrqtHhftc",
    authDomain: "boardgame-bymile.firebaseapp.com",
    projectId: "boardgame-bymile",
    storageBucket: "boardgame-bymile.firebasestorage.app",
    messagingSenderId: "450054853638",
    appId: "1:450054853638:web:f0c7895aa7e38cd7915f87",
    measurementId: "G-F5FS0S6VTE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;

// 사용자 상태 변화 감지
function initializeAuth() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        updateAuthUI();

        if (user) {
            await ensureUserInFirestore(user);
        }
    });
}

// UI 업데이트
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    if (!authBtn) return;

    if (currentUser) {
        authBtn.innerHTML = '👤';
        authBtn.title = '마이페이지';
        authBtn.className = 'profile-btn';
        authBtn.onclick = openMyPage;
    } else {
        authBtn.innerHTML = '로그인';
        authBtn.title = '로그인';
        authBtn.className = 'login-btn';
        authBtn.onclick = signInWithGoogle;
    }
}

// Google 로그인
async function signInWithGoogle() {
    try {
        const provider = new GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');

        const result = await signInWithPopup(auth, provider);
        console.log('로그인 성공:', result.user.displayName);
    } catch (error) {
        console.error('로그인 실패:', error);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
    }
}

// 로그아웃
async function logout() {
    try {
        await signOut(auth);
        console.log('로그아웃 완료');
        closeMyPage();
    } catch (error) {
        console.error('로그아웃 실패:', error);
    }
}

// 사용자 Firestore 정보 확인 및 생성
async function ensureUserInFirestore(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            showRealNameModal(user);
        } else {
            const userData = userSnap.data();
            console.log('기존 사용자:', userData.realName);
        }
    } catch (error) {
        console.error('사용자 정보 확인 실패:', error);
    }
}

// 실명 저장
async function saveRealName() {
    const realNameInput = document.getElementById('realNameInput');
    const realName = realNameInput.value.trim();

    const koreanNameRegex = /^[가-힣]{2,4}$/;
    if (!koreanNameRegex.test(realName)) {
        alert('한글 실명을 2-4글자로 입력해주세요.');
        return;
    }

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            realName,
            photoURL: currentUser.photoURL,
            createdAt: serverTimestamp(),
            rentals: []
        });

        console.log('사용자 정보 저장 완료:', realName);
        closeRealNameModal();
        alert(`환영합니다, ${realName}님!`);
    } catch (error) {
        console.error('정보 저장 실패:', error);
        alert('정보 저장에 실패했습니다. 다시 시도해주세요.');
    }
}

// 마이페이지 관련 함수들
async function getCurrentUserData() {
    if (!currentUser) return null;

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? userSnap.data() : null;
    } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error);
        return null;
    }
}

async function openMyPage() {
    const userData = await getCurrentUserData();
    if (!userData) {
        alert('사용자 정보를 불러올 수 없습니다.');
        return;
    }
    showMyPageModal(userData);
}

// 실명 입력 및 마이페이지 UI
function showRealNameModal(user) {
    const modal = document.getElementById('realNameModal');
    modal?.classList.remove('hidden');
    document.getElementById('realNameInput')?.focus();
}

function closeRealNameModal() {
    const modal = document.getElementById('realNameModal');
    modal?.classList.add('hidden');
    const input = document.getElementById('realNameInput');
    if (input) input.value = '';
}

function showMyPageModal(userData) {
    const modal = document.getElementById('myPageModal');
    if (!modal) return;

    document.getElementById('userRealName').textContent = userData.realName;
    document.getElementById('userEmail').textContent = userData.email;

    loadUserRentals(currentUser.uid);
    modal.classList.remove('hidden');
}

function closeMyPage() {
    document.getElementById('myPageModal')?.classList.add('hidden');
}

// 대여 기록 관련 함수 생략 (필요시 추가 가능)

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    initializeAuth();
});

// firebase-auth.js 하단에 추가
window.saveRealName = saveRealName;
window.openMyPage = openMyPage;
window.closeMyPage = closeMyPage;
window.signInWithGoogle = signInWithGoogle;
window.signOut = logout; // 이름 바꾼 함수인 경우
