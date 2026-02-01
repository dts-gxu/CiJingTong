Page({

  /**
   * 页面的初始数据
   */
  data: {
    words: [], // 所有词语
    filteredWords: [], // 过滤后的词语
    searchKeyword: '', // 搜索关键词
    isLoading: false, // 是否正在加载
    showEditModal: false, // 是否显示编辑弹窗
    editingWord: null, // 当前编辑的词语
    correctAnswerIndex: 0, // 正确答案的索引
    pageSize: 50, // 每页显示的词语数量
    currentPage: 1, // 当前页码
    totalPages: 1, // 总页数
    selectAll: false, // 是否全选
    showDeleteModal: false, // 是否显示删除确认弹窗
    wordToDelete: '', // 要删除的词语
    wordIdToDelete: '', // 要删除的词语ID
    showBatchDeleteModal: false, // 是否显示批量删除确认弹窗
    selectedCount: 0, // 选中的词语数量
    showCleanupModal: false, // 是否显示清理旧数据确认弹窗
    showImageUpload: false // 是否显示图片上传
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 直接加载词语，不检查权限
    this.loadWords();
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 不检查权限
  },

  /**
   * 检查管理员权限 - 已移除权限检查
   */
  checkAdminAuth: function() {
    // 不做任何权限检查，直接返回
    return true;
  },

  /**
   * 确保拼音选项完整
   */
  ensurePinyinOptions: function(pinyinQuiz) {
    const defaultOptions = [
      { label: 'A', value: '' },
      { label: 'B', value: '' },
      { label: 'C', value: '' },
      { label: 'D', value: '' }
    ];

    if (!pinyinQuiz || !pinyinQuiz.options || !pinyinQuiz.options.options) {
      return defaultOptions;
    }

    const options = pinyinQuiz.options.options;
    const result = [];

    for (let i = 0; i < 4; i++) {
      if (options[i] && options[i].label && options[i].value !== undefined) {
        result[i] = {
          label: ['A', 'B', 'C', 'D'][i],
          value: options[i].value || ''
        };
      } else {
        result[i] = {
          label: ['A', 'B', 'C', 'D'][i],
          value: ''
        };
      }
    }

    return result;
  },

  /**
   * 加载词语数据
   */
  loadWords: function() {
    this.setData({ isLoading: true });
    
    console.log('开始加载词语数据');
    
    wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'getWords'
      },
      success: res => {
        console.log('获取词语数据响应:', res);
        console.log('响应结果详情:', JSON.stringify(res.result));
        
        if (res.result && res.result.code === 0) {
          const words = res.result.data || [];
          // 为每个词语添加selected属性
          const wordsWithSelection = words.map(word => ({
            ...word,
            selected: false
          }));
          const totalPages = Math.ceil(wordsWithSelection.length / this.data.pageSize);
          
          console.log(`成功获取${wordsWithSelection.length}个词语`);
          
          this.setData({
            words: wordsWithSelection,
            totalPages: totalPages > 0 ? totalPages : 1,
            isLoading: false,
            selectAll: false,
            selectedCount: 0
          });
          
          this.updateFilteredWords();
        } else {
          console.error('获取词语失败:', res);
          console.error('失败原因:', res.result ? res.result.message : '未知错误');
          this.setData({ isLoading: false });
          
          // 尝试加载本地词语数据作为备用
          this.loadLocalWords();
          
          wx.showToast({
            title: '获取词语失败: ' + (res.result ? res.result.message : '未知错误'),
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: err => {
        console.error('调用获取词语云函数失败:', err);
        this.setData({ isLoading: false });
        
        // 尝试加载本地词语数据作为备用
        this.loadLocalWords();
        
        wx.showToast({
          title: '获取词语失败: ' + err.errMsg,
          icon: 'none',
          duration: 3000
        });
      }
    });
  },

  /**
   * 加载本地词语数据（作为备用）
   */
  loadLocalWords: function() {
    console.log('尝试加载本地词语数据');
    
    try {
      // 尝试从全局数据获取词语
      const app = getApp();
      let words = [];
      
      if (app.globalData && app.globalData.words) {
        words = app.globalData.words;
      } else if (app.globalData && app.globalData.currentGroup && app.globalData.currentGroup.words) {
        words = app.globalData.currentGroup.words;
      }
      
      if (words && words.length > 0) {
        console.log(`从本地获取到${words.length}个词语`);
        
        // 确保每个词语都有_id字段，并添加selected属性
        words = words.map((word, index) => {
          if (!word._id) {
            word._id = 'local_' + index;
          }
          return {
            ...word,
            selected: false
          };
        });
        
        const totalPages = Math.ceil(words.length / this.data.pageSize);
        
        this.setData({
          words: words,
          totalPages: totalPages > 0 ? totalPages : 1,
          selectAll: false,
          selectedCount: 0
        });
        
        this.updateFilteredWords();
        
        wx.showToast({
          title: '已加载本地词语数据',
          icon: 'none'
        });
      } else {
        console.log('未找到本地词语数据');
        
        // 创建一个示例词语，以便界面不会完全空白
        const sampleWords = [{
          _id: 'sample_1',
          word: '示例词语',
          pinyin: 'shì lì cí yǔ',
          translation: '这是一个示例词语',
          turkmenTranslation: '',
          example: { chinese: '这是一个示例词语的例句。' },
          pinyinQuiz: {
            options: {
              options: [
                { label: 'A', value: 'shì lì cí yǔ' },
                { label: 'B', value: 'shì lì' },
                { label: 'C', value: 'cí yǔ' },
                { label: 'D', value: 'shì yǔ' }
              ],
              correctOption: 'A'
            }
          },
          fillBlank: {
            sentence: '这是一个（）的例句。',
            prefix: '这是一个',
            suffix: '的例句。',
            answer: '示例词语'
          },
          selected: false
        }];
        
        this.setData({
          words: sampleWords,
          totalPages: 1,
          selectAll: false,
          selectedCount: 0
        });
        
        this.updateFilteredWords();
      }
    } catch (error) {
      console.error('加载本地词语数据失败:', error);
    }
  },

  /**
   * 更新过滤后的词语列表
   */
  updateFilteredWords: function() {
    let filteredWords = [...this.data.words];
    
    console.log(`总词语数量: ${this.data.words.length}`);
    
    // 搜索过滤
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase();
      filteredWords = filteredWords.filter(word => 
        word.word.toLowerCase().includes(keyword) || 
        word.pinyin.toLowerCase().includes(keyword) ||
        (word.translation && word.translation.toLowerCase().includes(keyword))
      );
      console.log(`搜索后词语数量: ${filteredWords.length}`);
    }
    
    // 计算总页数
    const totalPages = Math.ceil(filteredWords.length / this.data.pageSize);
    console.log(`每页显示: ${this.data.pageSize}条, 总页数: ${totalPages}`);
    
    // 分页处理
    const start = (this.data.currentPage - 1) * this.data.pageSize;
    const end = start + this.data.pageSize;
    const pagedWords = filteredWords.slice(start, end);
    
    console.log(`当前页: ${this.data.currentPage}, 显示范围: ${start}-${end}, 本页词语数: ${pagedWords.length}`);
    
    // 计算选中的词语数量
    const selectedCount = this.data.words.filter(word => word.selected).length;
    
    this.setData({
      filteredWords: pagedWords,
      totalPages: totalPages > 0 ? totalPages : 1,
      selectedCount: selectedCount
    });
  },

  /**
   * 搜索输入变化处理
   */
  onSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  /**
   * 执行搜索
   */
  searchWord: function() {
    this.setData({ currentPage: 1 }); // 重置到第一页
    this.updateFilteredWords();
  },

  /**
   * 清除搜索
   */
  clearSearch: function() {
    this.setData({ 
      searchKeyword: '',
      currentPage: 1
    });
    this.updateFilteredWords();
  },

  /**
   * 上一页
   */
  prevPage: function() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      });
      this.updateFilteredWords();
    }
  },

  /**
   * 下一页
   */
  nextPage: function() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      });
      this.updateFilteredWords();
    }
  },

  /**
   * 编辑词语
   */
  editWord: function(e) {
    const wordId = e.currentTarget.dataset.wordId;
    const word = this.data.words.find(w => w._id === wordId);
    
    if (word) {
      // 完整的编辑词语信息，包含所有字段
      const editingWord = {
        _id: word._id,
        word: word.word || '',
        pinyin: word.pinyin || '',
        translation: word.translation || '',
        turkmenTranslation: word.turkmenTranslation || '',
        example: {
          chinese: (word.example && typeof word.example === 'object' && word.example.chinese) || 
                   (typeof word.example === 'string' ? word.example : '') || ''
        },
        pinyinQuiz: {
          options: {
            options: this.ensurePinyinOptions(word.pinyinQuiz),
            correctOption: (word.pinyinQuiz && word.pinyinQuiz.options && word.pinyinQuiz.options.correctOption) || 'A'
          }
        },
        fillBlank: {
          sentence: (word.fillBlank && word.fillBlank.sentence) || '',
          prefix: (word.fillBlank && word.fillBlank.prefix) || '',
          suffix: (word.fillBlank && word.fillBlank.suffix) || '',
          answer: (word.fillBlank && word.fillBlank.answer) || word.word || ''
        },
        imageUrl: word.imageUrl || ''
      };
      
      // 设置正确答案的索引
      const correctAnswerIndex = ['A', 'B', 'C', 'D'].indexOf(editingWord.pinyinQuiz.options.correctOption);
      
      this.setData({
        editingWord: editingWord,
        correctAnswerIndex: correctAnswerIndex >= 0 ? correctAnswerIndex : 0,
        showEditModal: true
      });
    }
  },

  /**
   * 关闭编辑弹窗
   */
  closeEditModal: function() {
    this.setData({
      showEditModal: false,
      editingWord: null,
      showImageUpload: false
    });
  },

  /**
   * 词语输入变化处理
   */
  onWordChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.word = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 拼音输入变化处理
   */
  onPinyinChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.pinyin = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 汉语释义输入变化处理
   */
  onTranslationChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.translation = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 土库曼语释义输入变化处理
   */
  onTurkmenTranslationChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.turkmenTranslation = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 例句输入变化处理
   */
  onExampleChineseChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.example.chinese = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 拼音选项输入变化处理
   */
  onPinyinOptionChange: function(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const editingWord = this.data.editingWord;
    
    if (editingWord.pinyinQuiz.options.options[index]) {
      editingWord.pinyinQuiz.options.options[index].value = value;
      this.setData({ editingWord });
    }
  },

  /**
   * 正确答案选择变化处理
   */
  onCorrectAnswerChange: function(e) {
    const index = parseInt(e.detail.value);
    const correctOption = ['A', 'B', 'C', 'D'][index];
    const editingWord = this.data.editingWord;
    
    editingWord.pinyinQuiz.options.correctOption = correctOption;
    
    this.setData({ 
      editingWord,
      correctAnswerIndex: index
    });
  },

  /**
   * 填空练习句子输入变化处理
   */
  onSentenceChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.fillBlank.sentence = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 填空练习前缀输入变化处理
   */
  onPrefixChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.fillBlank.prefix = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 填空练习后缀输入变化处理
   */
  onSuffixChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.fillBlank.suffix = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 填空练习答案输入变化处理
   */
  onFillBlankAnswerChange: function(e) {
    const editingWord = this.data.editingWord;
    editingWord.fillBlank.answer = e.detail.value;
    this.setData({ editingWord });
  },

  /**
   * 显示图片上传
   */
  showImageUpload: function() {
    this.setData({
      showImageUpload: true
    });
  },

  /**
   * 隐藏图片上传
   */
  hideImageUpload: function() {
    this.setData({
      showImageUpload: false
    });
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
    const editingWord = this.data.editingWord;
    
    wx.showLoading({
      title: '上传中...'
    });

    // 上传到云存储
    wx.cloud.uploadFile({
      cloudPath: `word-images/${editingWord.word}-${Date.now()}.jpg`,
      filePath: filePath,
      success: function(res) {
        console.log('图片上传成功:', res);
        
        // 更新编辑中的词语的图片URL
        editingWord.imageUrl = res.fileID;
        that.setData({ 
          editingWord,
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
    const editingWord = this.data.editingWord;
    editingWord.imageUrl = '';
    this.setData({ editingWord });
    
    wx.showToast({
      title: '图片已删除',
      icon: 'success'
    });
  },

  /**
   * 保存编辑的词语
   */
  saveEditedWord: function() {
    const editingWord = this.data.editingWord;
    
    // 基本验证
    if (!editingWord.word || !editingWord.word.trim()) {
      wx.showToast({
        title: '词语不能为空',
        icon: 'none'
      });
      return;
    }
    
    if (!editingWord.pinyin || !editingWord.pinyin.trim()) {
      wx.showToast({
        title: '拼音不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 验证拼音练习选项
    const pinyinOptions = editingWord.pinyinQuiz.options.options;
    const hasEmptyOption = pinyinOptions.some(option => !option.value || !option.value.trim());
    if (hasEmptyOption) {
      wx.showToast({
        title: '拼音练习的所有选项都不能为空',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ isLoading: true });
    
    // 准备保存的数据
    const updatedWord = {
      word: (editingWord.word || '').trim(),
      pinyin: (editingWord.pinyin || '').trim(),
      translation: (editingWord.translation || '').trim(),
      turkmenTranslation: (editingWord.turkmenTranslation || '').trim(),
      example: {
        chinese: (editingWord.example.chinese || '').trim()
      },
      pinyinQuiz: {
        options: {
          options: editingWord.pinyinQuiz.options.options.map(option => ({
            label: option.label,
            value: option.value.trim()
          })),
          correctOption: editingWord.pinyinQuiz.options.correctOption
        }
      },
      fillBlank: {
        sentence: (editingWord.fillBlank.sentence || '').trim(),
        prefix: (editingWord.fillBlank.prefix || '').trim(),
        suffix: (editingWord.fillBlank.suffix || '').trim(),
        answer: (editingWord.fillBlank.answer || '').trim()
      }
    };

    // 如果有图片URL，添加到数据中
    if (editingWord.imageUrl) {
      updatedWord.imageUrl = editingWord.imageUrl;
    }
    
    console.log('准备保存的词语数据:', updatedWord);
    
    wx.showLoading({
      title: '保存中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'updateWord',
      data: {
        wordId: editingWord._id,
        wordData: updatedWord
      },
      success: res => {
        console.log('保存词语响应:', res);
        wx.hideLoading();
        
        if (res.result && res.result.code === 0) {
          this.setData({
            showEditModal: false,
            editingWord: null,
            isLoading: false,
            showImageUpload: false
          });
          
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            duration: 2000
          });
          
          // 重新加载词语列表
          setTimeout(() => {
          this.loadWords();
          }, 500);
        } else {
          this.setData({ isLoading: false });
          
          const errorMsg = res.result ? res.result.message : '未知错误';
          wx.showModal({
            title: '保存失败',
            content: errorMsg,
            showCancel: false,
            confirmText: '确定'
          });
        }
      },
      fail: err => {
        console.error('保存词语失败:', err);
        wx.hideLoading();
        this.setData({ isLoading: false });
        
        wx.showModal({
          title: '保存失败',
          content: '网络错误，请检查网络连接后重试',
          showCancel: false,
          confirmText: '确定'
        });
      }
    });
  },

  /**
   * 页码输入变化处理
   */
  onPageInput: function(e) {
    this.inputPage = parseInt(e.detail.value);
  },

  /**
   * 跳转到指定页面
   */
  jumpToPage: function() {
    if (!this.inputPage) return;
    
    let targetPage = this.inputPage;
    
    // 确保页码在有效范围内
    if (targetPage < 1) {
      targetPage = 1;
    } else if (targetPage > this.data.totalPages) {
      targetPage = this.data.totalPages;
    }
    
    if (targetPage !== this.data.currentPage) {
      this.setData({
        currentPage: targetPage
      });
      this.updateFilteredWords();
    }
  },

  /**
   * 切换全选状态
   */
  toggleSelectAll: function() {
    const newSelectAll = !this.data.selectAll;
    
    // 更新所有词语的选择状态
    const updatedWords = this.data.words.map(word => ({
      ...word,
      selected: newSelectAll
    }));
    
    this.setData({
      words: updatedWords,
      selectAll: newSelectAll,
      selectedCount: newSelectAll ? updatedWords.length : 0
    });
    
    // 更新当前页显示
    this.updateFilteredWords();
  },

  /**
   * 切换单个词语的选择状态
   */
  toggleSelect: function(e) {
    const index = e.currentTarget.dataset.index;
    const currentPageStart = (this.data.currentPage - 1) * this.data.pageSize;
    const wordIndex = currentPageStart + index;
    
    if (wordIndex >= 0 && wordIndex < this.data.words.length) {
      // 获取当前页面显示的词语ID
      const wordId = this.data.filteredWords[index]._id;
      
      // 在全部词语中找到对应的词语并更新选择状态
      const updatedWords = [...this.data.words];
      const wordIndexInAll = updatedWords.findIndex(w => w._id === wordId);
      
      if (wordIndexInAll !== -1) {
        updatedWords[wordIndexInAll].selected = !updatedWords[wordIndexInAll].selected;
        
        // 计算选中的词语数量
        const selectedCount = updatedWords.filter(word => word.selected).length;
        
        // 检查是否全部选中
        const selectAll = selectedCount === updatedWords.length;
        
        this.setData({
          words: updatedWords,
          selectAll: selectAll,
          selectedCount: selectedCount
        });
        
        // 更新当前页显示
        this.updateFilteredWords();
      }
    }
  },

  /**
   * 显示删除确认弹窗
   */
  showDeleteWordConfirm: function(e) {
    const wordId = e.currentTarget.dataset.wordId;
    const word = e.currentTarget.dataset.word;
    
    this.setData({
      showDeleteModal: true,
      wordToDelete: word,
      wordIdToDelete: wordId
    });
  },

  /**
   * 关闭删除确认弹窗
   */
  closeDeleteModal: function() {
    this.setData({
      showDeleteModal: false,
      wordToDelete: '',
      wordIdToDelete: ''
    });
  },

  /**
   * 确认删除单个词语
   */
  confirmDelete: function() {
    if (!this.data.wordIdToDelete) {
      this.closeDeleteModal();
      return;
    }
    
    wx.showLoading({
      title: '删除中...',
      mask: true
    });
    
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'deleteWord',
        wordId: this.data.wordIdToDelete
      },
      success: res => {
        wx.hideLoading();
        
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 2000
          });
          
          this.closeDeleteModal();
          
          // 重新加载词语列表
          setTimeout(() => {
          this.loadWords();
          }, 500);
        } else {
          this.setData({ isLoading: false });
          
          const errorMsg = res.result ? res.result.message : '未知错误';
          wx.showModal({
            title: '删除失败',
            content: errorMsg,
            showCancel: false,
            confirmText: '确定'
          });
        
        this.closeDeleteModal();
        }
      },
      fail: err => {
        console.error('删除词语失败:', err);
        wx.hideLoading();
        this.setData({ isLoading: false });
        
        wx.showModal({
          title: '删除失败',
          content: '网络错误，请检查网络连接后重试',
          showCancel: false,
          confirmText: '确定'
        });
        
        this.closeDeleteModal();
      }
    });
  },

  /**
   * 显示批量删除确认弹窗
   */
  showDeleteConfirm: function() {
    const selectedCount = this.data.words.filter(word => word.selected).length;
    
    if (selectedCount === 0) {
      wx.showToast({
        title: '请先选择要删除的词语',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      showBatchDeleteModal: true
    });
  },

  /**
   * 关闭批量删除确认弹窗
   */
  closeBatchDeleteModal: function() {
    this.setData({
      showBatchDeleteModal: false
    });
  },

  /**
   * 确认批量删除词语
   */
  confirmBatchDelete: function() {
    const selectedWords = this.data.words.filter(word => word.selected);
    
    if (selectedWords.length === 0) {
      this.closeBatchDeleteModal();
      return;
    }
    
    this.setData({ isLoading: true });
    
    const selectedWordIds = selectedWords.map(word => word._id);
    
    wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'batchDeleteWords',
        wordIds: selectedWordIds
      },
      success: res => {
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: `成功删除${res.result.deletedCount || selectedWordIds.length}个词语`,
            icon: 'success'
          });
          
          // 重新加载词语列表
          this.loadWords();
        } else {
          this.setData({ isLoading: false });
          
          wx.showToast({
            title: '批量删除失败: ' + (res.result ? res.result.message : '未知错误'),
            icon: 'none'
          });
        }
        
        this.closeBatchDeleteModal();
      },
      fail: err => {
        console.error('批量删除词语失败:', err);
        this.setData({ isLoading: false });
        
        wx.showToast({
          title: '批量删除失败: ' + err.errMsg,
          icon: 'none'
        });
        
        this.closeBatchDeleteModal();
      }
    });
  },

  /**
   * 显示清理旧数据确认弹窗
   */
  showCleanupConfirm: function() {
    this.setData({
      showCleanupModal: true
    });
  },

  /**
   * 关闭清理旧数据确认弹窗
   */
  closeCleanupModal: function() {
    this.setData({
      showCleanupModal: false
    });
  },

  /**
   * 确认清理旧数据
   */
  confirmCleanup: function() {
    this.setData({ isLoading: true });
    
    wx.cloud.callFunction({
      name: 'wordOperations',
      data: {
        operation: 'deleteCollection'
      },
      success: res => {
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '旧数据清理成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result ? res.result.message : '清理旧数据失败',
            icon: 'none'
          });
        }
        
        this.setData({ isLoading: false });
        this.closeCleanupModal();
      },
      fail: err => {
        console.error('清理旧数据失败:', err);
        
        wx.showToast({
          title: '清理旧数据失败: ' + err.errMsg,
          icon: 'none'
        });
        
        this.setData({ isLoading: false });
        this.closeCleanupModal();
      }
    });
  },

  /**
   * 创建数据库集合
   */
  createCollection: function() {
    wx.showModal({
      title: '创建数据库集合',
      content: '此操作将创建words_data数据库集合。是否继续？',
      success: (res) => {
        if (res.confirm) {
          this.executeCreateCollection();
        }
      }
    });
  },

  /**
   * 执行创建集合
   */
  executeCreateCollection: function() {
    wx.showLoading({
      title: '创建中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'createCollection',
      success: (res) => {
        wx.hideLoading();
        console.log('创建集合结果:', res);
        
        if (res.result && res.result.success) {
          wx.showModal({
            title: '创建成功',
            content: res.result.message,
            showCancel: false,
            confirmText: '确定',
            success: () => {
              // 重新加载数据
              this.loadWords();
            }
          });
        } else {
          wx.showModal({
            title: '创建失败',
            content: res.result ? res.result.message : '未知错误',
            showCancel: false,
            confirmText: '确定'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('创建集合失败:', err);
        wx.showModal({
          title: '创建失败',
          content: '网络错误，请检查网络连接后重试',
          showCancel: false,
          confirmText: '确定'
        });
      }
    });
  }
}); 