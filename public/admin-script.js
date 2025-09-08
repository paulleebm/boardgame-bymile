class AdminManager {
    constructor() {
        this.allGames = [];
        this.allPosts = [];
        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
        this.showView('game-management');
    }

    initializeElements() {
        const ids = [
            'nav-game-management', 'nav-post-management', 'game-management-page',
            'post-management-page', 'gamesList', 'postsList', 'modal-container', 'loading',
            'addGameBtn', 'bulkUploadBtn', 'addPostBtn'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }

    setupEventListeners() {
        this.elements['nav-game-management'].addEventListener('click', () => this.showView('game-management'));
        this.elements['nav-post-management'].addEventListener('click', () => this.showView('post-management'));
        this.elements.addGameBtn.addEventListener('click', () => this.openGameModal());
        this.elements.addPostBtn.addEventListener('click', () => this.openPostModal());
        window.adminManager = this;
    }

    showView(viewName) {
        console.log(`[Debug] Admin: Showing view: ${viewName}`);
        document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        
        document.getElementById(`${viewName}-page`).classList.add('active');
        document.getElementById(`nav-${viewName}`).classList.add('active');

        if (viewName === 'game-management' && this.allGames.length === 0) this.loadGames();
        if (viewName === 'post-management' && this.allPosts.length === 0) this.loadPosts();
    }
    
    async loadGames() {
        this.showLoading(true);
        try {
            this.allGames = await window.boardGameAPI.getAllGames();
            this.renderGames();
        } catch(e) { alert("게임 목록 로딩 실패: " + e.message); } 
        finally { this.showLoading(false); }
    }
    
    async loadPosts() {
        this.showLoading(true);
        try {
            this.allPosts = await window.boardGameAPI.getPosts();
            this.renderPosts();
        } catch(e) { 
            console.error("[Debug] Admin: Failed to load posts:", e);
            alert("게시글 목록 로딩 실패: " + e.message); 
        }
        finally { this.showLoading(false); }
    }

    renderGames() {
        const sortedGames = [...this.allGames].sort((a,b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
        this.elements.gamesList.innerHTML = sortedGames.map(game => this.createItemCard(game, 'game')).join('');
    }

    renderPosts() {
        const sortedPosts = [...this.allPosts].sort((a,b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        this.elements.postsList.innerHTML = sortedPosts.map(post => this.createItemCard(post, 'post')).join('');
    }

    createItemCard(item, type) {
        const isGame = type === 'game';
        const title = isGame ? item.name : item.title;
        const subtext = isGame ? item.genre : item.author;
        const imageUrl = isGame ? item.imageUrl : item.thumbnailUrl;

        return `
            <div class="item-card" data-id="${item.id}">
                <img src="${imageUrl || 'https://placehold.co/100x100/eee/ccc?text=No+Img'}" class="item-thumbnail" onerror="this.src='https://placehold.co/100x100/eee/ccc?text=No+Img'">
                <div class="item-info">
                    <h3>${title || '제목 없음'}</h3>
                    <p>${subtext || '정보 없음'}</p>
                </div>
                <div class="item-actions">
                    <button class="action-btn" onclick="window.adminManager.open${isGame ? 'Game' : 'Post'}Modal('${item.id}')">수정</button>
                    <button class="action-btn danger" onclick="window.adminManager.deleteItem('${item.id}', '${type}')">삭제</button>
                </div>
            </div>
        `;
    }

    openGameModal(gameId = null) {
        const game = gameId ? this.allGames.find(g => g.id === gameId) : {};
        const title = gameId ? '게임 수정' : '새 게임 추가';
        this.elements['modal-container'].innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h2>${title}</h2><button class="close-btn">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>게임 이름*</label><input type="text" name="name" value="${game?.name || ''}" required></div>
                        <div class="form-group"><label>장르</label><input type="text" name="genre" value="${game?.genre || ''}"></div>
                        <div class="form-group"><label>상태</label><select name="status"><option value="">일반</option><option value="new">신상</option><option value="shipping">배송중</option><option value="purchasing">구매중</option><option value="rented">대여중</option></select></div>
                        <div class="form-row">
                          <div class="form-group"><label>최소인원</label><input type="number" name="minPlayers" value="${game?.minPlayers || ''}"></div>
                          <div class="form-group"><label>최대인원</label><input type="number" name="maxPlayers" value="${game?.maxPlayers || ''}"></div>
                        </div>
                        <div class="form-group"><label>베스트인원</label><input type="text" name="bestPlayers" value="${game?.bestPlayers || ''}"></div>
                         <div class="form-group"><label>난이도</label><input type="number" name="difficulty" step="0.1" value="${game?.difficulty || ''}"></div>
                        <div class="form-group"><label>플레이시간(분)</label><input type="number" name="playTime" value="${game?.playTime || ''}"></div>
                        <div class="form-group"><label>이미지 URL</label><input type="url" name="imageUrl" value="${game?.imageUrl || ''}"></div>
                        <div class="form-group"><label>유튜브 URL</label><input type="url" name="youtubeUrl" value="${game?.youtubeUrl || ''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="action-btn close-btn">취소</button>
                        <button class="action-btn primary save-btn">저장</button>
                    </div>
                </div>
            </div>`;
        if (game?.status) this.elements['modal-container'].querySelector(`select[name="status"]`).value = game.status;
        this.setupModalEvents('game', gameId);
    }
    
    openPostModal(postId = null) {
        const post = postId ? this.allPosts.find(p => p.id === postId) : {};
        const title = postId ? '게시글 수정' : '새 게시글 추가';
        this.elements['modal-container'].innerHTML = `
             <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h2>${title}</h2><button class="close-btn">&times;</button></div>
                    <div class="modal-body">
                        <div class="form-group"><label>제목*</label><input type="text" name="title" value="${post?.title || ''}" required></div>
                        <div class="form-group"><label>작성자/출처</label><input type="text" name="author" value="${post?.author || ''}"></div>
                        <div class="form-group"><label>내용 (이미지 URL을 그대로 붙여넣으면 이미지로 표시됩니다)</label><textarea name="content" rows="8">${post?.content || ''}</textarea></div>
                        <div class="form-group"><label>대표 이미지 URL</label><input type="url" name="thumbnailUrl" value="${post?.thumbnailUrl || ''}"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="action-btn close-btn">취소</button>
                        <button class="action-btn primary save-btn">저장</button>
                    </div>
                </div>
            </div>`;
        this.setupModalEvents('post', postId);
    }
    
    setupModalEvents(type, id) {
        const modal = this.elements['modal-container'].querySelector('.modal-overlay');
        modal.querySelector('.save-btn').addEventListener('click', () => this.saveItem(type, id, modal));
        modal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    }

    async saveItem(type, id, modal) {
        const data = {};
        modal.querySelectorAll('input, textarea, select').forEach(input => {
            const value = input.value.trim();
            if (value) {
                data[input.name] = (input.type === 'number' && !isNaN(value)) ? Number(value) : value;
            }
        });

        this.showLoading(true);
        try {
            if (type === 'game') {
                if (!data.name) { alert("게임 이름은 필수입니다."); return; }
                id ? await window.boardGameAPI.updateGame(id, data) : await window.boardGameAPI.addGame(data);
                await this.loadGames();
            } else if (type === 'post') {
                if (!data.title) { alert("게시글 제목은 필수입니다."); return; }
                id ? await window.boardGameAPI.updatePost(id, data) : await window.boardGameAPI.addPost(data);
                await this.loadPosts();
            }
            modal.remove();
        } catch (e) {
            alert('저장 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    async deleteItem(id, type) {
        if (!confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        this.showLoading(true);
        try {
            if (type === 'game') {
                await window.boardGameAPI.deleteGame(id);
                await this.loadGames();
            } else if (type === 'post') {
                await window.boardGameAPI.deletePost(id);
                await this.loadPosts();
            }
        } catch(e) {
            alert("삭제 실패: " + e.message);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) { this.elements.loading.classList.toggle('hidden', !show); }
}

document.addEventListener('DOMContentLoaded', () => {
    function waitForFirebase() {
        if (window.firebaseInitialized) {
            new AdminManager();
        } else {
            console.log('[Debug] Admin: Waiting for Firebase to initialize...');
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
});

