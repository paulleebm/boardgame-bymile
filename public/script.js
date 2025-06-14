let allData = [];
let currentData = [];

// 정렬 상태 관리
let currentSortBy = 'name'; // 초기값: 가나다순
let currentSortOrder = 'asc'; // 초기값: 오름차순

// 기본 이미지 URL (더 안정적인 서비스 사용)
const DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 슬라이더 초기값을 먼저 설정
    document.getElementById('difficultyMin').value = 1;
    document.getElementById('difficultyMax').value = 3;
    document.getElementById('timeMin').value = 10;
    document.getElementById('timeMax').value = 120;
    
    initializeSliders();
    setupBestToggle();
    setupSortingControls();
    setupAdvancedSearch();
    loadData();
    
    // 5분마다 자동 새로고침
    setInterval(loadData, 300000);
});

// 고급 검색 설정
function setupAdvancedSearch() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    // 실시간 검색 (디바운싱)
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            advancedSearchAndFilter();
        }, 300);
    });
    
    // 엔터키 검색
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            advancedSearchAndFilter();
        }
    });
}

// 한글 자음 분리를 위한 함수 (띄어쓰기 무시)
function getKoreanInitials(text) {
    const initials = [];
    const koreanInitialConsonants = [
        'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
        'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    ];
    
    // 띄어쓰기 제거 후 처리
    const textNoSpaces = text.replace(/\s/g, '');
    
    for (let i = 0; i < textNoSpaces.length; i++) {
        const charCode = textNoSpaces.charCodeAt(i);
        if (charCode >= 0xAC00 && charCode <= 0xD7A3) { // 한글 범위
            const initialIndex = Math.floor((charCode - 0xAC00) / 588);
            initials.push(koreanInitialConsonants[initialIndex]);
        } else if (charCode >= 0x3131 && charCode <= 0x3163) {
            // 이미 자음/모음인 경우 (ㄱ, ㄴ, ㄷ 등)
            initials.push(textNoSpaces[i]);
        } else {
            // 영어나 숫자 등
            initials.push(textNoSpaces[i]);
        }
    }
    
    return initials.join('');
}

// 고급 검색 및 필터 기능
function advancedSearchAndFilter() {
    let filteredData = [...allData];
    
    // 1. 게임 이름 및 장르 고급 검색
    const searchInput = document.getElementById('searchInput').value.trim();
    if (searchInput) {
        const searchTerm = searchInput.toLowerCase();
        const searchTermNoSpaces = searchTerm.replace(/\s/g, '');
        const searchInitials = getKoreanInitials(searchTerm);
        
        // 검색어가 모두 자음인지 확인 (초성 검색 여부 판단)
        const isInitialSearch = /^[ㄱ-ㅎ]+$/.test(searchTermNoSpaces);
        
        filteredData = filteredData.filter(game => {
            // 게임 이름 검색
            const gameName = (game.name || '').toLowerCase();
            const gameNameNoSpaces = gameName.replace(/\s/g, '');
            const gameNameInitials = getKoreanInitials(gameName);
            
            // 장르 검색
            const gameGenre = (game.genre || '').toLowerCase();
            const gameGenreNoSpaces = gameGenre.replace(/\s/g, '');
            const gameGenreInitials = getKoreanInitials(gameGenre);
            
            // 초성 검색인 경우
            if (isInitialSearch) {
                return (
                    gameNameInitials.includes(searchInitials) ||
                    gameGenreInitials.includes(searchInitials)
                );
            }
            
            // 일반 검색인 경우
            return (
                // 완전 매칭
                gameName.includes(searchTerm) ||
                gameGenre.includes(searchTerm) ||
                // 띄어쓰기 무시 매칭
                gameNameNoSpaces.includes(searchTermNoSpaces) ||
                gameGenreNoSpaces.includes(searchTermNoSpaces) ||
                // 초성도 함께 체크 (혼합 검색 지원)
                gameNameInitials.includes(searchInitials) ||
                gameGenreInitials.includes(searchInitials)
            );
        });
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
    
    // 3. 난이도 필터
    const difficultyMin = parseFloat(document.getElementById('difficultyMin').value);
    const difficultyMax = parseFloat(document.getElementById('difficultyMax').value);
    
    if (difficultyMin > 1 || difficultyMax < 3) {
        filteredData = filteredData.filter(game => {
            const difficulty = parseFloat(game.difficulty) || 0;
            // 최대값이 3일 때는 3 이상의 모든 난이도 포함
            const maxDifficulty = difficultyMax === 3 ? 5 : difficultyMax;
            return difficulty >= difficultyMin && difficulty <= maxDifficulty;
        });
    }
    
    // 4. 플레이 시간 필터
    const timeMin = parseInt(document.getElementById('timeMin').value);
    const timeMax = parseInt(document.getElementById('timeMax').value);
    
    if (timeMin > 10 || timeMax < 120) {
        filteredData = filteredData.filter(game => {
            const playTime = game.playTime || 0;
            return playTime >= timeMin && playTime <= timeMax;
        });
    }
    
    currentData = filteredData;
    applySortingAndRender();
}

// 기존 searchAndFilter 함수를 고급 검색으로 대체
function searchAndFilter() {
    advancedSearchAndFilter();
}

// 정렬 컨트롤 설정
function setupSortingControls() {
    // 초기 상태 설정
    updateSortOrderIcon();
    
    // 전역 함수로 노출 (HTML에서 호출하기 위해)
    window.currentSortBy = currentSortBy;
    window.applySortingAndRender = applySortingAndRender;
    window.toggleSortOrder = toggleSortOrder;
    
    // 커스텀 드롭다운 초기화
    const selectedOption = document.getElementById('selectedOption');
    if (selectedOption) {
        selectedOption.textContent = currentSortBy === 'name' ? '가나다순' : '난이도순';
    }
}

// 정렬 순서 토글
function toggleSortOrder() {
    currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
    updateSortOrderIcon();
    applySortingAndRender();
}

// 정렬 순서 아이콘 업데이트
function updateSortOrderIcon() {
    const sortOrderIcon = document.getElementById('sortOrderIcon');
    const sortOrderBtn = document.getElementById('sortOrderBtn');
    
    if (sortOrderIcon && sortOrderBtn) {
        if (currentSortOrder === 'asc') {
            sortOrderIcon.textContent = '↑';
            sortOrderBtn.title = '오름차순 → 내림차순으로 변경';
        } else {
            sortOrderIcon.textContent = '↓';
            sortOrderBtn.title = '내림차순 → 오름차순으로 변경';
        }
    }
}

// 정렬 적용 및 렌더링
function applySortingAndRender() {
    sortGames();
    renderGridView();
}

// 개선된 게임 정렬 함수
function sortGames() {
    currentData.sort((a, b) => {
        let comparison = 0;
        
        if (currentSortBy === 'name') {
            // 가나다순 정렬
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            comparison = nameA.localeCompare(nameB, 'ko-KR');
        } else if (currentSortBy === 'difficulty') {
            // 개선된 난이도순 정렬
            const diffA = a.difficulty !== null && a.difficulty !== undefined && a.difficulty !== '' 
                ? parseFloat(a.difficulty) : null;
            const diffB = b.difficulty !== null && b.difficulty !== undefined && b.difficulty !== '' 
                ? parseFloat(b.difficulty) : null;
            
            // null 값 처리: 난이도가 없는 게임은 항상 뒤로
            if (diffA === null && diffB === null) {
                // 둘 다 난이도가 없으면 이름순으로 정렬
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                comparison = nameA.localeCompare(nameB, 'ko-KR');
            } else if (diffA === null) {
                comparison = 1; // A를 뒤로 (난이도 없음)
            } else if (diffB === null) {
                comparison = -1; // B를 뒤로 (난이도 없음)
            } else {
                // 둘 다 난이도가 있으면 난이도로 비교
                comparison = diffA - diffB;
            }
        }
        
        // 정렬 순서 적용
        return currentSortOrder === 'asc' ? comparison : -comparison;
    });
}

// 슬라이더 초기화
function initializeSliders() {
    initializeCustomSlider('difficulty', 1, 3, 0.1);
    initializeCustomSlider('time', 10, 120, 5); // 5분 단위
}

// 베스트 토글 설정
function setupBestToggle() {
    const bestToggle = document.getElementById('bestPlayersOnly');
    const playersLabel = document.getElementById('playersLabel');
    
    bestToggle.addEventListener('change', function() {
        if (this.checked) {
            playersLabel.textContent = '베스트 인원:';
        } else {
            playersLabel.textContent = '플레이 인원:';
        }
        advancedSearchAndFilter();
    });
}

// 커스텀 슬라이더 초기화 (난이도 & 시간용)
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
    
    // 마우스/터치 위치를 백분율로 변환
    function getPercentFromEvent(event) {
        const rect = track.getBoundingClientRect();
        const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
        const percent = ((clientX - rect.left) / rect.width) * 100;
        return Math.max(0, Math.min(100, percent));
    }
    
    // UI 업데이트
    function updateUI() {
        const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
        const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
        
        const minPercent = valueToPercent(minValue);
        const maxPercent = valueToPercent(maxValue);
        
        // 드래그 중일 때는 트랜지션 비활성화
        if (isDragging) {
            minHandle.style.transition = 'none';
            maxHandle.style.transition = 'none';
            range.style.transition = 'none';
        } else {
            // 드래그가 끝나면 트랜지션 복원 (호버 효과용)
            minHandle.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
            maxHandle.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
            range.style.transition = 'none';
        }
        
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
            maxValueEl.textContent = maxValue === max ? maxValue.toFixed(1) + '+' : maxValue.toFixed(1);
        }
    }
    
    // 값 제한 (핸들이 교차하지 않도록)
    function constrainValues() {
        let minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
        let maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
        
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
    
    // 드래그 시작 (마우스/터치)
    function startDrag(event, handle) {
        isDragging = true;
        currentHandle = handle;
        
        // 핸들을 앞으로 가져오기
        minHandle.style.zIndex = '3';
        maxHandle.style.zIndex = '3';
        handle.style.zIndex = '10';
        
        // 이벤트 리스너 등록
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', endDrag);
        
        event.preventDefault();
    }
    
    // 드래그 중 (마우스/터치)
    function onMove(event) {
        if (!isDragging || !currentHandle) return;
        
        const percent = getPercentFromEvent(event);
        const value = percentToValue(percent);
        
        if (currentHandle === minHandle) {
            const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
            minInput.value = Math.min(value, maxValue);
        } else {
            const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
            maxInput.value = Math.max(value, minValue);
        }
        
        updateUI();
        advancedSearchAndFilter(); // 실시간 필터링
        
        // 터치 이벤트의 기본 동작 방지 (스크롤 등)
        event.preventDefault();
    }
    
    // 드래그 끝
    function endDrag() {
        isDragging = false;
        currentHandle = null;
        
        // 이벤트 리스너 제거
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', endDrag);
        
        // 트랜지션 복원
        updateUI();
    }
    
    // 트랙 클릭/터치 이벤트
    function onTrackClick(event) {
        if (isDragging) return;
        
        const percent = getPercentFromEvent(event);
        const value = percentToValue(percent);
        const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
        const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
        
        // 가까운 핸들로 이동
        const distToMin = Math.abs(value - minValue);
        const distToMax = Math.abs(value - maxValue);
        
        if (distToMin < distToMax) {
            minInput.value = Math.min(value, maxValue);
        } else {
            maxInput.value = Math.max(value, minValue);
        }
        
        updateUI();
        advancedSearchAndFilter();
    }
    
    // 마우스 이벤트 리스너
    minHandle.addEventListener('mousedown', (e) => startDrag(e, minHandle));
    maxHandle.addEventListener('mousedown', (e) => startDrag(e, maxHandle));
    
    // 터치 이벤트 리스너
    minHandle.addEventListener('touchstart', (e) => startDrag(e, minHandle));
    maxHandle.addEventListener('touchstart', (e) => startDrag(e, maxHandle));
    
    // 트랙 클릭/터치 이벤트
    track.addEventListener('click', onTrackClick);
    track.addEventListener('touchstart', (e) => {
        // 터치가 핸들이 아닌 트랙에서 시작된 경우에만 처리
        if (e.target === track) {
            onTrackClick(e);
        }
    });
    
    // 키보드 접근성을 위한 input 이벤트
    minInput.addEventListener('input', () => {
        constrainValues();
        updateUI();
        advancedSearchAndFilter();
    });
    
    maxInput.addEventListener('input', () => {
        constrainValues();
        updateUI();
        advancedSearchAndFilter();
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
        
        // 초기 정렬 적용
        applySortingAndRender();
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    showLoading(false);
}

// 그리드 뷰 렌더링 (카드 형태)
function renderGridView() {
    const gameGrid = document.getElementById('gameGrid');
    
    if (currentData.length === 0) {
        gameGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666; font-size: 18px;">🎲 검색 결과가 없습니다</div>';
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

// 모든 검색 및 필터 초기화
function clearAll() {
    document.getElementById('searchInput').value = '';
    document.getElementById('playersFilter').value = '';
    document.getElementById('bestPlayersOnly').checked = false;
    
    // 라벨 초기화
    document.getElementById('playersLabel').textContent = '플레이 인원:';
    
    // 슬라이더 초기화
    document.getElementById('difficultyMin').value = 1;
    document.getElementById('difficultyMax').value = 3;
    document.getElementById('timeMin').value = 10;
    document.getElementById('timeMax').value = 120;
    
    // 정렬 초기화
    currentSortBy = 'name';
    currentSortOrder = 'asc';
    const selectedOption = document.getElementById('selectedOption');
    if (selectedOption) {
        selectedOption.textContent = '가나다순';
    }
    updateSortOrderIcon();
    
    // 슬라이더 UI 업데이트
    initializeSliders();
    
    currentData = allData;
    applySortingAndRender();
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
    
    // 게임 정보 렌더링
    const gameDetailInfo = document.querySelector('.game-detail-info');
    gameDetailInfo.innerHTML = `
        <h2>${game.name || '제목 없음'}</h2>
        <div class="detail-fields-container">
            <div class="detail-field">
                <span class="detail-label">난이도:</span>
                <span class="detail-value">${game.difficulty ? parseFloat(game.difficulty).toFixed(1) : '-'}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">플레이인원:</span>
                <span class="detail-value">${formatPlayerInfo(game)}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">플레이 시간:</span>
                <span class="detail-value">${game.playTime ? game.playTime + '분' : '-'}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">장르/테마:</span>
                <span class="detail-value">${game.genre || '-'}</span>
            </div>
            <div class="detail-field">
                <span class="detail-label">구매자:</span>
                <span class="detail-value">${game.buyer || '-'}</span>
            </div>
        </div>
        ${game.youtubeUrl && game.youtubeUrl.trim() ? `
            <div class="youtube-link-container">
                <a href="${game.youtubeUrl}" target="_blank" class="youtube-link">
                    📺 룰 설명 영상 보기
                </a>
            </div>
        ` : ''}
    `;
    
    modal.classList.remove('hidden');
}

// 게임 상세 모달 닫기
function closeGameModal() {
    document.getElementById('gameDetailModal').classList.add('hidden');
}

// 개선된 formatPlayerInfo 함수
function formatPlayerInfo(game) {
    const min = game.minPlayers;
    const max = game.maxPlayers;
    const best = game.bestPlayers;
    
    let result = formatPlayerCount(min, max);
    
    if (best && best.toString().trim()) {
        let bestStr = best.toString().trim();
        // 따옴표 제거 (CSV에서 "4,5" 형태로 올 수 있음)
        bestStr = bestStr.replace(/["'`]/g, '');
        
        if (bestStr) {
            // 최소/최대 인원이 같고, 베스트 인원도 동일한 경우 처리
            if (min && max && min === max) {
                // 베스트 인원이 최소/최대와 같은지 확인
                if (bestStr.includes(',') || bestStr.includes(';')) {
                    // 여러 베스트 인원이 있는 경우
                    result += ` (베스트: ${bestStr})`;
                } else {
                    const bestNum = parseInt(bestStr);
                    if (bestNum === min) {
                        // 베스트가 최소/최대와 동일한 경우 "전용 게임"으로 표기
                        return `${min}인 전용 게임`;
                    } else {
                        // 베스트가 다른 경우 기존 표기
                        result += ` (베스트: ${bestStr}명)`;
                    }
                }
            } else {
                // 최소/최대가 다른 경우 기존 베스트 표기
                if (bestStr.includes(',') || bestStr.includes(';')) {
                    result += ` (베스트: ${bestStr})`;
                } else {
                    result += ` (베스트: ${bestStr}명)`;
                }
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

// 필터 변경 시 자동 적용을 위한 이벤트 리스너
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('playersFilter').addEventListener('input', advancedSearchAndFilter);
    document.getElementById('bestPlayersOnly').addEventListener('change', advancedSearchAndFilter);
});