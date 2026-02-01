// 云存储图片路径配置
const cloudImagesBase = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308';

// 词语图片路径映射
const wordImages = {
  "一般": `${cloudImagesBase}/images/words/一般.png`,
  "上街": `${cloudImagesBase}/images/words/上街.png`,
  "下载": `${cloudImagesBase}/images/words/下载.png`,
  "下雪": `${cloudImagesBase}/images/words/下雪.png`,
  "不熄": `${cloudImagesBase}/images/words/不熄.png`,
  "世界": `${cloudImagesBase}/images/words/世界.png`,
  "丝织品": `${cloudImagesBase}/images/words/丝织品.png`,
  "丢三落四": `${cloudImagesBase}/images/words/丢三落四.png`,
  "中餐": `${cloudImagesBase}/images/words/中餐.png`,
  "丰富": `${cloudImagesBase}/images/words/丰富.png`,
  // 可以继续添加其他词语图片...
};

// 界面图标路径映射
const uiImages = {
  logo: '/images/logo.png', // 保留本地路径，或者也上传到云存储
  defaultAvatar: '/images/default_avatar.png',
  defaultWord: '/images/default_word.png',
  audioIcon: '/images/audio_icon.png',
  aiIcon: '/images/ai_icon.png',
  aiAvatar: '/images/ai_avatar.png',
  emptyIcon: '/images/empty.png',
  iconProfile: '/images/icon_profile.png',
  iconAbout: '/images/icon_about.png',
  iconService: '/images/icon_service.png',
  placeholder: '/images/placeholder.png'
};

// 获取词语图片云路径的函数
const getWordImagePath = (word) => {
  // 如果映射表中有该词语的图片路径，则返回云存储路径
  if (wordImages[word]) {
    return wordImages[word];
  }
  
  // 如果映射表中没有，则尝试构建一个标准路径
  const cloudPath = `${cloudImagesBase}/images/words/${word}.png`;
  return cloudPath;
};

module.exports = {
  cloudImagesBase,
  wordImages,
  uiImages,
  getWordImagePath
}; 