// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 获取学生统计数据
    const statsResult = await db.collection('student_stats')
      .limit(1000) // 限制最多获取1000条数据
      .get()
    
    // 转换数据格式，确保前端显示需要的字段都存在
    const studentList = statsResult.data.map(student => {
      return {
        studentId: student.studentId,
        name: student.name || '未知姓名',
        totalWordsLearned: student.totalWordsLearned || 0,
        correctRate: student.correctRate || 0,
        progress: student.progress || {
          stage1: 0,
          stage2: 0,
          stage3: 0,
          stage4: 0,
          stage5: 0
        },
        updateTime: student.updateTime || student.lastUpdateTime || new Date().toISOString()
      }
    })

    return {
      code: 0,
      message: '成功获取学生统计数据',
      data: studentList
    }
  } catch (err) {
    return {
      code: -1,
      message: '获取学生统计数据失败: ' + err.message,
      data: []
    }
  }
} 