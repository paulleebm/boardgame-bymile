let allData = [];
let currentData = [];

// 기본 이미지 URL (더 안정적인 서비스 사용)
const DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeSliders();
    loadData();
    
    // 5분마다 자동 새로고침
    setInterval(loadData, 300000);
});

// 슬라이더 초기화
function initializeSliders() {
    initializeCustomSlider('time', 10, 300, 10);
    initializeCustomSlider('difficulty', 1, 5, 0.1);
}

// 커스텀 슬라이더 초기화
function initializeCustomSlider(type, min, max, step) {
    const minHandle = document.getElementById(`${type}MinHandle`);
    const maxHandle = document.getElementById(`${type}MaxHandle`);
    const track = minHandle.parentElement;
    const range = document.getElementById(`${type}Range`);
    const minValueEl = document.getElementById(`${type}MinValue`);
    const maxValueEl = document.getElementById(`${type}MaxValue`);
    const minInput = document.getElementById(`${type}Min`);
    const maxInput = document.getElementById(`${type}Max`);
    
    let isDragging = false;
    let currentHandle = null;
    
    // 값을 백분율로 변환
    function valueToPercent(value) {
        return ((value - min) / (max - min)) * 100;
    }
    
    // 백분율을 값으로 변환
    function percentToValue(percent) {
        const value = min + (percent / 100) * (max - min);
        return Math.round(value / step) * step;
    }
    
    // 마우스 위치를 백분율로 변환
    function getPercentFromEvent(event) {
        const rect = track.getBoundingClientRect();
        const percent = ((event.clientX - rect.left) / rect.width) * 100;
        return Math.max(0, Math.min(100, percent));
    }
    
    // UI 업데이트
    function updateUI() {
        const minValue = parseFloat(minInput.value);
        const maxValue = parseFloat(maxInput.value);
        
        const minPercent = valueToPercent(minValue);
        const maxPercent = valueToPercent(maxValue);
        
        // 핸들 위치 업데이트
        minHandle.style.left = minPercent + '%';
        maxHandle.style.left = maxPercent + '%';
        
        // 범위 표시 업데이트
        range.style.left = minPercent + '%';
        range.style.width = (maxPercent - minPercent) + '%';
        
        // 값 표시 업데이트
        if (type === 'time') {
            minValueEl.textContent = minValue + '분';
            maxValueEl.textContent = maxValue === max ? maxValue + '분+' : maxValue + '분';
        } else {
            minValueEl.textContent = minValue.toFixed(1);
            maxValueEl.textContent = maxValue.toFixed(1);
        }
    }
    
    // 값 제한 (핸들이 교차하지 않도록)
    function constrainValues() {
        let minValue = parseFloat(minInput.value);
        let maxValue = parseFloat(maxInput.value);
        
        if (minValue > maxValue) {
            if (currentHandle === minHandle) {
                maxValue = minValue;
                maxInput.value = maxValue;
            } else {
                minValue = maxValue;
                minInput.value = minValue;
            }
        }
    }
    
    // 마우스 다운 이벤트
    function onMouseDown(event, handle) {
        isDragging = true;
        currentHandle = handle;
        
        // 핸들을 앞으로 가져오기
        minHandle.style.zIndex = '3';
        maxHandle.style.zIndex = '3';
        handle.style.zIndex = '10';
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        event.preventDefault();
    }
    
    // 마우스 이동 이벤트
    function onMouseMove(event) {
        if (!isDragging || !currentHandle) return;
        
        const percent = getPercentFromEvent(event);
        const value = percentToValue(percent);
        
        if (currentHandle === minHandle) {
            minInput.value = Math.min(value, parseFloat(maxInput.value));
        } else {
            maxInput.value = Math.max(value, parseFloat(minInput.value));
        }
        
        updateUI();
        searchAndFilter(); // 실시간 필터링
    }
    
    // 마우스 업 이벤트
    function onMouseUp() {
        isDragging = false;
        currentHandle = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
    
    // 트랙 클릭 이벤트
    function onTrackClick(event) {
        if (isDragging) return;
        
        const percent = getPercentFromEvent(event);
        const value = percentToValue(percent);
        const minValue = parseFloat(minInput.value);
        const maxValue = parseFloat(maxInput.value);
        
        // 가까운 핸들로 이동
        const distToMin = Math.abs(value - minValue);
        const distToMax = Math.abs(value - maxValue);
        
        if (distToMin < distToMax) {
            minInput.value = Math.min(value, maxValue);
        } else {
            maxInput.value = Math.max(value, minValue);
        }
        
        updateUI();
        searchAndFilter();
    }
    
    // 이벤트 리스너 등록
    minHandle.addEventListener('mousedown', (e) => onMouseDown(e, minHandle));
    maxHandle.addEventListener('mousedown', (e) => onMouseDown(e, maxHandle));
    track.addEventListener('click', onTrackClick);
    
    // 키보드 접근성을 위한 input 이벤트
    minInput.addEventListener('input', () => {
        constrainValues();
        updateUI();
        searchAndFilter();
    });
    
    maxInput.addEventListener('input', () => {
        constrainValues();
        updateUI();
        searchAndFilter();
    });
    
    // 초기 UI 설정
    updateUI();
}

// 데이터 로드
async function loadData() {
    showLoading(true);
    hideError();
    
    try {
        const data = await window.boardGameAPI.getAllGames();
        
        allData = data;
        currentData = data;
        
        renderGridView();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    showLoading(false);
}

// 뷰 전환 함수 제거 (그리드 단일 모드)

// 데이터 렌더링 (그리드 뷰만)
function renderData() {
    renderGridView();
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
        const imageUrl = item.imageUrl || DEFAULT_IMAGE_URL;
        
        return `
            <div class="game-card-grid" onclick="openGameModal('${item.id}')">
                <div class="game-image">
                    <img src="${imageUrl}" alt="${title}" onerror="this.src='${DEFAULT_IMAGE_URL}'">
                </div>
                <div class="game-title-grid">
                    <h3>${title}</h3>
                </div>
            </div>
        `;
    }).join('');
}

