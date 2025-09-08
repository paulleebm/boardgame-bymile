// 관리자 페이지 메인 스크립트 (최종 수정 버전)
class AdminManager {
    constructor() {
        this.allGames = [];
        this.currentGames = [];
        this.editingGameId = null;
        this.gameToDelete = null;
        this.bulkGameData = [];
        this.searchTimeout = null;
        this.selectedGameIds = new Set();

        this.elements = {};
        this.initializeElements();
        this.setupEventListeners();
        this.loadGames();
    }

    initializeElements() {
        const ids = [
            'totalGames', 'newGames', 'shippingGames', 'purchasingGames', 'rentedGames',
            'lastUpdate', 'searchInput', 'statusFilter', 'selectAllBtn', 'bulkStatusSelect',
            'applyBulkStatusBtn', 'selectedCount', 'selectedInfo', 'gamesList', 'gameModal',
            'deleteModal', 'bulkModal', 'loading', 'errorMessage', 'errorText',
            'successMessage', 'successText', 'gameForm', 'modalTitle', 'saveBtn',
            'deleteGameName', 'bulkData', 'bulkPreview', 'previewList', 'previewCount',
            'bulkSaveBtn', 'addGameBtn', 'bulkUploadBtn', 'modalCloseBtn', 'modalCancelBtn',
            'deleteModalCloseBtn', 'deleteCancelBtn', 'confirmDeleteBtn', 'bulkModalCloseBtn',
            'bulkCancelBtn', 'previewBtn', 'errorCloseBtn', 'successCloseBtn'
        ];
        ids.forEach(id => this.elements[id] = document.getElementById(id));
    }

    setupEventListeners() {
        this.elements.addGameBtn.addEventListener('click', () => this.openModal());
        this.elements.bulkUploadBtn.addEventListener('click', () => this.openBulkModal());
        
        this.elements.searchInput.addEventListener('input', () => this.debounceSearch());
        this.elements.statusFilter.addEventListener('change', () => this.searchGames());
        
        this.elements.selectAllBtn.addEventListener('click', () => this.toggleSelectAll());
        this.elements.applyBulkStatusBtn.addEventListener('click', () => this.applyBulkStatusChange());
        
        this.elements.modalCloseBtn.addEventListener('click', () => this.closeModal());
        this.elements.modalCancelBtn.addEventListener('click', () => this.closeModal());
        this.elements.saveBtn.addEventListener('click', () => this.saveGame());
        
        this.elements.deleteModalCloseBtn.addEventListener('click', () => this.closeDeleteModal());
        this.elements.deleteCancelBtn.addEventListener('click', () => this.closeDeleteModal());
        this.elements.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());

        this.elements.bulkModalCloseBtn.addEventListener('click', () => this.closeBulkModal());
        this.elements.bulkCancelBtn.addEventListener('click', () => this.closeBulkModal());
        this.elements.previewBtn.addEventListener('click', () => this.previewBulkData());
        this.elements.bulkSaveBtn.addEventListener('click', () => this.saveBulkData());
        
        this.elements.errorCloseBtn.addEventListener('click', () => this.hideError());
        this.elements.successCloseBtn.addEventListener('click', () => this.hideSuccess());

