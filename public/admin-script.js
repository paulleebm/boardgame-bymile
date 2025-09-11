class AdminManager {
    constructor() {
        this.allGames = [];
        this.allPosts = [];
        this.elements = {};
        this.initializeElements();
        this.initialize();
    }

    initializeElements() {
        const ids = [
            'nav-game-management', 'nav-post-management', 'nav-visit-log',
            'game-management-page', 'post-management-page', 'visit-log-page',
            'addGameBtn', 'addPostBtn', 'bulkUploadBtn',
            'gamesList', 'postsList', 'visit-log-body',
            'modal-container', 'loading'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }

    initialize() {
        this.setupEventListeners();
        this.showPage('game-management');
        this.loadGames();
    }

    setupEventListeners() {
        this.elements['nav-game-management'].addEventListener('click', () => {
            this.showPage('game-management');
            this.loadGames();
        });
        this.elements['nav-post-management'].addEventListener('click', () => {
            this.showPage('post-management');
            this.loadPosts();
        });
        this.elements['nav-visit-log'].addEventListener('click', () => {
            this.showPage('visit-log');
            this.loadVisitLogs();
        });

        this.elements['addGameBtn'].addEventListener('click', () => this.openModal('game'));
        this.elements['addPostBtn'].addEventListener('click', () => this.openModal('post'));
    }

    showPage(pageName) {
        document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        
        const pageId = `${pageName}-page`;
        if(this.elements[pageId]) this.elements[pageId].classList.add('active');

        const navId = `nav-${pageName}`;
        if(this.elements[navId]) this.elements[navId].classList.add('active');
    }

    showLoading(show) {
        this.elements.loading.classList.toggle('hidden', !show);
    }

    async loadGames() {
        this.showLoading(true);
        try {
            this.allGames = await window.boardGameAPI.getAllGames();
            this.renderList('game');
        } catch (e) {
            alert('게임 목록 로딩 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }

    async loadPosts() {
        this.showLoading(true);
        try {
            this.allPosts = await window.boardGameAPI.getPosts();
            this.renderList('post');
        } catch (e) {
            alert('게시글 목록 로딩 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    async loadVisitLogs() {
        this.showLoading(true);
        try {
            const logs = await window.boardGameAPI.getVisitLogs();
            const logBody = this.elements['visit-log-body'];
            if(logBody) {
                logBody.innerHTML = logs.map(log => `
                    <tr>
                        <td>${this.formatTimestamp(log.timestamp)}</td>
                        <td>${log.identifier}</td>
                        <td>${log.isLoggedIn ? '✔️ 로그인' : '❌ 비로그인'}</td>
                    </tr>
                `).join('');
            }
        } catch (e) {
            alert('방문 로그 로딩 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp || !timestamp.toDate) return '-';
        return timestamp.toDate().toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }

    renderList(type) {
        const listEl = this.elements[`${type}sList`];
        const data = type === 'game' ? this.allGames : this.allPosts;
        
        data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

        listEl.innerHTML = data.map(item => this.createItemCard(item, type)).join('');
    }

    createItemCard(item, type) {
        if (type === 'game') {
            return `
                <div class="item-card">
                    <img src="${item.imageUrl || 'https://placehold.co/100x100'}" alt="${item.name}" class="item-thumbnail">
                    <div class="item-info">
                        <h3>${item.name}</h3>
                        <p>장르: ${item.genre || '-'} | 난이도: ${item.difficulty || '-'}</p>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn" onclick="adminManager.openModal('game', '${item.id}')">수정</button>
                        <button class="action-btn danger" onclick="adminManager.deleteItem('${item.id}', 'game')">삭제</button>
                    </div>
                </div>`;
        } else { // post
            return `
                 <div class="item-card">
                    <img src="${item.thumbnailUrl || 'https://placehold.co/100x100'}" alt="${item.title}" class="item-thumbnail">
                    <div class="item-info">
                        <h3>${item.title}</h3>
                        <p>작성자: ${item.author || '-'} | 조회수: ${item.viewCount || 0}</p>
                    </div>
                    <div class="item-actions">
                        <button class="action-btn" onclick="adminManager.openModal('post', '${item.id}')">수정</button>
                        <button class="action-btn danger" onclick="adminManager.deleteItem('${item.id}', 'post')">삭제</button>
                    </div>
                </div>`;
        }
    }

    openModal(type, id = null) {
        const data = id 
            ? (type === 'game' ? this.allGames.find(g => g.id === id) : this.allPosts.find(p => p.id === id))
            : {};
        const modalHtml = type === 'game' ? this.getGameModalHtml(data) : this.getPostModalHtml(data);
        this.elements['modal-container'].innerHTML = modalHtml;
        this.setupModalEvents(type, id);
    }

    getGameModalHtml(data) {
        return `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${data.id ? '게임 정보 수정' : '새 게임 추가'}</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group"><label>이름</label><input type="text" name="name" value="${data.name || ''}"></div>
                        <div class="form-group"><label>이미지 URL</label><input type="text" name="imageUrl" value="${data.imageUrl || ''}"></div>
                        <div class="form-group"><label>장르</label><input type="text" name="genre" value="${data.genre || ''}"></div>
                        <div class="form-row">
                            <div class="form-group"><label>최소 인원</label><input type="number" name="minPlayers" value="${data.minPlayers || ''}"></div>
                            <div class="form-group"><label>최대 인원</label><input type="number" name="maxPlayers" value="${data.maxPlayers || ''}"></div>
                        </div>
                        <div class="form-group"><label>베스트 인원</label><input type="text" name="bestPlayers" value="${data.bestPlayers || ''}"></div>
                        <div class="form-row">
                            <div class="form-group"><label>난이도</label><input type="number" step="0.1" name="difficulty" value="${data.difficulty || ''}"></div>
                            <div class="form-group"><label>플레이 시간(분)</label><input type="number" name="playTime" value="${data.playTime || ''}"></div>
                        </div>
                        <div class="form-group"><label>YouTube URL</label><input type="text" name="youtubeUrl" value="${data.youtubeUrl || ''}"></div>
                        <div class="form-group"><label>상태</label>
                            <select name="status">
                                <option value="normal" ${data.status === 'normal' ? 'selected' : ''}>일반</option>
                                <option value="new" ${data.status === 'new' ? 'selected' : ''}>NEW</option>
                                <option value="shipping" ${data.status === 'shipping' ? 'selected' : ''}>배송중</option>
                                <option value="purchasing" ${data.status === 'purchasing' ? 'selected' : ''}>구매중</option>
                                <option value="rented" ${data.status === 'rented' ? 'selected' : ''}>대여중</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="action-btn close-btn">취소</button>
                        <button class="action-btn primary save-btn">저장</button>
                    </div>
                </div>
            </div>`;
    }

    getPostModalHtml(data) {
        return `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>${data.id ? '게시글 수정' : '새 게시글 추가'}</h2>
                        <button class="close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group"><label>제목</label><input type="text" name="title" value="${data.title || ''}"></div>
                        <div class="form-group"><label>작성자</label><input type="text" name="author" value="${data.author || ''}"></div>
                        <div class="form-group"><label>썸네일 URL</label><input type="text" name="thumbnailUrl" value="${data.thumbnailUrl || ''}"></div>
                        <div class="form-group"><label>조회수</label><input type="number" name="viewCount" value="${data.viewCount || '0'}"></div>
                        <div class="form-group"><label>내용</label><textarea name="content" rows="10">${data.content || ''}</textarea></div>
                    </div>
                    <div class="modal-footer">
                        <button class="action-btn close-btn">취소</button>
                        <button class="action-btn primary save-btn">저장</button>
                    </div>
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
                } else if (!id) {
                    data[name] = null;
                }
            } else {
                data[name] = value;
            }
        });

        if (type === 'game' && !id && !data.name) {
            alert("게임 이름은 필수입니다.");
            return; 
        } else if (type === 'post' && !id && !data.title) {
            alert("게시글 제목은 필수입니다.");
            return;
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
}

document.addEventListener('DOMContentLoaded', () => {
    function waitForAPI() {
        if (window.boardGameAPI) {
            window.adminManager = new AdminManager();
        } else {
            setTimeout(waitForAPI, 100);
        }
    }
    waitForAPI();
});

