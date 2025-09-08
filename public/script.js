// 사용자 페이지 메인 스크립트 (UI 개편 최종 버전)
class BoardGameViewer {
    constructor() {
        this.allGames = [];
        this.allComics = [];
        this.statusFilterActive = false;
        this.favoriteFilterActive = false;
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';
        this.DEFAULT_PROFILE_IMAGE_URL = 'https://i.imgur.com/rWd9g3i.png';
        this.currentUser = null;
        this.favorites = new Set();
        
        this.elements = {};
        this.initializeElements();
        this.initialize();
    }

    initializeElements() {
        const ids = [
            'searchInput', 'searchType', 'playerCountInput',
            'difficultyMin', 'difficultyMax', 'difficultyMinValue', 'difficultyMaxValue', 
            'timeMin', 'timeMax', 'timeMinValue', 'timeMaxValue',
            'gameGrid', 'gameCount', 'comicGrid', 'detailModal', 'loading', 'errorMessage', 
            'successMessage', 'nav-games-btn', 'nav-comics-btn', 'nav-mypage-btn',
            'filter-sidebar', 'filter-overlay', 'close-filter-btn',
            'games-page', 'comics-page', 'mypage-page', 'myPageContent', 'page-header'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }

    initialize() {
        this.setupEventListeners();
        this.initializeSliders();
        this.setupAuthMonitoring();
        this.loadInitialData();
        this.showView('games');
    }

    setupEventListeners() {
        const addListener = (element, event, handler) => element && element.addEventListener(event, handler);

        addListener(this.elements['nav-games-btn'], 'click', () => this.showView('games'));
        addListener(this.elements['nav-comics-btn'], 'click', () => this.showView('comics'));
        addListener(this.elements['nav-mypage-btn'], 'click', () => this.showView('mypage'));
        
        addListener(this.elements['filter-overlay'], 'click', () => this.toggleFilterSidebar(false));
        addListener(this.elements['close-filter-btn'], 'click', () => this.toggleFilterSidebar(false));
        
        const filterInputs = ['searchInput', 'searchType', 'playerCountInput'];
        filterInputs.forEach(id => addListener(this.elements[id], 'input', () => this.advancedSearchAndFilter()));
        
        window.openGameModal = (id) => this.openGameModal(id);
        window.openComicModal = (id) => this.openComicModal(id);
        window.toggleFavorite = (id, event) => this.toggleFavorite(id, event);
        window.handleLogin = () => this.handleLogin();
        window.handleLogout = () => this.handleLogout();
        window.submitComment = (comicId) => this.submitComment(comicId);
    }

    updateHeader(page) {
        let title = '';
        let controls = '';
        if (page === 'games') {
            title = '🎲 보드게임 목록';
            controls = `
                <div class="header-controls">
                    <button id="open-filter-btn" class="action-icon-btn" aria-label="필터 열기">📊</button>
                    <button id="statusFilterBtn" class="action-icon-btn" title="특별 상태 게임만 보기">❗</button>
                    <button id="favoriteFilterBtn" class="action-icon-btn ${this.currentUser ? '' : 'hidden'}" title="즐겨찾기만 보기">❤️</button>
                </div>`;
        } else if (page === 'comics') {
            title = '📚 보드게임 만화';
        } else if (page === 'mypage') {
            title = '👤 마이페이지';
        }
        this.elements['page-header'].innerHTML = `<h1>${title}</h1>${controls}`;
        if (page === 'games') {
            document.getElementById('open-filter-btn').addEventListener('click', () => this.toggleFilterSidebar(true));
            document.getElementById('statusFilterBtn').addEventListener('click', () => this.toggleStatusFilter());
            document.getElementById('favoriteFilterBtn').addEventListener('click', () => this.toggleFavoriteFilter());
        }
    }

    showView(viewName) {
        document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        this.elements[`${viewName}-page`]?.classList.remove('hidden');
        this.elements[`nav-${viewName}-btn`]?.classList.add('active');
        
        this.updateHeader(viewName);
        
        if (viewName === 'comics' && this.allComics.length === 0) this.loadComics();
        if (viewName === 'games') this.advancedSearchAndFilter(); // Re-render games when switching to the tab
    }
    
    toggleFilterSidebar(forceOpen) {
        this.elements['filter-sidebar'].classList.toggle('open', forceOpen);
        this.elements['filter-overlay'].classList.toggle('hidden', !forceOpen);
    }
    
    setupAuthMonitoring() {
        window.authManager.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.renderMyPage();
            if (user) this.loadUserFavorites();
            else this.favorites.clear();
            this.renderGridView();
            this.updateHeader(this.getActiveView());
        });
        