// 테이블 뷰 렌더링 함수 제거 (그리드 단일 모드)

// 통합된 검색 및 필터 기능
function searchAndFilter() {
    let filteredData = [...allData];
    
    // 1. 게임 이름 검색
    const searchInput = document.getElementById('searchInput').value.trim();
    if (searchInput) {
        const searchTerm = searchInput.toLowerCase();
        filteredData = filteredData.filter(game => 
            game.name && game.name.toLowerCase().includes(searchTerm)
        );
    }
    
    // 2. 플레이 인원 필터
    const playersFilter = document.getElementById('playersFilter').value;
    const bestPlayersOnly = document.getElementById('bestPlayersOnly').checked;
    
    if (playersFilter) {
        const playerCount = parseInt(playersFilter);
        filteredData = filteredData.filter(game => {
            if (bestPlayersOnly) {
                // 베스트 인원만 체크
                if (game.bestPlayers) {
                    const bestPlayers = game.bestPlayers.toString().trim();
                    if (!bestPlayers) return false;
                    
                    // 따옴표 제거 (CSV에서 "4,5" 형태로 올 수 있음)
                    const cleanBestPlayers = bestPlayers.replace(/["']/g, '');
                    
                    // 쉼표 또는 세미콜론으로 구분된 값들 처리
                    if (cleanBestPlayers.includes(',') || cleanBestPlayers.includes(';')) {
                        const separator = cleanBestPlayers.includes(',') ? ',' : ';';
                        const bestPlayersArray = cleanBestPlayers.split(separator).map(p => parseInt(p.trim()));
                        return bestPlayersArray.includes(playerCount);
                    }
                    // 단일 값 처리
                    else {
                        return parseInt(cleanBestPlayers) === playerCount;
                    }
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
    
    // 3. 플레이 시간 필터
    const timeMin = parseInt(document.getElementById('timeMin').value);
    const timeMax = parseInt(document.getElementById('timeMax').value);
    
    if (timeMin > 10 || timeMax < 300) {
        filteredData = filteredData.filter(game => {
            const playTime = game.playTime || 0;
            return playTime >= timeMin && playTime <= timeMax;
        });
    }
    
    // 4. 난이도 필터
    const difficultyMin = parseFloat(document.getElementById('difficultyMin').value);
    const difficultyMax = parseFloat(document.getElementById('difficultyMax').value);
    
    if (difficultyMin > 1 || difficultyMax < 5) {
        filteredData = filteredData.filter(game => {
            const difficulty = parseFloat(game.difficulty) || 0;
            return difficulty >= difficultyMin && difficulty <= difficultyMax;
        });
    }
    
    currentData = filteredData;
    renderGridView();
}

// 모든 검색 및 필터 초기화
function clearAll() {
    document.getElementById('searchInput').value = '';
    document.getElementById('playersFilter').value = '';
    document.getElementById('bestPlayersOnly').checked = false;
    
    // 슬라이더 초기화
    document.getElementById('timeMin').value = 10;
    document.getElementById('timeMax').value = 300;
    document.getElementById('difficultyMin').value = 1;
    document.getElementById('difficultyMax').value = 5;
    
    // 슬라이더 UI 업데이트
    initializeSliders();
    
    currentData = allData;
    renderGridView();
}

// 게임 상세 모달 열기
function openGameModal(gameId) {
    const game = currentData.find(g => g.id === gameId);
    if (!game) return;
    
    const modal = document.getElementById('gameDetailModal');
    const imageUrl = game.imageUrl || DEFAULT_IMAGE_URL;
    
    // 모달 이미지 설정 (오류 처리 포함)
    const modalImage = document.getElementById('modalGameImage');
    modalImage.src = imageUrl;
    modalImage.onerror = function() {
        this.src = DEFAULT_IMAGE_URL;
    };
    
    document.getElementById('modalGameName').textContent = game.name || '제목 없음';
    document.getElementById('modalDifficulty').textContent = game.difficulty ? parseFloat(game.difficulty).toFixed(1) : '-';
    document.getElementById('modalPlayers').textContent = formatPlayerInfo(game);
    document.getElementById('modalPlayTime').textContent = game.playTime ? game.playTime + '분' : '-';
    document.getElementById('modalGenre').textContent = game.genre || '-';
    document.getElementById('modalBuyer').textContent = game.buyer || '-';
    
    // 유튜브 링크 처리 (없을 경우 숨김)
    const youtubeLink = document.getElementById('modalYoutubeLink');
    if (game.youtubeUrl && game.youtubeUrl.trim()) {
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

// 유틸리티 함수들
function formatPlayerInfo(game) {
    const min = game.minPlayers;
    const max = game.maxPlayers;
    const best = game.bestPlayers;
    
    let result = formatPlayerCount(min, max);
    
    if (best && best.toString().trim()) {
        let bestStr = best.toString().trim();
        // 따옴표 제거 (CSV에서 "4,5" 형태로 올 수 있음)
        bestStr = bestStr.replace(/["']/g, '');
        
        if (bestStr) {
            // 쉼표나 세미콜론으로 구분된 경우와 단일 값 모두 처리
            if (bestStr.includes(',') || bestStr.includes(';')) {
                result += ` (베스트: ${bestStr})`;
            } else {
                result += ` (베스트: ${bestStr}명)`;
            }
        }
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

// 필터 변경 시 자동 적용을 위한 이벤트 리스너
document.addEventListener('DOMContentLoaded', function() {
    // 검색 입력 디바운싱
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(searchAndFilter, 300);
    });
    
    document.getElementById('playersFilter').addEventListener('input', searchAndFilter);
    document.getElementById('bestPlayersOnly').addEventListener('change', searchAndFilter);
});