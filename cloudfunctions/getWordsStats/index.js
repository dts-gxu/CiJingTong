// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 默认词汇数量，当数据库中没有词汇数据时使用
const DEFAULT_VOCABULARY_COUNT = 500;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    // 从数据库获取词汇数据数量
    const countResult = await db.collection('words_data')
      .count()
    
    // 获取一些基本统计信息
    const statsResult = await db.collection('words_data')
      .limit(1)
      .get()
    
    let categories = []
    let difficulty = {
      easy: 0,
      medium: 0,
      hard: 0
    }
    
    // 如果有词汇数据，尝试获取分类信息
    if (statsResult && statsResult.data && statsResult.data.length > 0) {
      // 这里可以添加更多统计逻辑
    }

    // 如果数据库中没有词汇数据，使用默认数量
    const totalCount = countResult.total > 0 ? countResult.total : DEFAULT_VOCABULARY_COUNT;

    return {
      code: 0,
      message: '成功获取词汇统计数据',
      totalCount: totalCount,
      categories: categories,
      difficulty: difficulty
    }
  } catch (err) {
    // 出错时返回默认词汇数量
    return {
      code: -1,
      message: '获取词汇统计数据失败: ' + err.message,
      totalCount: DEFAULT_VOCABULARY_COUNT
    }
  }
} 