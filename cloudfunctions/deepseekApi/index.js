// 云函数入口文件
const cloud = require('wx-server-sdk');
const { OpenAI } = require('openai');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const openai = new OpenAI({
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || 'your-api-key-here'
    });

    // 获取用户发送的消息
    const userMessages = event.messages || [];
    
    // 添加系统消息（如果没有）
    const messages = userMessages.length > 0 && userMessages[0].role === 'system' 
      ? userMessages 
      : [
          { role: "system", content: "你是文学院小程序中的智慧助手，擅长回答关于汉语学习和中国文化的各类问题。请保持友好耐心的态度，提供准确详尽的信息，使用自然流畅的语言表达。" },
          ...userMessages
        ];

    // 调用DeepSeek API
    const completion = await openai.chat.completions.create({
      messages: messages,
      model: "deepseek-chat",
    });

    // 返回响应
    return {
      message: cleanResponse(completion.choices[0].message.content),
      success: true
    };

  } catch (error) {
    console.error('DeepSeek API调用失败:', error);
    return {
      message: '很抱歉，我现在无法回答您的问题。请稍后再试。',
      error: error.message,
      success: false
    };
  }
};

// 清理响应中的星号并添加适当换行
function cleanResponse(text) {
  if (!text) return text;
  
  // 移除所有星号（包括单个*和成对的**）
  let cleanedText = text.replace(/\*+([^*]*)\*+/g, '$1');
  cleanedText = cleanedText.replace(/\*/g, '');
  
  // 处理序号格式并添加换行
  cleanedText = cleanedText.replace(/(\d+\.\s+)([^.\d]+)(?=\s+\d+\.|$)/g, '$1$2\n');
  
  // 在中文句号、问号、感叹号后添加换行
  cleanedText = cleanedText.replace(/([。！？])((?![""''\)\]\}]))/g, '$1\n$2');
  
  // 在中文冒号后添加换行
  cleanedText = cleanedText.replace(/([：:])\s*/g, '$1\n');
  
  // 处理分隔符，如"——"后换行
  cleanedText = cleanedText.replace(/(——|---|——)/g, '\n$1\n');
  
  // 处理项目符号并添加换行
  cleanedText = cleanedText.replace(/([•◦▪︎·])\s*/g, '\n$1 ');
  
  // 避免连续多个换行，最多保留两个
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n');
  
  // 去除首尾多余空白
  cleanedText = cleanedText.trim();
  
  return cleanedText;
} 