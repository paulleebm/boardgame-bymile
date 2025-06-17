import { db, FieldValue } from './firebase-config.js';

let allGames = [];
let currentGames = [];
let editingGameId = null;
let gameToDelete = null;

// 대량 등록 관련 변수
let bulkGameData = [];

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 로드 완료');
    
    // Firebase API가 준비될 때까지 기다림
    function waitForAPI() {
        if (window.boardGameAPI) {
            console.log('BoardGame API 준비 완료');
            loadGames();
            setupEventListeners();
        } else {
            console.log('BoardGame API 대기 중...');
            setTimeout(waitForAPI, 100);
        }
    }
    
    waitForAPI();
});

// 이벤트 리스너 설정
function setupEventListeners() {
    console.log('이벤트 리스너 설정 시작');
    
    // DOM 요소들이 존재하는지 확인
    const sortByElement = document.getElementById('sortBy');
    const statusFilterElement = document.getElementById('statusFilter');
    const searchInputElement = document.getElementById('searchInput');
    const gameModalElement = document.getElementById('gameModal');
    const deleteModalElement = document.getElementById('deleteModal');
    
    console.log('DOM 요소 확인:', {
        sortBy: !!sortByElement,
        statusFilter: !!statusFilterElement,
        searchInput: !!searchInputElement,
        gameModal: !!gameModalElement,
        deleteModal: !!deleteModalElement
    });
    
    // 게임 관리 이벤트 리스너
    if (sortByElement) {
        sortByElement.addEventListener('change', sortGames);
    } else {
        console.warn('sortBy 요소를 찾을 수 없습니다.');
    }
    
    if (statusFilterElement) {
        statusFilterElement.addEventListener('change', searchGames);
    } else {
        console.warn('statusFilter 요소를 찾을 수 없습니다.');
    }
    
    // 검색 입력 디바운싱
    if (searchInputElement) {
        let searchTimeout;
        searchInputElement.addEventListener('input', function() {
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
        searchInputElement.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchGames();
            }
        });
    } else {
        console.warn('searchInput 요소를 찾을 수 없습니다.');
    }
    
    // 모달 외부 클릭시 닫기
    if (gameModalElement) {
        gameModalElement.addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    } else {
        console.warn('gameModal 요소를 찾을 수 없습니다.');
    }
    
    if (deleteModalElement) {
        deleteModalElement.addEventListener('click', function(e) {
            if (e.target === this) {
                closeDeleteModal();
            }
        });
    } else {
        console.warn('deleteModal 요소를 찾을 수 없습니다.');
    }
    
    console.log('이벤트 리스너 설정 완료');
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
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('게임 데이터 로드 실패:', error);
        showError('게임 데이터를 불러오는데 실패했습니다.');
    }
    
    showLoading(false);
}

