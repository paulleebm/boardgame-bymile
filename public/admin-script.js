// 관리자 페이지 메인 스크립트
class AdminManager {
    constructor() {
        this.allGames = [];
        this.currentGames = [];
        this.editingGameId = null;
        this.gameToDelete = null;
        this.bulkGameData = [];
        this.searchTimeout = null;
        
        // DOM 요소 캐싱
        this.elements = {};
        this.initializeElements();
        
        // 이벤트 리스너 등록
        this.setupEventListeners();
        
        // 초기 데이터 로드
        this.loadGames();
    }

    // DOM 요소 초기화
    initializeElements() {
        this.elements = {
            // 통계
            totalGames: document.getElementById('totalGames'),
            newGames: document.getElementById('newGames'),
            shippingGames: document.getElementById('shippingGames'),
            purchasingGames: document.getElementById('purchasingGames'),
            rentedGames: document.getElementById('rentedGames'),
            lastUpdate: document.getElementById('lastUpdate'),
            
            // 컨트롤
            searchInput: document.getElementById('searchInput'),
            searchBtn: document.getElementById('searchBtn'),
            statusFilter: document.getElementById('statusFilter'),
            sortBy: document.getElementById('sortBy'),
            
            // 게임 목록
            gamesList: document.getElementById('gamesList'),
            
            // 모달
            gameModal: document.getElementById('gameModal'),
            deleteModal: document.getElementById('deleteModal'),
            bulkModal: document.getElementById('bulkModal'),
            
            // 메시지
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('errorMessage'),
            errorText: document.getElementById('errorText'),
            successMessage: document.getElementById('successMessage'),
            successText: document.getElementById('successText'),
            
            // 게임 폼
            gameForm: document.getElementById('gameForm'),
            modalTitle: document.getElementById('modalTitle'),
            saveBtn: document.getElementById('saveBtn'),
            
            // 삭제 모달
            deleteGameName: document.getElementById('deleteGameName'),
            
            // 대량 등록
            bulkData: document.getElementById('bulkData'),
            bulkPreview: document.getElementById('bulkPreview'),
            previewList: document.getElementById('previewList'),
            previewCount: document.getElementById('previewCount'),
            bulkSaveBtn: document.getElementById('bulkSaveBtn')
        };
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 버튼 이벤트
        document.getElementById('addGameBtn').addEventListener('click', () => this.openModal());
        document.getElementById('bulkUploadBtn').addEventListener('click', () => this.openBulkModal());
        
        // 검색
        this.elements.searchBtn.addEventListener('click', () => this.searchGames());
        this.elements.searchInput.addEventListener('input', () => this.debounceSearch());
        this.elements.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchGames();
        });
        
        // 필터 및 정렬
        this.elements.statusFilter.addEventListener('change', () => this.searchGames());
        this.elements.sortBy.addEventListener('change', () => this.sortGames());
        
        // 게임 모달
        document.getElementById('modalCloseBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancelBtn').addEventListener('click', () => this.closeModal());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveGame());
        
        // 삭제 모달
        document.getElementById('deleteModalCloseBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('deleteCancelBtn').addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.confirmDelete());
        
        // 대량 등록 모달
        document.getElementById('bulkModalCloseBtn').addEventListener('click', () => this.closeBulkModal());
        document.getElementById('bulkCancelBtn').addEventListener('click', () => this.closeBulkModal());
        document.getElementById('previewBtn').addEventListener('click', () => this.previewBulkData());
        document.getElementById('bulkSaveBtn').addEventListener('click', () => this.saveBulkData());
        
        // 메시지 닫기
        document.getElementById('errorCloseBtn').addEventListener('click', () => this.hideError());
        document.getElementById('successCloseBtn').addEventListener('click', () => this.hideSuccess());
        
        // 모달 외부 클릭시 닫기
        this.elements.gameModal.addEventListener('click', (e) => {
            if (e.target === this.elements.gameModal) this.closeModal();
        });
        this.elements.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.elements.deleteModal) this.closeDeleteModal();
        });
        this.elements.bulkModal.addEventListener('click', (e) => {
            if (e.target === this.elements.bulkModal) this.closeBulkModal();
        });
    }

    // 게임 데이터 로드
    async loadGames() {
        this.showLoading(true);
        this.hideMessages();
        
        try {
            const data = await window.boardGameAPI.getAllGames();
            this.allGames = data;
            this.currentGames = data;
            
            this.renderGames();
            this.updateStats();
            this.updateLastUpdateTime();
            
        } catch (error) {
            console.error('게임 데이터 로드 실패:', error);
            this.showError(error.message || '게임 데이터를 불러오는데 실패했습니다.');
        }
        
        this.showLoading(false);
    }

    // 게임 목록 렌더링
    renderGames() {
        if (!this.elements.gamesList) return;
        
        if (this.currentGames.length === 0) {
            this.elements.gamesList.innerHTML = `
                <div class="empty-state">
                    <h3>🎲 게임이 없습니다</h3>
                    <p>첫 번째 보드게임을 추가해보세요!</p>
                    <button class="add-btn">➕ 게임 추가하기</button>
                </div>
            `;
            
            // 빈 상태에서의 추가 버튼
            const emptyAddBtn = this.elements.gamesList.querySelector('.add-btn');
            if (emptyAddBtn) {
                emptyAddBtn.addEventListener('click', () => this.openModal());
            }
            return;
        }
        
        this.elements.gamesList.innerHTML = this.currentGames.map(game => this.createGameItem(game)).join('');
        
        // 이벤트 위임으로 버튼 클릭 처리
        this.elements.gamesList.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');
            
            if (editBtn) {
                const gameId = editBtn.dataset.gameId;
                this.editGame(gameId);
            } else if (deleteBtn) {
                const gameId = deleteBtn.dataset.gameId;
                const gameName = deleteBtn.dataset.gameName;
                this.deleteGame(gameId, gameName);
            }
        });
    }

    // 게임 아이템 HTML 생성
    createGameItem(game) {
        return `
            <div class="game-item">
                <div class="game-header">
                    <h3 class="game-title">
                        ${this.escapeHtml(game.name || '이름 없음')}
                        ${this.getStatusTag(game.status)}
                    </h3>
                    <div class="game-actions">
                        <button class="action-btn edit-btn" data-game-id="${game.id}">✏️ 수정</button>
                        <button class="action-btn delete-btn" data-game-id="${game.id}" data-game-name="${this.escapeHtml(game.name)}">🗑️ 삭제</button>
                    </div>
                </div>
                
                <div class="game-info">
                    <div class="game-field">
                        <span class="field-label">상태:</span>
                        <span class="field-value">${this.getGameStatusText(game.status)}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">난이도:</span>
                        <span class="field-value">${game.difficulty ? game.difficulty.toFixed(1) : '-'}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">인원:</span>
                        <span class="field-value">${this.formatPlayerCount(game.minPlayers, game.maxPlayers)}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">베스트 인원:</span>
                        <span class="field-value">${this.formatBestPlayers(game.bestPlayers)}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">플레이 시간:</span>
                        <span class="field-value">${game.playTime ? game.playTime + '분' : '-'}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">장르/테마:</span>
                        <span class="field-value">${this.escapeHtml(game.genre || '-')}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">구매자:</span>
                        <span class="field-value">${this.escapeHtml(game.buyer || '-')}</span>
                    </div>
                    <div class="game-field">
                        <span class="field-label">등록일:</span>
                        <span class="field-value">${this.formatDateShort(game.createdAt)}</span>
                    </div>
                </div>
                
                ${game.description ? `
                    <div class="game-description">
                        ${this.escapeHtml(game.description)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // 게임 검색 (디바운스)
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.searchGames();
        }, 500);
    }

    // 게임 검색
    searchGames() {
        const query = this.elements.searchInput.value.trim().toLowerCase();
        const statusFilter = this.elements.statusFilter.value;
        
        this.currentGames = this.allGames.filter(game => {
            // 텍스트 검색
            const matchesText = !query || 
                (game.name && game.name.toLowerCase().includes(query)) ||
                (game.genre && game.genre.toLowerCase().includes(query)) ||
                (game.buyer && game.buyer.toLowerCase().includes(query));
            
            // 상태 필터
            const matchesStatus = !statusFilter || 
                (statusFilter === 'normal' && (!game.status || game.status === 'normal')) ||
                (statusFilter !== 'normal' && game.status === statusFilter);
            
            return matchesText && matchesStatus;
        });
        
        this.renderGames();
    }

    // 게임 정렬
    sortGames() {
        const sortBy = this.elements.sortBy.value;
        
        this.currentGames.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return (a.name || '').localeCompare(b.name || '', 'ko-KR');
                    
                case 'status':
                    const statusOrder = { 'new': 0, 'purchasing': 1, 'shipping': 2, 'rented': 3, 'normal': 4, '': 4 };
                    const statusA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 4;
                    const statusB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 4;
                    
                    if (statusA !== statusB) {
                        return statusA - statusB;
                    }
                    return (a.name || '').localeCompare(b.name || '', 'ko-KR');
                    
                case 'createdAt':
                case 'updatedAt':
                    const dateA = this.getDate(a[sortBy]);
                    const dateB = this.getDate(b[sortBy]);
                    return dateB - dateA; // 최신순
                    
                default:
                    return 0;
            }
        });
        
        this.renderGames();
    }

    // 모달 열기 (새 게임 추가)
    openModal() {
        this.editingGameId = null;
        this.elements.modalTitle.textContent = '새 게임 추가';
        this.elements.saveBtn.textContent = '추가';
        this.elements.gameModal.classList.remove('hidden');
        this.clearForm();
    }

    // 게임 수정
    editGame(gameId) {
        const game = this.allGames.find(g => g.id === gameId);
        if (!game) return;
        
        this.editingGameId = gameId;
        this.elements.modalTitle.textContent = '게임 수정';
        this.elements.saveBtn.textContent = '수정';
        this.elements.gameModal.classList.remove('hidden');
        
        // 폼에 데이터 채우기
        const formFields = {
            gameName: game.name,
            gameStatus: game.status,
            gameDifficulty: game.difficulty,
            gameMinPlayers: game.minPlayers,
            gameMaxPlayers: game.maxPlayers,
            gameBestPlayers: game.bestPlayers,
            gamePlayTime: game.playTime,
            gameGenre: game.genre,
            gameBuyer: game.buyer,
            gameImageUrl: game.imageUrl,
            gameYoutubeUrl: game.youtubeUrl
        };
        
        Object.entries(formFields).forEach(([fieldId, value]) => {
            const element = document.getElementById(fieldId);
            if (element) {
                element.value = value || '';
            }
        });
    }

    // 게임 삭제 확인
    deleteGame(gameId, gameName) {
        this.gameToDelete = gameId;
        this.elements.deleteGameName.textContent = gameName;
        this.elements.deleteModal.classList.remove('hidden');
    }

    // 게임 저장
    async saveGame() {
        const formData = {
            name: document.getElementById('gameName').value.trim(),
            status: document.getElementById('gameStatus').value,
            difficulty: document.getElementById('gameDifficulty').value,
            minPlayers: document.getElementById('gameMinPlayers').value,
            maxPlayers: document.getElementById('gameMaxPlayers').value,
            bestPlayers: document.getElementById('gameBestPlayers').value.trim(),
            playTime: document.getElementById('gamePlayTime').value,
            genre: document.getElementById('gameGenre').value.trim(),
            buyer: document.getElementById('gameBuyer').value.trim(),
            imageUrl: document.getElementById('gameImageUrl').value.trim(),
            youtubeUrl: document.getElementById('gameYoutubeUrl').value.trim()
        };
        
        // 필수 필드 검증
        if (!formData.name) {
            this.showError('게임 이름은 필수입니다.');
            return;
        }
        
        this.showLoading(true);
        
        try {
            if (this.editingGameId) {
                await window.boardGameAPI.updateGame(this.editingGameId, formData);
                this.showSuccess('게임이 수정되었습니다.');
            } else {
                await window.boardGameAPI.addGame(formData);
                this.showSuccess('새 게임이 추가되었습니다.');
            }
            
            this.closeModal();
            await this.loadGames();
            
        } catch (error) {
            console.error('게임 저장 실패:', error);
            this.showError(error.message || '게임 저장에 실패했습니다.');
        }
        
        this.showLoading(false);
    }

    // 게임 삭제 확인
    async confirmDelete() {
        if (!this.gameToDelete) return;
        
        this.showLoading(true);
        
        try {
            await window.boardGameAPI.deleteGame(this.gameToDelete);
            this.closeDeleteModal();
            this.showSuccess('게임이 삭제되었습니다.');
            await this.loadGames();
            
        } catch (error) {
            console.error('게임 삭제 실패:', error);
            this.showError(error.message || '게임 삭제에 실패했습니다.');
        }
        
        this.showLoading(false);
    }

    // 대량 등록 모달 열기
    openBulkModal() {
        this.elements.bulkModal.classList.remove('hidden');
        this.elements.bulkData.value = '';
        this.elements.bulkPreview.classList.add('hidden');
        this.elements.bulkSaveBtn.disabled = true;
        this.bulkGameData = [];
    }

    // 대량 데이터 미리보기
    previewBulkData() {
        const csvData = this.elements.bulkData.value.trim();
        
        if (!csvData) {
            this.showError('CSV 데이터를 입력해주세요.');
            return;
        }
        
        try {
            const lines = csvData.split('\n').filter(line => line.trim());
            if (lines.length < 2) {
                this.showError('헤더와 최소 1개의 데이터 행이 필요합니다.');
                return;
            }
            
            const headers = this.parseCSVLine(lines[0]);
            
            if (!headers.includes('name')) {
                this.showError('name 컬럼은 필수입니다.');
                return;
            }
            
            this.bulkGameData = [];
            this.elements.previewList.innerHTML = '';
            
            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                const gameData = {};
                
                headers.forEach((header, index) => {
                    let value = values[index] || '';
                    value = value.replace(/^["']|["']$/g, '').trim();
                    
                    if (value) {
                        gameData[header] = value;
                    }
                });
                
                if (gameData.name) {
                    this.bulkGameData.push(gameData);
                    
                    const previewItem = document.createElement('div');
                    previewItem.className = 'preview-item';
                    previewItem.innerHTML = `
                        ${this.escapeHtml(gameData.name)} 
                        ${this.getStatusTag(gameData.status)}
                        (난이도: ${gameData.difficulty || '-'}, 인원: ${this.formatPlayerCount(gameData.minPlayers, gameData.maxPlayers)})
                    `;
                    this.elements.previewList.appendChild(previewItem);
                }
            }
            
            this.elements.previewCount.textContent = this.bulkGameData.length;
            this.elements.bulkPreview.classList.remove('hidden');
            this.elements.bulkSaveBtn.disabled = this.bulkGameData.length === 0;
            
            if (this.bulkGameData.length === 0) {
                this.showError('유효한 게임 데이터가 없습니다.');
            }
            
        } catch (error) {
            console.error('CSV 파싱 오류:', error);
            this.showError('CSV 데이터 형식이 올바르지 않습니다.');
        }
    }

    // 대량 데이터 저장
    async saveBulkData() {
        if (this.bulkGameData.length === 0) {
            this.showError('등록할 데이터가 없습니다.');
            return;
        }
        
        this.showLoading(true);
        
        try {
            let successCount = 0;
            let errorCount = 0;
            const errors = [];
            
            for (const gameData of this.bulkGameData) {
                try {
                    await window.boardGameAPI.addGame(gameData);
                    successCount++;
                } catch (error) {
                    console.error(`게임 "${gameData.name}" 등록 실패:`, error);
                    errors.push(`${gameData.name}: ${error.message}`);
                    errorCount++;
                }
            }
            
            this.closeBulkModal();
            
            if (errorCount === 0) {
                this.showSuccess(`${successCount}개의 게임이 성공적으로 등록되었습니다.`);
            } else {
                this.showSuccess(`${successCount}개 성공, ${errorCount}개 실패했습니다.`);
                if (errors.length > 0) {
                    console.error('등록 실패 목록:', errors);
                }
            }
            
            await this.loadGames();
            
        } catch (error) {
            console.error('대량 등록 실패:', error);
            this.showError('대량 등록에 실패했습니다.');
        }
        
        this.showLoading(false);
    }

    // CSV 라인 파서
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < line.length) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i += 2;
                } else {
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
                i++;
            } else {
                current += char;
                i++;
            }
        }
        
        result.push(current.trim());
        return result.map(field => field.replace(/^["']|["']$/g, ''));
    }

    // 모달 닫기 함수들
    closeModal() {
        this.elements.gameModal.classList.add('hidden');
        this.clearForm();
        this.editingGameId = null;
    }

    closeDeleteModal() {
        this.elements.deleteModal.classList.add('hidden');
        this.gameToDelete = null;
    }

    closeBulkModal() {
        this.elements.bulkModal.classList.add('hidden');
        this.bulkGameData = [];
    }

    // 폼 초기화
    clearForm() {
        this.elements.gameForm.reset();
    }

    // 통계 업데이트
    updateStats() {
        const stats = {
            total: this.allGames.length,
            new: this.allGames.filter(game => game.status === 'new').length,
            shipping: this.allGames.filter(game => game.status === 'shipping').length,
            purchasing: this.allGames.filter(game => game.status === 'purchasing').length,
            rented: this.allGames.filter(game => game.status === 'rented').length
        };
        
        this.elements.totalGames.textContent = stats.total;
        this.elements.newGames.textContent = stats.new;
        this.elements.shippingGames.textContent = stats.shipping;
        this.elements.purchasingGames.textContent = stats.purchasing;
        this.elements.rentedGames.textContent = stats.rented;
    }

    // 마지막 업데이트 시간 표시
    updateLastUpdateTime() {
        const now = new Date();
        this.elements.lastUpdate.textContent = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    // 유틸리티 함수들
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

    getGameStatusText(status) {
        const map = {
            new: '신상',
            shipping: '배송중',
            purchasing: '구매중',
            rented: '대여중'
        };
        return map[status] || '일반';
    }

    formatPlayerCount(min, max) {
        if (!min && !max) return '-';
        if (!max) return `${min}명+`;
        if (!min) return `~${max}명`;
        if (min === max) return `${min}명`;
        return `${min}-${max}명`;
    }

    formatBestPlayers(bestPlayers) {
        if (!bestPlayers) return '-';
        
        let bestStr = bestPlayers.toString().trim();
        bestStr = bestStr.replace(/["'`]/g, '');
        
        if (!bestStr) return '-';
        
        if (bestStr.includes(',') || bestStr.includes(';')) {
            return bestStr;
        } else {
            return bestStr + '명';
        }
    }

    formatDateShort(ts) {
        if (!ts) return '-';
        const date = this.getDate(ts);
        return date.toLocaleDateString('ko-KR');
    }

    getDate(ts) {
        if (!ts) return new Date(0);
        if (ts.toDate) return ts.toDate();
        if (ts.seconds) return new Date(ts.seconds * 1000);
        return new Date(ts);
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

    // 메시지 표시 함수들
    showLoading(show) {
        this.elements.loading.classList.toggle('show', show);
    }

    showError(message) {
        this.hideMessages();
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        setTimeout(() => this.hideError(), 5000);
    }

    showSuccess(message) {
        this.hideMessages();
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

    hideMessages() {
        this.hideError();
        this.hideSuccess();
    }
}

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 로드 완료');
    
    // Firebase API가 준비될 때까지 기다림
    function waitForAPI() {
        if (window.boardGameAPI && window.firebaseInitialized) {
            console.log('BoardGame API 준비 완료');
            // AdminManager 인스턴스 생성
            window.adminManager = new AdminManager();
        } else {
            console.log('BoardGame API 대기 중...');
            setTimeout(waitForAPI, 100);
        }
    }
    
    waitForAPI();
});