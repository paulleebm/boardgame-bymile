class AdminManager {
    constructor() {
        this.allGames = [];
        this.elements = {};
        this.initializeElements();
        this.initialize();
    }

    initializeElements() {
        const ids = [
            'nav-game-management', 'nav-visit-log',
            'game-management-page', 'visit-log-page',
            'addGameBtn', 'bulkUploadBtn',
            'gamesList', 'visit-log-body',
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
        this.elements['nav-visit-log'].addEventListener('click', () => {
            this.showPage('visit-log');
            this.loadVisitLogs();
        });

        this.elements['addGameBtn'].addEventListener('click', () => this.openGameModal());
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
            this.renderGamesList();
        } catch (e) {
            alert('게임 목록 로딩 실패: ' + e.message);
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

    renderGamesList() {
        const listEl = this.elements.gamesList;
        this.allGames.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
        listEl.innerHTML = this.allGames.map(item => this.createGameCard(item)).join('');
    }

    createGameCard(item) {
        return `
            <div class="item-card">
                <img src="${item.imageUrl || 'https://placehold.co/100x100'}" alt="${item.name}" class="item-thumbnail">
                <div class="item-info">
                    <h3>${item.name}</h3>
                    <p>장르: ${item.genre || '-'} | 난이도: ${item.difficulty || '-'}</p>
                </div>
                <div class="item-actions">
                    <button class="action-btn" onclick="adminManager.openGameModal('${item.id}')">수정</button>
                    <button class="action-btn danger" onclick="adminManager.deleteGame('${item.id}')">삭제</button>
                </div>
            </div>`;
    }

    openGameModal(id = null) {
        const data = id ? this.allGames.find(g => g.id === id) : {};
        const modalHtml = this.getGameModalHtml(data);
        this.elements['modal-container'].innerHTML = modalHtml;
        this.setupGameModalEvents(id);
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
    
    setupGameModalEvents(id) {
        const modal = this.elements['modal-container'].querySelector('.modal-overlay');
        modal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => modal.remove()));
        modal.querySelector('.save-btn').addEventListener('click', () => this.saveGame(id, modal));
    }

    async saveGame(id, modal) {
        const data = {};
        modal.querySelectorAll('input, textarea, select').forEach(input => {
            const name = input.name;
            if (!name) return;
            let value = input.value;
            if (input.type !== 'select-one') value = value.trim();
            if (input.type === 'number') {
                data[name] = value !== '' ? Number(value) : null;
            } else {
                data[name] = value;
            }
        });
        
        if (!data.name) {
            alert("게임 이름은 필수입니다.");
            return;
        }

        this.showLoading(true);
        try {
            id ? await window.boardGameAPI.updateGame(id, data) : await window.boardGameAPI.addGame(data);
            await this.loadGames();
            modal.remove();
        } catch (e) {
            console.error("저장 실패:", e);
            alert('저장 실패: ' + e.message);
        } finally {
            this.showLoading(false);
        }
    }
    
    async deleteGame(id) {
        if (!confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        this.showLoading(true);
        try {
            await window.boardGameAPI.deleteGame(id);
            await this.loadGames();
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