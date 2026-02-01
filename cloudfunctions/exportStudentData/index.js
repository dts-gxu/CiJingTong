// 云函数入口文件
const cloud = require('wx-server-sdk')

// 修改为使用动态环境
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

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

    // 获取学生数据
    const studentResult = await db.collection('student_stats')
      .limit(1000) // 限制最多获取1000条数据
      .get()
    
    const students = studentResult.data || []
    
    // 生成CSV格式的数据
    let csvContent = '学号,姓名,已学词汇量,正确率,阶段1,阶段2,阶段3,阶段4,阶段5,最后登录时间\n'
    
    students.forEach(student => {
      csvContent += `${student.studentId},${student.name},${student.totalWordsLearned || 0},${student.correctRate || 0}%,`
      csvContent += `${student.progress?.stage1 || 0},${student.progress?.stage2 || 0},${student.progress?.stage3 || 0},`
      csvContent += `${student.progress?.stage4 || 0},${student.progress?.stage5 || 0},${student.lastLoginTime || ''}\n`
    })
    
    // 生成文件名
    const fileName = `学生学习数据_${new Date().getTime()}.csv`
    
    // 将CSV内容写入云存储
    const result = await cloud.uploadFile({
      cloudPath: fileName,
      fileContent: Buffer.from(csvContent, 'utf-8')
    })
    
    // 获取文件的临时下载链接
    const fileResult = await cloud.getTempFileURL({
      fileList: [result.fileID]
    })
    
    return {
      code: 0,
      message: '成功导出学生数据',
      fileID: result.fileID,
      tempFileURL: fileResult.fileList[0]?.tempFileURL || '',
      success: true
    }
  } catch (err) {
    return {
      code: -1,
      message: '导出学生数据失败: ' + err.message,
      success: false
    }
  }
} 