        this.elements.gamesList.addEventListener('click', e => {
            const gameItem = e.target.closest('.game-item');
            if (!gameItem) return;

            const checkbox = gameItem.querySelector('.game-checkbox');
            const gameId = checkbox?.dataset.gameId;
            if (!gameId) return;

            if (e.target.closest('.edit-btn')) {
                e.stopPropagation();
                this.editGame(gameId);
            } else if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                this.deleteGame(gameId, e.target.closest('.delete-btn').dataset.gameName);
            } else {
                this.toggleGameSelection(gameId);
            }
        });
    }

    async loadGames() {
        this.showLoading(true);
        this.hideMessages();
        try {
            const data = await window.boardGameAPI.getAllGames();
            this.allGames = data;
            this.searchGames(); 
            this.updateStats();
            this.updateLastUpdateTime();
        } catch (error) {
            console.error('게임 데이터 로드 실패:', error);
            this.showError(`게임 데이터를 불러오는 데 실패했습니다: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }
    
    searchGames() {
        const query = this.elements.searchInput.value.trim().toLowerCase();
        const statusFilter = this.elements.statusFilter.value;

        this.currentGames = this.allGames.filter(game => {
            const matchesText = !query || 
                (game.name && game.name.toLowerCase().includes(query)) ||
                (game.genre && game.genre.toLowerCase().includes(query)) ||
                (game.buyer && game.buyer.toLowerCase().includes(query));
            
            const matchesStatus = !statusFilter || 
                (statusFilter === 'normal' && (!game.status || game.status === 'normal')) ||
                (game.status === statusFilter);
            
            return matchesText && matchesStatus;
        });
        
        this.sortGamesByUpdatedAt();
        this.renderGames();
    }

    sortGamesByUpdatedAt() {
        this.currentGames.sort((a, b) => {
            const dateA = this.getDate(a.updatedAt || a.createdAt);
            const dateB = this.getDate(b.updatedAt || b.createdAt);
            return dateB - dateA;
        });
    }

    renderGames() {
        if (this.allGames.length === 0) {
            this.elements.gamesList.innerHTML = `<div class="empty-state"><h3>🎲 등록된 게임이 없습니다.</h3><p>새 게임을 추가하여 목록을 채워보세요.</p></div>`;
        } else if (this.currentGames.length === 0) {
            this.elements.gamesList.innerHTML = `<div class="empty-state"><h3>검색 결과가 없습니다.</h3></div>`;
        } else {
            this.elements.gamesList.innerHTML = this.currentGames.map(game => this.createGameItem(game)).join('');
        }
        this.updateBulkActions();
    }
    
    createGameItem(game) {
        const isSelected = this.selectedGameIds.has(game.id);
        
        // V V V V V V V V V V V V V V V V V V V V V V V V V V V
        // 이 부분이 수정되었습니다.
        const difficultyValue = parseFloat(game.difficulty);
        const difficultyText = !isNaN(difficultyValue) ? difficultyValue.toFixed(1) : '-';
        // ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^ ^

        return `
            <div class="game-item ${isSelected ? 'selected' : ''}" data-game-id="${game.id}">
                <div class="game-header">
                    <div class="game-title-section">
                        <div class="game-checkbox-container">
                            <input type="checkbox" class="game-checkbox" data-game-id="${game.id}" ${isSelected ? 'checked' : ''}>
                        </div>
                        <h3 class="game-title">${this.escapeHtml(game.name)} ${this.getStatusTag(game.status)}</h3>
                    </div>
                    <div class="game-actions">
                        <button class="action-btn edit-btn">✏️ 수정</button>
                        <button class="action-btn delete-btn" data-game-name="${this.escapeHtml(game.name)}">🗑️ 삭제</button>
                    </div>
                </div>
                <div class="game-info">
                    <div class="game-field"><span>상태:</span><span>${this.getGameStatusText(game.status)}</span></div>
                    <div class="game-field"><span>난이도:</span><span>${difficultyText}</span></div>
                    <div class="game-field"><span>인원:</span><span>${this.formatPlayerCount(game.minPlayers, game.maxPlayers)}</span></div>
                    <div class="game-field"><span>베스트:</span><span>${this.formatBestPlayers(game.bestPlayers)}</span></div>
                    <div class="game-field"><span>시간:</span><span>${game.playTime ? game.playTime + '분' : '-'}</span></div>
                    <div class="game-field"><span>장르:</span><span>${this.escapeHtml(game.genre)}</span></div>
                    <div class="game-field"><span>구매자:</span><span>${this.escapeHtml(game.buyer)}</span></div>
                    <div class="game-field"><span>수정일:</span><span>${this.formatDateShort(game.updatedAt)}</span></div>
                </div>
            </div>
        `;
    }

    toggleGameSelection(gameId) {
        this.selectedGameIds.has(gameId) ? this.selectedGameIds.delete(gameId) : this.selectedGameIds.add(gameId);
        this.updateGameItemSelection(gameId);
        this.updateBulkActions();
    }

    updateGameItemSelection(gameId) {
        const item = this.elements.gamesList.querySelector(`.game-item[data-game-id="${gameId}"]`);
        if (!item) return;
        const checkbox = item.querySelector('.game-checkbox');
        const isSelected = this.selectedGameIds.has(gameId);
        item.classList.toggle('selected', isSelected);
        checkbox.checked = isSelected;
    }

    toggleSelectAll() {
        const allCurrentIds = this.currentGames.map(g => g.id);
        const allSelected = allCurrentIds.length > 0 && allCurrentIds.every(id => this.selectedGameIds.has(id));
        allCurrentIds.forEach(id => {
            allSelected ? this.selectedGameIds.delete(id) : this.selectedGameIds.add(id);
        });
        this.renderGames();
    }

    updateBulkActions() {
        const count = this.selectedGameIds.size;
        this.elements.selectedInfo.style.display = count > 0 ? 'block' : 'none';
        this.elements.selectedCount.textContent = `${count}개 선택됨`;
        this.elements.applyBulkStatusBtn.disabled = count === 0;
        const allCurrentSelected = this.currentGames.length > 0 && this.currentGames.every(g => this.selectedGameIds.has(g.id));
        this.elements.selectAllBtn.textContent = allCurrentSelected ? '전체 해제' : '전체 선택';
    }

    async applyBulkStatusChange() {
        const ids = Array.from(this.selectedGameIds);
        const status = this.elements.bulkStatusSelect.value;
        if (ids.length === 0 || !status) return;

        this.showLoading(true);
        try {
            await Promise.all(ids.map(id => window.boardGameAPI.updateGame(id, { status })));
            this.selectedGameIds.clear();
            await this.loadGames();
            this.showSuccess(`${ids.length}개 게임 상태 변경 완료`);
        } catch (error) {
            this.showError('상태 변경 실패');
        } finally {
            this.showLoading(false);
        }
    }
    
    openModal() {
        this.editingGameId = null;
        this.elements.modalTitle.textContent = '새 게임 추가';
        this.elements.saveBtn.textContent = '추가';
        this.clearForm();
        this.elements.gameModal.classList.remove('hidden');
    }

    editGame(gameId) {
        const game = this.allGames.find(g => g.id === gameId);
        if (!game) return;
        this.editingGameId = gameId;
        this.elements.modalTitle.textContent = '게임 수정';
        this.elements.saveBtn.textContent = '수정';
        
        const form = this.elements.gameForm;
        form.elements.name.value = game.name || '';
        form.elements.status.value = game.status || '';
        form.elements.difficulty.value = game.difficulty || '';
        form.elements.minPlayers.value = game.minPlayers || '';
        form.elements.maxPlayers.value = game.maxPlayers || '';
        form.elements.bestPlayers.value = game.bestPlayers || '';
        form.elements.playTime.value = game.playTime || '';
        form.elements.genre.value = game.genre || '';
        form.elements.buyer.value = game.buyer || '';
        form.elements.imageUrl.value = game.imageUrl || '';
        form.elements.youtubeUrl.value = game.youtubeUrl || '';
        
        this.elements.gameModal.classList.remove('hidden');
    }

    deleteGame(gameId, gameName) {
        this.gameToDelete = gameId;
        this.elements.deleteGameName.textContent = gameName;
        this.elements.deleteModal.classList.remove('hidden');
    }

    async saveGame() {
        const formData = new FormData(this.elements.gameForm);
        const gameData = Object.fromEntries(formData.entries());
        if (!gameData.name) {
            this.showError('게임 이름은 필수입니다.');
            return;
        }

        this.showLoading(true);
        try {
            if (this.editingGameId) {
                await window.boardGameAPI.updateGame(this.editingGameId, gameData);
                this.showSuccess('게임이 수정되었습니다.');
            } else {
                await window.boardGameAPI.addGame(gameData);
                this.showSuccess('새 게임이 추가되었습니다.');
            }
            this.closeModal();
            await this.loadGames();
        } catch (error) {
            this.showError('게임 저장에 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }
    
    async confirmDelete() {
        if (!this.gameToDelete) return;
        this.showLoading(true);
        try {
            await window.boardGameAPI.deleteGame(this.gameToDelete);
            this.selectedGameIds.delete(this.gameToDelete);
            this.closeDeleteModal();
            this.showSuccess('게임이 삭제되었습니다.');
            await this.loadGames();
        } catch (error) {
            this.showError('게임 삭제에 실패했습니다.');
        } finally {
            this.showLoading(false);
        }
    }
    
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.searchGames(), 300);
    }

    openBulkModal() {
        this.elements.bulkModal.classList.remove('hidden');
        this.elements.bulkData.value = '';
        this.elements.bulkPreview.classList.add('hidden');
        this.elements.bulkSaveBtn.disabled = true;
    }

    previewBulkData() {
        const csvData = this.elements.bulkData.value.trim();
        if (!csvData) {
            this.showError('CSV 데이터를 입력해주세요.');
            return;
        }
        try {
            const lines = csvData.split('\n');
            const headers = this.parseCSVLine(lines.shift());
            if (!headers.includes('name')) throw new Error('name 컬럼은 필수입니다.');
            
            this.bulkGameData = lines.map(line => {
                const values = this.parseCSVLine(line);
                return headers.reduce((obj, header, index) => {
                    if (values[index]) obj[header] = values[index];
                    return obj;
                }, {});
            }).filter(game => game.name);

            this.elements.previewList.innerHTML = this.bulkGameData
                .map(game => `<div>${this.escapeHtml(game.name)}</div>`)
                .join('');
            this.elements.previewCount.textContent = this.bulkGameData.length;
            this.elements.bulkPreview.classList.remove('hidden');
            this.elements.bulkSaveBtn.disabled = this.bulkGameData.length === 0;
        } catch (error) {
            this.showError(error.message || 'CSV 파싱 오류');
        }
    }

    async saveBulkData() {
        if (this.bulkGameData.length === 0) return;
        this.showLoading(true);
        try {
            await Promise.all(this.bulkGameData.map(game => window.boardGameAPI.addGame(game)));
            this.closeBulkModal();
            this.showSuccess(`${this.bulkGameData.length}개 게임 등록 완료`);
            await this.loadGames();
        } catch (error) {
            this.showError('대량 등록 실패');
        } finally {
            this.showLoading(false);
        }
    }
    
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (const char of line) {
            if (char === '"' && !inQuotes) { inQuotes = true; continue; }
            if (char === '"' && inQuotes) { inQuotes = false; continue; }
            if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    }

    closeModal() { this.elements.gameModal.classList.add('hidden'); }
    closeDeleteModal() { this.elements.deleteModal.classList.add('hidden'); }
    closeBulkModal() { this.elements.bulkModal.classList.add('hidden'); }
    clearForm() { this.elements.gameForm.reset(); this.editingGameId = null; }

    updateStats() {
        this.elements.totalGames.textContent = this.allGames.length;
        this.elements.newGames.textContent = this.allGames.filter(g => g.status === 'new').length;
        this.elements.shippingGames.textContent = this.allGames.filter(g => g.status === 'shipping').length;
        this.elements.purchasingGames.textContent = this.allGames.filter(g => g.status === 'purchasing').length;
        this.elements.rentedGames.textContent = this.allGames.filter(g => g.status === 'rented').length;
    }

    updateLastUpdateTime() {
        this.elements.lastUpdate.textContent = new Date().toLocaleString('ko-KR');
    }

    getStatusTag(status) {
        if (!status || status === 'normal') return '';
        const map = {'new': 'status-new', 'shipping': 'status-shipping', 'purchasing': 'status-purchasing', 'rented': 'status-rented'};
        const textMap = {'new': 'NEW', 'shipping': '배송중', 'purchasing': '구매중', 'rented': '대여중'};
        return `<span class="status-tag ${map[status]}">${textMap[status]}</span>`;
    }
    getGameStatusText(status) { return {new:'신상', shipping:'배송중', purchasing:'구매중', rented:'대여중'}[status] || '일반'; }
    formatPlayerCount(min, max) { return min && max ? (min === max ? `${min}명` : `${min}-${max}명`) : (min ? `${min}명+` : (max ? `~${max}명` : '-')); }
    formatBestPlayers(best) { return best ? (String(best).match(/[,|-]/) ? best : `${best}명`) : '-'; }
    formatDateShort(ts) { return this.getDate(ts).toLocaleDateString('ko-KR'); }
    getDate(ts) { return ts ? (ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)) : new Date(0); }
    escapeHtml(text) { return text != null ? String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])) : ''; }

    showLoading(show) { this.elements.loading.classList.toggle('show', show); }
    hideError() { this.elements.errorMessage.classList.add('hidden'); }
    hideSuccess() { this.elements.successMessage.classList.add('hidden'); }
    hideMessages() { this.hideError(); this.hideSuccess(); }
    showError(message) { this.hideMessages(); this.elements.errorText.textContent = message; this.elements.errorMessage.classList.remove('hidden'); setTimeout(() => this.hideError(), 5000); }
    showSuccess(message) { this.hideMessages(); this.elements.successText.textContent = message; this.elements.successMessage.classList.remove('hidden'); setTimeout(() => this.hideSuccess(), 3000); }
}

document.addEventListener('DOMContentLoaded', () => {
    function waitForAPI() {
        if (window.boardGameAPI && window.firebaseInitialized) {
            new AdminManager();
        } else {
            setTimeout(waitForAPI, 100);
        }
    }
    waitForAPI();
});