// 마지막 업데이트 시간 표시
function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// 게임 목록 렌더링
function renderGames() {
    const gamesList = document.getElementById('gamesList');
    
    if (!gamesList) {
        console.error('gamesList 요소를 찾을 수 없습니다.');
        return;
    }
    
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
                <h3 class="game-title">
                    ${game.name || '이름 없음'}
                    ${getStatusTag(game.status)}
                </h3>
                <div class="game-actions">
                    <button class="action-btn edit-btn" onclick="editGame('${game.id}')">✏️ 수정</button>
                    <button class="action-btn delete-btn" onclick="deleteGame('${game.id}', '${game.name}')">🗑️ 삭제</button>
                </div>
            </div>
            
            <div class="game-info">
                <div class="game-field">
                    <span class="field-label">상태:</span>
                    <span class="field-value">${getGameStatusText(game.status)}</span>
                </div>
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
                    <span class="field-value">${formatDateShort(game.createdAt)}</span>
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

// 상태 태그 HTML 생성
function getStatusTag(status) {
    if (!status || status === 'normal') return '';
    
    const statusMap = {
        'new': { text: 'NEW', class: 'status-new' },
        'shipping': { text: '배송중', class: 'status-shipping' },
        'purchasing': { text: '구매중', class: 'status-purchasing' },
        'rented': { text: '대여중', class: 'status-rented' }
    };
    
    const statusInfo = statusMap[status];
    if (!statusInfo) return '';
    
    return `<span class="status-tag ${statusInfo.class}">${statusInfo.text}</span>`;
}

// 상태 텍스트 반환
function getGameStatusText(status) {
    const map = {
        new: '신상',
        shipping: '배송중',
        purchasing: '구매중',
        rented: '대여중'
    };
    return map[status] || '일반';
}

// 통계 업데이트
function updateStats() {
    const totalGames = allGames.length;
    const newGames = allGames.filter(game => game.status === 'new').length;
    const shippingGames = allGames.filter(game => game.status === 'shipping').length;
    const purchasingGames = allGames.filter(game => game.status === 'purchasing').length;
    const rentedGames = allGames.filter(game => game.status === 'rented').length;
    
    const totalElement = document.getElementById('totalGames');
    const newElement = document.getElementById('newGames');
    const shippingElement = document.getElementById('shippingGames');
    const purchasingElement = document.getElementById('purchasingGames');
    const rentedElement = document.getElementById('rentedGames');
    
    if (totalElement) totalElement.textContent = totalGames;
    if (newElement) newElement.textContent = newGames;
    if (shippingElement) shippingElement.textContent = shippingGames;
    if (purchasingElement) purchasingElement.textContent = purchasingGames;
    if (rentedElement) rentedElement.textContent = rentedGames;
}

// 게임 검색 (상태 필터 포함)
function searchGames() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const statusFilterValue = statusFilter ? statusFilter.value : '';
    
    currentGames = allGames.filter(game => {
        // 텍스트 검색
        const matchesText = !query || Object.values(game).some(value => 
            value && value.toString().toLowerCase().includes(query)
        );
        
        // 상태 필터
        const matchesStatus = !statusFilterValue || 
            (statusFilterValue === 'normal' && (!game.status || game.status === 'normal')) ||
            (statusFilterValue !== 'normal' && game.status === statusFilterValue);
        
        return matchesText && matchesStatus;
    });
    
    renderGames();
}

// 검색 초기화
function clearSearch() {
    currentGames = allGames;
    renderGames();
}

// 게임 정렬
function sortGames() {
    const sortBy = document.getElementById('sortBy');
    const sortByValue = sortBy ? sortBy.value : 'createdAt';
    
    currentGames.sort((a, b) => {
        if (sortByValue === 'name') {
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortByValue === 'status') {
            // 상태순 정렬: new → purchasing → shipping → rented → normal
            const statusOrder = { 'new': 0, 'purchasing': 1, 'shipping': 2, 'rented': 3, 'normal': 4, '': 4 };
            const statusA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 4;
            const statusB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 4;
            
            if (statusA !== statusB) {
                return statusA - statusB;
            }
            // 같은 상태일 경우 이름순
            return (a.name || '').localeCompare(b.name || '');
        } else if (sortByValue === 'createdAt' || sortByValue === 'updatedAt') {
            const dateA = a[sortByValue] ? (a[sortByValue].toDate ? a[sortByValue].toDate() : new Date(a[sortByValue])) : new Date(0);
            const dateB = b[sortByValue] ? (b[sortByValue].toDate ? b[sortByValue].toDate() : new Date(b[sortByValue])) : new Date(0);
            return dateB - dateA; // 최신순
        }
        return 0;
    });
    
    renderGames();
}

// 모달 열기 (새 게임 추가)
function openModal() {
    editingGameId = null;
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveBtn');
    const gameModal = document.getElementById('gameModal');
    
    if (modalTitle) modalTitle.textContent = '새 게임 추가';
    if (saveBtn) saveBtn.textContent = '추가';
    if (gameModal) gameModal.classList.remove('hidden');
    
    clearForm();
}

