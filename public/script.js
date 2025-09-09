class BoardGameViewer {
    constructor() {
        this.allGames = [];
        this.allPosts = [];
        this.currentData = [];
        this.statusFilterActive = false;
        this.favoriteFilterActive = false;
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';
        this.DEFAULT_PROFILE_IMAGE_URL = 'https://i.imgur.com/rWd9g3i.png';
        this.currentUser = null;
        this.favorites = new Set();
        this.profileImageFile = null;
        
        this.sortOrders = ['name_asc', 'name_desc', 'difficulty_asc', 'difficulty_desc'];
        this.sortLabels = {
            'name_asc': '가나다순',
            'name_desc': '가나다 역순',
            'difficulty_asc': '난이도 낮은순',
            'difficulty_desc': '난이도 높은순'
        };
        this.currentSortIndex = 0;

        this.elements = {};
        this.initializeElements();
        this.initialize();
    }

    initializeElements() {
        const ids = [
            'nameSearchInput', 'genreSearchInput', 'playerCountInput', 'bestPlayerToggle',
            'difficultyMin', 'difficultyMax', 'difficultyMinValue', 'difficultyMaxValue', 
            'timeMin', 'timeMax', 'timeMinValue', 'timeMaxValue',
            'gameGrid', 'postGrid', 'detailModal', 'loading', 'errorMessage', 
            'successMessage', 'nav-games-btn', 'nav-posts-btn', 'nav-mypage-btn',
            'filter-sidebar', 'filter-overlay', 'close-filter-btn', 'sort-btn',
            'games-page', 'posts-page', 'mypage-page', 'myPageContent', 'page-header',
            'post-view-page'
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`Initialization Error: Element with ID '${id}' not found.`);
            }
            this.elements[id] = el;
        });

        if (!this.elements['post-view-page']) {
             console.error("FATAL: post-view-page element is missing from the DOM during initialization.");
        }
    }

    initialize() {
        this.setupEventListeners();
        this.initializeSliders();
        this.setupAuthMonitoring();
        this.loadInitialData();
        this.handleUrlChange();
    }

    setupEventListeners() {
        const addListener = (element, event, handler) => element && element.addEventListener(event, handler);

        addListener(this.elements['nav-games-btn'], 'click', () => this.showView('games'));
        addListener(this.elements['nav-posts-btn'], 'click', () => this.showView('posts'));
        addListener(this.elements['nav-mypage-btn'], 'click', () => this.showView('mypage'));
        
        addListener(this.elements['filter-overlay'], 'click', () => this.toggleFilterSidebar(false));
        addListener(this.elements['close-filter-btn'], 'click', () => this.toggleFilterSidebar(false));
        addListener(this.elements['sort-btn'], 'click', () => this.cycleSortOrder());
        
        const filterInputs = ['nameSearchInput', 'genreSearchInput', 'playerCountInput', 'bestPlayerToggle'];
        filterInputs.forEach(id => {
            const el = this.elements[id];
            if (el) {
                const eventType = el.type === 'checkbox' ? 'change' : 'input';
                addListener(el, eventType, () => this.debounceSearch());
            }
        });
        
        window.addEventListener('popstate', () => this.handleUrlChange());

        window.openGameModal = (id) => this.openGameModal(id);
        window.showPostPage = (id) => this.showPostPage(id);
        window.toggleFavorite = (id, event) => this.toggleFavorite(id, event);
        window.handleLogin = () => this.handleLogin();
        window.handleLogout = () => this.handleLogout();
        window.submitComment = (postId) => this.submitComment(postId);
        window.handleDeleteComment = (postId, commentId) => this.handleDeleteComment(postId, commentId);
        window.handleProfileUpdate = () => this.handleProfileUpdate();
    }
    
    cycleSortOrder() {
        this.currentSortIndex = (this.currentSortIndex + 1) % this.sortOrders.length;
        const newSortOrder = this.sortOrders[this.currentSortIndex];
        this.elements['sort-btn'].textContent = `정렬: ${this.sortLabels[newSortOrder]}`;
        this.advancedSearchAndFilter();
    }

    handleUrlChange() {
        const hash = window.location.hash;
        if (hash.startsWith('#post/')) {
            const postId = hash.substring(6);
            this.renderPostDetailView(postId);
        } else {
            this.hidePostPage();
            const viewName = hash.substring(1) || 'games';
            this.showView(viewName, false);
        }
    }

    updateHeader(page) {
        let title = '';
        let controls = '';
        if (page === 'games') {
            const gameCount = this.currentData ? this.currentData.length : 0;
            title = `🎲 보드게임 목록 <span class="game-count-badge">${gameCount}</span>`;
            controls = `
                <div class="header-controls">
                    <button id="statusFilterBtn" class="action-icon-btn ${this.statusFilterActive ? 'active' : ''}" title="특별 상태 게임만 보기">❗</button>
                    <button id="favoriteFilterBtn" class="action-icon-btn ${this.favoriteFilterActive ? 'active' : ''} ${this.currentUser ? '' : 'hidden'}" title="즐겨찾기만 보기">❤️</button>
                    <button id="open-filter-btn" class="action-icon-btn" aria-label="필터 열기">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                    </button>
                </div>`;
        } else if (page === 'posts') {
            title = '📚 보드게임 게시판';
        } else if (page === 'mypage') {
            title = '👤 마이페이지';
        }
        this.elements['page-header'].innerHTML = `<h1>${title}</h1>${controls}`;
        if (page === 'games') {
            document.getElementById('open-filter-btn')?.addEventListener('click', () => this.toggleFilterSidebar(true));
            document.getElementById('statusFilterBtn')?.addEventListener('click', () => this.toggleFilter());
            document.getElementById('favoriteFilterBtn')?.addEventListener('click', () => this.toggleFilter(true));
        }
    }

    showView(viewName, shouldPushState = true) {
        if (shouldPushState && `#${viewName}` !== window.location.hash) {
            history.pushState({ view: viewName }, '', `#${viewName}`);
        }
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

        const pageEl = this.elements[`${viewName}-page`];
        const navBtnEl = this.elements[`nav-${viewName}-btn`];

        if(pageEl) pageEl.classList.add('active');
        if(navBtnEl) navBtnEl.classList.add('active');
        
        this.updateHeader(viewName);
        
        if (viewName === 'posts' && this.allPosts.length === 0) this.loadPosts();
        if (viewName === 'mypage') this.renderMyPage();
    }
    
    toggleFilterSidebar(forceOpen) {
        this.elements['filter-sidebar']?.classList.toggle('open', forceOpen);
        this.elements['filter-overlay']?.classList.toggle('hidden', !forceOpen);
    }
    
    setupAuthMonitoring() {
        window.authManager.onAuthStateChanged((user) => {
            this.currentUser = user;
            const currentView = this.getActiveView();
            if (currentView === 'mypage') {
                this.renderMyPage();
            } else if (currentView === 'post') {
                 const hash = window.location.hash;
                 const postId = hash.substring(6);
                 this.renderPostDetailView(postId);
            }

            if (user) {
                this.loadUserFavorites();
            } else {
                this.favorites.clear();
            }
            this.renderGridView();
            this.updateHeader(this.getActiveView());
        });
        
        window.favoriteManager.onFavoritesChanged((favoriteIds) => {
            this.favorites = new Set(favoriteIds);
            this.renderGridView();
        });
    }

    getActiveView() {
        const hash = window.location.hash.substring(1);
        if (hash.startsWith('post/')) return 'post';
        return hash || 'games';
    }
    
    renderMyPage() {
        const contentEl = this.elements.myPageContent;
        if (!contentEl) return;
        this.profileImageFile = null;

        if (this.currentUser) {
            contentEl.innerHTML = `
                <div class="profile-card editable">
                     <div class="profile-image-upload">
                        <img src="${this.currentUser.photoURL || this.DEFAULT_PROFILE_IMAGE_URL}" id="profileImagePreview" class="profile-avatar" alt="프로필 미리보기">
                        <label for="profileImageInput" class="profile-image-upload-label">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                        </label>
                        <input type="file" id="profileImageInput" accept="image/*">
                    </div>

                    <div class="form-group">
                        <label for="displayNameInput">닉네임</label>
                        <input type="text" id="displayNameInput" class="form-input" value="${this.escapeHtml(this.currentUser.displayName)}">
                    </div>
                     <div class="profile-email">${this.escapeHtml(this.currentUser.email)}</div>

                    <div class="profile-actions">
                         <button class="action-btn primary" onclick="handleProfileUpdate()">프로필 저장</button>
                         <button class="logout-btn" onclick="handleLogout()">로그아웃</button>
                    </div>
                </div>`;
            
            const imageInput = document.getElementById('profileImageInput');
            const imagePreview = document.getElementById('profileImagePreview');

            imageInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    this.profileImageFile = file;
                    const reader = new FileReader();
                    reader.onload = (e) => { imagePreview.src = e.target.result; };
                    reader.readAsDataURL(file);
                }
            });

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
    
    toggleFilter(isFavorite = false) {
        if (isFavorite) {
            if (!this.currentUser) return;
            this.favoriteFilterActive = !this.favoriteFilterActive;
            document.getElementById('favoriteFilterBtn')?.classList.toggle('active', this.favoriteFilterActive);
        } else {
            this.statusFilterActive = !this.statusFilterActive;
            document.getElementById('statusFilterBtn')?.classList.toggle('active', this.statusFilterActive);
        }
        this.advancedSearchAndFilter();
    }
    
    async loadInitialData() {
        this.showLoading(true);
        try {
            this.allGames = await window.boardGameAPI.getAllGames();
            this.advancedSearchAndFilter();
        } catch (error) { 
            console.error("데이터 로딩 중 오류 발생:", error);
            if (error.code === 'permission-denied') {
                this.showError('데이터를 불러올 권한이 없습니다. Firestore 보안 규칙을 확인해주세요.');
            } else {
                this.showError('데이터를 불러오는 데 실패했습니다.');
            }
        } 
        finally { this.showLoading(false); }
    }

    async loadPosts() {
        this.showLoading(true);
        try {
            this.allPosts = await window.boardGameAPI.getPosts();
            this.renderPostView();
        } catch(e) { 
            console.error("게시글 목록 로딩 실패:", e);
            this.showError("게시글 목록 로딩에 실패했습니다."); 
        }
        finally { this.showLoading(false); }
    }

    advancedSearchAndFilter() {
        let filtered = [...this.allGames];
        
        if (this.favoriteFilterActive) filtered = filtered.filter(g => this.favorites.has(g.id));
        if (this.statusFilterActive) filtered = filtered.filter(g => g.status && g.status !== 'normal');
        
        const nameQuery = (this.elements.nameSearchInput.value || '').trim().toLowerCase();
        const genreQuery = (this.elements.genreSearchInput.value || '').trim().toLowerCase();
        const playerCount = parseInt(this.elements.playerCountInput.value, 10);
        const bestMatchOnly = this.elements.bestPlayerToggle.checked;

        if (nameQuery) filtered = filtered.filter(g => (g.name || '').toLowerCase().includes(nameQuery));
        if (genreQuery) filtered = filtered.filter(g => (g.genre || '').toLowerCase().includes(genreQuery));

        if (!isNaN(playerCount)) {
            if (bestMatchOnly) {
                filtered = filtered.filter(g => {
                    if (!g.bestPlayers) return false;
                    const best = String(g.bestPlayers);
                    if (best.includes('-')) {
                        const [min, max] = best.split('-').map(Number);
                        return playerCount >= min && playerCount <= max;
                    }
                    if (best.includes(',')) {
                        const options = best.split(',').map(s => s.trim());
                        return options.includes(String(playerCount));
                    }
                    return parseInt(best, 10) === playerCount;
                });
            } else {
                filtered = filtered.filter(g => playerCount >= (g.minPlayers || 1) && playerCount <= (g.maxPlayers || 99));
            }
        }
        
        filtered = this.applySliderFilter(filtered, 'difficulty');
        filtered = this.applySliderFilter(filtered, 'time');
        
        const sortOrder = this.sortOrders[this.currentSortIndex];
        filtered.sort((a, b) => {
            switch (sortOrder) {
                case 'name_asc':
                    return (a.name || '').localeCompare(b.name || '', 'ko');
                case 'name_desc':
                    return (b.name || '').localeCompare(a.name || '', 'ko');
                case 'difficulty_asc':
                    return (a.difficulty || 0) - (b.difficulty || 0);
                case 'difficulty_desc':
                    return (b.difficulty || 0) - (a.difficulty || 0);
                default:
                    return 0;
            }
        });

        this.currentData = filtered;
        this.renderGridView();
        this.updateHeader('games');
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

    getStatusInfo(status) {
        const statusMap = {
            'new': { text: 'NEW', className: 'status-new' },
            'shipping': { text: '배송중', className: 'status-shipping' },
            'purchasing': { text: '구매중', className: 'status-purchasing' },
            'rented': { text: '대여중', className: 'status-rented' },
        };
        return statusMap[status] || null;
    }
    
    createGameCard(item) {
        const title = this.escapeHtml(item.name || '제목 없음');
        const imageUrl = item.imageUrl || this.DEFAULT_IMAGE_URL;
        const favoriteIndicator = (this.currentUser && this.favorites.has(item.id)) ? `<div class="favorite-indicator">❤️</div>` : '';
        
        let statusBadge = '';
        const statusInfo = this.getStatusInfo(item.status);
        if (statusInfo) {
            statusBadge = `<div class="game-status-badge ${statusInfo.className}">${statusInfo.text}</div>`;
        }

        return `
            <div class="game-card-grid" onclick="openGameModal('${item.id}')">
                <div class="game-image">
                    ${statusBadge}
                    <img src="${imageUrl}" alt="${title}" loading="lazy" onerror="this.src='${this.DEFAULT_IMAGE_URL}'">
                    ${favoriteIndicator}
                </div>
                <div class="game-title-grid"><h3>${title}</h3></div>
            </div>`;
    }
    
    renderPostView() {
        const grid = this.elements.postGrid;
        if (!grid) return;
        this.allPosts.sort((a, b) => this.getDate(b.createdAt) - this.getDate(a.createdAt));
        grid.innerHTML = this.allPosts.length === 0
            ? `<p class="empty-state-text">아직 게시글이 없습니다.</p>`
            : this.allPosts.map(item => this.createPostCard(item)).join('');
    }

    createPostCard(item) {
        return `
            <div class="post-list-item" onclick="showPostPage('${item.id}')">
                <img src="${item.thumbnailUrl || this.DEFAULT_IMAGE_URL}" class="post-thumbnail" alt="${this.escapeHtml(item.title)}">
                <div class="post-info">
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
             <div class="modal-overlay" onclick="this.parentElement.classList.add('hidden')">
                <div class="detail-content" onclick="event.stopPropagation()">
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
                </div>
            </div>`;
        this.elements.detailModal.classList.remove('hidden');
    }
    
    async handleProfileUpdate() {
        if (!this.currentUser) return;
        const displayNameInput = document.getElementById('displayNameInput');
        const newDisplayName = displayNameInput.value.trim();

        if (!newDisplayName) { this.showError("닉네임을 입력해주세요."); return; }
        this.showLoading(true);
        try {
            const updates = { displayName: newDisplayName };
            if (this.profileImageFile) {
                const downloadURL = await window.boardGameAPI.uploadProfileImage(this.currentUser.uid, this.profileImageFile);
                updates.photoURL = downloadURL;
            }
            await window.authManager.updateUserProfile(updates);
            this.showSuccess("프로필이 성공적으로 업데이트되었습니다.");
        } catch (error) {
            console.error("Profile update failed:", error);
            this.showError(error.message || "프로필 업데이트에 실패했습니다.");
        } finally {
            this.showLoading(false);
        }
    }

    showPostPage(postId) {
        history.pushState({ postId }, '', `#post/${postId}`);
        this.renderPostDetailView(postId);
    }
    
    async renderPostDetailView(postId) {
        const viewer = this.elements['post-view-page'];
        if (!viewer) { console.error('게시글 상세 보기 요소를 찾을 수 없습니다.'); return; }
        this.showLoading(true);
        try {
            const post = await window.boardGameAPI.getPost(postId);
            if (!post) {
                this.showError('게시글을 찾을 수 없습니다.');
                history.replaceState(null, '', '#posts');
                this.handleUrlChange();
                return;
            }
            const comments = await window.boardGameAPI.getComments(postId);
            viewer.innerHTML = `
                <header class="post-view-header">
                    <button class="post-view-back-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <h2 class="post-view-title">${this.escapeHtml(post.title)}</h2>
                </header>
                <div class="post-view-container">
                    <div class="post-content-wrapper">
                        <h1>${this.escapeHtml(post.title)}</h1>
                        <div class="post-meta">
                            <span>By ${this.escapeHtml(post.author || 'Unknown')}</span> | <span>${this.formatTimestamp(post.createdAt)}</span>
                        </div>
                        <div class="post-viewer-content">${this.formatPostContent(post.content)}</div>
                    </div>
                    <section class="comments-section">
                        <h3>댓글 ${comments.length}개</h3>
                        <div id="comment-list">${this.renderComments(comments, postId)}</div>
                        <div class="comment-form-container"></div>
                    </section>
                </div>
            `;
            const commentFormContainer = viewer.querySelector('.comment-form-container');
            if (this.currentUser) {
                commentFormContainer.innerHTML = `
                    <form onsubmit="event.preventDefault(); submitComment('${postId}');" class="comment-form">
                        <input type="text" id="comment-input" class="comment-input" placeholder="댓글을 입력하세요..." autocomplete="off">
                        <button type="submit" class="comment-submit">등록</button>
                    </form>`;
            } else {
                commentFormContainer.innerHTML = '<p>댓글을 작성하려면 <a href="#" onclick="handleLogin(); return false;">로그인</a>이 필요합니다.</p>';
            }
            viewer.querySelector('.post-view-back-btn').onclick = () => history.back();
            document.body.classList.add('post-view-active');
            viewer.classList.add('active');
        } catch (error) {
            console.error("Error rendering post detail:", error);
            this.showError("게시글을 불러오는 데 실패했습니다.");
        } finally {
            this.showLoading(false);
        }
    }
    
    hidePostPage() {
        document.body.classList.remove('post-view-active');
        const viewer = this.elements['post-view-page'];
        if (viewer) {
            viewer.classList.remove('active');
            viewer.innerHTML = '';
        }
    }

    formatPostContent(content) {
        if (!content) return '';
        const lines = this.escapeHtml(content).split('\n');
        return lines.map(line => {
            if (line.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                return `<img src="${line}" alt="게시글 이미지" loading="lazy">`;
            }
            if (line.trim() === '') return '<br>';
            return `<p>${line}</p>`;
        }).join('');
    }

    renderComments(comments, postId) {
        if (!comments || comments.length === 0) return '<p>아직 댓글이 없습니다.</p>';
        return comments.map(comment => {
            const isAuthor = this.currentUser && this.currentUser.uid === comment.userId;
            const deleteButton = isAuthor
                ? `<button class="comment-delete-btn" onclick="handleDeleteComment('${postId}', '${comment.id}')">삭제</button>`
                : '';
            return `
                <div class="comment-item">
                    <img src="${comment.userPhotoUrl || this.DEFAULT_PROFILE_IMAGE_URL}" alt="${this.escapeHtml(comment.userName)}" class="comment-avatar">
                    <div class="comment-body">
                        <div class="comment-header">
                            <span class="comment-author">${this.escapeHtml(comment.userName)}</span>
                            <div class="comment-meta">
                                <span class="comment-timestamp">${this.formatTimestamp(comment.createdAt)}</span>
                                ${deleteButton}
                            </div>
                        </div>
                        <div class="comment-text">${this.escapeHtml(comment.text)}</div>
                    </div>
                </div>`;
        }).join('');
    }

    async submitComment(postId) {
        const input = document.getElementById('comment-input');
        if (!input) return;
        const text = input.value.trim();
        if (!text) { this.showError('댓글 내용을 입력해주세요.'); return; }
        if (!this.currentUser) { this.showError('로그인이 필요합니다.'); return; }
        const submitBtn = document.querySelector('.comment-submit');
        submitBtn.disabled = true;
        try {
            await window.boardGameAPI.addComment(postId, text);
            input.value = '';
            const comments = await window.boardGameAPI.getComments(postId);
            document.querySelector('#post-view-page #comment-list').innerHTML = this.renderComments(comments, postId);
            document.querySelector('.comments-section h3').textContent = `댓글 ${comments.length}개`;
        } catch (e) {
            this.showError('댓글 등록에 실패했습니다.');
        } finally {
            submitBtn.disabled = false;
        }
    }

    async handleDeleteComment(postId, commentId) {
        if (!confirm('정말로 댓글을 삭제하시겠습니까?')) return;
        this.showLoading(true);
        try {
            await window.boardGameAPI.deleteComment(postId, commentId);
            const comments = await window.boardGameAPI.getComments(postId);
            document.querySelector('#post-view-page #comment-list').innerHTML = this.renderComments(comments, postId);
            document.querySelector('.comments-section h3').textContent = `댓글 ${comments.length}개`;
            this.showSuccess('댓글이 삭제되었습니다.');
        } catch (e) {
            console.error('Error deleting comment:', e);
            this.showError(e.message || '댓글 삭제에 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    formatTimestamp(ts) {
        if (!ts) return '';
        const date = this.getDate(ts);
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
    }

    initializeSliders() {
        ['difficulty', 'time'].forEach(type => {
            const minInput = this.elements[`${type}Min`], maxInput = this.elements[`${type}Max`];
            const range = minInput?.parentElement.querySelector('.slider-range');
            if (!minInput || !maxInput || !range) return;
            const update = () => {
                let min = parseFloat(minInput.value), max = parseFloat(maxInput.value);
                if (min > max) { this.activeSlider === minInput ? maxInput.value = min : minInput.value = max; }
                min = parseFloat(minInput.value), max = parseFloat(maxInput.value);
                const minPercent = ((min - minInput.min) / (minInput.max - minInput.min)) * 100;
                const maxPercent = ((max - maxInput.min) / (maxInput.max - minInput.min)) * 100;
                range.style.left = `${minPercent}%`; range.style.width = `${maxPercent - minPercent}%`;
                this.elements[`${type}MinValue`].textContent = min.toFixed(type === 'difficulty' ? 1 : 0) + (type === 'time' ? '분' : '');
                const maxText = max.toFixed(type === 'difficulty' ? 1 : 0);
                const maxSuffix = type === 'time' ? (max == maxInput.max ? '분+' : '분') : '';
                this.elements[`${type}MaxValue`].textContent = maxText + maxSuffix;
            };
            const setActiveSlider = (e) => { this.activeSlider = e.target; };
            [minInput, maxInput].forEach(el => {
                el.addEventListener('mousedown', setActiveSlider); el.addEventListener('touchstart', setActiveSlider);
                el.addEventListener('input', update); el.addEventListener('change', this.debounce(() => this.advancedSearchAndFilter(), 200));
            });
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
    showLoading(show) { this.elements.loading?.classList.toggle('hidden', !show); }
    
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

