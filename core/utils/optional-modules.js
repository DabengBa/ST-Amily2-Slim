const createOptionalLoader = (importer, label) => {
  let cachedPromise;
  return () => {
    if (!cachedPromise) {
      cachedPromise = importer().catch((error) => {
        console.warn(`[Amily2][可选模块] ${label} 未能加载，原因:`, error);
        return null;
      });
    }
    return cachedPromise;
  };
};

const loadAutoHideManager = createOptionalLoader(
  () => import('../autoHideManager.js'),
  '自动隐藏管理器'
);

const loadNgmsApi = createOptionalLoader(
  () => import('../api/Ngms_api.js'),
  'Ngms API'
);

export async function getPresetToolkit() {
  return {
    available: false,
    getPresetPrompts: null,
    getMixedOrder: null,
  };
}

export async function getRagProcessor() {
  return null;
}

export async function getAutoHideManager() {
  return await loadAutoHideManager();
}

export async function getNgmsApi() {
  return await loadNgmsApi();
}