// 게임 수정
function editGame(gameId) {
    const game = allGames.find(g => g.id === gameId);
    if (!game) return;
    
    editingGameId = gameId;
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('saveBtn');
    const gameModal = document.getElementById('gameModal');
    
    if (modalTitle) modalTitle.textContent = '게임 수정';
    if (saveBtn) saveBtn.textContent = '수정';
    if (gameModal) gameModal.classList.remove('hidden');
    
    // 폼에 데이터 채우기
    const fields = [
        'gameName', 'gameStatus', 'gameDifficulty', 'gameMinPlayers', 
        'gameMaxPlayers', 'gameBestPlayers', 'gamePlayTime', 'gameGenre', 
        'gameBuyer', 'gameImageUrl', 'gameYoutubeUrl'
    ];
    
    const gameKeys = [
        'name', 'status', 'difficulty', 'minPlayers', 
        'maxPlayers', 'bestPlayers', 'playTime', 'genre', 
        'buyer', 'imageUrl', 'youtubeUrl'
    ];
    
    fields.forEach((fieldId, index) => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = game[gameKeys[index]] || '';
        }
    });
}

// 게임 삭제 (확인 모달)
function deleteGame(gameId, gameName) {
    gameToDelete = gameId;
    const deleteGameNameElement = document.getElementById('deleteGameName');
    const deleteModal = document.getElementById('deleteModal');
    
    if (deleteGameNameElement) deleteGameNameElement.textContent = gameName;
    if (deleteModal) deleteModal.classList.remove('hidden');
}

// 모달 닫기
function closeModal() {
    const gameModal = document.getElementById('gameModal');
    if (gameModal) gameModal.classList.add('hidden');
    clearForm();
    editingGameId = null;
}

function closeDeleteModal() {
    const deleteModal = document.getElementById('deleteModal');
    if (deleteModal) deleteModal.classList.add('hidden');
    gameToDelete = null;
}

// 폼 초기화
function clearForm() {
    const gameForm = document.getElementById('gameForm');
    if (gameForm) gameForm.reset();
}

