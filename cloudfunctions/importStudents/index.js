// 云函数入口文件
const cloud = require('wx-server-sdk');
const xlsx = require('node-xlsx');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { fileID } = event;

  if (!fileID) {
    return {
      code: -1,
      message: '未提供文件ID',
      success: false
    };
  }

  try {
    // 下载Excel文件
    const res = await cloud.downloadFile({
      fileID: fileID
    });
    const buffer = res.fileContent;
    
    // 解析Excel文件
    const sheets = xlsx.parse(buffer);
    if (!sheets || sheets.length === 0 || !sheets[0].data || sheets[0].data.length <= 1) {
      return {
        code: -1,
        message: 'Excel文件格式错误或为空',
        success: false
      };
    }
    
    // 获取第一个sheet
    const sheet = sheets[0];
    const rows = sheet.data;
    
    // 第一行应该是表头
    const headers = rows[0];
    
    // 检查表头是否符合要求
    const requiredColumns = ['学号', '姓名', '院系', '专业'];
    const headerIndexMap = {};
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (requiredColumns.includes(header)) {
        headerIndexMap[header] = i;
      }
    }
    
    // 确保所有必需的列都存在
    for (const col of requiredColumns) {
      if (headerIndexMap[col] === undefined) {
        return {
          code: -1,
          message: `Excel文件缺少必要的列: ${col}`,
          success: false
        };
      }
    }
    
    // 解析数据行
    const students = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      
      // 跳过空行
      if (!row || row.length === 0 || !row[headerIndexMap['学号']]) {
        continue;
      }
      
      // 提取学生信息
      const student = {
        studentId: String(row[headerIndexMap['学号']]).trim(),
        name: row[headerIndexMap['姓名']] ? String(row[headerIndexMap['姓名']]).trim() : '',
        department: row[headerIndexMap['院系']] ? String(row[headerIndexMap['院系']]).trim() : '',
        major: row[headerIndexMap['专业']] ? String(row[headerIndexMap['专业']]).trim() : '',
        addTime: new Date().toISOString()
      };
      
      // 验证学号和姓名不为空
      if (!student.studentId || !student.name) {
        continue;
      }
      
      students.push(student);
    }
    
    if (students.length === 0) {
      return {
        code: -1,
        message: '没有有效的学生数据',
        success: false
      };
    }
    
    // 批量添加到白名单集合
    const whitelistCollection = db.collection('whitelist');
    
    // 由于小程序云开发限制，一次最多操作100条数据，需要分批处理
    const batchSize = 100;
    let successCount = 0;
    
    for (let i = 0; i < students.length; i += batchSize) {
      const batch = students.slice(i, i + batchSize);
      
      // 对每个学生，先检查是否已存在
      for (const student of batch) {
        // 查询是否已存在该学号的学生
        const existingStudent = await whitelistCollection.where({
          studentId: student.studentId
        }).get();
        
        if (existingStudent.data && existingStudent.data.length > 0) {
          // 已存在，更新信息
          await whitelistCollection.doc(existingStudent.data[0]._id).update({
            data: {
              name: student.name,
              department: student.department,
              major: student.major,
              updateTime: new Date().toISOString()
            }
          });
        } else {
          // 不存在，添加新记录
          await whitelistCollection.add({
            data: student
          });
        }
        
        successCount++;
      }
    }
    
    // 删除上传的文件
    await cloud.deleteFile({
      fileList: [fileID]
    });
    
    return {
      code: 0,
      message: '导入成功',
      success: true,
      importCount: successCount
    };
    
  } catch (error) {
    console.error('导入学生数据失败:', error);
    return {
      code: -1,
      message: '导入失败: ' + error.message,
      success: false
    };
  }
}; 