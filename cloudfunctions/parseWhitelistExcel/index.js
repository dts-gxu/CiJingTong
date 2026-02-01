// 云函数入口文件
const cloud = require('wx-server-sdk')
const xlsx = require('node-xlsx')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { fileID } = event
  
  // 验证参数
  if (!fileID) {
    return {
      code: -1,
      message: '缺少文件ID',
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

    // 下载Excel文件
    const fileResult = await cloud.downloadFile({
      fileID: fileID
    })
    
    const buffer = fileResult.fileContent
    
    // 解析Excel文件
    const sheets = xlsx.parse(buffer)
    
    if (!sheets || sheets.length === 0 || !sheets[0].data || sheets[0].data.length <= 1) {
      return {
        code: -1,
        message: 'Excel文件格式不正确或为空',
        success: false
      }
    }
    
    // 获取第一个工作表的数据
    const rows = sheets[0].data
    
    // 获取表头
    const headers = rows[0]
    
    // 验证表头
    const requiredColumns = ['学号', '姓名', '院系', '专业']
    const columnIndexes = {}
    
    for (const column of requiredColumns) {
      const index = headers.findIndex(header => header === column)
      if (index === -1) {
        return {
          code: -1,
          message: `Excel文件缺少必要列: ${column}`,
          success: false
        }
      }
      columnIndexes[column] = index
    }
    
    // 处理数据行
    const students = []
    const now = new Date().toISOString()
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      
      // 跳过空行
      if (!row || row.length === 0 || !row[columnIndexes['学号']]) {
        continue
      }
      
      // 创建学生记录
      const student = {
        studentId: String(row[columnIndexes['学号']]).trim(),
        name: String(row[columnIndexes['姓名']] || '').trim(),
        department: String(row[columnIndexes['院系']] || '').trim(),
        major: String(row[columnIndexes['专业']] || '').trim(),
        addTime: now,
        updateTime: now
      }
      
      // 验证必填字段
      if (!student.studentId || !student.name) {
        continue
      }
      
      students.push(student)
    }
    
    if (students.length === 0) {
      return {
        code: -1,
        message: '没有找到有效的学生数据',
        success: false
      }
    }
    
    // 批量添加到白名单
    const whitelist = db.collection('whitelist')
    const studentStats = db.collection('student_stats')
    let importCount = 0
    
    // 由于小程序云函数限制，每次最多添加100条记录，需要分批处理
    const batchSize = 100
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize)
      
      // 对每个学生记录执行添加操作
      for (const student of batch) {
        try {
          // 检查是否已存在于白名单
          const existResult = await whitelist.where({
            studentId: student.studentId
          }).get()
          
          if (existResult.data && existResult.data.length > 0) {
            // 更新现有记录
            await whitelist.doc(existResult.data[0]._id).update({
              data: {
                name: student.name,
                department: student.department,
                major: student.major,
                updateTime: now
              }
            })
          } else {
            // 添加新记录
            await whitelist.add({
              data: student
            })
          }
          
          // 检查学生是否已有学习统计数据
          const statsResult = await studentStats.where({
            studentId: student.studentId
          }).get()
          
          if (!statsResult.data || statsResult.data.length === 0) {
            // 如果学生没有学习统计数据，创建初始记录
            await studentStats.add({
              data: {
                studentId: student.studentId,
                name: student.name,
                totalWordsLearned: 0,
                correctRate: 0,
                progress: {
                  stage1: 0,
                  stage2: 0,
                  stage3: 0,
                  stage4: 0,
                  stage5: 0
                },
                lastLoginTime: now,
                lastUpdateTime: now,
                createTime: now
              }
            })
          }
          
          importCount++
        } catch (err) {
          console.error('添加学生数据失败:', err)
        }
      }
    }
    
    // 删除临时文件
    await cloud.deleteFile({
      fileList: [fileID]
    })
    
    return {
      code: 0,
      message: '成功导入白名单数据',
      importCount: importCount,
      success: true
    }
  } catch (err) {
    return {
      code: -1,
      message: '解析Excel文件失败: ' + err.message,
      success: false
    }
  }
} 