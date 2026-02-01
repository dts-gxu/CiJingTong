// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { studentId, name, timestamp, action, groupSize, reviewCount, newCount } = event

  // 参数验证
  if (!studentId || !action) {
    return {
      code: -1,
      message: '缺少必要参数',
      success: false
    }
  }

  try {
    // 记录学习行为
    const result = await db.collection('learning_actions').add({
      data: {
        studentId,
        name,
        timestamp,
        action,
        groupSize: groupSize || 0,
        reviewCount: reviewCount || 0,
        newCount: newCount || 0,
        openid: wxContext.OPENID,
        createTime: new Date()
      }
    })

    return {
      code: 0,
      message: '成功记录学习行为',
      success: true,
      id: result._id
    }
  } catch (err) {
    return {
      code: -1,
      message: '记录学习行为失败: ' + err.message,
      success: false
    }
  }
} 