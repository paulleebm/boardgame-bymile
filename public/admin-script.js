let allGames = [];
let currentGames = [];
let editingGameId = null;
let gameToDelete = null;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    loadGames();
    setupEventListeners();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    // 정렬 변경
    document.getElementById('sortBy').addEventListener('change', sortGames);
    
    // 검색 입력 디바운싱
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            if (this.value.trim() === '') {
                clearSearch();
            } else {
                searchGames();
            }
        }, 500);
    });
    
    // 엔터키로 검색
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchGames();
        }
    });
    
    // 모달 외부 클릭시 닫기
    document.getElementById('gameModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    document.getElementById('deleteModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeDeleteModal();
        }
    });
}

// 게임 데이터 로드
async function loadGames() {
    showLoading(true);
    hideMessages();
    
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('데이터 로드 실패');
        
        const data = await response.json();
        allGames = data;
        currentGames = data;
        
        renderGames();
        updateStats();
        
    } catch (error) {
        console.error('게임 데이터 로드 실패:', error);
        showError('게임 데이터를 불러오는데 실패했습니다.');
    }
    
    showLoading(false);
}

// 게임 목록 렌더링
function renderGames() {
    const gamesList = document.getElementById('gamesList');
    
    if (currentGames.length === 0) {
        gamesList.innerHTML = `
            <div class="empty-state">
                <h3>🎲 게임이 없습니다</h3>
                <p>첫 번째 보드게임을 추가해보세요!</p>
                <button onclick="openModal()" class="add-btn">➕ 게임 추가하기</button>
            </div>
        `;
        return;
    }
    
    gamesList.innerHTML = currentGames.map(game => `
        <div class="game-item">
            <div class="game-header">
                <h3 class="game-title">${game.name || '이름 없음'}</h3>
                <div class="game-actions">
                    <button class="action-btn edit-btn" onclick="editGame('${game.id}')">✏️ 수정</button>
                    <button class="action-btn delete-btn" onclick="deleteGame('${game.id}', '${game.name}')">🗑️ 삭제</button>
                </div>
            </div>
            
            <div class="game-info">
                <div class="game-field">
                    <span class="field-label">난이도:</span>
                    <span class="field-value">${game.difficulty ? game.difficulty.toFixed(1) : '-'}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">인원:</span>
                    <span class="field-value">${formatPlayerCount(game.minPlayers, game.maxPlayers)}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">베스트 인원:</span>
                    <span class="field-value">${game.bestPlayers || '-'}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">플레이 시간:</span>
                    <span class="field-value">${game.playTime ? game.playTime + '분' : '-'}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">장르/테마:</span>
                    <span class="field-value">${game.genre || '-'}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">구매자:</span>
                    <span class="field-value">${game.buyer || '-'}</span>
                </div>
                <div class="game-field">
                    <span class="field-label">등록일:</span>
                    <span class="field-value">${formatDate(game.createdAt)}</span>
                </div>
            </div>
            
            ${game.description ? `
                <div class="game-description">
                    ${game.description}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// 통계 업데이트
function updateStats() {
    const totalGames = allGames.length;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentlyAdded = allGames.filter(game => {
        if (!game.createdAt) return false;
        const gameDate = game.createdAt.toDate ? game.createdAt.toDate() : new Date(game.createdAt);
        return gameDate > sevenDaysAgo;
    }).length;
    
    document.getElementById('totalGames').textContent = totalGames;
    document.getElementById('recentlyAdded').textContent = recentlyAdded;
}

// 게임 검색
function searchGames() {
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    
    if (!query) {
        currentGames = allGames;
    } else {
        currentGames = allGames.filter(game => {
            return Object.values(game).some(value => 
                value && value.toString().toLowerCase().includes(query)
            );
        });
    }
    
    renderGames();
}

// 검색 초기화
function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentGames = allGames;
    renderGames();
}

// 게임 정렬
function sortGames() {
    const sortBy = document.getElementById('sortBy').value;
    
    currentGames.sort((a, b) => {
        if (sortBy === 'name') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
            const dateA = a[sortBy] ? (a[sortBy].toDate ? a[sortBy].toDate() : new Date(a[sortBy])) : new Date(0);
            const dateB = b[sortBy] ? (b[sortBy].toDate ? b[sortBy].toDate() : new Date(b[sortBy])) : new Date(0);
            return dateB - dateA; // 최신순
        }
        return 0;
    });
    
    renderGames();
}

// 모달 열기 (새 게임 추가)
function openModal() {
    editingGameId = null;
    document.getElementById('modalTitle').textContent = '새 게임 추가';
    document.getElementById('saveBtn').textContent = '추가';
    clearForm();
    document.getElementById('gameModal').style.display = 'flex';
}

