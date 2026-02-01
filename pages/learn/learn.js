// pages/learn/learn.js
// 导入词语服务
const wordService = require('../../services/wordService');
// 导入助手服务
const assistantService = require('../../services/assistantService');
// 导入云存储图片配置
const cloudImageConfig = require('../../utils/cloudImageConfig');

// 确保助手服务可用
console.log('助手服务加载状态:', {
  hasCallAI: typeof assistantService.callAI === 'function',
  hasGetWordExplanation: typeof assistantService.getWordExplanation === 'function'
});

// 创建内部变量存储音频实例
let audioContext = null;
// 创建内部变量存储录音管理器
let recorderManager = null;
// 录音计时器
let recordingTimer = null;

Page({

  /**
   * 页面的初始数据
   */
  data: {
    currentWord: null,
    currentIndex: 0,
    totalWords: 0,
    progressPercent: 0,
    isLastWord: false,
    // AI解读相关数据
    showAIExplanation: false,
    aiExplanation: null,
    isLoadingExplanation: false,
    explanationError: null,
    // 例句类型标志
    isExampleString: false,
    // 默认图片路径
    defaultImagePath: '/images/default_word.png',
    // 图片调试信息
    imageDebugInfo: '',
    showImageDebug: false,
    // 音频相关状态
    isPlayingAudio: false,
    audioSrc: '',
    // 云存储图片配置
    cloudImages: cloudImageConfig.wordImages,
    // 权限控制
    isAdmin: false,
    // 录音状态
    isRecording: false,
    recordingDuration: 0,
    tempAudioFilePath: '',
    audioType: 'aac' // 默认录音格式
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 检查默认图片是否存在
    this.checkDefaultImage();
    // 加载词语
    this.loadCurrentGroup();
    // 初始化音频上下文
    this.initAudioContext();
    // 初始化录音管理器
    this.initRecorderManager();
    // 检查是否是管理员
    this.checkAdminPermission();
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    // 如果正在播放，停止播放
    if (this.data.isPlayingAudio && audioContext) {
      audioContext.stop();
    }
    
    // 如果正在录音，停止录音
    if (this.data.isRecording && recorderManager) {
      recorderManager.stop();
    }
    
    // 清除计时器
    if (recordingTimer) {
      clearInterval(recordingTimer);
      recordingTimer = null;
    }
  },
  
  /**
   * 初始化音频上下文
   */
  initAudioContext: function() {
    // 创建音频上下文
    audioContext = wx.createInnerAudioContext();
    
    // 监听音频播放结束事件
    audioContext.onEnded(() => {
      this.setData({
        isPlayingAudio: false
      });
    });
    
    // 监听音频错误事件
    audioContext.onError((err) => {
      console.error('音频播放错误:', err);
      wx.showToast({
        title: '音频播放失败',
        icon: 'none'
      });
      this.setData({
        isPlayingAudio: false
      });
    });
  },

  /**
   * 检查默认图片是否存在
   */
  checkDefaultImage: function() {
    wx.getFileSystemManager().access({
      path: this.data.defaultImagePath.slice(1), // 去除前导斜杠
      success: () => {
        console.log('默认图片存在:', this.data.defaultImagePath);
      },
      fail: (err) => {
        console.error('默认图片不存在:', this.data.defaultImagePath, err);
        this.setData({
          defaultImagePath: '/images/placeholder.png'
        });
      }
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  /**
   * 加载当前学习组
   */
  loadCurrentGroup: function() {
    // 获取全局应用实例
    const app = getApp();
    
    // 获取当前学习组
    const currentGroup = app.globalData.currentGroup;
    
    if (!currentGroup || !currentGroup.words || currentGroup.words.length === 0) {
      wx.showToast({
        title: '没有可学习的词语',
        icon: 'none'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
      return;
    }
    
    // 设置当前学习模式
    app.globalData.currentGroup.mode = 'learn';
    
    // 获取当前词语索引
    const currentIndex = currentGroup.progress || 0;
    
    // 获取当前词语
    const words = currentGroup.words;
    const currentWord = words[currentIndex];
    
    if (!currentWord) {
      wx.showToast({
        title: '词语数据错误',
        icon: 'none'
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
      return;
    }
    
    // 计算进度百分比
    const progressPercent = (currentIndex / words.length) * 100;
    
    // 判断是否是最后一个词
    const isLastWord = currentIndex === words.length - 1;
    
    // 判断example是否为字符串类型
    const isExampleString = typeof currentWord.example === 'string';
    
    // 使用云存储图片路径
    if (currentWord.word) {
      // 使用云存储路径
      currentWord.imagePath = cloudImageConfig.getWordImagePath(currentWord.word);
      console.log('已设置词语云存储图片路径:', currentWord.imagePath);
    }
    
    this.setData({
      currentWord: currentWord,
      currentIndex: currentIndex,
      totalWords: words.length,
      progressPercent: progressPercent,
      isLastWord: isLastWord,
      // 设置例句类型标志
      isExampleString: isExampleString,
      // 重置AI解读相关数据
      showAIExplanation: false,
      aiExplanation: null,
      isLoadingExplanation: false,
      explanationError: null
    });
    
    // 自动播放功能已删除，用户需要手动点击播放按钮
  },
  
  /**
   * 检查图片是否存在 - 云存储图片不需要检查本地文件系统
   */
  checkImageExists: function(imagePath, wordName) {
    // 对于云存储图片，我们不需要检查本地文件系统
    if (imagePath && imagePath.startsWith('cloud://')) {
      return; // 云存储图片，无需进一步处理
    }
    
    // 如果不是云存储路径，则尝试使用云存储路径
    if (wordName) {
      const cloudPath = cloudImageConfig.getWordImagePath(wordName);
      
      // 更新当前词语图片路径为云存储路径
      const currentWord = this.data.currentWord;
      if (currentWord) {
        currentWord.imagePath = cloudPath;
        this.setData({
          currentWord: currentWord
        });
      }
    }
  },

  /**
   * 播放发音
   */
  playPronunciation: function() {
    // 获取当前词语
    const currentWord = this.data.currentWord;
    
    if (!currentWord || !currentWord.word) {
      wx.showToast({
        title: '无法获取词语信息',
        icon: 'none'
      });
      return;
    }
    
    // 如果正在播放，停止播放
    if (this.data.isPlayingAudio) {
      if (audioContext) {
        audioContext.stop();
      }
      this.setData({
        isPlayingAudio: false
      });
      return;
    }

    // 首先检查是否有云存储中的录音
    if (currentWord.audioFileId) {
      // 获取云存储音频URL
      wordService.getWordAudioUrl(currentWord.word).then(audioUrl => {
        if (audioUrl) {
          // 播放云存储音频
          console.log('播放云存储音频:', audioUrl);
          this.playAudio(audioUrl);
        } else {
          // 如果获取失败，尝试播放本地音频
          this.playLocalOrOnlineAudio();
        }
      }).catch(err => {
        console.error('获取云存储音频URL失败:', err);
        // 尝试播放本地音频
        this.playLocalOrOnlineAudio();
      });
    } else {
      // 没有云存储录音，尝试播放本地音频
      this.playLocalOrOnlineAudio();
    }
  },
  
  /**
   * 尝试播放本地或在线音频
   */
  playLocalOrOnlineAudio: function() {
    const currentWord = this.data.currentWord;
    
    wx.showLoading({
      title: '加载音频...'
    });
    
    console.log('调用getAudioFile云函数，词语:', currentWord.word);
    
    // 使用云函数获取音频文件
    wx.cloud.callFunction({
      name: 'getAudioFile',
      data: {
        word: currentWord.word
      },
      success: res => {
        wx.hideLoading();
        console.log('云函数返回结果:', res);
        
        if (res.result && res.result.success && res.result.fileURL) {
          console.log('获取到音频URL:', res.result.fileURL);
          
          // 检查URL是否是百度翻译API
          if (res.result.fileURL.includes('fanyi.baidu.com')) {
            console.error('错误: 云函数返回了百度翻译API的URL');
            wx.showToast({
              title: '音频服务不可用',
              icon: 'none'
            });
            return;
          }
          
          this.playAudio(res.result.fileURL);
        } else {
          console.error('未找到音频文件:', res.result);
          wx.showToast({
            title: '暂无音频',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('调用云函数失败:', err);
        wx.showToast({
          title: '获取音频失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 切换AI解读显示状态
   */
  toggleAIExplanation: function() {
    const currentState = this.data.showAIExplanation;
    
    this.setData({
      showAIExplanation: !currentState
    });
    
    // 如果是显示解读且还没有解读内容，则获取解读
    if (!currentState && !this.data.aiExplanation && !this.data.isLoadingExplanation) {
      this.getAIExplanation();
    }
  },
  
  /**
   * 获取AI解读内容
   */
  getAIExplanation: function() {
    // 获取当前词语
    const currentWord = this.data.currentWord;
    
    if (!currentWord || !currentWord.word) {
      this.setData({
        explanationError: '无法获取当前词语信息'
      });
      return;
    }
    
    // 设置加载状态
    this.setData({
      isLoadingExplanation: true,
      explanationError: null
    });
    
    // 检查助手服务是否可用
    if (!assistantService || typeof assistantService.getWordExplanation !== 'function') {
      console.error('助手服务不可用:', assistantService);
      this.setData({
        explanationError: '助手服务不可用',
        isLoadingExplanation: false
      });
      return;
    }
    
    // 使用助手服务获取词语解读
    try {
      assistantService.getWordExplanation(currentWord.word)
        .then(result => {
          if (result && result.content) {
            // 更新AI解读内容
            this.setData({
              aiExplanation: result.content,
              isLoadingExplanation: false
            });
          } else {
            this.setData({
              explanationError: '获取解读失败，请重试',
              isLoadingExplanation: false
            });
          }
        })
        .catch(err => {
          console.error('调用AI失败', err);
          this.setData({
            explanationError: '网络错误，请重试',
            isLoadingExplanation: false
          });
        });
    } catch (error) {
      console.error('执行getWordExplanation时出错:', error);
      this.setData({
        explanationError: '系统错误，请重试',
        isLoadingExplanation: false
      });
    }
  },

  /**
   * 下一个词语
   */
  nextWord: function() {
    // 获取全局应用实例
    const app = getApp();
    
    // 确保当前学习组有效
    const currentGroup = app.ensureCurrentGroup();
    
    if (!currentGroup || !currentGroup.words) {
      wx.navigateBack();
      return;
    }
    
    // 获取当前词语
    const currentWord = this.data.currentWord;
    
    // 更新学习历史记录
    if (currentWord && currentWord.word) {
      // 获取学习历史记录
      const learningHistory = wx.getStorageSync('learningHistory') || {
        completedWords: [],
        reviewWords: [],
        lastReviewTime: null,
        stage: 1 // 学习阶段：1=初次学习，2=复习阶段
      };
      
      // 检查词语是否已在学习记录中
      const existingWordIndex = learningHistory.completedWords.findIndex(w => w.word === currentWord.word);
      
      if (existingWordIndex >= 0) {
        // 更新已有记录
        learningHistory.completedWords[existingWordIndex].lastLearned = new Date().toISOString();
        learningHistory.completedWords[existingWordIndex].learnCount = 
          (learningHistory.completedWords[existingWordIndex].learnCount || 0) + 1;
      } else {
        // 添加新记录
        learningHistory.completedWords.push({
          word: currentWord.word,
          lastLearned: new Date().toISOString(),
          learnCount: 1
        });
      }
      
      // 如果是复习阶段，从复习列表中移除已学习的词语
      if (learningHistory.stage === 2) {
        learningHistory.reviewWords = learningHistory.reviewWords.filter(w => w.word !== currentWord.word);
      }
      
      // 保存更新后的学习历史记录
      wx.setStorageSync('learningHistory', learningHistory);
      console.log('已更新学习历史记录:', learningHistory);
    }
    
    if (this.data.isLastWord) {
      // 如果是最后一个词，进入练习模式
      app.globalData.currentGroup.mode = 'practice';
      app.globalData.currentGroup.progress = 0;
      
      // 确保使用正确的路径
      wx.navigateTo({
        url: '/pages/practice/practice',
        fail: function(err) {
          console.error('跳转到练习页面失败:', err);
          wx.showToast({
            title: '无法进入练习页面',
            icon: 'none'
          });
        }
      });
    } else {
      // 更新进度
      app.globalData.currentGroup.progress = this.data.currentIndex + 1;
      
      // 加载下一个词
      this.loadCurrentGroup();
    }
  },

  /**
   * 返回
   */
  goBack: function() {
    wx.navigateBack();
  },

  /**
   * 处理图片加载错误
   */
  handleImageError: function(e) {
    console.error('图片加载错误:', e);
    
    // 获取当前词语
    const currentWord = this.data.currentWord;
    
    if (currentWord && currentWord.word) {
      // 尝试使用云存储路径
      const cloudPath = cloudImageConfig.getWordImagePath(currentWord.word);
      
      // 更新当前词语图片路径
      currentWord.imagePath = cloudPath;
      
      this.setData({
        currentWord: currentWord,
        imageDebugInfo: `尝试使用云存储路径: ${cloudPath}`
      });
    } else {
      // 使用默认图片
      if (currentWord) {
        currentWord.imagePath = this.data.defaultImagePath;
        
        this.setData({
          currentWord: currentWord,
          imageDebugInfo: '使用默认图片'
        });
      }
    }
  },

  /**
   * 检查管理员权限
   */
  checkAdminPermission: function() {
    // 暂时注释掉管理员权限检查，因为checkAdmin云函数不存在
    // wx.cloud.callFunction({
    //   name: 'checkAdmin'
    // }).then(res => {
    //   console.log('检查管理员权限结果:', res);
    //   this.setData({
    //     isAdmin: res.result && res.result.isAdmin
    //   });
    // }).catch(err => {
    //   console.error('检查管理员权限失败:', err);
    // });
    
    // 直接设置为非管理员
    this.setData({
      isAdmin: false
    });
  },
  
  /**
   * 初始化录音管理器
   */
  initRecorderManager: function() {
    // 创建录音管理器
    recorderManager = wx.getRecorderManager();
    
    // 监听录音开始事件
    recorderManager.onStart(() => {
      console.log('录音开始');
      this.setData({
        isRecording: true,
        recordingDuration: 0
      });
      
      // 开始计时
      recordingTimer = setInterval(() => {
        this.setData({
          recordingDuration: this.data.recordingDuration + 1
        });
      }, 1000);
    });
    
    // 监听录音停止事件
    recorderManager.onStop((res) => {
      console.log('录音停止', res);
      const { tempFilePath } = res;
      
      // 清除计时器
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      
      this.setData({
        isRecording: false,
        tempAudioFilePath: tempFilePath
      });
      
      // 如果录音时间太短（小于1秒），显示提示
      if (this.data.recordingDuration < 1) {
        wx.showToast({
          title: '录音时间太短',
          icon: 'none'
        });
        return;
      }
      
      // 播放录音预览
      this.playAudio(tempFilePath);
      
      // 询问是否使用这段录音
      wx.showModal({
        title: '录音完成',
        content: '是否使用这段录音？',
        success: (res) => {
          if (res.confirm) {
            this.uploadAudio();
          }
        }
      });
    });
    
    // 监听录音错误事件
    recorderManager.onError((res) => {
      console.error('录音错误:', res);
      
      // 清除计时器
      if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
      }
      
      this.setData({
        isRecording: false
      });
      
      wx.showToast({
        title: '录音失败: ' + res.errMsg,
        icon: 'none'
      });
    });
  },
  
  /**
   * 开始录音
   */
  startRecording: function() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '没有管理员权限',
        icon: 'none'
      });
      return;
    }
    
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.record']) {
          // 请求录音权限
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              this.doStartRecording();
            },
            fail: () => {
              wx.showToast({
                title: '需要录音权限',
                icon: 'none'
              });
            }
          });
        } else {
          this.doStartRecording();
        }
      }
    });
  },
  
  /**
   * 执行开始录音
   */
  doStartRecording: function() {
    // 如果已经在录音，不做任何操作
    if (this.data.isRecording) {
      return;
    }
    
    // 如果正在播放，停止播放
    if (this.data.isPlayingAudio && audioContext) {
      audioContext.stop();
      this.setData({
        isPlayingAudio: false
      });
    }
    
    // 开始录音
    recorderManager.start({
      duration: 60000, // 最长60秒
      sampleRate: 44100, // 采样率
      numberOfChannels: 1, // 录音通道数
      encodeBitRate: 192000, // 编码码率
      format: this.data.audioType, // 音频格式：aac或mp4
      frameSize: 50 // 指定帧大小
    });
    
    wx.showToast({
      title: '开始录音',
      icon: 'none'
    });
  },
  
  /**
   * 停止录音
   */
  stopRecording: function() {
    if (!this.data.isRecording) {
      return;
    }
    
    // 停止录音
    recorderManager.stop();
    
    wx.showToast({
      title: '录音结束',
      icon: 'none'
    });
  },
  
  /**
   * 切换录音状态（开始/停止）
   */
  toggleRecording: function() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '没有管理员权限',
        icon: 'none'
      });
      return;
    }
    
    if (this.data.isRecording) {
      this.stopRecording();
    } else {
      // 切换录音格式
      wx.showActionSheet({
        itemList: ['AAC格式', 'MP4格式'],
        success: (res) => {
          // 根据选择设置录音格式
          const format = res.tapIndex === 0 ? 'aac' : 'mp4';
          this.setData({
            audioType: format
          });
          
          wx.showToast({
            title: `已选择${format}格式`,
            icon: 'none'
          });
          
          // 开始录音
          setTimeout(() => {
            this.startRecording();
          }, 500);
        }
      });
    }
  },
  
  /**
   * 上传音频
   */
  uploadAudio: function() {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '没有管理员权限',
        icon: 'none'
      });
      return;
    }
    
    const currentWord = this.data.currentWord;
    if (!currentWord || !currentWord.word) {
      wx.showToast({
        title: '无法获取词语信息',
        icon: 'none'
      });
      return;
    }
    
    // 如果有临时录音文件，直接上传
    if (this.data.tempAudioFilePath) {
      this.doUploadAudio(this.data.tempAudioFilePath);
      return;
    }
    
    // 如果没有临时录音文件，选择音频文件
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['aac', 'mp4'],
      success: (res) => {
        if (res.tempFiles && res.tempFiles.length > 0) {
          const tempFilePath = res.tempFiles[0].path;
          
          // 检查文件类型
          const fileExtension = tempFilePath.substring(tempFilePath.lastIndexOf('.') + 1).toLowerCase();
          if (fileExtension !== 'aac' && fileExtension !== 'mp4') {
            wx.showToast({
              title: '仅支持AAC或MP4格式',
              icon: 'none'
            });
            return;
          }
          
          // 上传文件
          this.doUploadAudio(tempFilePath);
        }
      }
    });
  },
  
  /**
   * 执行音频上传
   */
  doUploadAudio: function(filePath) {
    const currentWord = this.data.currentWord;
    
    wx.showLoading({
      title: '上传中...',
      mask: true
    });
    
    // 调用服务上传音频
    wordService.uploadWordAudio(currentWord.word, filePath)
      .then(result => {
        wx.hideLoading();
        
        if (result.success) {
          wx.showToast({
            title: '上传成功',
            icon: 'success'
          });
          
          // 更新当前词语数据，添加音频文件ID
          currentWord.audioFileId = result.fileID;
          this.setData({
            currentWord: currentWord,
            tempAudioFilePath: '' // 清空临时文件
          });
        } else {
          wx.showToast({
            title: result.message || '上传失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('上传音频失败:', err);
        wx.showToast({
          title: '上传失败: ' + err.message,
          icon: 'none'
        });
      });
  },

  /**
   * 播放指定音频
   */
  /**
   * 播放当前词语的音频
   */
  playWordAudio: function() {
    const currentWord = this.data.currentWord;
    if (!currentWord) return;
    
    // 检查用户设置中的声音开关
    const userSettings = wx.getStorageSync('userSettings') || {};
    if (userSettings.soundEnabled === false) {
      return;
    }
    
    // 尝试播放词语音频
    if (currentWord.audioUrl) {
      this.playAudio(currentWord.audioUrl);
    }
  },

  playAudio: function(audioSrc) {
    // 检查用户声音设置
    const userSettings = wx.getStorageSync('userSettings') || {};
    if (userSettings.soundEnabled === false) {
      return; // 声音已关闭，不播放
    }
    
    // 设置音频源
    if (audioContext) {
      audioContext.src = audioSrc;
      
      // 开始播放
      audioContext.play();
      
      // 更新状态
      this.setData({
        isPlayingAudio: true,
        audioSrc: audioSrc
      });
      
      // 显示提示
      wx.showToast({
        title: '正在播放发音',
        icon: 'none',
        duration: 1500
      });
    } else {
      wx.showToast({
        title: '音频初始化失败',
        icon: 'none'
      });
    }
  }
})