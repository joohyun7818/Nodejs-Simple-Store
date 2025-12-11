# Optimizely SDK Integration

이 문서는 Node.js Simple Store에 통합된 Optimizely SDK의 사용 방법을 설명합니다.

## 개요

Optimizely SDK를 사용하여 사용자의 국가(country) 속성을 기반으로 A/B 테스트를 수행하고, 각 variant에 따라 다른 UI 설정을 제공합니다.

## 주요 기능

- **세션 시작 시 자동 결정**: 사용자가 회원가입하거나 로그인할 때 Optimizely가 자동으로 variant를 결정합니다.
- **국가 기반 속성**: 사용자의 국가 코드를 attribute로 저장하여 실험에 활용합니다.
- **Variant별 UI 커스터마이제이션**: 각 variant에 따라 다른 테마, 색상, 메시지, 카테고리를 제공합니다.
- **PollingConfigManager**: 환경 변수로 SDK Key 또는 Datafile URL을 제공하면 자동으로 datafile을 주기적으로 업데이트합니다.

## 구현 내용

### 1. 환경 변수 설정

`.env` 파일을 생성하여 Optimizely SDK 설정을 구성할 수 있습니다:

```bash
# Option 1: SDK Key 사용 (권장)
OPTIMIZELY_SDK_KEY=your_sdk_key_here

# Option 2: Datafile URL 사용
# OPTIMIZELY_DATAFILE_URL=https://cdn.optimizely.com/datafiles/your_datafile_url
```

환경 변수가 설정되지 않으면 StaticConfigManager가 사용되며, 설정되면 PollingConfigManager가 자동으로 활성화되어 5분마다 datafile을 업데이트합니다.

### 2. 데이터베이스 스키마 변경

`users` 테이블에 `country` 컬럼 추가:
```sql
country TEXT DEFAULT 'KR'
```

### 3. API 엔드포인트 변경

#### 회원가입 (`POST /api/register`)

**요청 예시:**
```json
{
  "email": "user@example.com",
  "name": "홍길동",
  "password": "password123",
  "country": "KR"  // 선택사항, 기본값: "KR"
}
```

**응답 예시:**
```json
{
  "email": "user@example.com",
  "name": "홍길동",
  "country": "KR",
  "variant": "v1",
  "uiConfig": {
    "theme": "default",
    "primaryColor": "#007bff",
    "showDiscount": false,
    "featuredCategories": ["전자제품", "의류", "도서"],
    "headerMessage": "AI Store에 오신 것을 환영합니다!"
  }
}
```

#### 로그인 (`POST /api/login`)

**요청 예시:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**응답 예시:**
```json
{
  "email": "user@example.com",
  "name": "홍길동",
  "country": "KR",
  "variant": "v2",
  "uiConfig": {
    "theme": "modern",
    "primaryColor": "#28a745",
    "showDiscount": true,
    "featuredCategories": ["캠핑", "스포츠", "생활용품"],
    "headerMessage": "🎉 특별 할인 이벤트 진행중!"
  }
}
```

## Variant 종류

### v1 (기본)
- **테마**: default
- **주 색상**: #007bff (파란색)
- **할인 표시**: 없음
- **추천 카테고리**: 전자제품, 의류, 도서
- **헤더 메시지**: "AI Store에 오신 것을 환영합니다!"

### v2
- **테마**: modern
- **주 색상**: #28a745 (녹색)
- **할인 표시**: 있음
- **추천 카테고리**: 캠핑, 스포츠, 생활용품
- **헤더 메시지**: "🎉 특별 할인 이벤트 진행중!"

## 실험 구성

현재 설정된 실험:
- **실험 이름**: `store_ui_experiment`
- **Feature Flag**: `test1`
- **Variations**: `v1`, `v2`
- **Traffic Allocation**: 50/50 split (v1 vs v2)
- **사용자 속성**: `country` (국가 코드)

## 프론트엔드 통합 예시

로그인/회원가입 응답에서 받은 `uiConfig`를 활용하여 UI를 커스터마이징:

```javascript
// 로그인 후
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const data = await response.json();

// UI 적용
document.documentElement.style.setProperty('--primary-color', data.uiConfig.primaryColor);
document.querySelector('.header-message').textContent = data.uiConfig.headerMessage;

if (data.uiConfig.showDiscount) {
  document.querySelector('.discount-banner').style.display = 'block';
}

// 추천 카테고리 표시
displayFeaturedCategories(data.uiConfig.featuredCategories);
```

## 설정 변경

### 기본 국가 변경
`optimizely.js`의 `DEFAULT_COUNTRY` 상수를 수정:
```javascript
export const DEFAULT_COUNTRY = 'US'; // 미국으로 변경
```

### 실험 설정 변경

#### 운영 환경 (PollingConfigManager 사용)
실제 운영 환경에서는 Optimizely 대시보드에서 실험을 생성하고, 환경 변수를 통해 SDK를 구성:

1. Optimizely 대시보드에서 프로젝트 생성
2. SDK Key 또는 Datafile URL 획득
3. 환경 변수 설정:
```bash
export OPTIMIZELY_SDK_KEY=your_actual_sdk_key
# 또는
export OPTIMIZELY_DATAFILE_URL=https://cdn.optimizely.com/datafiles/your_datafile_url
```
4. 서버 시작 - PollingConfigManager가 자동으로 활성화되어 5분마다 datafile을 업데이트

#### 개발 환경 (StaticConfigManager 사용)
환경 변수 없이 서버를 시작하면 StaticConfigManager가 사용되며, 코드에 하드코딩된 datafile로 동작합니다.

## 로깅

서버 로그에서 각 사용자의 variant 할당을 확인할 수 있습니다:
```
🎯 User user@example.com (country: KR) => Variant: v1
```

서버 시작 시 어떤 ConfigManager가 사용되는지도 확인할 수 있습니다:
```
🔄 PollingConfigManager를 사용하여 Optimizely SDK를 초기화합니다.
# 또는
📋 StaticConfigManager를 사용하여 Optimizely SDK를 초기화합니다.
```

## 주의사항

1. **환경 변수 관리**:
   - `.env` 파일을 사용하는 경우 `.gitignore`에 포함되어 있는지 확인
   - 실제 SDK Key나 URL을 코드에 직접 하드코딩하지 말 것
   - `.env.example` 파일을 참고하여 환경 변수 설정

2. **PollingConfigManager**:
   - 기본 업데이트 간격은 5분 (300,000ms)
   - SDK Key 또는 Datafile URL 중 하나만 제공하면 됨
   - SDK Key가 있으면 우선적으로 사용됨

3. **사용자 Variant 할당**:
   - 사용자 ID(이메일)를 기반으로 일관되게 할당됨
   - 동일한 사용자는 항상 동일한 variant를 받음

4. **국가 코드**:
   - ISO 3166-1 alpha-2 형식 권장 (예: KR, US, JP)
   - 기본값은 'KR'로 설정되어 있음
