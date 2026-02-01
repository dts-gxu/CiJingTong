// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { username, password } = event

  // 验证用户名和密码
  if (!username) {
    return {
      code: -1,
      message: '请输入用户名',
      success: false
    }
  }
  
  if (!password) {
    return {
      code: -1,
      message: '请输入密码',
      success: false
    }
  }

  try {
    // 管理员凭据（生产环境请使用环境变量）
    const adminUsername = process.env.ADMIN_USERNAME || 'admin'
    const adminPassword = process.env.ADMIN_PASSWORD || 'change-this-password'
    
    // 严格验证用户名和密码
    if (username === adminUsername && password === adminPassword) {
      // 登录成功，记录管理员登录
      const openid = wxContext.OPENID
      const now = new Date().toISOString()
      
      // 查询管理员是否已存在
      const adminResult = await db.collection('admins')
        .where({
          openid: openid
        })
        .get()
      
      if (adminResult && adminResult.data && adminResult.data.length > 0) {
        // 管理员已存在，更新登录时间
        await db.collection('admins').doc(adminResult.data[0]._id).update({
          data: {
            username: adminUsername, // 记录用户名
            lastLoginTime: now,
            updateTime: now
          }
        })
      } else {
        // 管理员不存在，创建新记录
        await db.collection('admins').add({
          data: {
            openid: openid,
            username: adminUsername, // 记录用户名
            role: 'admin',
            createTime: now,
            lastLoginTime: now,
            updateTime: now
          }
        })
      }
      
      return {
        code: 0,
        message: '登录成功',
        success: true,
        username: adminUsername // 返回用户名
      }
    } else {
      return {
        code: -1,
        message: '用户名或密码不正确',
        success: false
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '登录验证失败: ' + err.message,
      success: false
    }
  }
} 