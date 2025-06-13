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
        const data = await window.boardGameAPI.getAllGames();
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
                    <span class="field-value">${formatBestPlayers(game.bestPlayers)}</span>
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
    document.getElementById('totalGames').textContent = totalGames;
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
    document.getElementById('gameModal').classList.remove('hidden');
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
    document.getElementById('gameImageUrl').value = game.imageUrl || '';
    document.getElementById('gameYoutubeUrl').value = game.youtubeUrl || '';
    
    document.getElementById('gameModal').classList.remove('hidden');
}

// 게임 삭제 (확인 모달)
function deleteGame(gameId, gameName) {
    gameToDelete = gameId;
    document.getElementById('deleteGameName').textContent = gameName;
    document.getElementById('deleteModal').classList.remove('hidden');
}

// 모달 닫기
function closeModal() {
    document.getElementById('gameModal').classList.add('hidden');
    clearForm();
    editingGameId = null;
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.add('hidden');
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
        buyer: document.getElementById('gameBuyer').value.trim(),
        imageUrl: document.getElementById('gameImageUrl').value.trim(),
        youtubeUrl: document.getElementById('gameYoutubeUrl').value.trim()
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
        let result;
        
        if (editingGameId) {
            // 수정
            result = await window.boardGameAPI.updateGame(editingGameId, formData);
        } else {
            // 추가
            result = await window.boardGameAPI.addGame(formData);
        }
        
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
        await window.boardGameAPI.deleteGame(gameToDelete);
        
        closeDeleteModal();
        showSuccess('게임이 삭제되었습니다.');
        await loadGames(); // 데이터 새로고침
        
    } catch (error) {
        console.error('게임 삭제 실패:', error);
        showError('게임 삭제에 실패했습니다.');
    }
    
    showLoading(false);
}

// 대량 등록 모달 관련
let bulkGameData = [];

function openBulkModal() {
    document.getElementById('bulkModal').classList.remove('hidden');
    document.getElementById('bulkData').value = '';
    document.getElementById('bulkPreview').classList.add('hidden');
    document.getElementById('bulkSaveBtn').disabled = true;
    bulkGameData = [];
}

function closeBulkModal() {
    document.getElementById('bulkModal').classList.add('hidden');
    bulkGameData = [];
}

function previewBulkData() {
    const csvData = document.getElementById('bulkData').value.trim();
    
    if (!csvData) {
        showError('CSV 데이터를 입력해주세요.');
        return;
    }
    
    try {
        // 개선된 CSV 파싱 - 따옴표 안의 쉼표 처리
        const lines = csvData.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            showError('헤더와 최소 1개의 데이터 행이 필요합니다.');
            return;
        }
        
        // 헤더 파싱
        const headers = parseCSVLine(lines[0]);
        const expectedHeaders = ['name', 'difficulty', 'minPlayers', 'maxPlayers', 'bestPlayers', 'playTime', 'genre', 'buyer', 'imageUrl', 'youtubeUrl'];
        
        // 필수 헤더 체크 (name만 필수)
        if (!headers.includes('name')) {
            showError('name 컬럼은 필수입니다.');
            return;
        }
        
        bulkGameData = [];
        const previewList = document.getElementById('previewList');
        previewList.innerHTML = '';
        
        // 데이터 파싱
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const gameData = {};
            
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // 모든 값에서 추가 따옴표 제거
                value = value.replace(/^["']|["']$/g, '').trim();
                
                if (header === 'difficulty' && value) {
                    gameData[header] = parseFloat(value) || null;
                } else if (['minPlayers', 'maxPlayers', 'playTime'].includes(header) && value) {
                    gameData[header] = parseInt(value) || null;
                } else if (value) {
                    gameData[header] = value;
                }
            });
            
            // 필수 데이터 체크
            if (gameData.name) {
                bulkGameData.push(gameData);
                
                // 미리보기 추가
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                previewItem.textContent = `${gameData.name} (난이도: ${gameData.difficulty || '-'}, 인원: ${formatPlayerInfoForAdmin(gameData)})`;
                previewList.appendChild(previewItem);
            }
        }
        
        document.getElementById('previewCount').textContent = bulkGameData.length;
        document.getElementById('bulkPreview').classList.remove('hidden');
        document.getElementById('bulkSaveBtn').disabled = bulkGameData.length === 0;
        
        if (bulkGameData.length === 0) {
            showError('유효한 게임 데이터가 없습니다.');
        }
        
    } catch (error) {
        console.error('CSV 파싱 오류:', error);
        showError('CSV 데이터 형식이 올바르지 않습니다.');
    }
}

