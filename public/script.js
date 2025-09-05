// 사용자 페이지 메인 스크립트 (로그인 및 즐겨찾기 기능 포함)
class BoardGameViewer {
    constructor() {
        this.allData = [];
        this.currentData = [];
        this.currentSortBy = 'name';
        this.currentSortOrder = 'asc';
        this.statusFilterActive = false;
        this.favoriteFilterActive = false;
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';
        this.currentModalGame = null;
        this.currentUser = null;
        this.favorites = new Set();
        
        // DOM 요소 캐싱
        this.elements = {};
        this.initializeElements();
        
        // 초기화
        this.initialize();
    }

    // DOM 요소 초기화
    initializeElements() {
        this.elements = {
            // 인증 관련
            authSection: document.getElementById('authSection'),
            loginBtn: document.getElementById('loginBtn'),
            logoutBtn: document.getElementById('logoutBtn'),
            userProfile: document.getElementById('userProfile'),
            userAvatarBtn: document.getElementById('userAvatarBtn'),
            profileModal: document.getElementById('profileModal'),
            profileModalCloseBtn: document.getElementById('profileModalCloseBtn'),
            profileAvatar: document.getElementById('profileAvatar'),
            profileName: document.getElementById('profileName'),
            profileEmail: document.getElementById('profileEmail'),
            
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
            favoriteFilterBtn: document.getElementById('favoriteFilterBtn'),
            
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
            errorText: document.getElementById('errorText'),
            successMessage: document.getElementById('successMessage'),
            successText: document.getElementById('successText')
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
        
        // 인증 상태 모니터링
        this.setupAuthMonitoring();
        
        // 데이터 로드
        this.loadData();
        
        // 5분마다 자동 새로고침
        setInterval(() => this.loadData(), 300000);
    }

    // 인증 상태 모니터링 설정
    setupAuthMonitoring() {
        window.authManager.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateAuthUI(user);
            
            if (user) {
                // 로그인 시 즐겨찾기 로드
                this.loadUserFavorites();
            } else {
                // 로그아웃 시 즐겨찾기 초기화
                this.favorites.clear();
                this.renderGridView(); // UI 업데이트
            }
        });
        
