import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

// ES Module에서 __dirname 사용을 위한 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DB 파일 저장 경로 (프로젝트 루트의 store.db)
const dbPath = path.resolve(__dirname, "store.db");

// 데이터베이스 연결
export const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ 데이터베이스 연결 실패:", err.message);
  } else {
    console.log("✅ SQLite 데이터베이스에 연결되었습니다.");
  }
});

// 에러 이벤트 핸들러를 추가하여 emit된 에러의 상세를 기록
db.on("error", (err) => {
  console.error(
    "SQLite DB 'error' event emitted:",
    err && err.stack ? err.stack : err
  );
});

export const initDB = () => {
  db.serialize(() => {
    // 상품 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        description TEXT,
        category TEXT,
        imageUrl TEXT
      )
    `);

    // 회원 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        country TEXT DEFAULT 'KR'
      )
    `);

    // 마이그레이션: 기존 테이블에 country 컬럼이 없으면 추가
    db.all("PRAGMA table_info(users)", (err, cols) => {
      if (err) {
        console.error("PRAGMA table_info(users) 실패:", err.message);
        return;
      }
      const hasCountry = cols && cols.some((c) => c.name === "country");
      if (!hasCountry) {
        console.log(
          "users 테이블에 country 컬럼이 없어 추가합니다 (migration)"
        );
        db.run(
          "ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'KR'",
          (alterErr) => {
            if (alterErr)
              console.error("country 컬럼 추가 실패:", alterErr.message);
            else console.log("country 컬럼이 추가되었습니다.");
          }
        );
      }
    });

    // 장바구니 테이블
    db.run(`
      CREATE TABLE IF NOT EXISTS cart (
        user_email TEXT,
        product_id INTEGER,
        quantity INTEGER,
        PRIMARY KEY (user_email, product_id),
        FOREIGN KEY(user_email) REFERENCES users(email),
        FOREIGN KEY(product_id) REFERENCES products(id)
      )
    `);

    // [추가] 주문 테이블
    // items 컬럼에는 주문 당시의 상품 스냅샷을 JSON 문자열로 저장합니다.
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_email TEXT NOT NULL,
        date TEXT NOT NULL,
        total INTEGER NOT NULL,
        status TEXT NOT NULL,
        items TEXT NOT NULL, 
        FOREIGN KEY(user_email) REFERENCES users(email)
      )
    `);
  });
};
