// public/firebase-auth.js

// Firebase Auth와 Firestore 사용자 관리

let currentUser = null;

// 사용자 상태 변화 감지
function initializeAuth() {
    firebase.auth().onAuthStateChanged(async (user) => {
        currentUser = user;
        updateAuthUI();
        
        if (user) {
            // 로그인된 사용자 정보를 Firestore에서 확인/생성
            await ensureUserInFirestore(user);
        }
    });
}

// UI 업데이트 (로그인/마이페이지 버튼)
function updateAuthUI() {
    const authBtn = document.getElementById('authBtn');
    
    if (currentUser) {
        // 로그인된 상태 - 마이페이지 버튼
        authBtn.innerHTML = '👤';
        authBtn.title = '마이페이지';
        authBtn.className = 'profile-btn';
        authBtn.onclick = openMyPage;
    } else {
        // 비로그인 상태 - 로그인 버튼
        authBtn.innerHTML = '로그인';
        authBtn.title = '로그인';
        authBtn.className = 'login-btn';
        authBtn.onclick = signInWithGoogle;
    }
}

// Google 로그인
async function signInWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        
        const result = await firebase.auth().signInWithPopup(provider);
        console.log('로그인 성공:', result.user.displayName);
    } catch (error) {
        console.error('로그인 실패:', error);
        alert('로그인에 실패했습니다. 다시 시도해주세요.');
    }
}

// 로그아웃
async function signOut() {
    try {
        await firebase.auth().signOut();
        console.log('로그아웃 완료');
        // 마이페이지가 열려있다면 닫기
        closeMyPage();
    } catch (error) {
        console.error('로그아웃 실패:', error);
    }
}

// Firestore에 사용자 정보 확인/생성
async function ensureUserInFirestore(user) {
    try {
        const userRef = firebase.firestore().collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            // 첫 로그인 - 실명 입력 모달 표시
            showRealNameModal(user);
        } else {
            // 기존 사용자 - 사용자 정보 로드
            const userData = userDoc.data();
            console.log('기존 사용자:', userData.realName);
        }
    } catch (error) {
        console.error('사용자 정보 확인 실패:', error);
    }
}

// 실명 입력 모달 표시
function showRealNameModal(user) {
    const modal = document.getElementById('realNameModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('realNameInput').focus();
    }
}

// 실명 저장
async function saveRealName() {
    const realNameInput = document.getElementById('realNameInput');
    const realName = realNameInput.value.trim();
    
    if (!realName) {
        alert('실명을 입력해주세요.');
        return;
    }
    
    // 한글 이름 검증 (2-4글자)
    const koreanNameRegex = /^[가-힣]{2,4}$/;
    if (!koreanNameRegex.test(realName)) {
        alert('한글 실명을 2-4글자로 입력해주세요.');
        return;
    }
    
    try {
        const userRef = firebase.firestore().collection('users').doc(currentUser.uid);
        await userRef.set({
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            realName: realName,
            photoURL: currentUser.photoURL,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            rentals: [] // 대여 기록 배열
        });
        
        console.log('사용자 정보 저장 완료:', realName);
        closeRealNameModal();
        alert(`환영합니다, ${realName}님!`);
        
    } catch (error) {
        console.error('사용자 정보 저장 실패:', error);
        alert('정보 저장에 실패했습니다. 다시 시도해주세요.');
    }
}

// 실명 입력 모달 닫기
function closeRealNameModal() {
    const modal = document.getElementById('realNameModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('realNameInput').value = '';
    }
}

// 현재 사용자 정보 가져오기
async function getCurrentUserData() {
    if (!currentUser) return null;
    
    try {
        const userRef = firebase.firestore().collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            return userDoc.data();
        }
        return null;
    } catch (error) {
        console.error('사용자 정보 가져오기 실패:', error);
        return null;
    }
}

// 마이페이지 열기
async function openMyPage() {
    const userData = await getCurrentUserData();
    if (!userData) {
        alert('사용자 정보를 불러올 수 없습니다.');
        return;
    }
    
    // 마이페이지 모달 표시
    showMyPageModal(userData);
}

// 마이페이지 모달 표시
function showMyPageModal(userData) {
    const modal = document.getElementById('myPageModal');
    if (modal) {
        // 사용자 정보 표시
        document.getElementById('userRealName').textContent = userData.realName;
        document.getElementById('userEmail').textContent = userData.email;
        
        // 대여 기록 로드
        loadUserRentals(userData.uid);
        
        modal.classList.remove('hidden');
    }
}