        window.favoriteManager.onFavoritesChanged((favoriteIds) => {
            this.favorites = new Set(favoriteIds);
            this.renderGridView();
        });
    }

    getActiveView() {
        return document.querySelector('.nav-btn.active')?.id.split('-')[1] || 'games';
    }
    
    renderMyPage() {
        const contentEl = this.elements.myPageContent;
        if (!contentEl) return;
        if (this.currentUser) {
            contentEl.innerHTML = `
                <div class="profile-card">
                    <img src="${this.currentUser.photoURL || this.DEFAULT_PROFILE_IMAGE_URL}" alt="프로필" class="profile-avatar">
                    <div class="profile-name">${this.escapeHtml(this.currentUser.displayName)}</div>
                    <div class="profile-email">${this.escapeHtml(this.currentUser.email)}</div>
                    <button class="logout-btn" onclick="handleLogout()">로그아웃</button>
                </div>`;
        } else {
            contentEl.innerHTML = `
                <div class="mypage-login-prompt">
                    <p>로그인하고 더 많은 기능을 이용해보세요!</p>
                    <button class="login-btn-main" onclick="handleLogin()">Google 계정으로 로그인</button>
                </div>`;
        }
    }

    async loadUserFavorites() { if (this.currentUser) await window.favoriteManager.loadUserFavorites(this.currentUser.uid); }
    async handleLogin() { /* ... */ }
    async handleLogout() { /* ... */ }
    async toggleFavorite(gameId, event) { /* ... */ }
    
    toggleFavoriteFilter() {
        if (!this.currentUser) return;
        this.favoriteFilterActive = !this.favoriteFilterActive;
        document.getElementById('favoriteFilterBtn')?.classList.toggle('active', this.favoriteFilterActive);
        this.advancedSearchAndFilter();
    }

    toggleStatusFilter() {
        this.statusFilterActive = !this.statusFilterActive;
        document.getElementById('statusFilterBtn')?.classList.toggle('active', this.statusFilterActive);
        this.advancedSearchAndFilter();
    }
    
    async loadInitialData() {
        this.showLoading(true);
        try {
            this.allGames = await window.boardGameAPI.getAllGames();
            this.allGames.sort((a, b) => this.getDate(b.createdAt) - this.getDate(a.createdAt));
            this.advancedSearchAndFilter();
        } catch (error) { this.showError('데이터를 불러오는 데 실패했습니다.'); } 
        finally { this.showLoading(false); }
    }

    async loadComics() {
        this.showLoading(true);
        try {
            this.allComics = await window.boardGameAPI.getAllComics();
            this.renderComicView();
        } catch(e) { this.showError("만화 목록 로딩 실패"); }
        finally { this.showLoading(false); }
    }

    advancedSearchAndFilter() {
        let filtered = [...this.allGames];
        if (this.favoriteFilterActive) filtered = filtered.filter(g => this.favorites.has(g.id));
        if (this.statusFilterActive) filtered = filtered.filter(g => g.status && g.status !== 'normal');
        
        filtered = this.applySearch(filtered);
        filtered = this.applySliderFilter(filtered, 'difficulty');
        filtered = this.applySliderFilter(filtered, 'time');
        
        this.currentData = filtered;
        this.renderGridView();
        this.updateGameCount();
    }
    
    applySearch(data) { /* ... */ }
    applySliderFilter(data, type) { /* ... */ }
    
    renderGridView() {
        const grid = this.elements.gameGrid;
        if (!grid) return;
        grid.innerHTML = this.currentData.length === 0
            ? `<p class="empty-state-text">조건에 맞는 보드게임이 없습니다.</p>`
            : this.currentData.map(item => this.createGameCard(item)).join('');
    }
    
    createGameCard(item) { /* ... */ }
    
    renderComicView() {
        const grid = this.elements.comicGrid;
        if (!grid) return;
        grid.innerHTML = this.allComics.length === 0
            ? `<p class="empty-state-text">아직 만화가 없습니다.</p>`
            : this.allComics.map(item => this.createComicCard(item)).join('');
    }

    createComicCard(item) { /* ... */ }
    updateGameCount() { /* ... */ }
    openGameModal(gameId) { /* ... */ }
    async openComicModal(comicId) { /* ... */ }
    renderComments(comments) { /* ... */ }
    async submitComment(comicId) { /* ... */ }

    initializeSliders() {
        ['difficulty', 'time'].forEach(type => {
            const minInput = this.elements[`${type}Min`];
            const maxInput = this.elements[`${type}Max`];
            const range = minInput.parentElement.querySelector('.slider-range');
            
            if (!minInput || !maxInput || !range) return;
            
            const update = () => {
                let min = parseFloat(minInput.value);
                let max = parseFloat(maxInput.value);
                
                if (this.activeSlider === minInput && min > max) { maxInput.value = min; max = min; }
                if (this.activeSlider === maxInput && max < min) { minInput.value = max; min = max; }
                
                const minPercent = ((min - minInput.min) / (minInput.max - minInput.min)) * 100;
                const maxPercent = ((max - maxInput.min) / (maxInput.max - maxInput.min)) * 100;
                
                range.style.left = `${minPercent}%`;
                range.style.width = `${maxPercent - minPercent}%`;

                this.elements[`${type}MinValue`].textContent = min.toFixed(type === 'difficulty' ? 1 : 0) + (type === 'time' ? '분' : '');
                const maxText = max.toFixed(type === 'difficulty' ? 1 : 0);
                this.elements[`${type}MaxValue`].textContent = maxText + (type === 'time' ? (max == maxInput.max ? '분+' : '분') : '');
            };
            
            minInput.addEventListener('mousedown', () => this.activeSlider = minInput);
            minInput.addEventListener('touchstart', () => this.activeSlider = minInput);
            maxInput.addEventListener('mousedown', () => this.activeSlider = maxInput);
            maxInput.addEventListener('touchstart', () => this.activeSlider = maxInput);

            minInput.addEventListener('input', update);
            maxInput.addEventListener('input', update);

            const debouncedFilter = this.debounce(() => this.advancedSearchAndFilter(), 200);
            minInput.addEventListener('change', debouncedFilter);
            maxInput.addEventListener('change', debouncedFilter);

            update();
        });
    }
    
    debounce(func, delay) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Helper & Message functions...
}

document.addEventListener('DOMContentLoaded', () => {
    function waitForAPI() {
        if (window.boardGameAPI && window.firebaseInitialized) {
            new BoardGameViewer();
        } else {
            setTimeout(waitForAPI, 100);
        }
    }
    waitForAPI();
});

