// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 创建words_data集合
    await db.createCollection('words_data')
    return {
      success: true,
      message: '成功创建words_data集合'
    }
  } catch (error) {
    // 如果集合已存在，会返回错误，但这不是问题
    if (error.message && error.message.indexOf('collection already exists') !== -1) {
      return {
        success: true,
        message: 'words_data集合已存在'
      }
    }
    
    return {
      success: false,
      message: '创建集合失败: ' + error.message,
      error: error
    }
  }
} 