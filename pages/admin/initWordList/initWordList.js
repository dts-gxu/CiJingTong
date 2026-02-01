Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLoading: false,
    result: null,
    forceReset: false,
    forceResetPinyin: false,
    isAdmin: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 不再检查管理员权限，直接设置为管理员
    this.setData({
      isAdmin: true
    });
  },

  /**
   * 检查管理员权限 - 已移除权限检查
   */
  checkAdminPermission: function() {
    // 不做任何权限检查，直接设置为管理员
    this.setData({
      isAdmin: true
    });
  },

  /**
   * 切换强制重置选项
   */
  toggleForceReset: function() {
    this.setData({
      forceReset: !this.data.forceReset
    });
  },

  /**
   * 切换强制重置拼音练习题选项
   */
  toggleForceResetPinyin: function() {
    this.setData({
      forceResetPinyin: !this.data.forceResetPinyin
    });
  },

  /**
   * 从本地文件导入词汇
   */
  chooseLocalFile: function() {
    if (this.data.isLoading) return;
    
    // 微信小程序API不直接支持文件选择，需要引导用户手动输入
    wx.showModal({
      title: '导入本地词汇',
      content: '请将JSON格式的词汇数据复制到下方文本框中',
      editable: true,
      placeholderText: '粘贴JSON数据...',
      success: res => {
        if (res.confirm && res.content) {
          this.processLocalData(res.content);
        }
      }
    });
  },
  
  /**
   * 处理本地数据
   */
  processLocalData: function(jsonContent) {
    try {
      // 尝试解析JSON数据
      let wordData = JSON.parse(jsonContent);
      
      // 确保数据是数组格式
      if (!Array.isArray(wordData)) {
        if (typeof wordData === 'object') {
          // 如果是对象，尝试提取其中的数组
          const possibleArrayKeys = Object.keys(wordData).filter(key => 
            Array.isArray(wordData[key]) && wordData[key].length > 0
          );
          
          if (possibleArrayKeys.length > 0) {
            wordData = wordData[possibleArrayKeys[0]];
          } else {
            // 将单个对象转换为数组
            wordData = [wordData];
          }
        } else {
          throw new Error('无法识别的数据格式，请提供JSON数组');
        }
      }
      
      // 检查数据有效性
      if (!wordData || wordData.length === 0) {
        throw new Error('没有找到有效的词汇数据');
      }
      
      // 检查数据格式
      const sampleWord = wordData[0];
      if (!sampleWord.word) {
        throw new Error('数据格式不正确，缺少必要的word字段');
      }
      
      console.log(`成功解析${wordData.length}条词汇数据`);
      
      // 显示确认对话框
      wx.showModal({
        title: '确认导入',
        content: `已解析${wordData.length}条词汇数据，是否导入到数据库？`,
        success: res => {
          if (res.confirm) {
            this.importLocalWords(wordData);
          }
        }
      });
      
    } catch (error) {
      console.error('处理本地数据失败:', error);
      wx.showToast({
        title: '数据格式错误: ' + error.message,
        icon: 'none'
      });
    }
  },
  
  /**
   * 导入本地词汇到数据库
   */
  importLocalWords: function(wordData) {
    this.setData({
      isLoading: true,
      result: null
    });
    
    wx.showLoading({
      title: '导入中...',
      mask: true
    });
    
    // 调用云函数导入词汇
    wx.cloud.callFunction({
      name: 'importLocalWords',
      data: {
        words: wordData,
        forceReset: this.data.forceReset
      }
    }).then(res => {
      console.log('导入本地词汇结果:', res);
      
      this.setData({
        result: res.result,
        isLoading: false
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '导入成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '导入失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('导入本地词汇失败:', err);
      
      this.setData({
        isLoading: false,
        result: {
          success: false,
          message: err.message || '未知错误'
        }
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    });
  },

  /**
   * 初始化word_list表
   */
  initWordList: function() {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true,
      result: null
    });
    
    wx.showLoading({
      title: '初始化中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'initWordList',
      data: {
        forceReset: this.data.forceReset
      }
    }).then(res => {
      console.log('初始化word_list表结果:', res);
      
      this.setData({
        result: res.result,
        isLoading: false
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '初始化成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '初始化失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('初始化word_list表失败:', err);
      
      this.setData({
        isLoading: false,
        result: {
          success: false,
          message: err.message || '未知错误'
        }
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '初始化失败',
        icon: 'none'
      });
    });
  },

  /**
   * 导入拼音练习题
   */
  importPinyinQuiz: function() {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true,
      result: null
    });
    
    wx.showLoading({
      title: '导入中...',
      mask: true
    });
    
    // 从本地文件读取拼音练习题数据
    const fs = wx.getFileSystemManager();
    
    try {
      // 读取pinyin.json文件
      fs.readFile({
        filePath: `${wx.env.USER_DATA_PATH}/pinyin.json`,
        encoding: 'utf8',
        success: (res) => {
          try {
            const pinyinData = JSON.parse(res.data);
            
            if (!pinyinData || !pinyinData.pinyin_quiz || !Array.isArray(pinyinData.pinyin_quiz)) {
              throw new Error('无法解析拼音练习题数据，请检查文件格式');
            }
            
            const quizData = pinyinData.pinyin_quiz;
            
            // 调用云函数导入拼音练习题
            wx.cloud.callFunction({
              name: 'importPinyinQuiz',
              data: {
                pinyinQuizData: quizData,
                forceReset: this.data.forceResetPinyin
              }
            }).then(res => {
              console.log('导入拼音练习题结果:', res);
              
              this.setData({
                result: res.result,
                isLoading: false
              });
              
              wx.hideLoading();
              
              if (res.result && res.result.success) {
                wx.showToast({
                  title: '导入成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result ? res.result.message : '导入失败',
                  icon: 'none'
                });
              }
            }).catch(err => {
              console.error('导入拼音练习题失败:', err);
              
              this.setData({
                isLoading: false,
                result: {
                  success: false,
                  message: err.message || '未知错误'
                }
              });
              
              wx.hideLoading();
              wx.showToast({
                title: '导入失败',
                icon: 'none'
              });
            });
          } catch (parseErr) {
            console.error('解析拼音练习题数据失败:', parseErr);
            
            this.setData({
              isLoading: false,
              result: {
                success: false,
                message: '解析拼音练习题数据失败: ' + parseErr.message
              }
            });
            
            wx.hideLoading();
            wx.showToast({
              title: '解析数据失败',
              icon: 'none'
            });
          }
        },
        fail: (err) => {
          console.error('读取pinyin.json文件失败:', err);
          
          // 如果文件不存在，尝试从项目根目录读取
          this.readPinyinFromProjectRoot();
        }
      });
    } catch (err) {
      console.error('读取文件失败:', err);
      
      // 尝试从项目根目录读取
      this.readPinyinFromProjectRoot();
    }
  },
  
  /**
   * 从项目根目录读取pinyin.json文件
   */
  readPinyinFromProjectRoot: function() {
    wx.request({
      url: '/pinyin.json',
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const pinyinData = res.data;
          
          if (!pinyinData || !pinyinData.pinyin_quiz || !Array.isArray(pinyinData.pinyin_quiz)) {
            this.showPinyinDataInputDialog();
            return;
          }
          
          // 调用云函数导入拼音练习题
          this.callImportPinyinQuizFunction(pinyinData.pinyin_quiz);
        } else {
          this.showPinyinDataInputDialog();
        }
      },
      fail: (err) => {
        console.error('请求pinyin.json文件失败:', err);
        this.showPinyinDataInputDialog();
      }
    });
  },
  
  /**
   * 显示拼音数据输入对话框
   */
  showPinyinDataInputDialog: function() {
    wx.hideLoading();
    
    wx.showModal({
      title: '导入拼音练习题',
      content: '未找到pinyin.json文件，请手动输入拼音练习题数据',
      editable: true,
      placeholderText: '粘贴JSON数据...',
      success: res => {
        if (res.confirm && res.content) {
          try {
            const pinyinData = JSON.parse(res.content);
            
            if (pinyinData.pinyin_quiz && Array.isArray(pinyinData.pinyin_quiz)) {
              // 调用云函数导入拼音练习题
              this.callImportPinyinQuizFunction(pinyinData.pinyin_quiz);
            } else if (Array.isArray(pinyinData)) {
              // 如果直接是数组，假设是拼音练习题数组
              this.callImportPinyinQuizFunction(pinyinData);
            } else {
              throw new Error('无法识别的数据格式，请提供正确的拼音练习题数据');
            }
          } catch (err) {
            console.error('解析拼音练习题数据失败:', err);
            
            this.setData({
              isLoading: false,
              result: {
                success: false,
                message: '解析拼音练习题数据失败: ' + err.message
              }
            });
            
            wx.showToast({
              title: '解析数据失败',
              icon: 'none'
            });
          }
        } else {
          this.setData({ isLoading: false });
        }
      }
    });
  },
  
  /**
   * 调用导入拼音练习题云函数
   */
  callImportPinyinQuizFunction: function(quizData) {
    wx.showLoading({
      title: '导入中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'importPinyinQuiz',
      data: {
        pinyinQuizData: quizData,
        forceReset: this.data.forceResetPinyin
      }
    }).then(res => {
      console.log('导入拼音练习题结果:', res);
      
      this.setData({
        result: res.result,
        isLoading: false
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '导入成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: res.result ? res.result.message : '导入失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('导入拼音练习题失败:', err);
      
      this.setData({
        isLoading: false,
        result: {
          success: false,
          message: err.message || '未知错误'
        }
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    });
  },

  /**
   * 返回上一页
   */
  goBack: function() {
    wx.navigateBack();
  }
}); 