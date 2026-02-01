// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { studentId, name } = event

  // 参数验证
  if (!studentId || !name) {
    return {
      code: -1,
      message: '缺少学号或姓名参数',
      success: false
    }
  }

  try {
    // 查询白名单
    const whitelistResult = await db.collection('whitelist')
      .where({
        studentId: studentId
      })
      .get()

    if (whitelistResult && whitelistResult.data && whitelistResult.data.length > 0) {
      const user = whitelistResult.data[0]
      
      // 验证姓名是否匹配
      if (user.name === name) {
        const now = new Date().toISOString()
        const openid = wxContext.OPENID
        
        // 更新用户登录信息
        await db.collection('user_login_history').add({
          data: {
            studentId,
            name,
            openid,
            loginTime: now
          }
        })
        
        // 更新user_info集合
        const userInfoResult = await db.collection('user_info')
          .where({
            studentId: studentId
          })
          .get()
        
        if (userInfoResult && userInfoResult.data && userInfoResult.data.length > 0) {
          // 更新现有用户信息
          await db.collection('user_info').doc(userInfoResult.data[0]._id).update({
            data: {
              name,
              openid,
              department: user.department || '',
              major: user.major || '',
              lastLoginTime: now,
              updateTime: now
            }
          })
        } else {
          // 创建新用户信息
          await db.collection('user_info').add({
            data: {
              studentId,
              name,
              openid,
              department: user.department || '',
              major: user.major || '',
              createTime: now,
              lastLoginTime: now,
              updateTime: now
            }
          })
        }
        
        // 更新或创建学生统计数据
        await updateStudentStats(studentId, name)
        
        return {
          code: 0,
          message: '登录成功',
          success: true,
          userInfo: {
            studentId,
            name,
            department: user.department || '',
            major: user.major || ''
          }
        }
      } else {
        // 姓名不匹配
        return {
          code: -1,
          message: '学号或姓名不正确',
          success: false
        }
      }
    } else {
      // 学号不在白名单中
      return {
        code: -1,
        message: '学号或姓名不正确',
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

// 更新学生统计数据
async function updateStudentStats(studentId, name) {
  try {
    const now = new Date().toISOString()
    
    // 查询学生统计数据
    const statsResult = await db.collection('student_stats')
      .where({
        studentId: studentId
      })
      .get()
    
    if (statsResult && statsResult.data && statsResult.data.length > 0) {
      // 更新登录时间
      await db.collection('student_stats').doc(statsResult.data[0]._id).update({
        data: {
          lastLoginTime: now,
          updateTime: now
        }
      })
    } else {
      // 创建新的学生统计数据
      await db.collection('student_stats').add({
        data: {
          studentId,
          name,
          totalWordsLearned: 0,
          correctRate: 0,
          progress: {
            stage1: 0,
            stage2: 0,
            stage3: 0,
            stage4: 0,
            stage5: 0
          },
          createTime: now,
          lastLoginTime: now,
          updateTime: now
        }
      })
    }
    
    return true
  } catch (err) {
    console.error('更新学生统计数据失败:', err)
    return false
  }
} 