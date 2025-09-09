class AdminManager {
    constructor() {
        this.elements = {};
        this.games = [];
        this.posts = [];
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/e0e6ed/2c3e50?text=No+Image';
        this._initElements();
        this._init();
    }

    _initElements() {
        const ids = [
            'nav-game-management', 'nav-post-management', 'addGameBtn', 'addPostBtn', 'bulkUploadBtn',
            'game-management-page', 'post-management-page',
            'gamesList', 'postsList', 'modal-container', 'loading'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }

    _init() {
        this.setupEventListeners();
        this.loadGames(); // 초기 페이지는 게임 관리로 설정
    }

    setupEventListeners() {
        this.elements['nav-game-management'].addEventListener('click', () => this.switchPage('game-management'));
        this.elements['nav-post-management'].addEventListener('click', () => this.switchPage('post-management'));
        this.elements['addGameBtn'].addEventListener('click', () => this.openGameModal());
        this.elements['addPostBtn'].addEventListener('click', () => this.openPostModal());
        // 여기에 CSV 업로드 등 다른 이벤트 리스너 추가 가능
    }

    switchPage(pageId) {
        document.querySelectorAll('.admin-page').forEach(page => page.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));

        document.getElementById(`${pageId}-page`).classList.add('active');
        document.getElementById(`nav-${pageId}`).classList.add('active');

        if (pageId === 'game-management') {
            this.loadGames();
        } else if (pageId === 'post-management') {
            this.loadPosts();
        }
    }

    async loadGames() {
        this.showLoading(true);
        try {
            this.games = await window.boardGameAPI.getAllGames();
             this.games.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            this.renderList('game', this.games, this.elements['gamesList']);
        } catch (e) {
            console.error('Error loading games:', e);
            alert('게임 목록을 불러오는 데 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    async loadPosts() {
        this.showLoading(true);
        try {
            this.posts = await window.boardGameAPI.getPosts();
            this.posts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            this.renderList('post', this.posts, this.elements['postsList']);
        } catch (e) {
            console.error('Error loading posts:', e);
            alert('게시글 목록을 불러오는 데 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }

    renderList(type, data, container) {
        container.innerHTML = data.map(item => this.createItemCard(item, type)).join('');
        this.attachCardEventListeners(type);
    }
    
    createItemCard(item, type) {
        const isGame = type === 'game';
        const title = isGame ? item.name : item.title;
        const subtext = isGame 
            ? `난이도: ${item.difficulty || '미설정'} | 인원: ${item.minPlayers || '?'}-${item.maxPlayers || '?'}`
            : `작성자: ${item.author || '미상'}`;
        const imageUrl = isGame ? item.imageUrl : item.thumbnailUrl;

        return `
            <div class="item-card" data-id="${item.id}">
                <img src="${imageUrl || this.DEFAULT_IMAGE_URL}" alt="${title}" class="item-thumbnail">
                <div class="item-info">
                    <h3>${this.escapeHtml(title)}</h3>
                    <p>${this.escapeHtml(subtext)}</p>
                </div>
                <div class="item-actions">
                    <button class="action-btn edit-btn">수정</button>
                    <button class="action-btn danger delete-btn">삭제</button>
                </div>
            </div>`;
    }

    attachCardEventListeners(type) {
        const listId = type === 'game' ? 'gamesList' : 'postsList';
        const listElement = this.elements[listId];
        if (!listElement) return;

        listElement.querySelectorAll('.edit-btn').forEach(btn => {
            const id = btn.closest('.item-card').dataset.id;
            btn.addEventListener('click', () => (type === 'game' ? this.openGameModal(id) : this.openPostModal(id)));
        });

        listElement.querySelectorAll('.delete-btn').forEach(btn => {
            const id = btn.closest('.item-card').dataset.id;
            btn.addEventListener('click', () => this.deleteItem(id, type));
        });
    }

    async openGameModal(id = null) {
        let game = {};
        if (id) {
            game = this.games.find(g => g.id === id) || {};
        }

        const modalBody = `
            <div class="form-group">
                <label for="name">게임 이름</label>
                <input type="text" id="name" name="name" value="${this.escapeHtml(game.name || '')}">
            </div>
            <div class="form-group">
                <label for="imageUrl">이미지 URL</label>
                <input type="text" id="imageUrl" name="imageUrl" value="${this.escapeHtml(game.imageUrl || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="minPlayers">최소 인원</label>
                    <input type="number" id="minPlayers" name="minPlayers" value="${game.minPlayers || ''}">
                </div>
                <div class="form-group">
                    <label for="maxPlayers">최대 인원</label>
                    <input type="number" id="maxPlayers" name="maxPlayers" value="${game.maxPlayers || ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="bestPlayers">베스트 인원 (예: 3-4, 4, 2,4)</label>
                <input type="text" id="bestPlayers" name="bestPlayers" value="${this.escapeHtml(game.bestPlayers || '')}">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label for="playTime">플레이 시간(분)</label>
                    <input type="number" id="playTime" name="playTime" value="${game.playTime || ''}">
                </div>
                <div class="form-group">
                    <label for="difficulty">난이도 (1-5)</label>
                    <input type="number" step="0.1" id="difficulty" name="difficulty" value="${game.difficulty || ''}">
                </div>
            </div>
            <div class="form-group">
                <label for="genre">장르 (쉼표로 구분)</label>
                <input type="text" id="genre" name="genre" value="${this.escapeHtml(game.genre || '')}">
            </div>
             <div class="form-group">
                <label for="youtubeUrl">YouTube 링크</label>
                <input type="text" id="youtubeUrl" name="youtubeUrl" value="${this.escapeHtml(game.youtubeUrl || '')}">
            </div>
            <div class="form-group">
                <label for="status">상태</label>
                <select id="status" name="status">
                    <option value="normal" ${game.status === 'normal' ? 'selected' : ''}>일반</option>
                    <option value="new" ${game.status === 'new' ? 'selected' : ''}>NEW</option>
                    <option value="shipping" ${game.status === 'shipping' ? 'selected' : ''}>배송중</option>
                    <option value="purchasing" ${game.status === 'purchasing' ? 'selected' : ''}>구매중</option>
                    <option value="rented" ${game.status === 'rented' ? 'selected' : ''}>대여중</option>
                </select>
            </div>
        `;
        this.renderModal(id ? '게임 정보 수정' : '새 게임 추가', modalBody, 'game', id);
    }

    async openPostModal(id = null) {
        let post = {};
        if (id) {
            post = this.posts.find(p => p.id === id) || {};
        }

        const modalBody = `
            <div class="form-group">
                <label for="title">제목</label>
                <input type="text" id="title" name="title" value="${this.escapeHtml(post.title || '')}">
            </div>
             <div class="form-group">
                <label for="author">작성자</label>
                <input type="text" id="author" name="author" value="${this.escapeHtml(post.author || '')}">
            </div>
            <div class="form-group">
                <label for="thumbnailUrl">썸네일 이미지 URL</label>
                <input type="text" id="thumbnailUrl" name="thumbnailUrl" value="${this.escapeHtml(post.thumbnailUrl || '')}">
            </div>
            <div class="form-group">
                <label for="content">내용</label>
                <textarea id="content" name="content" rows="10">${this.escapeHtml(post.content || '')}</textarea>
            </div>
        `;
        this.renderModal(id ? '게시글 수정' : '새 게시글 추가', modalBody, 'post', id);
    }

    renderModal(title, body, type, id) {
        const modalHTML = this.createModalHtml(title, body, `
            <button class="action-btn close-btn">취소</button>
            <button class="action-btn primary save-btn">저장</button>
        `);
        this.elements['modal-container'].innerHTML = modalHTML;
        this.setupModalEvents(type, id);
    }
    
    createModalHtml(title, body, footer) {
        return `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${title}</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">${body}</div>
                    <div class="modal-footer">${footer}</div>
                </div>
            </div>`;
    }

    setupModalEvents(type, id) {
        const modal = this.elements['modal-container'].querySelector('.modal-overlay');
        modal.querySelector('.save-btn').addEventListener('click', () => this.saveItem(type, id, modal));
        modal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    }

    async saveItem(type, id, modal) {
        const data = {};
        modal.querySelectorAll('input, textarea, select').forEach(input => {
            const name = input.name;
            if (!name) return;

            let value = input.value;
            
            if (input.type !== 'select-one') {
                value = value.trim();
            }

            if (input.type === 'number') {
                if (value !== '') {
                    data[name] = Number(value);
                } else if (!id) { // This is a new item
                    data[name] = null;
                }
                // If 'id' exists and value is '', we do nothing, so it's not added to 'data'
            } else {
                data[name] = value;
            }
        });

        if (type === 'game') {
            if (!id && !data.name) {
                alert("게임 이름은 필수입니다.");
                return; 
            }
        } else if (type === 'post') {
            if (!id && !data.title) {
                alert("게시글 제목은 필수입니다.");
                return;
            }
        }

        this.showLoading(true);
        try {
            if (type === 'game') {
                id ? await window.boardGameAPI.updateGame(id, data) : await window.boardGameAPI.addGame(data);
                await this.loadGames();
            } else if (type === 'post') {
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
        } catch (e) {
            alert('삭제 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        this.elements.loading.classList.toggle('hidden', !show);
    }
    
    escapeHtml(text) {
        if (text === null || typeof text === 'undefined') return '';
        return text.toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Firebase 서비스가 초기화될 때까지 대기
    function waitForFirebase() {
        if (window.boardGameAPI && window.firebaseInitialized) {
            new AdminManager();
        } else {
            setTimeout(waitForFirebase, 100);
        }
    }
    waitForFirebase();
});

