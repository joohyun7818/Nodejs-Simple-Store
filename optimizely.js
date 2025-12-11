import * as optimizely from "@optimizely/optimizely-sdk";

// 기본 국가 코드 설정
export const DEFAULT_COUNTRY = "KR";

// 환경 변수에서 Optimizely SDK 설정 가져오기
// NODE_ENV에 따라 적절한 키 선택 (development 환경에서는 _DEV 접미사 키 사용)
const isDevelopment = process.env.NODE_ENV === "development";
const OPTIMIZELY_SDK_KEY = isDevelopment
  ? process.env.OPTIMIZELY_SDK_KEY_DEV
  : process.env.OPTIMIZELY_SDK_KEY;
const OPTIMIZELY_DATAFILE_URL = isDevelopment
  ? process.env.OPTIMIZELY_DATAFILE_URL_DEV
  : process.env.OPTIMIZELY_DATAFILE_URL;

// Decision flag key
const HEADER_COLOR_FLAG_KEY = process.env.HEADER_COLOR_FLAG_KEY || "test1";

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
      endOfRange: 5000,
    },
    {
      entityId: "variation_2",
      endOfRange: 10000,
    },
  ],
  audienceIds: [],
  variations: [
    {
      variables: [],
      id: "variation_1",
      key: "v1",
      featureEnabled: true,
    },
    {
      variables: [],
      id: "variation_2",
      key: "v2",
      featureEnabled: true,
    },
  ],
  forcedVariations: {},
  id: "store_ui_experiment",
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
      id: "test1",
      key: "test1",
    },
  ],
  experiments: [{ ...experimentConfig }],
  audiences: [],
  groups: [],
  attributes: [
    {
      id: "country",
      key: "country",
    },
  ],
  accountId: "nodejs-simple-store-account",
  layers: [
    {
      id: "layer_1",
      experiments: [{ ...experimentConfig }],
    },
  ],
  revision: "1",
};

// Optimizely 클라이언트 인스턴스 (싱글톤)
let optimizelyClient = null;

/**
 * Optimizely 클라이언트를 초기화합니다.
 */
export const initOptimizely = () => {
  // 이미 초기화된 경우 기존 인스턴스 반환
  if (optimizelyClient) {
    return optimizelyClient;
  }

  try {
    let configManager;

    // SDK Key와 Datafile URL이 환경 변수로 제공되면 PollingConfigManager 사용
    if (OPTIMIZELY_SDK_KEY || OPTIMIZELY_DATAFILE_URL) {
      const envType = isDevelopment ? "development" : "production";
      console.log(
        `🔄 PollingConfigManager를 사용하여 Optimizely SDK를 초기화합니다. (환경: ${envType})`
      );

      const pollingOptions = {
        updateInterval: 300000, // 5분마다 업데이트 (밀리초 단위)
        autoUpdate: true,
      };

      // SDK Key가 있으면 우선 사용
      if (OPTIMIZELY_SDK_KEY) {
        pollingOptions.sdkKey = OPTIMIZELY_SDK_KEY;
        // SDK Key 마스킹 (일관된 형식으로 표시)
        const maskedKey =
          OPTIMIZELY_SDK_KEY.length > 12
            ? OPTIMIZELY_SDK_KEY.substring(0, 8) +
              "..." +
              OPTIMIZELY_SDK_KEY.substring(OPTIMIZELY_SDK_KEY.length - 4)
            : "***...***";
        console.log(`   - SDK Key: ${maskedKey}`);
      }
      // 그렇지 않고 Datafile URL이 있으면 사용
      else if (OPTIMIZELY_DATAFILE_URL) {
        pollingOptions.datafileUrl = OPTIMIZELY_DATAFILE_URL;
        // URL 마스킹 (도메인만 표시)
        try {
          const url = new URL(OPTIMIZELY_DATAFILE_URL);
          console.log(`   - Datafile URL: ${url.origin}/***`);
        } catch {
          console.log(`   - Datafile URL: ***`);
        }
      }

      configManager =
        optimizely.createPollingProjectConfigManager(pollingOptions);
    } else {
      // 환경 변수가 없으면 Static config manager 사용 (fallback)
      console.log(
        "📋 StaticConfigManager를 사용하여 Optimizely SDK를 초기화합니다."
      );
      configManager = optimizely.createStaticProjectConfigManager({
        datafile: datafile,
      });
    }

    // Configure event processor explicitly
    // - In development: default to forwarding processor for immediate event dispatch to Optimizely
    // - In production: default to batch processor to reduce network calls; configurable via env vars
    let eventProcessor = null;

    const envEventProcessor =
      process.env.OPTIMIZELY_EVENT_PROCESSOR ||
      (isDevelopment ? "forwarding" : "batch");

    if (envEventProcessor === "forwarding") {
      console.log(
        "➡️ Using ForwardingEventProcessor (immediate event dispatch)"
      );
      eventProcessor = optimizely.createForwardingEventProcessor();
    } else {
      const batchSize = parseInt(
        process.env.OPTIMIZELY_EVENT_BATCH_SIZE || "10",
        10
      );
      const flushInterval = parseInt(
        process.env.OPTIMIZELY_EVENT_FLUSH_INTERVAL || "1000",
        10
      );
      console.log(
        `➡️ Using BatchEventProcessor (batchSize=${batchSize}, flushInterval=${flushInterval})`
      );
      eventProcessor = optimizely.createBatchEventProcessor({
        batchSize: batchSize,
        flushInterval: flushInterval,
      });
    }

    optimizelyClient = optimizely.createInstance({
      projectConfigManager: configManager,
      eventProcessor: eventProcessor,
    });

    console.log("✅ Optimizely SDK가 초기화되었습니다.");

    // Graceful shutdown: ensure queued events are flushed
    if (optimizelyClient && typeof optimizelyClient.close === "function") {
      const flushAndExit = async (signal) => {
        try {
          console.log(
            `🛑 Received ${signal}. Closing Optimizely client to flush events...`
          );
          await optimizelyClient.close();
          console.log("🧾 Optimizely client closed, events flushed.");
        } catch (err) {
          console.error(
            "Error while closing Optimizely client:",
            err?.message || err
          );
        }
        // Do not force exit here; process may have other cleanup handlers
      };

      process.on("SIGINT", () => flushAndExit("SIGINT"));
      process.on("SIGTERM", () => flushAndExit("SIGTERM"));
    }
    return optimizelyClient;
  } catch (error) {
    console.error("❌ Optimizely SDK 초기화 실패:", error.message);
    console.error("Error stack:", error.stack);
    return null;
  }
};

