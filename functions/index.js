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
const SHEET_ID = '1k30Bl76pYmpGazjFE0Lv4dR5JzsYBvSSFxfG2PG9bc4'; // 예시 ID - 실제로 변경 필요
const SHEET_NAME = 'Sheet1'; // 시트 이름
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

// 구글 스프레드시트에서 데이터 가져오기
async function fetchSheetData() {
  try {
    console.log('스프레드시트 URL:', SHEET_URL);
    
    const response = await axios.get(SHEET_URL, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    // Google Sheets 응답 파싱
    const jsonString = response.data.substring(47).slice(0, -2);
    const data = JSON.parse(jsonString);
    
    if (!data.table || !data.table.rows) {
      console.log('데이터 구조:', data);
      throw new Error('올바르지 않은 스프레드시트 데이터 구조');
    }
    
    const rows = data.table.rows;
    const headers = data.table.cols.map(col => col.label || col.id || `Column${col.index}`);
    
    console.log('헤더:', headers);
    console.log('행 개수:', rows.length);
    
    const formattedData = rows.map((row, rowIndex) => {
      const rowData = {};
      headers.forEach((header, index) => {
        const cell = row.c && row.c[index];
        rowData[header] = cell ? (cell.v !== null ? cell.v : '') : '';
      });
      rowData._rowIndex = rowIndex;
      return rowData;
    });
    
    console.log('포맷된 데이터 샘플:', formattedData.slice(0, 2));
    return formattedData;
    
  } catch (error) {
    console.error('스프레드시트 데이터 가져오기 실패:', error.message);
    console.error('오류 상세:', error.response?.status, error.response?.statusText);
    return [];
  }
}

// Firestore에 데이터 저장
async function saveDataToFirestore(data) {
  try {
    if (!data || data.length === 0) {
      console.log('저장할 데이터가 없습니다.');
      return;
    }
    
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
        id: index,
        lastUpdated: new Date().toISOString()
      });
    });
    
    await batch.commit();
    console.log(`${data.length}개의 데이터가 Firestore에 저장되었습니다.`);
    
  } catch (error) {
    console.error('Firestore 저장 실패:', error);
    throw error;
  }
}

// 데이터 업데이트 함수
async function updateData() {
  console.log('스프레드시트 데이터 업데이트 시작...');
  
  try {
    const data = await fetchSheetData();
    
    if (data.length > 0) {
      await saveDataToFirestore(data);
      console.log('데이터 업데이트 완료');
      return { success: true, count: data.length, timestamp: new Date().toISOString() };
    } else {
      console.log('가져온 데이터가 없습니다.');
      return { success: false, error: '데이터가 없습니다.', count: 0 };
    }
    
  } catch (error) {
    console.error('데이터 업데이트 실패:', error);
    return { success: false, error: error.message, count: 0 };
  }
}

// API 엔드포인트들
app.get('/data', async (req, res) => {
  try {
    const snapshot = await db.collection('boardgameData')
      .orderBy('id', 'asc')
      .get();
      
    const data = snapshot.docs.map(doc => {
      const docData = doc.data();
      // timestamp 필드는 클라이언트에서 제외
      const { timestamp, ...cleanData } = docData;
      return cleanData;
    });
    
    console.log(`${data.length}개의 데이터 반환`);
    res.json(data);
    
  } catch (error) {
    console.error('데이터 조회 실패:', error);
    res.status(500).json({ error: '데이터 조회 실패', details: error.message });
  }
});

// 데이터 강제 업데이트
app.post('/update', async (req, res) => {
  try {
    console.log('수동 데이터 업데이트 요청');
    const result = await updateData();
    res.json(result);
    
  } catch (error) {
    console.error('데이터 업데이트 실패:', error);
    res.status(500).json({ error: '데이터 업데이트 실패', details: error.message });
  }
});

// 검색 API
app.get('/search', async (req, res) => {
  try {
    const { q, field } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: '검색어가 필요합니다.' });
    }
    
    const snapshot = await db.collection('boardgameData').get();
    let data = snapshot.docs.map(doc => {
      const docData = doc.data();
      const { timestamp, ...cleanData } = docData;
      return cleanData;
    });
    
    const searchTerm = q.toLowerCase();
    
    data = data.filter(item => {
      if (field && item[field]) {
        return item[field].toString().toLowerCase().includes(searchTerm);
      } else {
        return Object.values(item).some(value => 
          value && value.toString().toLowerCase().includes(searchTerm)
        );
      }
    });
    
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
    const snapshot = await db.collection('boardgameData').get();
    let data = snapshot.docs.map(doc => {
      const docData = doc.data();
      const { timestamp, ...cleanData } = docData;
      return cleanData;
    });
    
    Object.keys(filters).forEach(key => {
      if (filters[key] && key !== 'timestamp' && key !== 'id' && key !== 'lastUpdated') {
        data = data.filter(item => 
          item[key] && item[key].toString().toLowerCase() === filters[key].toLowerCase()
        );
      }
    });
    
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
    sheetId: SHEET_ID,
    sheetName: SHEET_NAME
  });
});

// 정기적으로 데이터 업데이트 (매 10분마다)
exports.scheduledDataUpdate = functions.pubsub
  .schedule('every 10 minutes')
  .timeZone('Asia/Seoul')
  .onRun(async () => {
    console.log('스케줄된 데이터 업데이트 실행');
    await updateData();
    return null;
  });

// API 함수 내보내기
exports.api = functions.https.onRequest(app);

// 초기 데이터 로드 함수
exports.initData = functions.https.onCall(async () => {
  console.log('초기 데이터 로드 함수 호출');
  return await updateData();
});