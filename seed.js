import { db, initDB } from "./database.js";

// 테이블 생성 보장
initDB();

const categories = [
  "전자제품",
  "의류",
  "도서",
  "식품",
  "생활용품",
  "캠핑",
  "스포츠",
];
const adjectives = [
  "프리미엄",
  "초경량",
  "가성비",
  "친환경",
  "한정판",
  "AI탑재",
  "빈티지",
];
const nouns = [
  "무선 이어폰",
  "스마트 워치",
  "러닝화",
  "백팩",
  "유기농 커피",
  "텐트",
  "게이밍 마우스",
];

// 랜덤 데이터 생성 함수
const generateProducts = () => {
  const products = [];
  for (let i = 0; i < 50; i++) {
    const category = categories[i % categories.length];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];

    products.push({
      name: `${adj} ${noun}`,
      price: (Math.floor(Math.random() * 50) + 1) * 1000, // 1,000 ~ 50,000원
      description: `${category} 분야의 베스트셀러! ${adj} 감성을 담은 최고급 ${noun}입니다.`,
      category: category,
      imageUrl: `https://picsum.photos/400/400?random=${i + 500}`, // 랜덤 이미지 URL
    });
  }
  console.log(`Generated ${products.length} products.`);
  return products;
};

const seedData = () => {
  db.serialize(() => {
    const products = generateProducts();
    // 기존 데이터 삭제 (중복 방지) — 삭제가 완료된 후 삽입 시작
    db.run("DELETE FROM products", (err) => {
      if (err) {
        console.error("DELETE error:", err.message);
        return;
      }
      console.log("DELETE completed");

      const stmt = db.prepare(
        "INSERT INTO products (name, price, description, category, imageUrl) VALUES (?, ?, ?, ?, ?)"
      );

      // 새 데이터 삽입
      products.forEach((p) => {
        stmt.run(
          p.name,
          p.price,
          p.description,
          p.category,
          p.imageUrl,
          function (err) {
            if (err) console.error("Insert error:", err.message);
            else console.log(`Inserted row id=${this.lastID}`);
          }
        );
      });

      stmt.finalize((err) => {
        if (err) {
          console.error("❌ 데이터 삽입 중 오류 발생:", err.message);
        } else {
          console.log("✨ 상품 50개가 DB에 성공적으로 추가되었습니다.");
        }
        console.log("Starting db.close...");
        setTimeout(() => {
          db.close((closeErr) => {
            if (closeErr) {
              console.error(
                "❌ 데이터베이스 종료 중 오류 발생:",
                closeErr.message
              );
            } else {
              console.log("✅ 데이터베이스 연결이 종료되었습니다.");
            }
          });
        }, 10);
        console.log("db.close scheduled");
      });
    });
  });
};

seedData();
