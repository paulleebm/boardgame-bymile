const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 컬렉션 이름
const COLLECTION_NAME = 'boardgames';

// 모든 보드게임 데이터 조회
app.get('/data', async (req, res) => {
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .orderBy('createdAt', 'desc')
      .get();
      
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`${data.length}개의 보드게임 데이터 반환`);
    res.json(data);
    
  } catch (error) {
    console.error('데이터 조회 실패:', error);
    res.status(500).json({ error: '데이터 조회 실패', details: error.message });
  }
});

// 특정 보드게임 데이터 조회
app.get('/data/:id', async (req, res) => {
  try {
    const doc = await db.collection(COLLECTION_NAME).doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: '데이터를 찾을 수 없습니다.' });
    }
    
    res.json({
      id: doc.id,
      ...doc.data()
    });
    
  } catch (error) {
    console.error('데이터 조회 실패:', error);
    res.status(500).json({ error: '데이터 조회 실패', details: error.message });
  }
});

// 새 보드게임 데이터 추가
app.post('/data', async (req, res) => {
  try {
    const gameData = {
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection(COLLECTION_NAME).add(gameData);
    
    const newDoc = await docRef.get();
    const result = {
      id: newDoc.id,
      ...newDoc.data()
    };
    
    console.log('새 보드게임 데이터 추가:', docRef.id);
    res.status(201).json(result);
    
  } catch (error) {
    console.error('데이터 추가 실패:', error);
    res.status(500).json({ error: '데이터 추가 실패', details: error.message });
  }
});

// 보드게임 데이터 수정
app.put('/data/:id', async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: '데이터를 찾을 수 없습니다.' });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await docRef.update(updateData);
    
    const updatedDoc = await docRef.get();
    const result = {
      id: updatedDoc.id,
      ...updatedDoc.data()
    };
    
    console.log('보드게임 데이터 수정:', req.params.id);
    res.json(result);
    
  } catch (error) {
    console.error('데이터 수정 실패:', error);
    res.status(500).json({ error: '데이터 수정 실패', details: error.message });
  }
});

// 보드게임 데이터 삭제
app.delete('/data/:id', async (req, res) => {
  try {
    const docRef = db.collection(COLLECTION_NAME).doc(req.params.id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: '데이터를 찾을 수 없습니다.' });
    }
    
    await docRef.delete();
    
    console.log('보드게임 데이터 삭제:', req.params.id);
    res.json({ message: '데이터가 삭제되었습니다.', id: req.params.id });
    
  } catch (error) {
    console.error('데이터 삭제 실패:', error);
    res.status(500).json({ error: '데이터 삭제 실패', details: error.message });
  }
});

// 검색 API
app.get('/search', async (req, res) => {
  try {
    const { q, field } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }
    
    let query = db.collection(COLLECTION_NAME);
    
    // 특정 필드에서 검색
    if (field) {
      query = query.where(field, '>=', q)
                   .where(field, '<=', q + '\uf8ff');
    }
    
    const snapshot = await query.get();
    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // 전체 필드 검색인 경우 클라이언트에서 필터링
    if (!field) {
      const searchTerm = q.toLowerCase();
      data = data.filter(item => {
        return Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchTerm)
        );
      });
    }
    
    console.log(`검색 "${q}" 결과: ${data.length}개`);
    res.json(data);
    
  } catch (error) {
    console.error('검색 실패:', error);
    res.status(500).json({ error: '검색 실패', details: error.message });
  }
});

// 필터 API
app.get('/filter', async (req, res) => {
  try {
    const filters = req.query;
    let query = db.collection(COLLECTION_NAME);
    
    // 필터 조건 적용
    Object.keys(filters).forEach(key => {
      if (filters[key] && key !== 'createdAt' && key !== 'updatedAt') {
        query = query.where(key, '==', filters[key]);
      }
    });
    
    const snapshot = await query.get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`필터 결과: ${data.length}개`);
    res.json(data);
    
  } catch (error) {
    console.error('필터링 실패:', error);
    res.status(500).json({ error: '필터링 실패', details: error.message });
  }
});

// 헬스 체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    database: 'firestore'
  });
});

// API 함수 내보내기
exports.api = functions.https.onRequest(app);