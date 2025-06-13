let allData = [];
let currentData = [];
let headers = [];
let currentView = 'grid';

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // Firebase 초기화 확인
    firebase.auth().onAuthStateChanged(() => {
        loadData();
    });
    
    // 5분마다 자동 새로고침
    setInterval(loadData, 300000);
});

// 데이터 로드
async function loadData() {
    showLoading(true);
    hideError();
    
    try {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('데이터 로드 실패');
        
        const data = await response.json();
        
        allData = data;
        currentData = data;
        
        if (data.length > 0) {
            headers = Object.keys(data[0]).filter(key => 
                key !== 'id' && key !== 'timestamp'
            );
            setupFilters();
        }
        
        renderData();
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('데이터 로드 실패:', error);
        showError('데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    
    showLoading(false);
}

// 데이터 강제 업데이트
async function forceUpdate() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/update', { method: 'POST' });
        if (!response.ok) throw new Error('업데이트 실패');
        
        const result = await response.json();
        console.log('데이터 업데이트 완료:', result);
        
        // 업데이트 후 데이터 다시 로드
        await loadData();
        
    } catch (error) {
        console.error('데이터 업데이트 실패:', error);
        showError('데이터 업데이트에 실패했습니다.');
    }
    
    showLoading(false);
}

// 뷰 전환 (그리드/테이블)
function toggleView(view) {
    currentView = view;
    
    const gridView = document.getElementById('gridView');
    const tableView = document.getElementById('tableView');
    const gridBtn = document.getElementById('gridViewBtn');
    const tableBtn = document.getElementById('tableViewBtn');
    
    if (view === 'grid') {
        gridView.style.display = 'block';
        tableView.style.display = 'none';
        gridBtn.classList.add('active');
        tableBtn.classList.remove('active');
    } else {
        gridView.style.display = 'none';
        tableView.style.display = 'block';
        tableBtn.classList.add('active');
        gridBtn.classList.remove('active');
    }
    
    renderData();
}

// 데이터 렌더링
function renderData() {
    if (currentView === 'grid') {
        renderGridView();
    } else {
        renderTableView();
    }
    
    updateDataCount();
}

// 그리드 뷰 렌더링
function renderGridView() {
    const gameGrid = document.getElementById('gameGrid');
    
    if (currentData.length === 0) {
        gameGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #666; font-size: 18px;">🎲 데이터가 없습니다</div>';
        return;
    }
    
    gameGrid.innerHTML = currentData.map(item => {
        const title = item[headers[0]] || '제목 없음';
        
        return `
            <div class="game-card">
                <h3>${title}</h3>
                ${headers.slice(1).map(header => {
                    const value = item[header] || '-';
                    return `
                        <div class="field">
                            <span class="field-label">${header}:</span>
                            <span class="field-value">${value}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

// 테이블 뷰 렌더링
function renderTableView() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    // 헤더 생성
    if (headers.length > 0) {
        tableHead.innerHTML = `
            <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
        `;
    }
    
    // 데이터 행 생성
    if (currentData.length > 0) {
        tableBody.innerHTML = currentData.map(row => `
            <tr>
                ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
            </tr>
        `).join('');
    } else {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${headers.length}" style="text-align: center; padding: 60px; color: #666; font-size: 18px;">
                    🎲 데이터가 없습니다
                </td>
            </tr>
        `;
    }
}

// 필터 옵션 설정
function setupFilters() {
    const searchField = document.getElementById('searchField');
    const filterField = document.getElementById('filterField');
    
    // 검색 필드 옵션
    searchField.innerHTML = '<option value="">전체 필드</option>' + 
        headers.map(header => `<option value="${header}">${header}</option>`).join('');
    
    // 필터 필드 옵션
    filterField.innerHTML = '<option value="">필터 선택</option>' + 
        headers.map(header => `<option value="${header}">${header}</option>`).join('');
    
    // 필터 필드 변경 시 값 옵션 업데이트
    filterField.addEventListener('change', updateFilterValues);
}

// 필터 값 옵션 업데이트
function updateFilterValues() {
    const filterField = document.getElementById('filterField').value;
    const filterValue = document.getElementById('filterValue');
    
    if (!filterField) {
        filterValue.innerHTML = '<option value="">값 선택</option>';
        return;
    }
    
    const uniqueValues = [...new Set(
        allData.map(item => item[filterField])
            .filter(value => value && value.toString().trim() !== '')
    )].sort();
    
    filterValue.innerHTML = '<option value="">값 선택</option>' + 
        uniqueValues.map(value => `<option value="${value}">${value}</option>`).join('');
}

// 검색 기능
async function searchData() {
    const searchInput = document.getElementById('searchInput').value.trim();
    const searchField = document.getElementById('searchField').value;
    
    if (!searchInput) {
        currentData = allData;
        renderData();
        return;
    }
    
    showLoading(true);
    
    try {
        const params = new URLSearchParams();
        params.append('q', searchInput);
        if (searchField) params.append('field', searchField);
        
        const response = await fetch(`/api/search?${params}`);
        if (!response.ok) throw new Error('검색 실패');
        
        const data = await response.json();
        currentData = data;
        renderData();
        
    } catch (error) {
        console.error('검색 실패:', error);
        showError('검색에 실패했습니다.');
    }
    
    showLoading(false);
}

// 필터 기능
async function filterData() {
    const filterField = document.getElementById('filterField').value;
    const filterValue = document.getElementById('filterValue').value;
    
    if (!filterField || !filterValue) {
        showError('필터 조건을 선택해주세요.');
        return;
    }
    
    showLoading(true);
    
    try {
        const params = new URLSearchParams();
        params.append(filterField, filterValue);
        
        const response = await fetch(`/api/filter?${params}`);
        if (!response.ok) throw new Error('필터링 실패');
        
        const data = await response.json();
        currentData = data;
        renderData();
        
    } catch (error) {
        console.error('필터링 실패:', error);
        showError('필터링에 실패했습니다.');
    }
    
    showLoading(false);
}

// 필터 및 검색 초기화
function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchField').value = '';
    document.getElementById('filterField').value = '';
    document.getElementById('filterValue').innerHTML = '<option value="">값 선택</option>';
    
    currentData = allData;
    renderData();
}

// 데이터 개수 업데이트
function updateDataCount() {
    const totalCount = document.getElementById('totalCount');
    totalCount.textContent = `총 ${currentData.length}개`;
}

// 로딩 표시/숨김
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('show', show);
}

// 에러 메시지 표시
function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.getElementById('errorText');
    
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    
    // 5초 후 자동으로 숨김
    setTimeout(hideError, 5000);
}

// 에러 메시지 숨김
function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.display = 'none';
}

// 마지막 업데이트 시간 표시
function updateLastUpdateTime() {
    const lastUpdate = document.getElementById('lastUpdate');
    const now = new Date();
    lastUpdate.textContent = now.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 엔터키로 검색
document.addEventListener('keypress', function(e) {
    if (e.target.id === 'searchInput' && e.key === 'Enter') {
        searchData();
    }
});

// 검색 입력 실시간 처리 (디바운싱)
let searchTimeout;
document.getElementById('searchInput').addEventListener('input', function() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (this.value.trim() === '') {
            clearFilters();
        }
    }, 500);
});