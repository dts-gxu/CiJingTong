// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云存储基础路径
const cloudImagesBase = 'cloud://cloud1-2gryvxfp35682746.636c-cloud1-2gryvxfp35682746-1366502308';

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始更新词语图片路径为云存储路径');
    
    // 获取所有词语
    const wordsResult = await db.collection('words_data').get();
    const words = wordsResult.data;
    
    console.log(`获取到${words.length}个词语`);
    
    // 词语图片映射
    const wordImages = [
      "布置", "管理", "管理员", "告诉", "答应", "窗户", "桌子", "圆圈儿", "彩灯", "彩带",
      "水仙", "吉祥", "椅子", "仔细", "幸福", "沙发", "登机", "登机牌", "手续", "行李",
      "机票", "硬币", "扶手", "卡子", "上街", "要紧", "骨头", "小偷", "遇到", "似的",
      "首都", "算命", "受骗", "抽烟", "决定", "戒烟", "浪费", "武打", "性格", "传统",
      "艺术", "了解", "担心", "节目单", "羡慕", "内容", "阿姨", "关机", "开机", "接电话",
      "比赛", "祝贺", "托福", "肚子", "牛肉", "化验", "检查", "结果", "肠炎", "消化",
      "打针", "寂寞", "所以", "礼堂", "舞会", "跳舞", "满意", "周围", "环境", "厨房",
      "卧室", "面积", "客厅", "阳光", "妻子", "堵车", "房租", "虽然", "交通", "汽车",
      "车站", "公共汽车", "地铁", "旁边", "操场", "成绩", "句子", "糟糕", "回信", "故事",
      "会话", "办法", "打开", "合上", "作业", "生活", "习惯", "干燥", "干净", "油腻"
    ];
    
    const updatePromises = [];
    let updatedCount = 0;
    const updatedWords = [];
    const errors = [];
    
    // 遍历所有词语
    for (const word of words) {
      try {
        // 构建图片路径 - 始终使用词语的word字段作为标识
        if (!word.word) {
          console.log('词语缺少word字段:', word);
          errors.push({
            word: word._id || '未知',
            error: '缺少word字段'
          });
          continue;
        }
        
        // 构建云存储图片路径
        const cloudImagePath = `${cloudImagesBase}/images/words/${word.word}.png`;
        
        // 记录更新信息
        updatedWords.push({
          word: word.word,
          oldPath: word.imagePath || '无',
          newPath: cloudImagePath
        });
        
        // 更新词语记录
        const updatePromise = db.collection('words_data').doc(word._id).update({
          data: {
            imagePath: cloudImagePath,
            imagePathUpdated: true, // 添加标记，表示路径已更新
            imagePathUpdateTime: new Date().toISOString(), // 更新时间
            isCloudPath: true // 标记为云存储路径
          }
        });
        
        updatePromises.push(updatePromise);
        updatedCount++;
      } catch (wordError) {
        console.error('处理词语时出错:', word, wordError);
        errors.push({
          word: word.word || word._id || '未知',
          error: wordError.message || '未知错误'
        });
      }
    }
    
    console.log('准备更新的词语（使用云存储路径）：', updatedWords);
    
    // 等待所有更新完成
    await Promise.all(updatePromises);
    
    return {
      success: true,
      updatedCount: updatedCount,
      updatedWords: updatedWords.slice(0, 20), // 只返回前20个更新的词语信息，避免数据过大
      errors: errors.length > 0 ? errors : null,
      message: `成功更新${updatedCount}个词语的图片路径为云存储路径${errors.length > 0 ? `，${errors.length}个错误` : ''}`
    };
    
  } catch (error) {
    console.error('更新词语图片路径失败:', error);
    return {
      success: false,
      error: error.message || error,
      message: '更新词语图片路径失败: ' + (error.message || '未知错误')
    };
  }
}; 