// 마이페이지 닫기
function closeMyPage() {
    const modal = document.getElementById('myPageModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 사용자 대여 기록 로드
async function loadUserRentals(userId) {
    try {
        const rentalsRef = firebase.firestore()
            .collection('rentals')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');
        
        const snapshot = await rentalsRef.get();
        const rentals = [];
        
        snapshot.forEach(doc => {
            rentals.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderUserRentals(rentals);
        
    } catch (error) {
        console.error('대여 기록 로드 실패:', error);
    }
}

// 대여 기록 렌더링
function renderUserRentals(rentals) {
    const rentalsList = document.getElementById('userRentalsList');
    
    if (rentals.length === 0) {
        rentalsList.innerHTML = '<div class="no-rentals">대여 기록이 없습니다.</div>';
        return;
    }
    
    rentalsList.innerHTML = rentals.map(rental => {
        const statusText = getRentalStatusText(rental.status);
        const statusClass = getRentalStatusClass(rental.status);
        
        return `
            <div class="rental-item">
                <div class="rental-header">
                    <h4>${rental.gameName}</h4>
                    <span class="rental-status ${statusClass}">${statusText}</span>
                </div>
                <div class="rental-details">
                    <p>대여 기간: ${formatDate(rental.startDate)} ~ ${formatDate(rental.endDate)}</p>
                    <p>신청일: ${formatDate(rental.createdAt)}</p>
                    ${rental.rejectionReason ? `<p class="rejection-reason">거절 사유: ${rental.rejectionReason}</p>` : ''}
                </div>
                <div class="rental-actions">
                    ${getRentalActionButtons(rental)}
                </div>
            </div>
        `;
    }).join('');
}

// 대여 상태 텍스트
function getRentalStatusText(status) {
    const statusMap = {
        'pending': '신청중',
        'approved': '승인됨',
        'rented': '대여중',
        'returned': '반납완료',
        'rejected': '거절됨'
    };
    return statusMap[status] || status;
}

// 대여 상태 클래스
function getRentalStatusClass(status) {
    return `status-${status}`;
}

// 대여 액션 버튼들
function getRentalActionButtons(rental) {
    const today = new Date();
    const startDate = rental.startDate.toDate ? rental.startDate.toDate() : new Date(rental.startDate);
    
    if (rental.status === 'approved' && startDate <= today) {
        return `<button onclick="startRental('${rental.id}')" class="action-btn start-btn">대여 시작</button>`;
    } else if (rental.status === 'rented') {
        return `<button onclick="returnRental('${rental.id}')" class="action-btn return-btn">반납하기</button>`;
    }
    return '';
}

// 대여 시작
async function startRental(rentalId) {
    try {
        const batch = firebase.firestore().batch();
        
        // 대여 상태 업데이트
        const rentalRef = firebase.firestore().collection('rentals').doc(rentalId);
        batch.update(rentalRef, {
            status: 'rented',
            actualStartDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 게임 상태 업데이트
        const rentalDoc = await rentalRef.get();
        const rentalData = rentalDoc.data();
        const gameRef = firebase.firestore().collection('games').doc(rentalData.gameId);
        batch.update(gameRef, {
            status: 'rented'
        });
        
        await batch.commit();
        
        alert('대여가 시작되었습니다.');
        loadUserRentals(currentUser.uid);
        
    } catch (error) {
        console.error('대여 시작 실패:', error);
        alert('대여 시작에 실패했습니다.');
    }
}

// 반납하기
async function returnRental(rentalId) {
    if (!confirm('정말 반납하시겠습니까?')) return;
    
    try {
        const batch = firebase.firestore().batch();
        
        // 대여 상태 업데이트
        const rentalRef = firebase.firestore().collection('rentals').doc(rentalId);
        batch.update(rentalRef, {
            status: 'returned',
            actualEndDate: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // 게임 상태 복원
        const rentalDoc = await rentalRef.get();
        const rentalData = rentalDoc.data();
        const gameRef = firebase.firestore().collection('games').doc(rentalData.gameId);
        batch.update(gameRef, {
            status: null // 또는 'normal'
        });
        
        await batch.commit();
        
        alert('반납이 완료되었습니다.');
        loadUserRentals(currentUser.uid);
        
    } catch (error) {
        console.error('반납 실패:', error);
        alert('반납에 실패했습니다.');
    }
}

// 날짜 포맷팅
function formatDate(date) {
    if (!date) return '-';
    
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 페이지 로드 시 인증 초기화
document.addEventListener('DOMContentLoaded', function() {
    // Firebase가 로드된 후에 인증 초기화
    if (typeof firebase !== 'undefined') {
        initializeAuth();
    } else {
        // Firebase 로드 대기
        window.addEventListener('load', initializeAuth);
    }
});