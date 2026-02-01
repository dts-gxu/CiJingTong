// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    // 从数据库获取词汇数据
    const wordsResult = await db.collection('words_data')
      .limit(1000) // 限制最多获取1000条词汇
      .get()

    // 确保每个词汇都有id字段
    const wordsData = wordsResult.data || [];
    const processedWords = wordsData.map(word => {
      // 如果没有id字段，使用_id作为id
      if (!word.id && word._id) {
        word.id = word._id;
      }
      return word;
    });

    return {
      code: 0,
      message: '成功获取词汇数据',
      data: processedWords
    }
  } catch (err) {
    return {
      code: -1,
      message: '获取词汇数据失败: ' + err.message,
      data: []
    }
  }
} 