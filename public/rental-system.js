// rental-system.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import {
    getFirestore,
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    query,
    where,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import {
    getAuth,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Firebase 설정
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
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
});

// 대여 신청 모달 열기
export async function openRentalModal() {
    if (!currentUser) {
        alert('로그인이 필요합니다.');
        return;
    }

    await loadAvailableGames();

    const modal = document.getElementById('rentalModal');
    if (modal) {
        modal.classList.remove('hidden');
        const today = new Date().toISOString().split('T')[0];
        const startDateInput = document.getElementById('startDate');
        const endDateInput = document.getElementById('endDate');

        if (startDateInput) {
            startDateInput.value = today;
            startDateInput.min = today;
        }

        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + 8);
        if (endDateInput) {
            endDateInput.max = maxDate.toISOString().split('T')[0];
        }

        updateEndDate();
    }
}

export function closeRentalModal() {
    const modal = document.getElementById('rentalModal');
    if (modal) {
        modal.classList.add('hidden');
        const rentalForm = document.getElementById('rentalForm');
        rentalForm?.reset();
    }
}

async function loadAvailableGames() {
    try {
        const snapshot = await getDocs(collection(db, 'boardgames'));
        const availableGames = [];

        snapshot.forEach(docSnap => {
            const game = { id: docSnap.id, ...docSnap.data() };
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

function renderGameSelection(games) {
    const gameSelect = document.getElementById('gameSelect');
    if (!gameSelect) return;

    gameSelect.innerHTML = '<option value="">게임을 선택하세요</option>' +
        games.map(game =>
            `<option value="${game.id}">${game.name}</option>`
        ).join('');
}

export function updateEndDate() {
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (startDateInput && endDateInput && startDateInput.value) {
        const startDate = new Date(startDateInput.value);
        const minEndDate = new Date(startDate);
        minEndDate.setDate(minEndDate.getDate() + 1);
        endDateInput.min = minEndDate.toISOString().split('T')[0];

        const maxEndDate = new Date(startDate);
        maxEndDate.setDate(maxEndDate.getDate() + 8);
        endDateInput.max = maxEndDate.toISOString().split('T')[0];

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

async function checkDateConflict(gameId, startDate, endDate) {
    try {
        const q = query(
            collection(db, 'rentals'),
            where('gameId', '==', gameId),
            where('status', 'in', ['approved', 'rented'])
        );

        const snapshot = await getDocs(q);
        const requestStart = new Date(startDate);
        const requestEnd = new Date(endDate);

        for (const doc of snapshot.docs) {
            const rental = doc.data();
            const existingStart = rental.startDate.toDate();
            const existingEnd = rental.endDate.toDate();

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

export async function submitRental() {
    const gameSelect = document.getElementById('gameSelect');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    const gameId = gameSelect.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!gameId || !startDate || !endDate) {
        alert('모든 항목을 입력해주세요.');
        return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const conflict = await checkDateConflict(gameId, startDate, endDate);
    if (conflict.conflict) {
        alert(`선택한 기간에 이미 승인된 대여가 있습니다.\n충돌 기간: ${conflict.conflictPeriod}`);
        return;
    }

    try {
        if (!currentUser) {
            alert('로그인이 필요합니다.');
            return;
        }

        const gameSnap = await getDoc(doc(db, 'boardgames', gameId));
        const gameData = gameSnap.data();

        const rentalData = {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            gameId,
            gameName: gameData.name,
            startDate: Timestamp.fromDate(startDateObj),
            endDate: Timestamp.fromDate(endDateObj),
            status: 'pending',
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, 'rentals'), rentalData);

        alert('대여 신청이 완료되었습니다. 관리자 승인을 기다려주세요.');
        closeRentalModal();

        const myPageModal = document.getElementById('myPageModal');
        if (myPageModal && !myPageModal.classList.contains('hidden')) {
            if (typeof window.loadUserRentals === 'function') {
                window.loadUserRentals(currentUser.uid);
            }
        }

    } catch (error) {
        console.error('대여 신청 실패:', error);
        alert('대여 신청에 실패했습니다.');
    }
}

// 상태 텍스트 및 포맷팅
function formatDate(date) {
    const d = date instanceof Date ? date : date.toDate();
    return d.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

async function loadUserRentals(userId) {
    try {
        const rentalsRef = collection(db, 'rentals');
        const q = query(rentalsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const rentals = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderUserRentals(rentals);
    } catch (error) {
        console.error('대여 기록 로드 실패:', error);
    }
}

function renderUserRentals(rentals) {
    const rentalsList = document.getElementById('userRentalsList');
    if (!rentalsList) return;

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
            </div>
        `;
    }).join('');
}

function getRentalStatusText(status) {
    const map = {
        pending: '신청중',
        approved: '승인됨',
        rented: '대여중',
        returned: '반납완료',
        rejected: '거절됨'
    };
    return map[status] || status;
}

function getRentalStatusClass(status) {
    return `status-${status}`;
}

// ✅ 전역 등록
window.loadUserRentals = loadUserRentals;
window.submitRental = submitRental;
window.updateEndDate = updateEndDate;
window.openRentalModal = openRentalModal;
window.closeRentalModal = closeRentalModal;

