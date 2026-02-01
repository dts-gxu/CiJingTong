// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  // 检查参数
  if (!event.wordId) {
    return {
      success: false,
      error: '缺少wordId参数'
    }
  }
  
  try {
    // 获取词汇信息（用于日志记录）
    const wordResult = await db.collection('words').doc(event.wordId).get()
    const word = wordResult.data
    
    if (!word) {
      return {
        success: false,
        error: `词汇不存在: ${event.wordId}`
      }
    }
    
    // 检查用户权限
    const { OPENID } = cloud.getWXContext()
    const adminResult = await db.collection('admins').where({
      userId: OPENID
    }).get()
    
    if (adminResult.data.length === 0) {
      console.log('权限不足：', OPENID)
      return {
        success: false,
        error: '权限不足'
      }
    }
    
    // 从词汇记录中移除audioFileId字段
    const updateResult = await db.collection('words').doc(event.wordId).update({
      data: {
        audioFileId: _.remove(),
        updatedAt: db.serverDate()
      }
    })
    
    console.log(`成功移除词汇'${word.word}'的音频`, updateResult)
    
    return {
      success: true,
      data: {
        updated: updateResult.stats.updated,
        word: word.word
      }
    }
  } catch (error) {
    console.error('移除词汇音频失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 