// 사용자 페이지 메인 스크립트
class BoardGameViewer {
    constructor() {
        this.allData = [];
        this.currentData = [];
        this.currentSortBy = 'name';
        this.currentSortOrder = 'asc';
        this.statusFilterActive = false;
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';
        
        // DOM 요소 캐싱
        this.elements = {};
        this.initializeElements();
        
        // 초기화
        this.initialize();
    }

    // DOM 요소 초기화
    initializeElements() {
        this.elements = {
            // 검색 관련
            searchType: document.getElementById('searchType'),
            searchInput: document.getElementById('searchInput'),
            
            // 슬라이더
            difficultyMin: document.getElementById('difficultyMin'),
            difficultyMax: document.getElementById('difficultyMax'),
            difficultyMinValue: document.getElementById('difficultyMinValue'),
            difficultyMaxValue: document.getElementById('difficultyMaxValue'),
            timeMin: document.getElementById('timeMin'),
            timeMax: document.getElementById('timeMax'),
            timeMinValue: document.getElementById('timeMinValue'),
            timeMaxValue: document.getElementById('timeMaxValue'),
            
            // 정렬 및 필터
            selectedOption: document.getElementById('selectedOption'),
            dropdownOptions: document.getElementById('dropdownOptions'),
            sortOrderBtn: document.getElementById('sortOrderBtn'),
            sortOrderIcon: document.getElementById('sortOrderIcon'),
            statusFilterBtn: document.getElementById('statusFilterBtn'),
            
            // 게임 목록
            gameGrid: document.getElementById('gameGrid'),
            gameCount: document.getElementById('gameCount'),
            
            // 모달
            gameDetailModal: document.getElementById('gameDetailModal'),
            modalGameImage: document.getElementById('modalGameImage'),
            modalCloseBtn: document.getElementById('modalCloseBtn'),
            
            // 메시지
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText')
        };
    }

    // 초기화
    initialize() {
        // 슬라이더 초기값 설정
        this.elements.difficultyMin.value = 1;
        this.elements.difficultyMax.value = 3;
        this.elements.timeMin.value = 10;
        this.elements.timeMax.value = 120;
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        // 슬라이더 초기화
        this.initializeSliders();
        
        // 데이터 로드
        this.loadData();
        
        // 5분마다 자동 새로고침
        setInterval(() => this.loadData(), 300000);
    }

