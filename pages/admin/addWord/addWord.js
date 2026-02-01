const app = getApp();

Page({

  /**
   * 页面的初始数据
   */
  data: {
    activeTab: 'single', // 'single' 或 'batch'
    
    // 单个添加的词语数据
    wordData: {
      word: '',                    // 词语
      pinyin: '',                  // 拼音
      translation: '',             // 英语翻译（中文释义）
      turkmenTranslation: '',      // 土库曼语翻译
      example: {                   // 例句
        chinese: '',               // 中文例句
        pinyin: '',                // 例句拼音
        translation: ''            // 例句翻译
      },
      imageUrl: '',                // 图片URL
      pinyinQuiz: {                // 看词语选拼音
        options: {
          options: [
            { label: 'A', value: '' },
            { label: 'B', value: '' },
            { label: 'C', value: '' },
            { label: 'D', value: '' }
          ],
          correctOption: 'A'
        }
      },
      fillBlank: {                 // 选词填空
        sentence: '',              // 完整句子
        prefix: '',                // 前缀
        suffix: '',                // 后缀
        answer: ''                 // 答案
      }
    },
    
    correctAnswerIndex: 0,         // 正确答案索引
    showImageUpload: false,        // 是否显示图片上传
    isSubmitting: false,           // 是否正在提交
    errorMessage: '',              // 错误消息
    successMessage: '',            // 成功消息
    
    // 批量导入相关
    fileSelected: false,
    fileName: '',
    tempFilePath: '',
    isUploading: false,
    uploadSuccess: false,
    uploadError: '',
    importedCount: 0,
    isLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化时确保数据结构完整
    this.initWordData();
  },

  onShow: function() {
    // 页面显示时不需要特殊处理
  },

  /**
   * 初始化词语数据结构
   */
  initWordData: function() {
    const wordData = this.data.wordData;
    // 确保数据结构完整
    if (!wordData.word) wordData.word = '';
    if (!wordData.pinyin) wordData.pinyin = '';
    if (!wordData.translation) wordData.translation = '';
    if (!wordData.turkmenTranslation) wordData.turkmenTranslation = '';
    if (!wordData.imageUrl) wordData.imageUrl = '';
    
    if (!wordData.example) {
      wordData.example = { chinese: '', pinyin: '', translation: '' };
    }
    if (!wordData.pinyinQuiz || !wordData.pinyinQuiz.options) {
      wordData.pinyinQuiz = {
        options: {
          options: [
            { label: 'A', value: '' },
            { label: 'B', value: '' },
            { label: 'C', value: '' },
            { label: 'D', value: '' }
          ],
          correctOption: 'A'
        }
      };
    }
    if (!wordData.fillBlank) {
      wordData.fillBlank = { sentence: '', prefix: '', suffix: '', answer: '' };
    }
    this.setData({ wordData });
  },

  /**
   * 切换标签页
   */
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      errorMessage: '',
      successMessage: '',
      uploadSuccess: false,
      uploadError: ''
    });
  },

  /**
   * 处理输入变化 - 通用函数
   */
  handleInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const wordData = this.data.wordData;
    

    
    // 处理嵌套字段
    if (field.includes('.')) {
      const fieldPath = field.split('.');
      if (fieldPath.length === 2) {
        wordData[fieldPath[0]][fieldPath[1]] = value;
      }
    } else {
      wordData[field] = value;
    }
    
    // 如果是词语字段变化，自动填充填空练习的答案
    if (field === 'word' && value) {
      wordData.fillBlank.answer = value;
    }
    
    this.setData({
      wordData,
      errorMessage: '',
      successMessage: ''
    });
  },
  
  /**
   * 处理拼音选项输入变化
   */
  onPinyinOptionChange: function(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const wordData = this.data.wordData;
    
    if (wordData.pinyinQuiz.options.options[index]) {
      wordData.pinyinQuiz.options.options[index].value = value;
      this.setData({ wordData });
    }
  },

  /**
   * 处理正确答案选择变化
   */
  onCorrectAnswerChange: function(e) {
    const index = parseInt(e.detail.value);
    const correctOption = ['A', 'B', 'C', 'D'][index];
    const wordData = this.data.wordData;
    
    wordData.pinyinQuiz.options.correctOption = correctOption;
    
    this.setData({
      wordData,
      correctAnswerIndex: index
    });
  },
  
  /**
   * 处理填空练习相关字段
   */
  onFillBlankChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const wordData = this.data.wordData;
    
    wordData.fillBlank[field] = value;
    this.setData({ wordData });
  },
  
  /**
   * 显示图片上传
   */
  showImageUpload: function() {
    this.setData({ showImageUpload: true });
  },

  /**
   * 隐藏图片上传
   */
  hideImageUpload: function() {
    this.setData({ showImageUpload: false });
  },

  /**
   * 选择图片
   */
  chooseImage: function() {
    const that = this;
    wx.chooseImage({
      count: 1,
      sizeType: ['original', 'compressed'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        const tempFilePath = res.tempFilePaths[0];
        that.uploadImage(tempFilePath);
      },
      fail: function (err) {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 上传图片
   */
  uploadImage: function(filePath) {
    const that = this;
    const wordData = this.data.wordData;
    
    wx.showLoading({
      title: '上传中...'
    });

    // 上传到云存储
    wx.cloud.uploadFile({
      cloudPath: `word-images/${wordData.word || 'temp'}-${Date.now()}.jpg`,
      filePath: filePath,
      success: function(res) {
        console.log('图片上传成功:', res);
        
        // 更新词语的图片URL
        wordData.imageUrl = res.fileID;
        that.setData({ 
          wordData,
          showImageUpload: false
        });
        
        wx.hideLoading();
        wx.showToast({
          title: '图片上传成功',
          icon: 'success'
        });
      },
      fail: function(err) {
        console.error('图片上传失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '图片上传失败',
          icon: 'none'
        });
      }
    });
  },
  
  /**
   * 删除图片
   */
  deleteImage: function() {
    const wordData = this.data.wordData;
    wordData.imageUrl = '';
    this.setData({ wordData });
    
    wx.showToast({
      title: '图片已删除',
      icon: 'success'
    });
  },
  
  /**
   * 验证表单数据
   */
  validateForm: function() {
    const wordData = this.data.wordData;
    
    if (!wordData.word || !wordData.word.trim()) {
      this.setData({ errorMessage: '词语不能为空' });
      return false;
    }
    
    if (!wordData.pinyin.trim()) {
      this.setData({ errorMessage: '拼音不能为空' });
      return false;
    }
    
    // 检查拼音练习选项
    const hasEmptyOption = wordData.pinyinQuiz.options.options.some(option => !option.value.trim());
    if (hasEmptyOption) {
      this.setData({ errorMessage: '拼音练习的所有选项都不能为空' });
      return false;
    }
    
    return true;
  },

  /**
   * 提交表单
   */
  submitForm: function() {
    if (!this.validateForm()) {
      return;
    }
    
    this.setData({ 
      isSubmitting: true,
      errorMessage: '',
      successMessage: ''
    });
    
    wx.showLoading({
      title: '添加中...'
    });
    
    const wordData = this.data.wordData;
    
    // 准备要保存的数据
    const saveData = {
      word: (wordData.word || '').trim(),
      pinyin: (wordData.pinyin || '').trim(),
      translation: (wordData.translation || '').trim(),
      turkmenTranslation: (wordData.turkmenTranslation || '').trim(),
      example: {
        chinese: (wordData.example.chinese || '').trim(),
        pinyin: (wordData.example.pinyin || '').trim(),
        translation: (wordData.example.translation || '').trim()
      },
      pinyinQuiz: {
        options: {
          options: wordData.pinyinQuiz.options.options.map(option => ({
            label: option.label,
            value: option.value.trim()
          })),
          correctOption: wordData.pinyinQuiz.options.correctOption
        }
      },
      fillBlank: {
        sentence: (wordData.fillBlank.sentence || '').trim(),
        prefix: (wordData.fillBlank.prefix || '').trim(),
        suffix: (wordData.fillBlank.suffix || '').trim(),
        answer: (wordData.fillBlank.answer || '').trim()
      },
      addTime: new Date().toISOString()
    };
    
    // 如果有图片，添加图片URL
    if (wordData.imageUrl) {
      saveData.imageUrl = wordData.imageUrl;
    }
    

    
    // 使用云函数添加词语
    wx.cloud.callFunction({
      name: 'addWord',
      data: {
        wordData: saveData
      },
      success: res => {
        console.log('添加词语成功:', res);
      wx.hideLoading();
        
        if (res.result && res.result.code === 0) {
      this.setData({
            isSubmitting: false,
            successMessage: '词语添加成功！',
            errorMessage: ''
          });
          
          // 重置表单
          this.resetForm();
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
          
          // 不调用用户数据同步，避免登录检查
          // getApp().saveUserData();
        } else {
          this.setData({
            isSubmitting: false,
            errorMessage: '添加失败: ' + (res.result ? res.result.message : '未知错误')
          });
          
          wx.showToast({
            title: '添加失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('添加词语失败:', err);
      wx.hideLoading();
        
      this.setData({
          isSubmitting: false,
          errorMessage: '添加失败: ' + err.errMsg
      });
      
      wx.showToast({
        title: '添加失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 重置表单
   */
  resetForm: function() {
    this.setData({
      wordData: {
        word: '',
        pinyin: '',
        translation: '',
        turkmenTranslation: '',
        example: {
          chinese: '',
          pinyin: '',
          translation: ''
        },
        imageUrl: '',
        pinyinQuiz: {
          options: {
            options: [
              { label: 'A', value: '' },
              { label: 'B', value: '' },
              { label: 'C', value: '' },
              { label: 'D', value: '' }
            ],
            correctOption: 'A'
          }
        },
        fillBlank: {
          sentence: '',
          prefix: '',
          suffix: '',
          answer: ''
        }
      },
      correctAnswerIndex: 0,
      showImageUpload: false
    });
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack();
  },

  /**
   * 选择Excel文件
   */
  chooseFile: function() {
    const that = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls', 'csv'],
      success: function(res) {
        const tempFile = res.tempFiles[0];
        that.setData({
          fileSelected: true,
          fileName: tempFile.name,
          tempFilePath: tempFile.path,
          uploadSuccess: false,
          uploadError: ''
        });
      },
      fail: function(err) {
        console.error('选择文件失败:', err);
        wx.showToast({
          title: '选择文件失败',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 上传文件并导入词语
   */
  uploadFile: function() {
    if (!this.data.fileSelected) {
      this.setData({
        uploadError: '请先选择文件'
      });
      return;
    }
    
    this.setData({
      isUploading: true,
      uploadSuccess: false,
      uploadError: ''
    });
    
    wx.showLoading({
      title: '上传中...'
    });
    
    const that = this;
    const cloudPath = 'word_imports/' + new Date().getTime() + '_' + this.data.fileName;
    
    // 上传文件到云存储
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: this.data.tempFilePath,
      success: res => {
        const fileID = res.fileID;
        
        // 调用云函数处理Excel文件
        wx.cloud.callFunction({
          name: 'importWords',
          data: {
            fileID: fileID,
            collectionName: 'words_data'
          },
          success: result => {
            wx.hideLoading();
            const data = result.result;
            
            if (data.success) {
              that.setData({
                isUploading: false,
                uploadSuccess: true,
                uploadError: '',
                importedCount: data.importCount,
                fileSelected: false,
                fileName: '',
                tempFilePath: ''
              });
              
              wx.showToast({
                title: '导入成功',
                icon: 'success'
              });
            } else {
              that.setData({
                isUploading: false,
                uploadSuccess: false,
                uploadError: data.message || '导入失败'
              });
              
              wx.showToast({
                title: '导入失败',
                icon: 'error'
              });
            }
          },
          fail: err => {
            wx.hideLoading();
            console.error('调用云函数失败:', err);
            that.setData({
              isUploading: false,
              uploadSuccess: false,
              uploadError: '导入失败: ' + err.message
            });
            
            wx.showToast({
              title: '导入失败',
              icon: 'error'
            });
          }
        });
      },
      fail: err => {
        wx.hideLoading();
        console.error('上传文件失败:', err);
        that.setData({
          isUploading: false,
          uploadSuccess: false,
          uploadError: '上传文件失败: ' + err.message
        });
        
        wx.showToast({
          title: '上传失败',
          icon: 'error'
        });
      }
    });
  }
}); 