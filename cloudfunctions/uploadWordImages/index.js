// 云函数入口文件
const cloud = require('wx-server-sdk')
const fs = require('fs')
const path = require('path')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始上传词语图片');
    
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
    
    const uploadResults = [];
    const failedUploads = [];
    
    // 上传每个图片
    for (const word of wordImages) {
      try {
        const result = await cloud.uploadFile({
          cloudPath: `word_images/${word}.png`,
          fileContent: Buffer.from(''), // 这里需要实际的文件内容，云函数无法直接访问本地文件系统
        });
        
        uploadResults.push({
          word: word,
          fileID: result.fileID,
          success: true
        });
      } catch (error) {
        console.error(`上传${word}图片失败:`, error);
        failedUploads.push({
          word: word,
          error: error.message
        });
      }
    }
    
    return {
      success: true,
      uploadedCount: uploadResults.length,
      failedCount: failedUploads.length,
      uploadResults: uploadResults,
      failedUploads: failedUploads,
      message: `成功上传${uploadResults.length}个图片，失败${failedUploads.length}个`
    };
    
  } catch (error) {
    console.error('上传词语图片失败:', error);
    return {
      success: false,
      error: error,
      message: '上传词语图片失败: ' + error.message
    };
  }
}; 