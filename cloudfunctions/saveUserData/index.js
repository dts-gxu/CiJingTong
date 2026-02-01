// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { studentId, name, learningProgress, wordStatus, lastSyncTime, stats } = event

  // 参数验证
  if (!studentId) {
    return {
      code: -1,
      message: '缺少学生ID参数',
      success: false
    }
  }

  try {
    // 查询用户数据是否已存在
    const userDataResult = await db.collection('user_data')
      .where({
        studentId: studentId
      })
      .get()

    // 记录当前时间，用于更新和统计
    const now = new Date()
    const updateTime = now.toISOString()

    // 处理统计数据
    const updateStats = stats || {
      totalWordsLearned: (learningProgress && learningProgress.totalWordsLearned) || 0,
      correctRate: 0,
      wordsAtStage: (learningProgress && learningProgress.wordsAtStage) || [0, 0, 0, 0, 0],
      lastUpdateTime: updateTime
    }

    // 统计数据需要记录更新历史，用于生成学习曲线
    const statsHistory = {
      time: updateTime,
      totalWordsLearned: updateStats.totalWordsLearned,
      correctRate: updateStats.correctRate,
      wordsAtStage: updateStats.wordsAtStage
    }

    if (userDataResult && userDataResult.data && userDataResult.data.length > 0) {
      // 用户数据已存在，执行更新
      const userData = userDataResult.data[0]
      
      // 合并历史统计数据
      let history = userData.statsHistory || []
      
      // 限制历史记录数量，防止数据过大
      if (history.length >= 30) {
        history = history.slice(history.length - 29)
      }
      
      history.push(statsHistory)

      // 更新用户数据
      await db.collection('user_data').doc(userData._id).update({
        data: {
          studentId,
          name,
          learningProgress,
          wordStatus,
          lastSyncTime,
          stats: updateStats,
          statsHistory: history,
          updateTime
        }
      })
    } else {
      // 用户数据不存在，创建新记录
      await db.collection('user_data').add({
        data: {
          studentId,
          name,
          learningProgress,
          wordStatus,
          lastSyncTime,
          stats: updateStats,
          statsHistory: [statsHistory],
          createTime: updateTime,
          updateTime
        }
      })
    }

    // 同步更新学生列表统计数据
    await updateStudentListStats(studentId, name, updateStats)

    return {
      code: 0,
      message: '成功保存用户数据',
      success: true,
      updateTime
    }
  } catch (err) {
    return {
      code: -1,
      message: '保存用户数据失败: ' + err.message,
      success: false
    }
  }
}

// 更新学生统计列表
async function updateStudentListStats(studentId, name, stats) {
  try {
    // 查询学生是否已在列表中
    const studentResult = await db.collection('student_stats')
      .where({
        studentId: studentId
      })
      .get()

    const now = new Date().toISOString()

    if (studentResult && studentResult.data && studentResult.data.length > 0) {
      // 学生已存在，执行更新
      await db.collection('student_stats').doc(studentResult.data[0]._id).update({
        data: {
          name,
          totalWordsLearned: stats.totalWordsLearned,
          correctRate: stats.correctRate,
          progress: {
            stage1: stats.wordsAtStage[0] || 0,
            stage2: stats.wordsAtStage[1] || 0,
            stage3: stats.wordsAtStage[2] || 0,
            stage4: stats.wordsAtStage[3] || 0,
            stage5: stats.wordsAtStage[4] || 0
          },
          lastUpdateTime: now
        }
      })
    } else {
      // 学生不存在，创建新记录
      await db.collection('student_stats').add({
        data: {
          studentId,
          name,
          totalWordsLearned: stats.totalWordsLearned,
          correctRate: stats.correctRate,
          progress: {
            stage1: stats.wordsAtStage[0] || 0,
            stage2: stats.wordsAtStage[1] || 0,
            stage3: stats.wordsAtStage[2] || 0,
            stage4: stats.wordsAtStage[3] || 0,
            stage5: stats.wordsAtStage[4] || 0
          },
          createTime: now,
          lastUpdateTime: now
        }
      })
    }
    
    return true
  } catch (err) {
    console.error('更新学生统计数据失败:', err)
    return false
  }
} 