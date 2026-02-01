// services/assistantService.js
// 提供与AI助手相关的服务功能

/**
 * 调用AI服务获取回复
 * @param {Array} messages - 消息数组，每个消息包含role和content
 * @param {String} systemPrompt - 系统提示词
 * @returns {Promise} - 返回Promise，成功时返回AI回复
 */
const callAI = function(messages, systemPrompt = '') {
  return new Promise((resolve, reject) => {
    // 构建完整消息数组
    const fullMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;
    
    // 调用云函数
    wx.cloud.callFunction({
      name: 'deepseekApi',
      data: {
        messages: fullMessages
      },
      success: res => {
        if (res.result && res.result.success) {
          resolve({
            content: res.result.message,
            success: true
          });
        } else {
          reject(new Error(res.result?.error || '调用AI服务失败'));
        }
      },
      fail: err => {
        console.error('调用AI云函数失败', err);
        reject(err);
      }
    });
  });
};

/**
 * 获取词语的AI解读
 * @param {String} word - 需要解读的词语
 * @returns {Promise} - 返回Promise，成功时返回解读内容
 */
const getWordExplanation = function(word) {
  const messages = [
    {
      role: 'user',
      content: `请对汉语词语"${word}"进行简单易懂的解读，包括：1. 基本意思 2. 简单例句 3. 日常使用场景。解释时要像对完全初学者讲解一样，确保他们能够理解。`
    }
  ];
  
  const systemPrompt = "你是一位经验丰富的汉语教师，专门教授初级水平的外国留学生。请用最简单、最基础的汉语词汇和短句来解释概念，避免使用复杂词汇和长句。你应该：1. 使用常用词 2. 保持句子简短 3. 适当重复关键信息 4. 使用具体例子。";
  
  return callAI(messages, systemPrompt);
};

// 导出服务函数
module.exports = {
  callAI: callAI,
  getWordExplanation: getWordExplanation
}; 