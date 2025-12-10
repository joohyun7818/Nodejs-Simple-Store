import express from "express";
import cors from "cors";
import { db, initDB } from "./database.js";

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.use(cors()); // 모든 도메인에서의 요청 허용 (실제 배포시는 특정 도메인만 허용 권장)
app.use(express.json());

// 서버 시작 시 DB 테이블 확인
initDB();

// 기본 라우트 (서버 상태 확인용)
app.get("/", (req, res) => {
  res.send("AI Store API Server is Running!");
});

// [API] 상품 목록 조회 및 검색
app.get("/api/products", (req, res) => {
  const searchQuery = req.query.q;

  let sql = "SELECT * FROM products";
  let params = [];

  // 검색어가 있는 경우 필터링
  if (searchQuery) {
    sql += " WHERE name LIKE ? OR description LIKE ? OR category LIKE ?";
    const likeQuery = `%${searchQuery}%`;
    params = [likeQuery, likeQuery, likeQuery];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).json({ error: "데이터 조회 중 오류가 발생했습니다." });
      return;
    }
    // 프론트엔드 호환성을 위해 ID를 문자열로 변환
    const products = rows.map((row) => ({ ...row, id: row.id.toString() }));
    res.json(products);
  });
});

// [API] 회원가입
app.post("/api/register", (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: "모든 필드를 입력해주세요." });
  }

  const stmt = db.prepare(
    "INSERT INTO users (email, name, password) VALUES (?, ?, ?)"
  );

  stmt.run(email, name, password, function (err) {
    if (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        return res.status(409).json({ error: "이미 존재하는 이메일입니다." });
      }
      return res.status(500).json({ error: err.message });
    }
    // 회원가입 성공 시, 바로 로그인 처리된 것처럼 사용자 정보 반환
    res.json({ email, name });
  });
  stmt.finalize();
});

// [API] 로그인
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.get(
    "SELECT email, name FROM users WHERE email = ? AND password = ?",
    [email, password],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res
          .status(401)
          .json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
      }
      res.json(row);
    }
  );
});

// [API] 장바구니 조회 (상품 정보와 조인)
app.get("/api/cart", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "이메일이 필요합니다." });

  // cart 테이블과 products 테이블을 합쳐서, 상품 상세 정보까지 한 번에 가져옴
  const query = `
    SELECT p.*, c.quantity 
    FROM cart c 
    JOIN products p ON c.product_id = p.id 
    WHERE c.user_email = ?
  `;

  db.all(query, [email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    // id를 문자열로 변환
    const items = rows.map((row) => ({ ...row, id: row.id.toString() }));
    res.json(items);
  });
});

// [API] 장바구니 담기 (이미 있으면 수량 증가, 없으면 추가)
app.post("/api/cart/add", (req, res) => {
  const { email, productId } = req.body;

  // 1. 이미 담긴 상품인지 확인
  db.get(
    "SELECT quantity FROM cart WHERE user_email = ? AND product_id = ?",
    [email, productId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });

      if (row) {
        // 이미 있으면 수량 + 1
        db.run(
          "UPDATE cart SET quantity = quantity + 1 WHERE user_email = ? AND product_id = ?",
          [email, productId],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
          }
        );
      } else {
        // 없으면 새로 추가 (기본 수량 1)
        db.run(
          "INSERT INTO cart (user_email, product_id, quantity) VALUES (?, ?, 1)",
          [email, productId],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
          }
        );
      }
    }
  );
});

// [API] 수량 변경 (직접 변경)
app.post("/api/cart/update", (req, res) => {
  const { email, productId, quantity } = req.body;

  if (quantity <= 0) {
    // 수량이 0 이하면 삭제 처리
    db.run(
      "DELETE FROM cart WHERE user_email = ? AND product_id = ?",
      [email, productId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  } else {
    db.run(
      "UPDATE cart SET quantity = ? WHERE user_email = ? AND product_id = ?",
      [quantity, email, productId],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      }
    );
  }
});

// [API] 장바구니 아이템 삭제
app.delete("/api/cart/:email/:productId", (req, res) => {
  const { email, productId } = req.params;
  db.run(
    "DELETE FROM cart WHERE user_email = ? AND product_id = ?",
    [email, productId],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// [API] 장바구니 비우기 (주문 완료 시 사용)
app.delete("/api/cart/:email", (req, res) => {
  const { email } = req.params;
  db.run("DELETE FROM cart WHERE user_email = ?", [email], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// [API] 주문 내역 조회
app.get('/api/orders', (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  db.all("SELECT * FROM orders WHERE user_email = ? ORDER BY date DESC", [email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // DB에 텍스트로 저장된 items(JSON)를 다시 객체로 변환하여 응답
    const orders = rows.map(row => ({
      ...row,
      id: row.id.toString(), // ID를 문자열로 변환
      items: JSON.parse(row.items)
    }));
    
    res.json(orders);
  });
});

// [API] 주문 생성 (결제)
app.post('/api/orders', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: '이메일이 필요합니다.' });

  // 1. 트랜잭션 처리를 위해 serialize 사용 (SQLite는 기본적으로 단일 파일 락을 사용하므로 순차 실행됨)
  db.serialize(() => {
    // 1-1. 현재 장바구니 목록 조회 (상품 정보 조인)
    const queryCart = `
      SELECT p.*, c.quantity 
      FROM cart c 
      JOIN products p ON c.product_id = p.id 
      WHERE c.user_email = ?
    `;

    db.all(queryCart, [email], (err, cartItems) => {
      if (err) return res.status(500).json({ error: '장바구니 조회 실패' });
      if (cartItems.length === 0) return res.status(400).json({ error: '장바구니가 비어있습니다.' });

      // 1-2. 총 결제 금액 계산 및 데이터 준비
      const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const itemsJson = JSON.stringify(cartItems); // 주문 당시의 상품 정보를 스냅샷으로 저장
      const date = new Date().toISOString();
      const status = 'processing';

      // 1-3. 주문 테이블에 추가
      const stmt = db.prepare("INSERT INTO orders (user_email, date, total, status, items) VALUES (?, ?, ?, ?, ?)");
      stmt.run(email, date, total, status, itemsJson, function(err) {
        if (err) return res.status(500).json({ error: '주문 생성 실패' });
        
        const newOrderId = this.lastID; // 생성된 주문 ID

        // 1-4. 장바구니 비우기
        db.run("DELETE FROM cart WHERE user_email = ?", [email], (err) => {
          if (err) console.error('장바구니 비우기 실패', err);
          
          // 1-5. 성공 응답
          res.json({
            success: true,
            orderId: newOrderId.toString()
          });
        });
      });
      stmt.finalize();
    });
  });
});

// 서버 실행
app.listen(PORT, () => {
  console.log(
    `🚀 서버가 http://localhost:${PORT} 에서 정상적으로 실행 중입니다.`
  );
});
