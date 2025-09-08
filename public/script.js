// 사용자 페이지 메인 스크립트 (UI 개편 최종 버전)
class BoardGameViewer {
    constructor() {
        this.allGames = [];
        this.allComics = [];
        this.currentData = [];
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
            'gameGrid', 'comicGrid', 'detailModal', 'loading', 'errorMessage', 
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
        filterInputs.forEach(id => addListener(this.elements[id], 'input', () => this.debounceSearch()));
        
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
                    <button id="statusFilterBtn" class="action-icon-btn ${this.statusFilterActive ? 'active' : ''}" title="특별 상태 게임만 보기">❗</button>
                    <button id="favoriteFilterBtn" class="action-icon-btn ${this.favoriteFilterActive ? 'active' : ''} ${this.currentUser ? '' : 'hidden'}" title="즐겨찾기만 보기">❤️</button>
                    <button id="open-filter-btn" class="action-icon-btn" aria-label="필터 열기">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>`;
        } else if (page === 'comics') {
            title = '📚 보드게임 만화';
        } else if (page === 'mypage') {
            title = '👤 마이페이지';
        }
        this.elements['page-header'].innerHTML = `<h1>${title}</h1>${controls}`;
        if (page === 'games') {
            document.getElementById('open-filter-btn').addEventListener('click', () => this.toggleFilterSidebar(true));
            document.getElementById('statusFilterBtn')?.addEventListener('click', () => this.toggleStatusFilter());
            document.getElementById('favoriteFilterBtn')?.addEventListener('click', () => this.toggleFavoriteFilter());
        }
    }

    showView(viewName) {
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        this.elements[`${viewName}-page`]?.classList.add('active');
        this.elements[`nav-${viewName}-btn`]?.classList.add('active');
        
        this.updateHeader(viewName);
        
        if (viewName === 'comics' && this.allComics.length === 0) this.loadComics();
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

    getActiveView() { return document.querySelector('.nav-btn.active')?.id.replace('nav-','').replace('-btn','') || 'games'; }
    
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
    
    async handleLogin() {
        try {
            this.showLoading(true);
            await window.authManager.signInWithGoogle();
            this.showSuccess('로그인되었습니다!');
        } catch (error) { this.showError(error.message || '로그인에 실패했습니다.'); }
        finally { this.showLoading(false); }
    }

    async handleLogout() {
        try { await window.authManager.signOut(); this.showSuccess('로그아웃되었습니다.'); }
        catch (error) { this.showError('로그아웃에 실패했습니다.'); }
    }

    async toggleFavorite(gameId, event) {
        event?.stopPropagation();
        if (!this.currentUser) { this.showError('로그인 후 즐겨찾기를 사용할 수 있습니다.'); return; }
        try {
            const isFavorited = await window.favoriteManager.toggleFavorite(gameId);
            this.showSuccess(isFavorited ? '즐겨찾기에 추가!' : '즐겨찾기에서 제거');
        } catch (error) { this.showError(error.message); }
    }
    
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
            this.allComics = await window.boardGameAPI.getComics();
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
    }
    
    applySearch(data) {
        const query = (this.elements.searchInput.value || '').trim().toLowerCase();
        const type = this.elements.searchType.value;
        const playerCount = parseInt(this.elements.playerCountInput.value, 10);
    
        if (!query && isNaN(playerCount)) return data;
    
        return data.filter(game => {
            if (query && type === 'name' && !(game.name || '').toLowerCase().includes(query)) return false;
            if (query && type === 'genre' && !(game.genre || '').toLowerCase().includes(query)) return false;
            if (!isNaN(playerCount) && (playerCount < (game.minPlayers || 1) || playerCount > (game.maxPlayers || 99))) return false;
            return true;
        });
    }

    applySliderFilter(data, type) {
        const minEl = this.elements[`${type}Min`];
        const maxEl = this.elements[`${type}Max`];
        if (!minEl || !maxEl) return data;

        const min = parseFloat(minEl.value);
        const max = parseFloat(maxEl.value);
        const field = type === 'time' ? 'playTime' : 'difficulty';
        const defaultMin = parseFloat(minEl.min);
        const defaultMax = parseFloat(maxEl.max);
        
        if (min === defaultMin && max === defaultMax) return data;

        return data.filter(game => {
            const value = parseFloat(game[field]) || 0;
            const upperValue = (max === defaultMax) ? Infinity : max;
            return value >= min && value <= upperValue;
        });
    }
    
    renderGridView() {
        const grid = this.elements.gameGrid;
        if (!grid) return;
        grid.innerHTML = this.currentData.length === 0
            ? `<p class="empty-state-text">조건에 맞는 보드게임이 없습니다.</p>`
            : this.currentData.map(item => this.createGameCard(item)).join('');
    }
    
    createGameCard(item) {
        const title = this.escapeHtml(item.name || '제목 없음');
        const imageUrl = item.imageUrl || this.DEFAULT_IMAGE_URL;
        const favoriteIndicator = (this.currentUser && this.favorites.has(item.id)) ? `<div class="favorite-indicator">❤️</div>` : '';
        return `
            <div class="game-card-grid" onclick="openGameModal('${item.id}')">
                <div class="game-image">
                    <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='${this.DEFAULT_IMAGE_URL}'">
                    ${favoriteIndicator}
                </div>
                <div class="game-title-grid"><h3>${title}</h3></div>
            </div>`;
    }
    
    renderComicView() {
        const grid = this.elements.comicGrid;
        if (!grid) return;
        grid.innerHTML = this.allComics.length === 0
            ? `<p class="empty-state-text">아직 만화가 없습니다.</p>`
            : this.allComics.map(item => this.createComicCard(item)).join('');
    }

    createComicCard(item) {
        return `
            <div class="comic-list-item" onclick="openComicModal('${item.id}')">
                <img src="${item.thumbnailUrl || this.DEFAULT_IMAGE_URL}" class="comic-thumbnail" alt="${this.escapeHtml(item.title)}">
                <div class="comic-info">
                    <h3>${this.escapeHtml(item.title)}</h3>
                    <p>${this.escapeHtml(item.author)}</p>
                </div>
            </div>
        `;
    }

    openGameModal(gameId) {
        const game = this.allGames.find(g => g.id === gameId);
        if (!game) return;
        this.currentModalGame = game;
        
        const favoriteButton = this.currentUser ? `<button class="modal-favorite-btn" onclick="toggleFavorite('${game.id}', event)">${this.favorites.has(game.id) ? '❤️' : '🤍'}</button>` : '';
        const youtubeButton = game.youtubeUrl ? `<button class="youtube-btn" onclick="window.open('${game.youtubeUrl}', '_blank')">룰 설명 영상 보기</button>` : '';

        this.elements.detailModal.innerHTML = `
             <div class="detail-content">
                <button onclick="this.closest('.modal').classList.add('hidden')" class="modal-close-btn">&times;</button>
                <div class="modal-image">
                    <img src="${game.imageUrl || this.DEFAULT_IMAGE_URL}" alt="${this.escapeHtml(game.name)}">
                    ${favoriteButton}
                </div>
                <div class="detail-info">
                    <h2>${this.escapeHtml(game.name)}</h2>
                    <div class="detail-field"><span>난이도:</span> <span>${game.difficulty || '-'}</span></div>
                    <div class="detail-field"><span>인원:</span> <span>${this.formatPlayerCount(game.minPlayers, game.maxPlayers)}</span></div>
                    <div class="detail-field"><span>베스트 인원:</span> <span>${this.formatBestPlayers(game.bestPlayers)}</span></div>
                    <div class="detail-field"><span>플레이 시간:</span> <span>${game.playTime ? game.playTime + '분' : '-'}</span></div>
                    <div class="detail-field"><span>장르:</span> <span>${this.escapeHtml(game.genre)}</span></div>
                    ${youtubeButton}
                </div>
            </div>`;
        this.elements.detailModal.classList.remove('hidden');
    }
    
    async openComicModal(comicId) {
        const comic = this.allComics.find(c => c.id === comicId);
        if (!comic) return;
    
        const comments = await window.boardGameAPI.getComments(comicId);
    
        this.elements.detailModal.innerHTML = `
            <div class="detail-content">
                <div class="modal-header">
                    <h2>${this.escapeHtml(comic.title)}</h2>
                    <button onclick="this.closest('.modal').classList.add('hidden')" class="modal-close-btn">&times;</button>
                </div>
                <div class="comic-viewer-body">
                    ${(comic.imageUrls || []).map(url => `<img src="${url}" alt="만화 페이지">`).join('')}
                </div>
                <div class="comments-section">
                    <h3>댓글</h3>
                    <div id="comment-list">${this.renderComments(comments)}</div>
                    ${this.currentUser ? `
                        <div class="comment-form">
                            <input type="text" id="comment-input" class="comment-input" placeholder="댓글을 입력하세요...">
                            <button class="comment-submit" onclick="submitComment('${comicId}')">등록</button>
                        </div>
                    ` : '<p>댓글을 작성하려면 <a href="#" onclick="handleLogin(); return false;">로그인</a>이 필요합니다.</p>'}
                </div>
            </div>`;
        this.elements.detailModal.classList.remove('hidden');
    }

    renderComments(comments) {
        if (!comments || comments.length === 0) return '<p>아직 댓글이 없습니다.</p>';
        return comments.map(comment => `
            <div class="comment-item">
                <img src="${comment.userPhotoUrl || this.DEFAULT_PROFILE_IMAGE_URL}" alt="${this.escapeHtml(comment.userName)}" class="comment-avatar">
                <div class="comment-content">
                    <div class="comment-author">${this.escapeHtml(comment.userName)}</div>
                    <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                </div>
            </div>
        `).join('');
    }

    async submitComment(comicId) {
        const input = document.getElementById('comment-input');
        const text = input.value.trim();
        if (!text || !this.currentUser) return;
        
        try {
            await window.boardGameAPI.addComment(comicId, text);
            input.value = '';
            const comments = await window.boardGameAPI.getComments(comicId);
            document.getElementById('comment-list').innerHTML = this.renderComments(comments);
        } catch (e) {
            this.showError('댓글 등록에 실패했습니다.');
        }
    }

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
    
    debounceSearch = this.debounce(() => this.advancedSearchAndFilter(), 300);

    debounce(func, delay) {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    getDate(ts) { return ts?.toDate ? ts.toDate() : new Date(ts?.seconds * 1000 || 0); }
    escapeHtml(text) { return text != null ? String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])) : ''; }
    formatPlayerCount(min, max) { return min && max ? (min === max ? `${min}명` : `${min}-${max}명`) : (min ? `${min}명+` : (max ? `~${max}명` : '-')); }
    formatBestPlayers(best) { return best ? (String(best).match(/[,|-]/) ? best : `${best}명`) : '-'; }
    showLoading(show) { this.elements.loading.classList.toggle('hidden', !show); }
    
    showMessage(message, type) {
        const el = this.elements[`${type}Message`];
        if(!el) return;
        el.textContent = message;
        el.classList.remove('hidden');
        setTimeout(() => el.classList.add('hidden'), 3000);
    }
    showError(message) { this.showMessage(message, 'error'); }
    showSuccess(message) { this.showMessage(message, 'success'); }
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