// 게임 저장 (추가/수정)
async function saveGame() {
    const fields = {
        name: document.getElementById('gameName'),
        status: document.getElementById('gameStatus'),
        difficulty: document.getElementById('gameDifficulty'),
        minPlayers: document.getElementById('gameMinPlayers'),
        maxPlayers: document.getElementById('gameMaxPlayers'),
        bestPlayers: document.getElementById('gameBestPlayers'),
        playTime: document.getElementById('gamePlayTime'),
        genre: document.getElementById('gameGenre'),
        buyer: document.getElementById('gameBuyer'),
        imageUrl: document.getElementById('gameImageUrl'),
        youtubeUrl: document.getElementById('gameYoutubeUrl')
    };
    
    const formData = {
        name: fields.name ? fields.name.value.trim() : '',
        status: fields.status ? fields.status.value.trim() || null : null,
        difficulty: fields.difficulty ? parseFloat(fields.difficulty.value) || null : null,
        minPlayers: fields.minPlayers ? parseInt(fields.minPlayers.value) || null : null,
        maxPlayers: fields.maxPlayers ? parseInt(fields.maxPlayers.value) || null : null,
        bestPlayers: fields.bestPlayers ? fields.bestPlayers.value.trim() : '',
        playTime: fields.playTime ? parseInt(fields.playTime.value) || null : null,
        genre: fields.genre ? fields.genre.value.trim() : '',
        buyer: fields.buyer ? fields.buyer.value.trim() : '',
        imageUrl: fields.imageUrl ? fields.imageUrl.value.trim() : '',
        youtubeUrl: fields.youtubeUrl ? fields.youtubeUrl.value.trim() : ''
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
function openBulkModal() {
    const bulkModal = document.getElementById('bulkModal');
    const bulkData = document.getElementById('bulkData');
    const bulkPreview = document.getElementById('bulkPreview');
    const bulkSaveBtn = document.getElementById('bulkSaveBtn');
    
    if (bulkModal) bulkModal.classList.remove('hidden');
    if (bulkData) bulkData.value = '';
    if (bulkPreview) bulkPreview.classList.add('hidden');
    if (bulkSaveBtn) bulkSaveBtn.disabled = true;
    
    bulkGameData = [];
}

function closeBulkModal() {
    const bulkModal = document.getElementById('bulkModal');
    if (bulkModal) bulkModal.classList.add('hidden');
    bulkGameData = [];
}

function previewBulkData() {
    const bulkDataElement = document.getElementById('bulkData');
    const csvData = bulkDataElement ? bulkDataElement.value.trim() : '';
    
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
        
        // 필수 헤더 체크 (name만 필수)
        if (!headers.includes('name')) {
            showError('name 컬럼은 필수입니다.');
            return;
        }
        
        bulkGameData = [];
        const previewList = document.getElementById('previewList');
        if (previewList) previewList.innerHTML = '';
        
        // 데이터 파싱
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const gameData = {};
            
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // 모든 값에서 추가 따옴표 제거
                value = value.replace(/^["']|["']$/g, '').trim();
                
                if (header === 'status' && value) {
                    // 상태 값 검증
                    const validStatuses = ['new', 'shipping', 'purchasing', 'rented', 'normal', ''];
                    gameData[header] = validStatuses.includes(value) ? (value === 'normal' ? '' : value) : null;
                } else if (header === 'difficulty' && value) {
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
                if (previewList) {
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.innerHTML = `
                        ${gameData.name} 
                        ${getStatusTag(gameData.status)}
                        (난이도: ${gameData.difficulty || '-'}, 인원: ${formatPlayerInfoForAdmin(gameData)})
                    `;
                    previewList.appendChild(previewItem);
                }
            }
        }
        
        const previewCount = document.getElementById('previewCount');
        const bulkPreview = document.getElementById('bulkPreview');
        const bulkSaveBtn = document.getElementById('bulkSaveBtn');
        
        if (previewCount) previewCount.textContent = bulkGameData.length;
        if (bulkPreview) bulkPreview.classList.remove('hidden');
        if (bulkSaveBtn) bulkSaveBtn.disabled = bulkGameData.length === 0;
        
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

function formatDateShort(ts) {
    if (!ts) return '-';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('ko-KR');
}

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.toggle('show', show);
    }
}

function showError(message) {
    hideMessages();
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    if (errorText) errorText.textContent = message;
    if (errorMessage) errorMessage.classList.remove('hidden');
    
    setTimeout(hideError, 5000);
}

function showSuccess(message) {
    hideMessages();
    const successMessage = document.getElementById('successMessage');
    const successText = document.getElementById('successText');
    
    if (successText) successText.textContent = message;
    if (successMessage) successMessage.classList.remove('hidden');
    
    setTimeout(hideSuccess, 3000);
}

function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) errorMessage.classList.add('hidden');
}

function hideSuccess() {
    const successMessage = document.getElementById('successMessage');
    if (successMessage) successMessage.classList.add('hidden');
}

function hideMessages() {
    hideError();
    hideSuccess();
}

// 전역 함수로 노출 (HTML onclick 이벤트에서 사용하기 위해)
window.openModal = openModal;
window.editGame = editGame;
window.deleteGame = deleteGame;
window.closeModal = closeModal;
window.closeDeleteModal = closeDeleteModal;
window.saveGame = saveGame;
window.confirmDelete = confirmDelete;
window.searchGames = searchGames;
window.openBulkModal = openBulkModal;
window.closeBulkModal = closeBulkModal;
window.previewBulkData = previewBulkData;
window.saveBulkData = saveBulkData;
window.hideError = hideError;
window.hideSuccess = hideSuccess;