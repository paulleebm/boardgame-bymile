// ... existing code ...
    setupModalEvents(type, id) {
        const modal = this.elements['modal-container'].querySelector('.modal-overlay');
        modal.querySelector('.save-btn').addEventListener('click', () => this.saveItem(type, id, modal));
        modal.querySelectorAll('.close-btn').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    }

    async saveItem(type, id, modal) {
        const data = {};
        modal.querySelectorAll('input, textarea, select').forEach(input => {
            const name = input.name;
            let value = input.value;
            
            if (input.type !== 'select-one') {
                value = value.trim();
            }

            if (input.type === 'number') {
                // 숫자 필드가 비어있으면 null로 저장, 아니면 숫자로 변환
                data[name] = value === '' ? null : Number(value);
            } else {
                data[name] = value;
            }
        });

        // API 호출 및 로딩 전에 유효성 검사 수행
        if (type === 'game') {
            if (!data.name) {
                alert("게임 이름은 필수입니다.");
                return; 
            }
        } else if (type === 'post') {
            if (!data.title) {
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
// ... existing code ...