// 개선된 CSV 라인 파서 - 따옴표 안의 쉼표 처리
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;
    
    while (i < line.length) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                // 연속된 따옴표는 하나의 따옴표로 처리
                current += '"';
                i += 2;
            } else {
                // 따옴표 상태 토글 (따옴표 자체는 결과에 포함하지 않음)
                inQuotes = !inQuotes;
                i++;
            }
        } else if (char === ',' && !inQuotes) {
            // 따옴표 밖의 쉼표는 구분자
            result.push(current.trim());
            current = '';
            i++;
        } else {
            current += char;
            i++;
        }
    }
    
    // 마지막 필드 추가
    result.push(current.trim());
    
    // 모든 필드에서 남은 따옴표 제거
    return result.map(field => field.replace(/^["']|["']$/g, ''));
}

async function saveBulkData() {
    if (bulkGameData.length === 0) {
        showError('등록할 데이터가 없습니다.');
        return;
    }
    
    showLoading(true);
    
    try {
        let successCount = 0;
        let errorCount = 0;
        
        for (const gameData of bulkGameData) {
            try {
                await window.boardGameAPI.addGame(gameData);
                successCount++;
            } catch (error) {
                console.error(`게임 "${gameData.name}" 등록 실패:`, error);
                errorCount++;
            }
        }
        
        closeBulkModal();
        
        if (errorCount === 0) {
            showSuccess(`${successCount}개의 게임이 성공적으로 등록되었습니다.`);
        } else {
            showSuccess(`${successCount}개 성공, ${errorCount}개 실패했습니다.`);
        }
        
        await loadGames(); // 데이터 새로고침
        
    } catch (error) {
        console.error('대량 등록 실패:', error);
        showError('대량 등록에 실패했습니다.');
    }
    
    showLoading(false);
}

// 유틸리티 함수들
function formatPlayerInfoForAdmin(game) {
    const min = game.minPlayers;
    const max = game.maxPlayers;
    const best = game.bestPlayers;
    
    let result = formatPlayerCount(min, max);
    
    if (best && best.toString().trim()) {
        let bestStr = best.toString().trim();
        // 모든 종류의 따옴표 제거 (앞뒤 + 중간)
        bestStr = bestStr.replace(/["'`]/g, '');
        
        if (bestStr) {
            if (bestStr.includes(',') || bestStr.includes(';')) {
                result += ` (베스트: ${bestStr})`;
            } else {
                result += ` (베스트: ${bestStr}명)`;
            }
        }
    }
    
    return result;
}

function formatBestPlayers(bestPlayers) {
    if (!bestPlayers) return '-';
    
    let bestStr = bestPlayers.toString().trim();
    // 모든 종류의 따옴표 제거 (앞뒤 + 중간)
    bestStr = bestStr.replace(/["'`]/g, '');
    
    if (!bestStr) return '-';
    
    if (bestStr.includes(',') || bestStr.includes(';')) {
        return bestStr;
    } else {
        return bestStr + '명';
    }
}

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
    errorMessage.classList.remove('hidden');
    
    setTimeout(hideError, 5000);
}

function showSuccess(message) {
    hideMessages();
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    successText.textContent = message;
    successMessage.classList.remove('hidden');
    
    setTimeout(hideSuccess, 3000);
}

function hideError() {
    document.getElementById('errorMessage').classList.add('hidden');
}

function hideSuccess() {
    document.getElementById('successMessage').classList.add('hidden');
}

function hideMessages() {
    hideError();
    hideSuccess();
}