        // 즐겨찾기 변경 모니터링
        window.favoriteManager.onFavoritesChanged((favoriteIds) => {
            console.log('즐겨찾기 변경됨:', favoriteIds);
            this.favorites = new Set(favoriteIds);
            this.updateFavoriteUI();
        });
    }

    // 인증 UI 업데이트
    updateAuthUI(user) {
        if (user) {
            // 로그인 상태
            this.elements.loginBtn.classList.add('hidden');
            this.elements.userProfile.classList.remove('hidden');
            this.elements.favoriteFilterBtn.classList.remove('hidden');
            
            this.elements.userAvatarImg.src = user.photoURL || '';
        } else {
            // 로그아웃 상태
            this.elements.loginBtn.classList.remove('hidden');
            this.elements.userProfile.classList.add('hidden');
            this.elements.favoriteFilterBtn.classList.add('hidden');
            
            // 즐겨찾기 필터가 활성화된 경우 해제
            if (this.favoriteFilterActive) {
                this.toggleFavoriteFilter();
            }
        }
    }

    // 사용자 즐겨찾기 로드
    async loadUserFavorites() {
        if (!this.currentUser) return;
        
        try {
            console.log('사용자 즐겨찾기 로드 시작');
            const favoriteIds = await window.favoriteManager.loadUserFavorites(this.currentUser.uid);
            console.log('로드된 즐겨찾기:', favoriteIds);
            this.favorites = new Set(favoriteIds);
            this.updateFavoriteUI();
        } catch (error) {
            console.error('즐겨찾기 로드 실패:', error);
        }
    }

    // 즐겨찾기 UI 업데이트
    updateFavoriteUI() {
        // 로그인하지 않은 경우 업데이트하지 않음
        if (!this.currentUser) return;
        
        console.log('즐겨찾기 UI 업데이트:', Array.from(this.favorites));
        
        // 게임 카드 다시 렌더링 (하트 표시 업데이트)
        this.renderGridView();
        
        // 모달 즐겨찾기 버튼 업데이트
        const modalFavoriteBtn = document.querySelector('.modal-favorite-btn');
        if (modalFavoriteBtn && this.currentModalGame) {
            this.updateFavoriteButton(modalFavoriteBtn, this.currentModalGame.id);
        }
        
        // 필터가 활성화된 경우 목록 다시 렌더링
        if (this.favoriteFilterActive) {
            this.advancedSearchAndFilter();
        }
    }

    // 즐겨찾기 버튼 상태 업데이트
    updateFavoriteButton(button, gameId) {
        if (!button || !this.currentUser) return;
        
        const isFavorited = this.favorites.has(gameId);
        
        button.innerHTML = isFavorited ? '❤️' : '🤍';
        button.classList.toggle('favorited', isFavorited);
        button.title = isFavorited ? '즐겨찾기 해제' : '즐겨찾기 추가';
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 인증 관련 이벤트
        this.elements.loginBtn.addEventListener('click', () => this.handleLogin());
        this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
        this.elements.userAvatarBtn.addEventListener('click', () => this.openProfileModal());
        this.elements.profileModalCloseBtn.addEventListener('click', () => this.closeProfileModal());
        this.elements.profileModal.addEventListener('click', (e) => {
            if (e.target === this.elements.profileModal) {
                this.closeProfileModal();
            }
        });

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
        
        // 모달 닫기
        this.elements.modalCloseBtn.addEventListener('click', () => this.closeGameModal());
        this.elements.gameDetailModal.addEventListener('click', (e) => {
            if (e.target === this.elements.gameDetailModal) {
                this.closeGameModal();
            }
        });
        
        // 메시지 닫기
        document.getElementById('errorCloseBtn')?.addEventListener('click', () => this.hideError());
        document.getElementById('successCloseBtn')?.addEventListener('click', () => this.hideSuccess());
        
        // 전역 함수 노출 (HTML onclick 이벤트용)
        window.toggleDropdown = () => this.toggleDropdown();
        window.selectOption = (value, text) => this.selectOption(value, text);
        window.openGameModal = (gameId) => this.openGameModal(gameId);
        window.closeGameModal = () => this.closeGameModal();
        window.embedYouTubeVideo = (url) => this.embedYouTubeVideo(url);
        window.searchAndFilter = () => this.advancedSearchAndFilter();
        window.hideError = () => this.hideError();
        window.hideSuccess = () => this.hideSuccess();
        window.toggleFavorite = (gameId, event) => this.toggleFavorite(gameId, event);
        window.openProfileModal = () => this.openProfileModal();
    }

    // 로그인 처리
    async handleLogin() {
        try {
            console.log('로그인 버튼 클릭됨');
            this.showLoading(true);
            
            const user = await window.authManager.signInWithGoogle();
            if (user) {
                this.showSuccess('로그인되었습니다!');
            }
        } catch (error) {
            console.error('로그인 처리 실패:', error);
            this.showError(error.message || '로그인에 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 로그아웃 처리
    async handleLogout() {
        try {
            this.showLoading(true);
            await window.authManager.signOut();
            this.showSuccess('로그아웃되었습니다.');
        } catch (error) {
            console.error('로그아웃 실패:', error);
            this.showError('로그아웃에 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    // 즐겨찾기 토글
    async toggleFavorite(gameId, event) {
        if (event) {
            event.stopPropagation();
        }
        
        if (!this.currentUser) {
            this.showError('로그인 후 즐겨찾기를 사용할 수 있습니다.');
            return;
        }

        try {
            const button = event ? event.target : document.querySelector(`[data-game-id="${gameId}"]`);
            if (button) {
                button.disabled = true;
            }

            const isFavorited = await window.favoriteManager.toggleFavorite(gameId);
            
            if (isFavorited) {
                this.showSuccess('즐겨찾기에 추가되었습니다!');
            } else {
                this.showSuccess('즐겨찾기에서 제거되었습니다.');
            }
        } catch (error) {
            console.error('즐겨찾기 토글 실패:', error);
            this.showError(error.message || '즐겨찾기 처리에 실패했습니다.');
        } finally {
            const button = event ? event.target : document.querySelector(`[data-game-id="${gameId}"]`);
            if (button) {
                button.disabled = false;
            }
        }
    }

    // 프로필 모달 열기
    openProfileModal() {
        if (!this.currentUser) return;
        
        this.elements.profileAvatar.src = this.currentUser.photoURL || '';
        this.elements.profileName.textContent = this.currentUser.displayName || '이름 없음';
        this.elements.profileEmail.textContent = this.currentUser.email || '';
        
        this.elements.profileModal.classList.remove('hidden');
    }

    // 프로필 모달 닫기
    closeProfileModal() {
        this.elements.profileModal.classList.add('hidden');
    }
    toggleFavoriteFilter() {
        if (!this.currentUser) {
            this.showError('로그인 후 즐겨찾기 필터를 사용할 수 있습니다.');
            return;
        }

        this.favoriteFilterActive = !this.favoriteFilterActive;
        
        if (this.favoriteFilterActive) {
            this.elements.favoriteFilterBtn.classList.add('active');
            this.elements.favoriteFilterBtn.title = '전체 게임 보기';
        } else {
            this.elements.favoriteFilterBtn.classList.remove('active');
            this.elements.favoriteFilterBtn.title = '즐겨찾기만 보기';
        }
        
        this.advancedSearchAndFilter();
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
        this.hideSuccess();
        
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
        
        // 1. 즐겨찾기 필터 (가장 먼저 적용)
        if (this.favoriteFilterActive && this.currentUser) {
            filteredData = filteredData.filter(game => this.favorites.has(game.id));
        }
        
        // 2. 검색 타입별 검색
        const searchInput = this.elements.searchInput.value.trim();
        const searchType = this.elements.searchType.value;
        
        if (searchInput) {
            filteredData = this.applySearch(filteredData, searchInput, searchType);
        }
        
        // 3. 난이도 필터
        filteredData = this.applyDifficultyFilter(filteredData);
        
        // 4. 플레이 시간 필터
        filteredData = this.applyTimeFilter(filteredData);
        
        // 5. 상태 필터
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
            let emptyMessage = '🎲 검색 결과가 없습니다';
            if (this.favoriteFilterActive) {
                emptyMessage = '❤️ 즐겨찾기한 게임이 없습니다';
            }
            
            this.elements.gameGrid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666; font-size: 18px;">
                    ${emptyMessage}
                </div>
            `;
            return;
        }
        
        this.elements.gameGrid.innerHTML = this.currentData.map(item => {
            const title = this.escapeHtml(item.name || '제목 없음');
            const imageUrl = item.imageUrl || this.DEFAULT_IMAGE_URL;
            const statusTag = this.getStatusTag(item.status);
            
            // 로그인했고 즐겨찾기된 게임만 하트 표시 (클릭 불가)
            const favoriteIndicator = (this.currentUser && this.favorites.has(item.id)) ? `
                <div class="favorite-indicator">❤️</div>
            ` : '';
            
            return `
                <div class="game-card-grid ${item.status ? 'has-status' : ''}" onclick="openGameModal('${item.id}')">
                    ${statusTag}
                    <div class="game-image">
                        <img src="${imageUrl}" alt="${title}" onerror="this.src='${this.DEFAULT_IMAGE_URL}'">
                        ${favoriteIndicator}
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
        const game = this.currentData.find(g => g.id === gameId) || this.allData.find(g => g.id === gameId);
        if (!game) return;
        
        // 현재 게임 정보 저장
        this.currentModalGame = game;
        
        // 1. 먼저 모달을 보이게 하고 로딩 상태 표시
        this.elements.gameDetailModal.classList.remove('hidden');
        
        // 2. 이전 이미지 즉시 제거하고 로딩 표시
        this.elements.modalGameImage.src = '';
        this.elements.modalGameImage.style.display = 'none';
        
        // 3. 게임 정보 먼저 렌더링 (이미지와 독립적으로)
        this.renderGameInfo(game);
        
        // 4. 이미지 로딩 처리
        this.loadModalImage(game);
        
        // 5. 모달 닫기 버튼 복원
        this.elements.modalCloseBtn.style.display = '';
    }

    // 게임 정보 렌더링
    renderGameInfo(game) {
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
    }

    // 모달 이미지 로딩
    loadModalImage(game) {
        const imageUrl = game.imageUrl || this.DEFAULT_IMAGE_URL;
        
        // 로그인한 경우에만 즐겨찾기 버튼 표시
        const favoriteButton = this.currentUser ? `
            <button class="modal-favorite-btn" 
                    data-game-id="${game.id}" 
                    onclick="toggleFavorite('${game.id}', event)"
                    title="${this.favorites.has(game.id) ? '즐겨찾기 해제' : '즐겨찾기 추가'}">
                ${this.favorites.has(game.id) ? '❤️' : '🤍'}
            </button>
        ` : '';
        
        // 기존 모달 이미지 컨테이너 초기화
        const modalGameImage = document.querySelector('.modal-game-image');
        modalGameImage.innerHTML = `
            <img id="modalGameImage" src="" alt="게임 이미지">
            ${favoriteButton}
        `;
        
        // 요소 재참조
        this.elements.modalGameImage = document.getElementById('modalGameImage');
        
        // 즐겨찾기 버튼 상태 업데이트 (로그인한 경우에만)
        if (this.currentUser) {
            const modalFavoriteBtn = modalGameImage.querySelector('.modal-favorite-btn');
            if (modalFavoriteBtn) {
                this.updateFavoriteButton(modalFavoriteBtn, game.id);
            }
        }
        
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
    }
    
    // 게임 상세 모달 닫기
    closeGameModal() {
        this.elements.gameDetailModal.classList.add('hidden');
        this.currentModalGame = null; // 현재 게임 정보 초기화
        
        // 모달 내용 초기화 (비디오나 다른 상태 완전히 리셋)
        this.resetModalContent();
    }

    // 모달 내용 완전 초기화
    resetModalContent() {
        // 이미지 컨테이너 완전 초기화
        const modalGameImage = document.querySelector('.modal-game-image');
        if (modalGameImage) {
            modalGameImage.innerHTML = '<img id="modalGameImage" src="" alt="게임 이미지">';
            
            // 요소 재참조
            this.elements.modalGameImage = document.getElementById('modalGameImage');
        }
        
        // 게임 정보 컨테이너 초기화
        const gameDetailInfo = document.querySelector('.game-detail-info');
        if (gameDetailInfo) {
            gameDetailInfo.innerHTML = '';
        }
        
        // 닫기 버튼 복원
        this.elements.modalCloseBtn.style.display = '';
    }

    // 유튜브 영상 임베드
    embedYouTubeVideo(youtubeUrl) {
        if (!this.currentModalGame || !youtubeUrl) return;
        
        this.elements.modalCloseBtn.style.display = 'none';
        
        const videoId = this.getYouTubeVideoId(youtubeUrl);
        if (!videoId) return;
        
        const modalGameImage = document.querySelector('.modal-game-image');
        
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
            // 비디오 닫기 시 원래 이미지로 복원
            this.restoreOriginalImage();
        };
        
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-container';
        videoContainer.appendChild(closeVideoBtn);
        videoContainer.appendChild(iframe);
        
        modalGameImage.innerHTML = '';
        modalGameImage.appendChild(videoContainer);
    }

    // 원래 이미지로 복원
    restoreOriginalImage() {
        if (!this.currentModalGame) return;
        
        this.elements.modalCloseBtn.style.display = '';
        
        // 이미지 컨테이너 완전 초기화 후 재생성
        const modalGameImage = document.querySelector('.modal-game-image');
        modalGameImage.innerHTML = '<img id="modalGameImage" src="" alt="게임 이미지">';
        
        // 요소 재참조
        this.elements.modalGameImage = document.getElementById('modalGameImage');
        
        // 원래 게임의 이미지 다시 로드
        this.loadModalImage(this.currentModalGame);
        
        // 게임 정보도 다시 렌더링 (유튜브 버튼 복원)
        this.renderGameInfo(this.currentModalGame);
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
        console.log('selectOption 호출:', value, text); // 디버깅용
        
        this.elements.selectedOption.textContent = text;
        this.elements.dropdownOptions.classList.add('hidden');
        
        const arrow = document.querySelector('.dropdown-arrow');
        if (arrow) {
            arrow.style.transform = 'rotate(0deg)';
        }
        
        // 정렬 기준 변경
        this.currentSortBy = value;
        console.log('현재 정렬 기준:', this.currentSortBy); // 디버깅용
        
        // 정렬 적용
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
        
        if (this.favoriteFilterActive) {
            this.elements.gameCount.textContent = `즐겨찾기 ${total}개`;
        } else if (total === totalAll) {
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
        this.hideSuccess();
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        
        setTimeout(() => this.hideError(), 5000);
    }

    showSuccess(message) {
        this.hideError();
        this.elements.successText.textContent = message;
        this.elements.successMessage.classList.remove('hidden');
        
        setTimeout(() => this.hideSuccess(), 3000);
    }

    hideError() {
        this.elements.errorMessage.classList.add('hidden');
    }

    hideSuccess() {
        this.elements.successMessage.classList.add('hidden');
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // Firebase API가 준비될 때까지 기다림
    function waitForAPI() {
        if (window.boardGameAPI && window.firebaseInitialized && window.authManager && window.favoriteManager) {
            console.log('모든 API 준비 완료');
            // BoardGameViewer 인스턴스 생성
            window.boardGameViewer = new BoardGameViewer();
        } else {
            console.log('API 대기 중...');
            setTimeout(waitForAPI, 100);
        }
    }
    
    waitForAPI();
});