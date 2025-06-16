// public/rental-system.js

// 대여 신청 관련 함수들

// 대여 신청 모달 열기
async function openRentalModal() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }
    
    // Firebase가 초기화되었는지 확인
    if (!window.firebaseInitialized) {
        alert('시스템 로딩 중입니다. 잠시 후 다시 시도해주세요.');
        return;
    }
    
    // 대여 가능한 게임 목록 로드
    await loadAvailableGames();
    
    const modal = document.getElementById('rentalModal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // 오늘 날짜로 초기화
        const today = new Date().toISOString().split('T')[0];
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');
        
        if (startDateInput) {
            startDateInput.value = today;
            startDateInput.min = today;
        }
        
        // 최대 8일 후 날짜 설정
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 8);
        if (endDateInput) {
            endDateInput.max = maxDate.toISOString().split('T')[0];
        }
        
        // 종료일 초기화
        updateEndDate();
    }
}

// 대여 모달 닫기
function closeRentalModal() {
    const modal = document.getElementById('rentalModal');
    if (modal) {
        modal.classList.add('hidden');
        // 폼 초기화
        document.getElementById('rentalForm').reset();
    }
}

// 대여 가능한 게임 목록 로드
async function loadAvailableGames() {
    try {
        const gamesRef = firebase.firestore().collection('games');
        const snapshot = await gamesRef.get();
        const availableGames = [];
        
        snapshot.forEach(doc => {
            const game = { id: doc.id, ...doc.data() };
            
            // 대여 불가능한 상태 체크
            const unavailableStatuses = ['new', 'shipping', 'purchasing', 'rented'];
            
            if (!unavailableStatuses.includes(game.status)) {
                availableGames.push(game);
            }
        });
        
        renderGameSelection(availableGames);
        
    } catch (error) {
        console.error('게임 목록 로드 실패:', error);
    }
}

// 게임 선택 렌더링
function renderGameSelection(games) {
    const gameSelect = document.getElementById('gameSelect');
    
    gameSelect.innerHTML = '<option value="">게임을 선택하세요</option>' +
        games.map(game => 
            `<option value="${game.id}">${game.name}</option>`
        ).join('');
}

// 시작 날짜 변경 시 종료일 업데이트
function updateEndDate() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput.value) {
        const startDate = new Date(startDateInput.value);
        
        // 최소 종료일: 시작일 + 1일
        const minEndDate = new Date(startDate);
        minEndDate.setDate(minEndDate.getDate() + 1);
        endDateInput.min = minEndDate.toISOString().split('T')[0];
        
        // 최대 종료일: 시작일 + 8일
        const maxEndDate = new Date(startDate);
        maxEndDate.setDate(maxEndDate.getDate() + 8);
        endDateInput.max = maxEndDate.toISOString().split('T')[0];
        
        // 종료일이 범위를 벗어나면 조정
        if (endDateInput.value) {
            const currentEndDate = new Date(endDateInput.value);
            if (currentEndDate < minEndDate) {
                endDateInput.value = minEndDate.toISOString().split('T')[0];
            } else if (currentEndDate > maxEndDate) {
                endDateInput.value = maxEndDate.toISOString().split('T')[0];
            }
        }
    }
}

// 날짜 충돌 체크
async function checkDateConflict(gameId, startDate, endDate) {
    try {
        const rentalsRef = firebase.firestore()
            .collection('rentals')
            .where('gameId', '==', gameId)
            .where('status', 'in', ['approved', 'rented']);
        
        const snapshot = await rentalsRef.get();
        
        const requestStart = new Date(startDate);
        const requestEnd = new Date(endDate);
        
        for (const doc of snapshot.docs) {
            const rental = doc.data();
            const existingStart = rental.startDate.toDate ? rental.startDate.toDate() : new Date(rental.startDate);
            const existingEnd = rental.endDate.toDate ? rental.endDate.toDate() : new Date(rental.endDate);
            
            // 날짜 겹침 체크
            if (requestStart <= existingEnd && requestEnd >= existingStart) {
                return {
                    conflict: true,
                    conflictPeriod: `${formatDate(existingStart)} ~ ${formatDate(existingEnd)}`
                };
            }
        }
        
        return { conflict: false };
        
    } catch (error) {
        console.error('날짜 충돌 체크 실패:', error);
        return { conflict: false };
    }
}

