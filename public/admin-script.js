// admin-script.js
import { db } from "./firebase-config.js";
import {
    collection,
    getDocs,
    updateDoc,
    doc,
    orderBy,
    query,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let allRentals = [];
let currentRentals = [];
let allGames = [];
let currentGames = [];

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName + 'Tab')?.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
    document.getElementById(tabName + 'TabContent')?.classList.remove('hidden');

    if (tabName === 'rentals') {
        loadAllRentals();
    } else if (tabName === 'games') {
        loadGames();
    }
}

async function loadAllRentals() {
    try {
        const q = query(collection(db, 'rentals'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const rentals = [];
        snapshot.forEach(doc => rentals.push({ id: doc.id, ...doc.data() }));
        currentRentals = allRentals = rentals;
        renderAdminRentals(rentals);
    } catch (error) {
        console.error("대여 목록 로드 실패:", error);
    }
}

function renderAdminRentals(rentals) {
    const list = document.getElementById('adminRentalsList');
    if (!list) return;

    list.innerHTML = rentals.length === 0
        ? '<div>대여 내역이 없습니다.</div>'
        : rentals.map(r => `
            <div class="rental-item">
                <strong>${r.gameName}</strong><br>
                사용자: ${r.userEmail}<br>
                상태: ${r.status}<br>
                대여: ${formatDate(r.startDate)} ~ ${formatDate(r.endDate)}
            </div>
        `).join('');
}

function formatDate(ts) {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('ko-KR');
}

async function approveRental(rentalId) {
    try {
        await updateDoc(doc(db, 'rentals', rentalId), {
            status: 'approved',
            approvedAt: serverTimestamp()
        });
        alert("승인되었습니다.");
        loadAllRentals();
    } catch (err) {
        console.error("승인 실패:", err);
    }
}

async function rejectRental(rentalId, reason) {
    try {
        await updateDoc(doc(db, 'rentals', rentalId), {
            status: 'rejected',
            rejectionReason: reason,
            rejectedAt: serverTimestamp()
        });
        alert("거절되었습니다.");
        loadAllRentals();
    } catch (err) {
        console.error("거절 실패:", err);
    }
}

async function loadGames() {
    try {
        const snapshot = await getDocs(collection(db, 'boardgames'));
        const games = [];
        snapshot.forEach(doc => games.push({ id: doc.id, ...doc.data() }));
        currentGames = allGames = games;
        renderGameList(games);
    } catch (error) {
        console.error("게임 목록 로드 실패:", error);
    }
}

function renderGameList(games) {
    const list = document.getElementById('gamesList');
    if (!list) return;

    list.innerHTML = games.length === 0
        ? '<div>게임이 없습니다.</div>'
        : games.map(g => `
            <div class="game-item">
                <strong>${g.name}</strong><br>
                상태: ${g.status || '일반'}<br>
            </div>
        `).join('');
}

function initAdminPage() {
    switchTab('games');
}

export {
    initAdminPage,
    switchTab,
    approveRental,
    rejectRental
};
