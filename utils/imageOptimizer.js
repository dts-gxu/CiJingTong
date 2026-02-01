// 图片资源优化工具

/**
 * 将本地图片路径转换为云存储路径
 * @param {string} localPath - 本地图片路径
 * @returns {string} 云存储路径
 */
const convertToCloudPath = (localPath) => {
  // 去除前导斜杠
  const path = localPath.startsWith('/') ? localPath.slice(1) : localPath;
  
  // 如果是词语图片，转换为云存储路径
  if (path.startsWith('images/words/')) {
    const cloudBase = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308';
    return `${cloudBase}/${path}`;
  }
  
  // 其他图片保持本地路径
  return localPath;
};

/**
 * 检查图片是否为云存储路径
 * @param {string} path - 图片路径
 * @returns {boolean} 是否为云存储路径
 */
const isCloudPath = (path) => {
  return path && path.startsWith('cloud://');
};

/**
 * 获取词语对应的图片路径（优先使用云存储）
 * @param {string} word - 词语
 * @returns {string} 图片路径
 */
const getWordImagePath = (word) => {
  if (!word) return '';
  
  const cloudBase = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308';
  return `${cloudBase}/images/words/${word}.png`;
};

module.exports = {
  convertToCloudPath,
  isCloudPath,
  getWordImagePath
}; 