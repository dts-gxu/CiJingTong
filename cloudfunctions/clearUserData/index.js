// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 清除用户学习数据 - 使用非空查询条件
    const userDataResult = await db.collection('user_word_status').where({
      _id: db.command.exists(true)
    }).remove()
    
    // 清除用户学习进度 - 使用非空查询条件
    const userProgressResult = await db.collection('user_progress').where({
      _id: db.command.exists(true)
    }).remove()
    
    // 清除用户每日学习记录 - 使用非空查询条件
    const userDailyResult = await db.collection('user_daily_study').where({
      _id: db.command.exists(true)
    }).remove()
    
    return {
      code: 0,
      message: '成功清除所有用户学习数据',
      success: true,
      userDataRemoved: userDataResult.stats.removed || 0,
      userProgressRemoved: userProgressResult.stats.removed || 0,
      userDailyRemoved: userDailyResult.stats.removed || 0
    }
  } catch (err) {
    console.error('清除用户数据失败:', err)
    return {
      code: -1,
      message: '清除用户数据失败: ' + err.message,
      success: false,
      error: err
    }
  }
} 