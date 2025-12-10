import * as optimizely from "@optimizely/optimizely-sdk";

// 기본 국가 코드 설정
export const DEFAULT_COUNTRY = 'KR';

/**
 * Optimizely SDK 설정 및 초기화
 * 
 * 이 모듈은 Optimizely Feature Experimentation을 통해
 * 사용자의 국가(country) 속성에 기반한 A/B 테스트를 수행합니다.
 */

// 실험 설정 (중복 방지를 위해 상수로 추출)
const experimentConfig = {
  status: "Running",
  key: "store_ui_experiment",
  layerId: "layer_1",
  trafficAllocation: [
    {
      entityId: "variation_1",
      endOfRange: 5000
    },
    {
      entityId: "variation_2",
      endOfRange: 10000
    }
  ],
  audienceIds: [],
  variations: [
    {
      variables: [],
      id: "variation_1",
      key: "control",
      featureEnabled: true
    },
    {
      variables: [],
      id: "variation_2",
      key: "variant_b",
      featureEnabled: true
    }
  ],
  forcedVariations: {},
  id: "store_ui_experiment"
};

// Optimizely SDK 데이터파일 (간단한 예시)
// 실제 운영 환경에서는 Optimizely 대시보드에서 생성된 SDK Key를 사용하거나
// 데이터파일 URL을 통해 동적으로 로드해야 합니다.
const datafile = {
  version: "4",
  rollouts: [],
  typedAudiences: [],
  anonymizeIP: false,
  projectId: "nodejs-simple-store",
  variables: [],
  featureFlags: [
    {
      experimentIds: ["store_ui_experiment"],
      rolloutId: "",
      variables: [],
      id: "store_ui_variant",
      key: "store_ui_variant"
    }
  ],
  experiments: [experimentConfig],
  audiences: [],
  groups: [],
  attributes: [
    {
      id: "country",
      key: "country"
    }
  ],
  accountId: "nodejs-simple-store-account",
  layers: [
    {
      id: "layer_1",
      experiments: [experimentConfig]
    }
  ],
  revision: "1"
};

// Optimizely 클라이언트 인스턴스 생성
let optimizelyClient = null;

/**
 * Optimizely 클라이언트를 초기화합니다.
 */
export const initOptimizely = () => {
  try {
    // Static config manager 생성
    const configManager = optimizely.createStaticProjectConfigManager({
      datafile: datafile
    });
    
    optimizelyClient = optimizely.createInstance({
      projectConfigManager: configManager
    });
    
    console.log("✅ Optimizely SDK가 초기화되었습니다.");
    return optimizelyClient;
  } catch (error) {
    console.error("❌ Optimizely SDK 초기화 실패:", error.message);
    console.error("Error stack:", error.stack);
    return null;
  }
};

/**
 * 사용자의 속성을 기반으로 Optimizely decision을 수행합니다.
 * 
 * @param {string} userId - 사용자 ID (이메일 등)
 * @param {string} country - 사용자의 국가 코드 (예: 'KR', 'US', 'JP')
 * @returns {object} - decision 결과 및 variation 정보
 */
export const decideVariant = (userId, country) => {
  if (!optimizelyClient) {
    console.warn("Optimizely 클라이언트가 초기화되지 않았습니다.");
    return {
      variant: "control",
      enabled: true
    };
  }

  try {
    const user = optimizelyClient.createUserContext(userId, {
      country: country
    });

    const decision = user.decide("store_ui_variant");

    console.log(`🎯 User ${userId} (country: ${country}) => Variant: ${decision.variationKey}`);

    return {
      variant: decision.variationKey || "control",
      enabled: decision.enabled,
      flagKey: decision.flagKey,
      ruleKey: decision.ruleKey,
      reasons: decision.reasons
    };
  } catch (error) {
    console.error("❌ Optimizely decide 오류:", error.message);
    return {
      variant: "control",
      enabled: true
    };
  }
};

/**
 * Variant에 따른 UI 설정을 반환합니다.
 * 
 * @param {string} variant - 'control' 또는 'variant_b'
 * @returns {object} - UI 커스터마이제이션 설정
 */
export const getUIConfig = (variant) => {
  const configs = {
    control: {
      theme: "default",
      primaryColor: "#007bff",
      showDiscount: false,
      featuredCategories: ["전자제품", "의류", "도서"],
      headerMessage: "AI Store에 오신 것을 환영합니다!"
    },
    variant_b: {
      theme: "modern",
      primaryColor: "#28a745",
      showDiscount: true,
      featuredCategories: ["캠핑", "스포츠", "생활용품"],
      headerMessage: "🎉 특별 할인 이벤트 진행중!"
    }
  };

  return configs[variant] || configs.control;
};

// 초기화 (모듈 로드 시 자동 실행)
initOptimizely();