// 대여 신청 제출
async function submitRental() {
    const gameId = document.getElementById('gameSelect').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 입력값 검증
    if (!gameId || !startDate || !endDate) {
        alert('모든 항목을 입력해주세요.');
        return;
    }
    
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // 날짜 검증
    if (startDateObj < today) {
        alert('시작일은 오늘 이후로 선택해주세요.');
        return;
    }
    
    if (endDateObj <= startDateObj) {
        alert('종료일은 시작일 이후로 선택해주세요.');
        return;
    }
    
    const daysDiff = (endDateObj - startDateObj) / (1000 * 60 * 60 * 24);
    if (daysDiff > 8) {
        alert('대여 기간은 최대 8일입니다.');
        return;
    }
    
    // 날짜 충돌 체크
    const conflictCheck = await checkDateConflict(gameId, startDate, endDate);
    if (conflictCheck.conflict) {
        alert(`선택한 기간에 이미 승인된 대여가 있습니다.\n충돌 기간: ${conflictCheck.conflictPeriod}`);
        return;
    }
    
    try {
        // 게임 정보 가져오기
        const gameDoc = await firebase.firestore().collection('games').doc(gameId).get();
        const gameData = gameDoc.data();
        
        // 대여 신청 데이터 생성
        const rentalData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            gameId: gameId,
            gameName: gameData.name,
            startDate: firebase.firestore.Timestamp.fromDate(startDateObj),
            endDate: firebase.firestore.Timestamp.fromDate(endDateObj),
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        // Firestore에 저장
        await firebase.firestore().collection('rentals').add(rentalData);
        
        alert('대여 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
        closeRentalModal();
        
        // 마이페이지가 열려있다면 새로고침
        if (!document.getElementById('myPageModal').classList.contains('hidden')) {
            loadUserRentals(currentUser.uid);
        }
        
    } catch (error) {
        console.error('대여 신청 실패:', error);
        alert('대여 신청에 실패했습니다. 다시 시도해주세요.');
    }
}

// 관리자 - 모든 대여 신청 로드
async function loadAllRentals() {
    try {
        const rentalsRef = firebase.firestore()
            .collection('rentals')
            .orderBy('createdAt', 'desc');
        
        const snapshot = await rentalsRef.get();
        const rentals = [];
        
        snapshot.forEach(doc => {
            rentals.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        renderAdminRentals(rentals);
        
    } catch (error) {
        console.error('대여 목록 로드 실패:', error);
    }
}

// 관리자 - 대여 목록 렌더링
function renderAdminRentals(rentals) {
    const rentalsList = document.getElementById('adminRentalsList');
    
    if (rentals.length === 0) {
        rentalsList.innerHTML = '<div class="no-rentals">대여 신청이 없습니다.</div>';
        return;
    }
    
    rentalsList.innerHTML = rentals.map(rental => {
        const statusText = getRentalStatusText(rental.status);
        const statusClass = getRentalStatusClass(rental.status);
        
        return `
            <div class="admin-rental-item">
                <div class="rental-header">
                    <h4>${rental.gameName}</h4>
                    <span class="rental-status ${statusClass}">${statusText}</span>
                </div>
                <div class="rental-details">
                    <p><strong>신청자:</strong> ${rental.userEmail}</p>
                    <p><strong>대여 기간:</strong> ${formatDate(rental.startDate)} ~ ${formatDate(rental.endDate)}</p>
                    <p><strong>신청일:</strong> ${formatDate(rental.createdAt)}</p>
                    ${rental.rejectionReason ? `<p class="rejection-reason"><strong>거절 사유:</strong> ${rental.rejectionReason}</p>` : ''}
                </div>
                <div class="admin-rental-actions">
                    ${getAdminActionButtons(rental)}
                </div>
            </div>
        `;
    }).join('');
}

// 관리자 액션 버튼들
function getAdminActionButtons(rental) {
    if (rental.status === 'pending') {
        return `
            <button onclick="approveRental('${rental.id}')" class="action-btn approve-btn">승인</button>
            <button onclick="showRejectModal('${rental.id}')" class="action-btn reject-btn">거절</button>
        `;
    }
    return '';
}

// 대여 승인
async function approveRental(rentalId) {
    if (!confirm('이 대여 신청을 승인하시겠습니까?')) return;
    
    try {
        await firebase.firestore().collection('rentals').doc(rentalId).update({
            status: 'approved',
            approvedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('대여 신청이 승인되었습니다.');
        loadAllRentals();
        
    } catch (error) {
        console.error('대여 승인 실패:', error);
        alert('대여 승인에 실패했습니다.');
    }
}

// 거절 모달 표시
function showRejectModal(rentalId) {
    document.getElementById('rejectRentalId').value = rentalId;
    document.getElementById('rejectModal').classList.remove('hidden');
    document.getElementById('rejectionReason').focus();
}

// 거절 모달 닫기
function closeRejectModal() {
    document.getElementById('rejectModal').classList.add('hidden');
    document.getElementById('rejectionReason').value = '';
    document.getElementById('rejectRentalId').value = '';
}

// 대여 거절
async function rejectRental() {
    const rentalId = document.getElementById('rejectRentalId').value;
    const reason = document.getElementById('rejectionReason').value.trim();
    
    if (!reason) {
        alert('거절 사유를 입력해주세요.');
        return;
    }
    
    try {
        await firebase.firestore().collection('rentals').doc(rentalId).update({
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        alert('대여 신청이 거절되었습니다.');
        closeRejectModal();
        loadAllRentals();
        
    } catch (error) {
        console.error('대여 거절 실패:', error);
        alert('대여 거절에 실패했습니다.');
    }
}