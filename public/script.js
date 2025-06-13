let allData = [];
let currentData = [];
let currentView = 'grid';

// 정렬된 필드 순서
const fieldOrder = ['name', 'difficulty', 'players', 'playTime', 'genre', 'buyer'];

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    
    // 5분마다 자동 새로고침
    setInterval(loadData, 300000);
});

// 데이터 로드
async function loadData() {
    showLoading(true);
    hideError();
    
    try {
        const data = await window.boardGameAPI.getAllGames();
        
        allData = data;
        currentData = data;
        
        renderData();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    showLoading(false);
}

// 뷰 전환 (그리드/테이블)
function toggleView(view) {
    currentView = view;
    
    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const gridBtn = document.getElementById('gridViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    
    if (view === 'grid') {
        gridView.classList.remove('hidden');
        tableView.classList.add('hidden');
        gridBtn.classList.add('active');
        tableBtn.classList.remove('active');
    } else {
        gridView.classList.add('hidden');
        tableView.classList.remove('hidden');
        tableBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
    
    renderData();
}

// 데이터 렌더링
function renderData() {
    if (currentView === 'grid') {
        renderGridView();
    } else {
        renderTableView();
    }
    
    updateDataCount();
}

// 그리드 뷰 렌더링 (카드 형태)
function renderGridView() {
    const gameGrid = document.getElementById('gameGrid');
    
    if (currentData.length === 0) {
        gameGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666; font-size: 18px;">🎲 데이터가 없습니다</div>';
        return;
    }
    
    gameGrid.innerHTML = currentData.map(item => {
        const title = item.name || '제목 없음';
        const imageUrl = item.imageUrl || 'https://via.placeholder.com/300x200/667eea/ffffff?text=No+Image';
        
        return `
            <div class="game-card-grid" onclick="openGameModal('${item.id}')">
                <div class="game-image">
                    <img src="${imageUrl}" alt="${title}" onerror="this.src='https://via.placeholder.com/300x200/667eea/ffffff?text=No+Image'">
                </div>
                <div class="game-title-grid">
                    <h3>${title}</h3>
                </div>
            </div>
        `;
    }).join('');
}

// 테이블 뷰 렌더링
function renderTableView() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    // 정해진 순서로 헤더 생성 (이미지 추가)
    const tableHeaders = ['이미지', '게임명', '난이도', '플레이인원', '플레이 시간', '장르/테마', '구매자'];
    
    tableHead.innerHTML = `
        <tr>
            ${tableHeaders.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;
    
    // 데이터 행 생성
    if (currentData.length > 0) {
        tableBody.innerHTML = currentData.map(row => {
            const imageUrl = row.imageUrl || 'https://via.placeholder.com/60x40/667eea/ffffff?text=No+Image';
            
            return `
                <tr onclick="openGameModal('${row.id}')" style="cursor: pointer;">
                    <td>
                        <img src="${imageUrl}" alt="${row.name || ''}" 
                             class="table-image" 
                             onerror="this.src='https://via.placeholder.com/60x40/667eea/ffffff?text=No+Image'">
                    </td>
                    <td>${row.name || '-'}</td>
                    <td>${row.difficulty ? parseFloat(row.difficulty).toFixed(1) : '-'}</td>
                    <td>${formatPlayerInfo(row)}</td>
                    <td>${row.playTime ? row.playTime + '분' : '-'}</td>
                    <td>${row.genre || '-'}</td>
                    <td>${row.buyer || '-'}</td>
                </tr>
            `;
        }).join('');
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${tableHeaders.length}" style="text-align: center; padding: 60px; color: #666; font-size: 18px;">
                    🎲 데이터가 없습니다
                </td>
            </tr>
        `;
    }
}

// 검색 기능 (게임 이름만)
async function searchData() {
    const searchInput = document.getElementById('searchInput').value.trim();
    
    if (!searchInput) {
        clearSearch();
        return;
    }
    
    showLoading(true);
    
    try {
        // 게임 이름으로만 검색
        const searchTerm = searchInput.toLowerCase();
        const filteredData = allData.filter(game => 
            game.name && game.name.toLowerCase().includes(searchTerm)
        );
        
        currentData = filteredData;
        renderData();
        
    } catch (error) {
        console.error('검색 실패:', error);
        showError('검색에 실패했습니다.');
    }
    
    showLoading(false);
}

// 검색 초기화
function clearSearch() {
    document.getElementById('searchInput').value = '';
    currentData = allData;
    renderData();
}

// 필터 적용
function applyFilters() {
    showLoading(true);
    
    try {
        let filteredData = [...allData];
        
        // 플레이 인원 필터
        const playersFilter = document.getElementById('playersFilter').value;
        const bestPlayersOnly = document.getElementById('bestPlayersOnly').checked;
        
        if (playersFilter) {
            const playerCount = parseInt(playersFilter);
            filteredData = filteredData.filter(game => {
                if (bestPlayersOnly) {
                    // 베스트 인원만 체크
                    if (game.bestPlayers) {
                        const bestPlayers = game.bestPlayers.toString();
                        return bestPlayers.includes(playerCount.toString());
                    }
                    return false;
                } else {
                    // 일반 플레이 인원 범위 체크
                    const min = game.minPlayers || 0;
                    const max = game.maxPlayers || 999;
                    return playerCount >= min && playerCount <= max;
                }
            });
        }
        
        // 플레이 시간 필터
        const playTimeFilter = document.getElementById('playTimeFilter').value;
        if (playTimeFilter) {
            filteredData = filteredData.filter(game => {
                const playTime = game.playTime || 0;
                switch (playTimeFilter) {
                    case '0-30':
                        return playTime <= 30;
                    case '31-60':
                        return playTime >= 31 && playTime <= 60;
                    case '61-120':
                        return playTime >= 61 && playTime <= 120;
                    case '121-':
                        return playTime >= 121;
                    default:
                        return true;
                }
            });
        }
        
        // 난이도 필터
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        if (difficultyFilter) {
            filteredData = filteredData.filter(game => {
                const difficulty = parseFloat(game.difficulty) || 0;
                switch (difficultyFilter) {
                    case '0-1.5':
                        return difficulty >= 0 && difficulty <= 1.5;
                    case '1.6-2.5':
                        return difficulty >= 1.6 && difficulty <= 2.5;
                    case '2.6-3.5':
                        return difficulty >= 2.6 && difficulty <= 3.5;
                    case '3.6-5':
                        return difficulty >= 3.6 && difficulty <= 5;
                    default:
                        return true;
                }
            });
        }
        
        currentData = filteredData;
        renderData();
        
    } catch (error) {
        console.error('필터링 실패:', error);
        showError('필터링에 실패했습니다.');
    }
    
    showLoading(false);
}

// 모든 필터 초기화
function clearAllFilters() {
    document.getElementById('playersFilter').value = '';
    document.getElementById('bestPlayersOnly').checked = false;
    document.getElementById('playTimeFilter').value = '';
    document.getElementById('difficultyFilter').value = '';
    
    currentData = allData;
    renderData();
}

// 데이터 개수 업데이트
function updateDataCount() {
    const totalCount = document.getElementById('totalCount');
    totalCount.textContent = `총 ${currentData.length}개`;
}

// 로딩 표시/숨김
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('show', show);
}

