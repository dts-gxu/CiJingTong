// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { studentId } = event

  // 参数验证
  if (!studentId) {
    return {
      code: -1,
      message: '缺少学生ID参数',
      data: null
    }
  }

  try {
    // 查询用户数据
    const userDataResult = await db.collection('user_data')
      .where({
        studentId: studentId
      })
      .get()

    // 如果找到用户数据，则返回
    if (userDataResult && userDataResult.data && userDataResult.data.length > 0) {
      return {
        code: 0,
        message: '成功获取用户数据',
        data: userDataResult.data[0]
      }
    } else {
      // 未找到用户数据
      return {
        code: 0,
        message: '未找到用户数据',
        data: null
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '获取用户数据失败: ' + err.message,
      data: null
    }
  }
} 