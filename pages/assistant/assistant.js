// pages/assistant/assistant.js
Page({
  data: {
    inputValue: '',
    chatHistory: [],
    loading: false,
    scrollToView: '' // 用于自动滚动
  },

  onLoad: function (options) {
    // 页面初始化时添加欢迎消息
    const welcomeMessage = {
      role: 'assistant',
      content: '您好！我是智慧助手，可以回答关于汉语学习和中国文化的各种问题。请随时向我提问，我会尽力提供帮助。'
    };
    
    this.setData({
      chatHistory: [welcomeMessage]
    });
  },
  
  // 页面显示时滚动到底部
  onShow: function() {
    this.scrollToBottom();
  },

  // 输入框输入事件
  onInput: function (e) {
    this.setData({
      inputValue: e.detail.value
    });
  },

  // 点击发送按钮
  sendMessage: function () {
    if (!this.data.inputValue.trim() || this.data.loading) return;
    
    const userMessage = this.data.inputValue.trim();
    const chatHistory = [...this.data.chatHistory];
    
    // 添加用户消息
    chatHistory.push({
      role: 'user',
      content: userMessage
    });
    
    this.setData({
      chatHistory: chatHistory,
      inputValue: '',
      loading: true
    });
    
    this.scrollToBottom();
    
    // 构建发送到API的消息数组
    const apiMessages = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    
    // 调用云函数
    wx.cloud.callFunction({
      name: 'deepseekApi',
      data: {
        messages: apiMessages
      },
      success: res => {
        if (res.result && res.result.success) {
          const assistantMessage = {
            role: 'assistant',
            content: res.result.message
          };
          
          chatHistory.push(assistantMessage);
          
          this.setData({
            chatHistory: chatHistory,
            loading: false
          });
          
          this.scrollToBottom();
        } else {
          // 错误处理
          this.handleError('API返回错误');
        }
      },
      fail: err => {
        console.error('调用云函数失败', err);
        this.handleError('网络请求失败');
      }
    });
  },
  
  // 错误处理
  handleError: function(errorMsg) {
    const chatHistory = [...this.data.chatHistory];
    chatHistory.push({
      role: 'assistant',
      content: '很抱歉，我遇到了一些问题，请稍后再试。'
    });
    
    this.setData({
      chatHistory: chatHistory,
      loading: false
    });
    
    this.scrollToBottom();
    
    // 显示错误提示
    wx.showToast({
      title: errorMsg,
      icon: 'none',
      duration: 2000
    });
  },
  
  // 滚动到底部
  scrollToBottom: function() {
    const length = this.data.chatHistory.length;
    if (length > 0) {
      this.setData({
        scrollToView: `msg-${length - 1}`
      });
    }
  }
}); 