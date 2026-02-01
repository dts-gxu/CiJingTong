// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境
const db = cloud.database()
const MAX_LIMIT = 100

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    console.log('开始获取词语列表');
    
    // 定义可能的集合名称
    const possibleCollections = ['words', 'vocabulary', 'word', 'vocab', 'words_data'];
    
    // 尝试从每个可能的集合中获取词语
    let allWords = [];
    let successCollection = null;
    
    for (const collectionName of possibleCollections) {
      try {
        console.log(`尝试从集合 ${collectionName} 获取词语数据`);
        
        // 获取词语总数
        const countResult = await db.collection(collectionName).count()
          .catch(err => {
            console.log(`集合 ${collectionName} 不存在或无法访问:`, err);
            return { total: 0 };
          });
          
        const total = countResult.total || 0;
        
        console.log(`集合 ${collectionName} 中有 ${total} 条记录`);
        
        if (total > 0) {
          // 计算需要分几次取
          const batchTimes = Math.ceil(total / MAX_LIMIT);
          console.log(`需要分 ${batchTimes} 次获取数据`);
          
          // 承载所有读操作的 promise 的数组
          const tasks = [];
          
          for (let i = 0; i < batchTimes; i++) {
            const promise = db.collection(collectionName)
              .skip(i * MAX_LIMIT)
              .limit(MAX_LIMIT)
              .get();
            
            tasks.push(promise);
          }
          
          // 等待所有请求完成
          const results = await Promise.all(tasks);
          console.log(`成功执行了 ${results.length} 次查询`);
          
          // 合并结果
          let tempWords = [];
          results.forEach(result => {
            console.log(`本批次获取到 ${result.data.length} 条数据`);
            tempWords = tempWords.concat(result.data);
          });
          
          console.log(`从集合 ${collectionName} 成功获取 ${tempWords.length} 条词语数据`);
          
          // 确保每个词语都有_id字段
          tempWords = tempWords.map((word, index) => {
            if (!word._id) {
              word._id = `word_${index}`;
            }
            return word;
          });
          
          allWords = tempWords;
          successCollection = collectionName;
          
          // 如果已经找到词语，不再继续查找其他集合
          if (allWords.length > 0) {
            break;
          }
        }
      } catch (err) {
        console.error(`从集合 ${collectionName} 获取词语失败:`, err);
        console.error('错误详情:', JSON.stringify(err));
      }
    }
    
    // 如果所有集合都没有找到数据，返回错误
    if (allWords.length === 0) {
      return {
        code: 2,
        message: '未找到词语数据',
        data: []
      };
    }
    
    console.log(`最终成功从 ${successCollection} 获取到 ${allWords.length} 条词语数据`);
    
    // 返回成功结果
    return {
      code: 0,
      data: allWords,
      message: `获取词语列表成功，共 ${allWords.length} 条`
    };
  } catch (error) {
    console.error('获取词语失败:', error);
    console.error('错误详情:', JSON.stringify(error));
    
    return {
      code: 3,
      message: '获取词语失败: ' + error.message,
      error: error
    };
  }
} 