// 게임 수정
function editGame(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    
    editingGameId = gameId;
    document.getElementById('modalTitle').textContent = '게임 수정';
    document.getElementById('saveBtn').textContent = '수정';
    
    // 폼에 데이터 채우기
    document.getElementById('gameName').value = game.name || '';
    document.getElementById('gameDifficulty').value = game.difficulty || '';
    document.getElementById('gameMinPlayers').value = game.minPlayers || '';
    document.getElementById('gameMaxPlayers').value = game.maxPlayers || '';
    document.getElementById('gameBestPlayers').value = game.bestPlayers || '';
    document.getElementById('gamePlayTime').value = game.playTime || '';
    document.getElementById('gameGenre').value = game.genre || '';
    document.getElementById('gameBuyer').value = game.buyer || '';
    
    document.getElementById('gameModal').style.display = 'flex';
}

// 게임 삭제 (확인 모달)
function deleteGame(gameId, gameName) {
    gameToDelete = gameId;
    document.getElementById('deleteGameName').textContent = gameName;
    document.getElementById('deleteModal').style.display = 'flex';
}

// 모달 닫기
function closeModal() {
    document.getElementById('gameModal').style.display = 'none';
    clearForm();
    editingGameId = null;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
    gameToDelete = null;
}

// 폼 초기화
function clearForm() {
    document.getElementById('gameForm').reset();
}

// 게임 저장 (추가/수정)
async function saveGame() {
    const formData = {
        name: document.getElementById('gameName').value.trim(),
        difficulty: parseFloat(document.getElementById('gameDifficulty').value) || null,
        minPlayers: parseInt(document.getElementById('gameMinPlayers').value) || null,
        maxPlayers: parseInt(document.getElementById('gameMaxPlayers').value) || null,
        bestPlayers: document.getElementById('gameBestPlayers').value.trim(),
        playTime: parseInt(document.getElementById('gamePlayTime').value) || null,
        genre: document.getElementById('gameGenre').value.trim(),
        buyer: document.getElementById('gameBuyer').value.trim()
    };
    
    // 필수 필드 검증
    if (!formData.name) {
        showError('게임 이름은 필수입니다.');
        return;
    }
    
    // 난이도 검증
    if (formData.difficulty !== null && (formData.difficulty < 0 || formData.difficulty > 5)) {
        showError('난이도는 0.0에서 5.0 사이의 값이어야 합니다.');
        return;
    }
    
    // 인원 수 검증
    if (formData.minPlayers && formData.maxPlayers && formData.minPlayers > formData.maxPlayers) {
        showError('최소 인원이 최대 인원보다 클 수 없습니다.');
        return;
    }
    
    showLoading(true);
    
    try {
        let response;
        
        if (editingGameId) {
            // 수정
            response = await fetch(`/api/data/${editingGameId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            // 추가
            response = await fetch('/api/data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        if (!response.ok) throw new Error('저장 실패');
        
        const result = await response.json();
        
        closeModal();
        showSuccess(editingGameId ? '게임이 수정되었습니다.' : '새 게임이 추가되었습니다.');
        await loadGames(); // 데이터 새로고침
        
    } catch (error) {
        console.error('게임 저장 실패:', error);
        showError('게임 저장에 실패했습니다.');
    }
    
    showLoading(false);
}

// 게임 삭제 확인
async function confirmDelete() {
    if (!gameToDelete) return;
    
    showLoading(true);
    
    try {
        const response = await fetch(`/api/data/${gameToDelete}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('삭제 실패');
        
        closeDeleteModal();
        showSuccess('게임이 삭제되었습니다.');
        await loadGames(); // 데이터 새로고침
        
    } catch (error) {
        console.error('게임 삭제 실패:', error);
        showError('게임 삭제에 실패했습니다.');
    }
    
    showLoading(false);
}

// 유틸리티 함수들
function formatPlayerCount(min, max) {
    if (!min && !max) return '-';
    if (!max) return `${min}명+`;
    if (!min) return `~${max}명`;
    if (min === max) return `${min}명`;
    return `${min}-${max}명`;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else {
        date = new Date(timestamp);
    }
    
    return date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('show', show);
}

function showError(message) {
    hideMessages();
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    
    setTimeout(hideError, 5000);
}

function showSuccess(message) {
    hideMessages();
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    successText.textContent = message;
    successMessage.style.display = 'flex';
    
    setTimeout(hideSuccess, 3000);
}

function hideError() {
    document.getElementById('errorMessage').style.display = 'none';
}

function hideSuccess() {
    document.getElementById('successMessage').style.display = 'none';
}

function hideMessages() {
    hideError();
    hideSuccess();
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeModal();
        closeDeleteModal();
    }
});