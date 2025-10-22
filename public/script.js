class BoardGameViewer {
    constructor() {
        this.allGames = [];
        this.currentData = [];
        this.statusFilterActive = false; // 상태 필터 활성화 여부
        this.DEFAULT_IMAGE_URL = 'https://placehold.co/300x300/667eea/ffffff?text=No+Image';
        
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
            'gameGrid', 'detailModal', 'loading', 'errorMessage', 
            'successMessage', 'filter-sidebar', 'filter-overlay', 
            'close-filter-btn', 'open-filter-btn', 'sort-btn', 'game-count-badge',
            'statusFilterBtn' // 상태 필터 버튼 ID 추가
        ];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`Initialization Error: Element with ID '${id}' not found.`);
            }
            this.elements[id] = el;
        });
    }

    initialize() {
        this.setupEventListeners();
        this.initializeSliders();
        this.loadInitialData();
    }

    setupEventListeners() {
        const addListener = (element, event, handler) => element && element.addEventListener(event, handler);

        addListener(this.elements['open-filter-btn'], 'click', () => this.toggleFilterSidebar(true));
        addListener(this.elements['filter-overlay'], 'click', () => this.toggleFilterSidebar(false));
        addListener(this.elements['close-filter-btn'], 'click', () => this.toggleFilterSidebar(false));
        addListener(this.elements['sort-btn'], 'click', () => this.cycleSortOrder());
        addListener(this.elements['statusFilterBtn'], 'click', () => this.toggleStatusFilter()); // 상태 필터 이벤트 리스너 추가
        
        const filterInputs = ['nameSearchInput', 'genreSearchInput', 'playerCountInput', 'bestPlayerToggle'];
        filterInputs.forEach(id => {
            const el = this.elements[id];
            if (el) {
                const eventType = el.type === 'checkbox' ? 'change' : 'input';
                addListener(el, eventType, () => this.debounceSearch());
            }
        });

        window.openGameModal = (id) => this.openGameModal(id);
    }
    
    cycleSortOrder() {
        this.currentSortIndex = (this.currentSortIndex + 1) % this.sortOrders.length;
        this.elements['sort-btn'].textContent = `정렬: ${this.sortLabels[this.sortOrders[this.currentSortIndex]]}`;
        this.advancedSearchAndFilter();
    }

    updateGameCount() {
        this.elements['game-count-badge'].textContent = this.currentData.length;
    }
    
    toggleFilterSidebar(forceOpen) {
        this.elements['filter-sidebar']?.classList.toggle('open', forceOpen);
        this.elements['filter-overlay']?.classList.toggle('hidden', !forceOpen);
    }

    toggleStatusFilter() {
        this.statusFilterActive = !this.statusFilterActive;
        this.elements['statusFilterBtn'].classList.toggle('active', this.statusFilterActive);
        this.advancedSearchAndFilter();
    }
    
    async loadInitialData() {
        this.showLoading(true);
        try {
            this.allGames = await window.boardGameAPI.getAllGames();
            this.advancedSearchAndFilter();
        } catch (error) { 
            console.error("데이터 로딩 중 오류 발생:", error);
            this.showError('데이터를 불러오는 데 실패했습니다.');
        } 
        finally { this.showLoading(false); }
    }

    advancedSearchAndFilter() {
        let filtered = [...this.allGames];
        
        // 상태 필터 로직 추가
        if (this.statusFilterActive) {
            filtered = filtered.filter(g => g.status && g.status !== 'normal');
        }
        
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
                        return best.split(',').map(s => s.trim()).includes(String(playerCount));
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
                case 'name_asc': return (a.name || '').localeCompare(b.name || '', 'ko');
                case 'name_desc': return (b.name || '').localeCompare(a.name || '', 'ko');
                case 'difficulty_asc': return (a.difficulty || 0) - (b.difficulty || 0);
                case 'difficulty_desc': return (b.difficulty || 0) - (a.difficulty || 0);
                default: return 0;
            }
        });

        this.currentData = filtered;
        this.renderGridView();
        this.updateGameCount();
    }
        
    applySliderFilter(data, type) {
        const minEl = this.elements[`${type}Min`], maxEl = this.elements[`${type}Max`];
        if (!minEl || !maxEl) return data;

        const min = parseFloat(minEl.value), max = parseFloat(maxEl.value);
        const field = type === 'time' ? 'playTime' : 'difficulty';
        const defaultMin = parseFloat(minEl.min), defaultMax = parseFloat(maxEl.max);
        
        if (min === defaultMin && max === defaultMax) return data;

        return data.filter(game => {
            const value = parseFloat(game[field]) || 0;
            return value >= min && value <= (max === defaultMax ? Infinity : max);
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
        const statusInfo = this.getStatusInfo(item.status);
        const statusBadge = statusInfo ? `<div class="game-status-badge ${statusInfo.className}">${statusInfo.text}</div>` : '';

        return `
            <div class="game-card-grid" onclick="openGameModal('${item.id}')">
                <div class="game-image">
                    ${statusBadge}
                    <img src="${imageUrl}" alt="${title}" onerror="this.src='${this.DEFAULT_IMAGE_URL}'">
                </div>
                <div class="game-title-grid"><h3>${title}</h3></div>
            </div>`;
    }

    openGameModal(gameId) {
        const game = this.allGames.find(g => g.id === gameId);
        if (!game) return;
        
        const youtubeButton = game.youtubeUrl ? `<a href="${game.youtubeUrl}" target="_blank" rel="noopener noreferrer" class="youtube-btn">룰 설명 영상 보기</a>` : '';

        this.elements.detailModal.innerHTML = `
             <div class="modal-overlay" onclick="this.parentElement.classList.add('hidden')">
                <div class="detail-content" onclick="event.stopPropagation()">
                    <button onclick="this.closest('.modal').classList.add('hidden')" class="modal-close-btn">&times;</button>
                    <div class="modal-image">
                        <img src="${game.imageUrl || this.DEFAULT_IMAGE_URL}" alt="${this.escapeHtml(game.name)}">
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

    initializeSliders() {
        ['difficulty', 'time'].forEach(type => {
            const minInput = this.elements[`${type}Min`], maxInput = this.elements[`${type}Max`];
            const range = minInput?.parentElement.querySelector('.slider-range');
            if (!minInput || !maxInput || !range) return;
            const update = () => {
                let min = parseFloat(minInput.value), max = parseFloat(maxInput.value);
                if (min > max) { [min, max] = [max, min]; } // 값 스왑
                minInput.value = min; maxInput.value = max;

                const minPercent = ((min - minInput.min) / (minInput.max - minInput.min)) * 100;
                const maxPercent = ((max - maxInput.min) / (maxInput.max - minInput.min)) * 100;
                range.style.left = `${minPercent}%`; range.style.width = `${maxPercent - minPercent}%`;
                
                const formatValue = (val, isMax) => {
                    const num = type === 'difficulty' ? val.toFixed(1) : val.toFixed(0);
                    const suffix = type === 'time' ? (isMax && val == maxInput.max ? '분+' : '분') : '';
                    return num + suffix;
                };
                this.elements[`${type}MinValue`].textContent = formatValue(min, false);
                this.elements[`${type}MaxValue`].textContent = formatValue(max, true);
            };
            [minInput, maxInput].forEach(el => {
                el.addEventListener('input', update); 
                el.addEventListener('change', this.debounce(() => this.advancedSearchAndFilter(), 200));
            });
            update();
        });
    }
    
    debounceSearch = this.debounce(() => this.advancedSearchAndFilter(), 300);

    debounce(func, delay) {
        let timeout;
        return (...args) => { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), delay); };
    }

    escapeHtml(text) { return text != null ? String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])) : ''; }
    formatPlayerCount(min, max) { return min && max ? (min === max ? `${min}명` : `${min}-${max}명`) : (min ? `${min}명+` : (max ? `~${max}명` : '-')); }
    formatBestPlayers(best) { return best ? (String(best).includes(',') || String(best).includes('-') ? best : `${best}명`) : '-'; }
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