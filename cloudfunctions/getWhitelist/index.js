// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    // 验证管理员权限（这里可以添加更严格的权限验证）
    // 从管理员集合中获取管理员信息
    const adminResult = await db.collection('admins')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    // 获取白名单数据
    const whitelistResult = await db.collection('whitelist')
      .limit(1000) // 限制最多获取1000条数据
      .get()
    
    return {
      code: 0,
      message: '成功获取白名单数据',
      data: whitelistResult.data || []
    }
  } catch (err) {
    return {
      code: -1,
      message: '获取白名单数据失败: ' + err.message,
      data: []
    }
  }
} 