    // 이벤트 리스너 설정
    setupEventListeners() {

        // 필터 토글 이벤트 리스너 추가 (맨 앞에 추가)
        const filterToggle = document.getElementById('filterToggle');
        const filterContent = document.getElementById('filterContent');
        
        if (filterToggle && filterContent) {
            filterToggle.addEventListener('click', () => {
                const isCollapsed = filterContent.classList.contains('collapsed');
                
                if (isCollapsed) {
                    // 펼치기
                    filterToggle.classList.remove('collapsed');
                    filterContent.classList.remove('collapsed');
                } else {
                    // 접기
                    filterToggle.classList.add('collapsed');
                    filterContent.classList.add('collapsed');
                }
            });
        }

        // 검색 타입 변경
        this.elements.searchType.addEventListener('change', () => this.handleSearchTypeChange());
        
        // 검색 입력
        let searchTimeout;
        this.elements.searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => this.advancedSearchAndFilter(), 300);
        });
        
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                this.advancedSearchAndFilter();
            }
        });      
        
        // 정렬 및 필터
        this.elements.sortOrderBtn.addEventListener('click', () => this.toggleSortOrder());
        this.elements.statusFilterBtn.addEventListener('click', () => this.toggleStatusFilter());
        
        // 모달 닫기
        this.elements.modalCloseBtn.addEventListener('click', () => this.closeGameModal());
        this.elements.gameDetailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.gameDetailModal) {
                this.closeGameModal();
            }
        });
        
        // 에러 메시지 닫기
        document.getElementById('errorCloseBtn')?.addEventListener('click', () => this.hideError());
        
        // 커스텀 드롭다운
        this.setupDropdownListeners();
        
        // 전역 함수 노출 (HTML onclick 이벤트용)
        window.toggleDropdown = () => this.toggleDropdown();
        window.selectOption = (value, text) => this.selectOption(value, text);
        window.openGameModal = (gameId) => this.openGameModal(gameId);
        window.closeGameModal = () => this.closeGameModal();
        window.embedYouTubeVideo = (url) => this.embedYouTubeVideo(url);
        window.searchAndFilter = () => this.advancedSearchAndFilter();
        window.hideError = () => this.hideError();
    }

    // 커스텀 드롭다운 설정
    setupDropdownListeners() {
        const dropdownSelected = document.querySelector('.dropdown-selected');
        if (dropdownSelected) {
            dropdownSelected.addEventListener('click', () => this.toggleDropdown());
        }
        
        // 외부 클릭시 드롭다운 닫기
        document.addEventListener('click', (event) => {
            const dropdown = document.getElementById('customDropdown');
            if (dropdown && !dropdown.contains(event.target)) {
                this.elements.dropdownOptions.classList.add('hidden');
                document.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
            }
        });
    }

    // 검색 타입 변경 처리
    handleSearchTypeChange() {
        const type = this.elements.searchType.value;
        const input = this.elements.searchInput;
        
        if (type === 'name') {
            input.placeholder = '게임 이름으로 검색';
            input.type = 'text';
        } else if (type === 'players' || type === 'players-best') {
            input.placeholder = '인원 수로 검색';
            input.type = 'number';
            input.min = '1';
            input.max = '20';
        } else if (type === 'genre') {
            input.placeholder = '장르로 검색';
            input.type = 'text';
        }
        
        this.advancedSearchAndFilter();
    }

    // 데이터 로드
    async loadData() {
        this.showLoading(true);
        this.hideError();
        
        try {
            const data = await window.boardGameAPI.getAllGames();
            this.allData = data;
            this.currentData = data;
            
            this.applySortingAndRender();
            this.updateGameCount();
            
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.showError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
        }
        
        this.showLoading(false);
    }

    // 고급 검색 및 필터
    advancedSearchAndFilter() {
        let filteredData = [...this.allData];
        
        // 1. 검색 타입별 검색
        const searchInput = this.elements.searchInput.value.trim();
        const searchType = this.elements.searchType.value;
        
        if (searchInput) {
            filteredData = this.applySearch(filteredData, searchInput, searchType);
        }
        
        // 2. 난이도 필터
        filteredData = this.applyDifficultyFilter(filteredData);
        
        // 3. 플레이 시간 필터
        filteredData = this.applyTimeFilter(filteredData);
        
        // 4. 상태 필터
        if (this.statusFilterActive) {
            filteredData = filteredData.filter(game => 
                game.status && game.status !== 'normal' && game.status.trim() !== ''
            );
        }
        
        this.currentData = filteredData;
        this.applySortingAndRender();
        this.updateGameCount();
    }

    // 검색 적용
    applySearch(data, searchInput, searchType) {
        if (searchType === 'name' || searchType === 'genre') {
            const searchTerm = searchInput.toLowerCase();
            const searchTermNoSpaces = searchTerm.replace(/\s/g, '');
            const isOnlyInitials = /^[ㄱ-ㅎ]+$/.test(searchTermNoSpaces);
            
            return data.filter(game => {
                const fieldValue = (game[searchType === 'name' ? 'name' : 'genre'] || '').toLowerCase();
                const fieldValueNoSpaces = fieldValue.replace(/\s/g, '');
                
                if (isOnlyInitials) {
                    const fieldInitials = this.getKoreanInitials(fieldValue);
                    return fieldInitials.includes(searchTermNoSpaces);
                }
                
                return fieldValue.includes(searchTerm) || fieldValueNoSpaces.includes(searchTermNoSpaces);
            });
            
        } else if (searchType === 'players') {
            const playerCount = parseInt(searchInput);
            if (!isNaN(playerCount)) {
                return data.filter(game => {
                    const min = game.minPlayers || 0;
                    const max = game.maxPlayers || 999;
                    return playerCount >= min && playerCount <= max;
                });
            }
            
        } else if (searchType === 'players-best') {
            const playerCount = parseInt(searchInput);
            if (!isNaN(playerCount)) {
                return data.filter(game => {
                    if (!game.bestPlayers) return false;
                    
                    const bestPlayers = game.bestPlayers.toString().trim().replace(/["']/g, '');
                    if (!bestPlayers) return false;
                    
                    if (bestPlayers.includes(',') || bestPlayers.includes(';')) {
                        const separator = bestPlayers.includes(',') ? ',' : ';';
                        const bestPlayersArray = bestPlayers.split(separator).map(p => parseInt(p.trim()));
                        return bestPlayersArray.includes(playerCount);
                    } else {
                        return parseInt(bestPlayers) === playerCount;
                    }
                });
            }
        }
        
        return data;
    }

    // 난이도 필터 적용
    applyDifficultyFilter(data) {
        const difficultyMin = parseFloat(this.elements.difficultyMin.value);
        const difficultyMax = parseFloat(this.elements.difficultyMax.value);
        
        if (difficultyMin > 1 || difficultyMax < 3) {
            return data.filter(game => {
                const difficulty = parseFloat(game.difficulty) || 0;
                const maxDifficulty = difficultyMax === 3 ? 5 : difficultyMax;
                return difficulty >= difficultyMin && difficulty <= maxDifficulty;
            });
        }
        
        return data;
    }

    // 플레이 시간 필터 적용
    applyTimeFilter(data) {
        const timeMin = parseInt(this.elements.timeMin.value);
        const timeMax = parseInt(this.elements.timeMax.value);
        
        if (timeMin > 10 || timeMax < 120) {
            return data.filter(game => {
                const playTime = game.playTime || 0;
                const maxTime = timeMax === 120 ? 360 : timeMax;
                return playTime >= timeMin && playTime <= maxTime;
            });
        }
        
        return data;
    }

    // 한글 초성 추출
    getKoreanInitials(text) {
        const initials = [];
        const koreanInitialConsonants = [
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
        ];
        
        const textNoSpaces = text.replace(/\s/g, '');
        
        for (let i = 0; i < textNoSpaces.length; i++) {
            const charCode = textNoSpaces.charCodeAt(i);
            if (charCode >= 0xAC00 && charCode <= 0xD7A3) {
                const initialIndex = Math.floor((charCode - 0xAC00) / 588);
                initials.push(koreanInitialConsonants[initialIndex]);
            } else if (charCode >= 0x3131 && charCode <= 0x3163) {
                initials.push(textNoSpaces[i]);
            } else {
                initials.push(textNoSpaces[i]);
            }
        }
        
        return initials.join('');
    }

    // 정렬 적용 및 렌더링
    applySortingAndRender() {
        this.sortGames();
        this.renderGridView();
    }

    // 게임 정렬
    sortGames() {
        this.currentData.sort((a, b) => {
            let comparison = 0;
            
            if (this.currentSortBy === 'name') {
                const nameA = (a.name || '').toLowerCase();
                const nameB = (b.name || '').toLowerCase();
                comparison = nameA.localeCompare(nameB, 'ko-KR');
            } else if (this.currentSortBy === 'difficulty') {
                const diffA = a.difficulty !== null && a.difficulty !== undefined && a.difficulty !== '' 
                    ? parseFloat(a.difficulty) : null;
                const diffB = b.difficulty !== null && b.difficulty !== undefined && b.difficulty !== '' 
                    ? parseFloat(b.difficulty) : null;
                
                if (diffA === null && diffB === null) {
                    const nameA = (a.name || '').toLowerCase();
                    const nameB = (b.name || '').toLowerCase();
                    comparison = nameA.localeCompare(nameB, 'ko-KR');
                } else if (diffA === null) {
                    comparison = 1;
                } else if (diffB === null) {
                    comparison = -1;
                } else {
                    comparison = diffA - diffB;
                }
            }
            
            return this.currentSortOrder === 'asc' ? comparison : -comparison;
        });
    }

    // 그리드 뷰 렌더링
    renderGridView() {
        if (this.currentData.length === 0) {
            this.elements.gameGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666; font-size: 18px;">
                    🎲 검색 결과가 없습니다
                </div>
            `;
            return;
        }
        
        this.elements.gameGrid.innerHTML = this.currentData.map(item => {
            const title = this.escapeHtml(item.name || '제목 없음');
            const imageUrl = item.imageUrl || this.DEFAULT_IMAGE_URL;
            const statusTag = this.getStatusTag(item.status);
            
            return `
                <div class="game-card-grid ${item.status ? 'has-status' : ''}" onclick="openGameModal('${item.id}')">
                    ${statusTag}
                    <div class="game-image">
                        <img src="${imageUrl}" alt="${title}" onerror="this.src='${this.DEFAULT_IMAGE_URL}'">
                    </div>
                    <div class="game-title-grid">
                        <h3>${title}</h3>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 게임 상세 모달 열기
    openGameModal(gameId) {
        const game = this.currentData.find(g => g.id === gameId);
        if (!game) return;
        
        // 1. 먼저 모달을 보이게 하고 로딩 상태 표시
        this.elements.gameDetailModal.classList.remove('hidden');
        
        // 2. 이전 이미지 즉시 제거하고 로딩 표시
        this.elements.modalGameImage.src = '';
        this.elements.modalGameImage.style.display = 'none';
        
        // 3. 게임 정보 먼저 렌더링 (이미지와 독립적으로)
        const gameDetailInfo = document.querySelector('.game-detail-info');
        gameDetailInfo.innerHTML = `
            <h2>${this.escapeHtml(game.name || '제목 없음')} ${this.getStatusTag(game.status)}</h2>
            <div class="detail-fields-container">
                <div class="detail-field">
                    <span class="detail-label">난이도:</span>
                    <span class="detail-value">${game.difficulty ? parseFloat(game.difficulty).toFixed(1) : '-'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">플레이인원:</span>
                    <span class="detail-value">${this.formatPlayerInfo(game)}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">플레이 시간:</span>
                    <span class="detail-value">${game.playTime ? game.playTime + '분' : '-'}</span>
                </div>
                <div class="detail-field">
                    <span class="detail-label">장르/테마:</span>
                    <span class="detail-value">${this.escapeHtml(game.genre || '-')}</span>
                </div>
            </div>
            ${game.youtubeUrl && game.youtubeUrl.trim() ? `
                <div class="youtube-link-container">
                    <button class="youtube-link" onclick="embedYouTubeVideo('${game.youtubeUrl}')">
                        📺 룰 설명 영상 보기
                    </button>
                </div>
            ` : `
                <div class="youtube-link-container">
                    <div class="youtube-link disabled">
                        📺 룰 영상 없음
                    </div>
                </div>
            `}
        `;
        
        // 4. 이미지 로딩 처리
        const imageUrl = game.imageUrl || this.DEFAULT_IMAGE_URL;
        
        // 새 이미지 객체 생성하여 preload
        const tempImage = new Image();
        
        tempImage.onload = () => {
            // 이미지 로딩 완료 후 모달 이미지에 적용
            this.elements.modalGameImage.src = imageUrl;
            this.elements.modalGameImage.style.display = 'block';
        };
        
        tempImage.onerror = () => {
            // 이미지 로딩 실패 시 기본 이미지 사용
            this.elements.modalGameImage.src = this.DEFAULT_IMAGE_URL;
            this.elements.modalGameImage.style.display = 'block';
        };
        
        // 이미지 로딩 시작
        tempImage.src = imageUrl;
        
        // 5. 모달 닫기 버튼 복원
        this.elements.modalCloseBtn.style.display = '';
    }
    
    // 게임 상세 모달 닫기
    closeGameModal() {
        this.elements.gameDetailModal.classList.add('hidden');
    }

    // 유튜브 영상 임베드
    embedYouTubeVideo(youtubeUrl) {
        this.elements.modalCloseBtn.style.display = 'none';
        
        const videoId = this.getYouTubeVideoId(youtubeUrl);
        if (!videoId) return;
        
        const modalGameImage = document.querySelector('.modal-game-image');
        const originalContent = modalGameImage.innerHTML;
        
        const iframe = document.createElement('iframe');
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
        iframe.allowFullscreen = true;
        iframe.style.borderRadius = '0';
        
        const closeVideoBtn = document.createElement('button');
        closeVideoBtn.innerHTML = '&times;';
        closeVideoBtn.className = 'close-video-btn';
        closeVideoBtn.onclick = () => {
            this.elements.modalCloseBtn.style.display = '';
            modalGameImage.innerHTML = originalContent;
            
            const youtubeLink = modalGameImage.parentElement.querySelector('.youtube-link:not(.disabled)');
            if (youtubeLink) {
                youtubeLink.onclick = (e) => {
                    e.preventDefault();
                    this.embedYouTubeVideo(youtubeUrl);
                };
            }
        };
        
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.appendChild(closeVideoBtn);
        videoContainer.appendChild(iframe);
        
        modalGameImage.innerHTML = '';
        modalGameImage.appendChild(videoContainer);
    }

    // 유튜브 비디오 ID 추출
    getYouTubeVideoId(url) {
        if (!url) return null;
        
        const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[7].length === 11) ? match[7] : null;
    }

    // 정렬 관련 메서드
    toggleDropdown() {
        this.elements.dropdownOptions.classList.toggle('hidden');
        const arrow = document.querySelector('.dropdown-arrow');
        if (arrow) {
            arrow.style.transform = this.elements.dropdownOptions.classList.contains('hidden') 
                ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }

    selectOption(value, text) {
        this.elements.selectedOption.textContent = text;
        this.elements.dropdownOptions.classList.add('hidden');
        document.querySelector('.dropdown-arrow').style.transform = 'rotate(0deg)';
        
        this.currentSortBy = value;
        this.applySortingAndRender();
    }

    toggleSortOrder() {
        this.currentSortOrder = this.currentSortOrder === 'asc' ? 'desc' : 'asc';
        this.updateSortOrderIcon();
        this.applySortingAndRender();
    }

    updateSortOrderIcon() {
        if (this.currentSortOrder === 'asc') {
            this.elements.sortOrderIcon.textContent = '↑';
            this.elements.sortOrderBtn.title = '오름차순 → 내림차순으로 변경';
        } else {
            this.elements.sortOrderIcon.textContent = '↓';
            this.elements.sortOrderBtn.title = '내림차순 → 오름차순으로 변경';
        }
    }

    toggleStatusFilter() {
        this.statusFilterActive = !this.statusFilterActive;
        
        if (this.statusFilterActive) {
            this.elements.statusFilterBtn.classList.add('active');
            this.elements.statusFilterBtn.title = '전체 게임 보기';
        } else {
            this.elements.statusFilterBtn.classList.remove('active');
            this.elements.statusFilterBtn.title = '특별 상태 게임만 보기';
        }
        
        this.advancedSearchAndFilter();
    }

    // 슬라이더 초기화
    initializeSliders() {
        this.initializeCustomSlider('difficulty', 1, 3, 0.1);
        this.initializeCustomSlider('time', 10, 120, 5);
    }

    // 커스텀 슬라이더 설정
    initializeCustomSlider(type, min, max, step) {
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
        
        const valueToPercent = (value) => ((value - min) / (max - min)) * 100;
        const percentToValue = (percent) => {
            const value = min + (percent / 100) * (max - min);
            return Math.round(value / step) * step;
        };
        
        const getPercentFromEvent = (event) => {
            const rect = track.getBoundingClientRect();
            const clientX = event.clientX || (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
            const percent = ((clientX - rect.left) / rect.width) * 100;
            return Math.max(0, Math.min(100, percent));
        };
        
        const updateUI = () => {
            const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
            const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
            
            const minPercent = valueToPercent(minValue);
            const maxPercent = valueToPercent(maxValue);
            
            if (isDragging) {
                minHandle.style.transition = 'none';
                maxHandle.style.transition = 'none';
                range.style.transition = 'none';
            } else {
                minHandle.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
                maxHandle.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
                range.style.transition = 'none';
            }
            
            minHandle.style.left = minPercent + '%';
            maxHandle.style.left = maxPercent + '%';
            
            range.style.left = minPercent + '%';
            range.style.width = (maxPercent - minPercent) + '%';
            
            if (type === 'time') {
                minValueEl.textContent = minValue + '분';
                maxValueEl.textContent = maxValue === max ? maxValue + '분+' : maxValue + '분';
            } else {
                minValueEl.textContent = minValue.toFixed(1);
                maxValueEl.textContent = maxValue === max ? maxValue.toFixed(1) + '+' : maxValue.toFixed(1);
            }
        };
        
        const startDrag = (event, handle) => {
            isDragging = true;
            currentHandle = handle;
            
            minHandle.style.zIndex = '3';
            maxHandle.style.zIndex = '3';
            handle.style.zIndex = '10';
            
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', endDrag);
            
            event.preventDefault();
        };
        
        const onMove = (event) => {
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
            this.advancedSearchAndFilter();
            
            event.preventDefault();
        };
        
        const endDrag = () => {
            isDragging = false;
            currentHandle = null;
            
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', endDrag);
            
            updateUI();
        };
        
        const onTrackClick = (event) => {
            if (isDragging) return;
            
            const percent = getPercentFromEvent(event);
            const value = percentToValue(percent);
            const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
            const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
            
            const distToMin = Math.abs(value - minValue);
            const distToMax = Math.abs(value - maxValue);
            
            if (distToMin < distToMax) {
                minInput.value = Math.min(value, maxValue);
            } else {
                maxInput.value = Math.max(value, minValue);
            }
            
            updateUI();
            this.advancedSearchAndFilter();
        };
        
        // 이벤트 리스너 등록
        minHandle.addEventListener('mousedown', (e) => startDrag(e, minHandle));
        maxHandle.addEventListener('mousedown', (e) => startDrag(e, maxHandle));
        minHandle.addEventListener('touchstart', (e) => startDrag(e, minHandle));
        maxHandle.addEventListener('touchstart', (e) => startDrag(e, maxHandle));
        
        track.addEventListener('click', onTrackClick);
        track.addEventListener('touchstart', (e) => {
            if (e.target === track) onTrackClick(e);
        });
        
        minInput.addEventListener('input', () => {
            const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
            const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
            
            if (minValue > maxValue) {
                maxInput.value = minValue;
            }
            
            updateUI();
            this.advancedSearchAndFilter();
        });
        
        maxInput.addEventListener('input', () => {
            const minValue = type === 'time' ? parseInt(minInput.value) : parseFloat(minInput.value);
            const maxValue = type === 'time' ? parseInt(maxInput.value) : parseFloat(maxInput.value);
            
            if (maxValue < minValue) {
                minInput.value = maxValue;
            }
            
            updateUI();
            this.advancedSearchAndFilter();
        });
        
        updateUI();
    }

    // 유틸리티 메서드
    updateGameCount() {
        const total = this.currentData.length;
        const totalAll = this.allData.length;
        
        if (total === totalAll) {
            this.elements.gameCount.textContent = `총 ${total}개`;
        } else {
            this.elements.gameCount.textContent = `${total}개 (전체 ${totalAll}개)`;
        }
    }

    getStatusTag(status) {
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

    formatPlayerInfo(game) {
        const min = game.minPlayers;
        const max = game.maxPlayers;
        const best = game.bestPlayers;
        
        let result = this.formatPlayerCount(min, max);
        
        if (best && best.toString().trim()) {
            let bestStr = best.toString().trim().replace(/["'`]/g, '');
            
            if (bestStr) {
                if (min && max && min === max) {
                    if (bestStr.includes(',') || bestStr.includes(';')) {
                        result += ` (베스트: ${bestStr})`;
                    } else {
                        const bestNum = parseInt(bestStr);
                        if (bestNum === min) {
                            return `${min}인 전용 게임`;
                        } else {
                            result += ` (베스트: ${bestStr}명)`;
                        }
                    }
                } else {
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

    formatPlayerCount(min, max) {
        if (!min && !max) return '-';
        if (!max) return `${min}명+`;
        if (!min) return `~${max}명`;
        if (min === max) return `${min}명`;
        return `${min}-${max}명`;
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
    }

    // 메시지 표시
    showLoading(show) {
        this.elements.loading.classList.toggle('show', show);
    }

    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => this.hideError(), 5000);
    }

    hideError() {
        this.elements.errorMessage.classList.add('hidden');
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // Firebase API가 준비될 때까지 기다림
    function waitForAPI() {
        if (window.boardGameAPI && window.firebaseInitialized) {
            console.log('BoardGame API 준비 완료');
            // BoardGameViewer 인스턴스 생성
            window.boardGameViewer = new BoardGameViewer();
        } else {
            console.log('BoardGame API 대기 중...');
            setTimeout(waitForAPI, 100);
        }
    }
    
    waitForAPI();
});