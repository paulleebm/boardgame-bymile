const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const axios = require('axios');

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// 구글 스프레드시트 설정
const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID'; // 여기에 실제 스프레드시트 ID 입력
const SHEET_NAME = 'Sheet1'; // 시트 이름
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

// 구글 스프레드시트에서 데이터 가져오기
async function fetchSheetData() {
  try {
    const response = await axios.get(SHEET_URL);
    const jsonString = response.data.substring(47).slice(0, -2);
    const data = JSON.parse(jsonString);
    
    const rows = data.table.rows;
    const headers = data.table.cols.map(col => col.label || col.id);
    
    const formattedData = rows.map(row => {
      const rowData = {};
      row.c.forEach((cell, index) => {
        rowData[headers[index]] = cell ? cell.v : '';
      });
      return rowData;
    });
    
    return formattedData;
  } catch (error) {
    console.error('스프레드시트 데이터 가져오기 실패:', error);
    return [];
  }
}

// Firestore에 데이터 저장
async function saveDataToFirestore(data) {
  try {
    const batch = db.batch();
    const collectionRef = db.collection('boardgameData');
    
    // 기존 데이터 삭제
    const snapshot = await collectionRef.get();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 새 데이터 추가
    data.forEach((item, index) => {
      const docRef = collectionRef.doc(`row_${index}`);
      batch.set(docRef, {
        ...item,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        id: index
      });
    });
    
    await batch.commit();
    console.log('데이터가 Firestore에 저장되었습니다.');
  } catch (error) {
    console.error('Firestore 저장 실패:', error);
  }
}

// 데이터 업데이트 함수
async function updateData() {
  console.log('스프레드시트 데이터 업데이트 중...');
  const data = await fetchSheetData();
  if (data.length > 0) {
    await saveDataToFirestore(data);
  }
  return data;
}

// API 엔드포인트들
app.get('/data', async (req, res) => {
  try {
    const snapshot = await db.collection('boardgameData').get();
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(data);
  } catch (error) {
    console.error('데이터 조회 실패:', error);
    res.status(500).json({ error: '데이터 조회 실패' });
  }
});

// 데이터 강제 업데이트
app.post('/update', async (req, res) => {
  try {
    const data = await updateData();
    res.json({ success: true, count: data.length });
  } catch (error) {
    console.error('데이터 업데이트 실패:', error);
    res.status(500).json({ error: '데이터 업데이트 실패' });
  }
});

// 검색 API
app.get('/search', async (req, res) => {
  try {
    const { q, field } = req.query;
    const snapshot = await db.collection('boardgameData').get();
    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    if (q) {
      data = data.filter(item => {
        if (field && item[field]) {
          return item[field].toString().toLowerCase().includes(q.toLowerCase());
        } else {
          return Object.values(item).some(value => 
            value && value.toString().toLowerCase().includes(q.toLowerCase())
          );
        }
      });
    }
    
    res.json(data);
  } catch (error) {
    console.error('검색 실패:', error);
    res.status(500).json({ error: '검색 실패' });
  }
});

// 필터 API
app.get('/filter', async (req, res) => {
  try {
    const filters = req.query;
    const snapshot = await db.collection('boardgameData').get();
    let data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && key !== 'timestamp' && key !== 'id') {
        data = data.filter(item => 
          item[key] && item[key].toString().toLowerCase() === filters[key].toLowerCase()
        );
      }
    });
    
    res.json(data);
  } catch (error) {
    console.error('필터링 실패:', error);
    res.status(500).json({ error: '필터링 실패' });
  }
});

// 정기적으로 데이터 업데이트 (매 5분마다)
exports.scheduledDataUpdate = functions.pubsub.schedule('every 5 minutes').onRun(async () => {
  await updateData();
  return null;
});

// API 함수 내보내기
exports.api = functions.https.onRequest(app);

// 초기 데이터 로드 함수
exports.initData = functions.https.onCall(async () => {
  return await updateData();
});