// 에러 메시지 표시
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    
    // 5초 후 자동으로 숨김
    setTimeout(hideError, 5000);
}

// 에러 메시지 숨김
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.classList.add('hidden');
}

// 마지막 업데이트 시간 표시
function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
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

// 유틸리티 함수들
function formatPlayerInfo(game) {
    const min = game.minPlayers;
    const max = game.maxPlayers;
    const best = game.bestPlayers;
    
    let result = formatPlayerCount(min, max);
    
    if (best) {
        result += ` (베스트: ${best})`;
    }
    
    return result;
}

function formatPlayerCount(min, max) {
    if (!min && !max) return '-';
    if (!max) return `${min}명+`;
    if (!min) return `~${max}명`;
    if (min === max) return `${min}명`;
    return `${min}-${max}명`;
}

// 게임 상세 모달 열기
function openGameModal(gameId) {
    const game = currentData.find(g => g.id === gameId);
    if (!game) return;
    
    const modal = document.getElementById('gameDetailModal');
    const imageUrl = game.imageUrl || 'https://via.placeholder.com/400x300/667eea/ffffff?text=No+Image';
    
    document.getElementById('modalGameImage').src = imageUrl;
    document.getElementById('modalGameName').textContent = game.name || '제목 없음';
    document.getElementById('modalDifficulty').textContent = game.difficulty ? parseFloat(game.difficulty).toFixed(1) : '-';
    document.getElementById('modalPlayers').textContent = formatPlayerInfo(game);
    document.getElementById('modalPlayTime').textContent = game.playTime ? game.playTime + '분' : '-';
    document.getElementById('modalGenre').textContent = game.genre || '-';
    document.getElementById('modalBuyer').textContent = game.buyer || '-';
    
    // 유튜브 링크 처리
    const youtubeLink = document.getElementById('modalYoutubeLink');
    if (game.youtubeUrl) {
        youtubeLink.href = game.youtubeUrl;
        youtubeLink.style.display = 'inline-block';
    } else {
        youtubeLink.style.display = 'none';
    }
    
    modal.classList.remove('hidden');
}

// 게임 상세 모달 닫기
function closeGameModal() {
    document.getElementById('gameDetailModal').classList.add('hidden');
}