/**
 * Optimizely 클라이언트 인스턴스를 가져옵니다.
 * @returns {object|null} Optimizely 클라이언트 인스턴스
 */
const getOptimizelyClient = () => {
  if (!optimizelyClient) {
    return initOptimizely();
  }
  return optimizelyClient;
};

/**
 * 주문 시 전환 발행
 * @param {string} userId - 사용자 ID (이메일 등)
 * @param {string} country - 사용자의 국가 코드 (예: 'KR', 'US', 'JP')
 */
export const trackOrderConversion = (userId, country) => {
  const client = getOptimizelyClient();
  if (!client) {
    console.warn("Optimizely 클라이언트가 초기화되지 않았습니다.");
    return;
  }

  try {
    const user = client.createUserContext(userId, {
      country: country,
    });

    user.track("order_placed");

    console.log(`✅ Order conversion tracked for user ${userId}`);
  } catch (error) {
    console.error("❌ Optimizely track 오류:", error.message);
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
  const client = getOptimizelyClient();

  if (!client) {
    console.warn("Optimizely 클라이언트가 초기화되지 않았습니다.");
    return {
      variant: "v1",
      enabled: true,
    };
  }

  try {
    const user = client.createUserContext(userId, {
      country: country,
    });

    const decision = user.decide(HEADER_COLOR_FLAG_KEY);

    console.log(
      `🎯 User ${userId} (country: ${country}) => Variant: ${decision.variationKey}`
    );

    return {
      variant: decision.variationKey || "v1",
      enabled: decision.enabled,
      flagKey: decision.flagKey,
      ruleKey: decision.ruleKey,
      reasons: decision.reasons,
    };
  } catch (error) {
    console.error("❌ Optimizely decide 오류:", error.message);
    return {
      variant: "v1",
      enabled: true,
    };
  }
};

/**
 * Variant에 따른 UI 설정을 반환합니다.
 *
 * @param {string} variant - 'v1' 또는 'v2'
 * @returns {object} - UI 커스터마이제이션 설정
 */
export const getUIConfig = (variant) => {
  const configs = {
    v1: {
      theme: "default",
      primaryColor: "#007bff",
      showDiscount: false,
      featuredCategories: ["전자제품", "의류", "도서"],
      headerMessage: "AI Store에 오신 것을 환영합니다!",
    },
    v2: {
      theme: "modern",
      primaryColor: "#28a745",
      showDiscount: true,
      featuredCategories: ["캠핑", "스포츠", "생활용품"],
      headerMessage: "🎉 특별 할인 이벤트 진행중!",
    },
  };

  return configs[variant] || configs.v1;
};

// 초기화 (모듈 로드 시 자동 실행)
initOptimizely();
