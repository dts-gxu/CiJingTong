// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, student, studentId } = event

  // 参数验证
  if (!action) {
    return {
      code: -1,
      message: '缺少操作类型参数',
      success: false
    }
  }

  try {
    // 验证管理员权限
    const adminResult = await db.collection('admins')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    // 如果不是管理员，拒绝操作
    if (!adminResult || !adminResult.data || adminResult.data.length === 0) {
      return {
        code: -1,
        message: '没有管理员权限',
        success: false
      }
    }

    // 根据操作类型执行不同的操作
    if (action === 'add') {
      // 添加学生到白名单
      if (!student || !student.studentId || !student.name) {
        return {
          code: -1,
          message: '缺少学生信息',
          success: false
        }
      }

      // 检查学生是否已存在
      const existResult = await db.collection('whitelist')
        .where({
          studentId: student.studentId
        })
        .get()
      
      if (existResult && existResult.data && existResult.data.length > 0) {
        // 更新现有学生信息
        await db.collection('whitelist').doc(existResult.data[0]._id).update({
          data: {
            name: student.name,
            department: student.department || '',
            major: student.major || '',
            updateTime: new Date().toISOString()
          }
        })

        return {
          code: 0,
          message: '学生信息已更新',
          success: true
        }
      } else {
        // 添加新学生
        await db.collection('whitelist').add({
          data: {
            studentId: student.studentId,
            name: student.name,
            department: student.department || '',
            major: student.major || '',
            addTime: student.addTime || new Date().toISOString(),
            updateTime: new Date().toISOString()
          }
        })

        return {
          code: 0,
          message: '学生已添加到白名单',
          success: true
        }
      }
    } else if (action === 'delete') {
      // 从白名单中删除学生
      if (!studentId) {
        return {
          code: -1,
          message: '缺少学生ID',
          success: false
        }
      }

      // 查找要删除的学生
      const existResult = await db.collection('whitelist')
        .where({
          studentId: studentId
        })
        .get()
      
      if (existResult && existResult.data && existResult.data.length > 0) {
        // 删除学生
        await db.collection('whitelist').doc(existResult.data[0]._id).remove()

        return {
          code: 0,
          message: '学生已从白名单中删除',
          success: true
        }
      } else {
        return {
          code: -1,
          message: '找不到指定学生',
          success: false
        }
      }
    } else {
      return {
        code: -1,
        message: '不支持的操作类型',
        success: false
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '操作失败: ' + err.message,
      success: false
    }
  }
} 