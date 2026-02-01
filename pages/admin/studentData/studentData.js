const app = getApp();

Page({
  data: {
    students: [],
    filteredStudents: [],
    searchKeyword: '',
    isLoading: false,
    currentTab: 'all', // 'all', 'active', 'inactive'
    sortField: 'totalWordsLearned', // 'totalWordsLearned', 'correctRate'
    sortOrder: 'desc', // 'asc', 'desc'
    noData: false
  },

  onLoad: function(options) {
    // 直接加载数据，不检查权限
    this.loadStudentData();
  },

  onShow: function() {
    // 每次显示页面时强制刷新数据
    this.loadStudentData();
  },

  // 权限检查函数保留但不做任何检查
  checkAdminAuth: function() {
    // 不做任何权限检查，直接返回
    return true;
  },

  // 加载学生数据
  loadStudentData: function() {
    this.setData({ isLoading: true, noData: false });
    
    wx.cloud.callFunction({
      name: 'getStudentStats',
      success: res => {
        if (res.result && res.result.code === 0 && res.result.data) {
          const studentList = res.result.data;
          
          // 应用当前排序
          const sortedList = this.sortStudents(studentList);
          
          this.setData({
            students: sortedList,
            filteredStudents: this.filterStudents(sortedList),
            isLoading: false,
            noData: studentList.length === 0
          });
          
          console.log(`已加载${studentList.length}名学生数据`);
        } else {
          this.setData({
            students: [],
            filteredStudents: [],
            isLoading: false,
            noData: true
          });
          
          wx.showToast({
            title: '获取学生数据失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('获取学生数据失败:', err);
        this.setData({
          students: [],
          filteredStudents: [],
          isLoading: false,
          noData: true
        });
        
        wx.showToast({
          title: '获取学生数据失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 切换标签
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    
    // 根据当前标签过滤学生
    this.setData({
      filteredStudents: this.filterStudents(this.data.students)
    });
  },
  
  // 根据当前标签过滤学生
  filterStudents: function(students) {
    if (!students || students.length === 0) return [];
    
    const keyword = this.data.searchKeyword.toLowerCase().trim();
    let filtered = [...students];
    
    // 先按关键词过滤
    if (keyword) {
      filtered = filtered.filter(student => 
        (student.name && student.name.toLowerCase().includes(keyword)) || 
        (student.studentId && student.studentId.toLowerCase().includes(keyword))
      );
    }
    
    // 再按标签过滤
    if (this.data.currentTab === 'active') {
      // 活跃学生：有学习记录的学生（学过至少一个单词）
      filtered = filtered.filter(student => {
        return (student.totalWordsLearned || 0) > 0;
      });
    } else if (this.data.currentTab === 'inactive') {
      // 不活跃学生：没有学习记录的学生
      filtered = filtered.filter(student => {
        return (student.totalWordsLearned || 0) === 0;
      });
    }
    
    return filtered;
  },
  
  // 处理搜索输入
  handleSearchInput: function(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },
  
  // 执行搜索
  searchStudent: function() {
    this.setData({
      filteredStudents: this.filterStudents(this.data.students)
    });
  },
  
  // 清除搜索
  clearSearch: function() {
    this.setData({
      searchKeyword: '',
      filteredStudents: this.filterStudents(this.data.students)
    });
  },
  
  // 设置排序
  setSorting: function(e) {
    const field = e.currentTarget.dataset.field;
    
    // 如果点击当前排序字段，则切换排序顺序
    if (field === this.data.sortField) {
      this.setData({
        sortOrder: this.data.sortOrder === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // 否则切换排序字段，默认降序
      this.setData({
        sortField: field,
        sortOrder: 'desc'
      });
    }
    
    // 重新排序并过滤
    const sortedList = this.sortStudents(this.data.students);
    this.setData({
      students: sortedList,
      filteredStudents: this.filterStudents(sortedList)
    });
  },
  
  // 排序学生列表
  sortStudents: function(students) {
    if (!students || students.length === 0) return [];
    
    const { sortField, sortOrder } = this.data;
    const sortedList = [...students];
    
    sortedList.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortField) {
        case 'totalWordsLearned':
          valueA = a.totalWordsLearned || 0;
          valueB = b.totalWordsLearned || 0;
          break;
        case 'correctRate':
          valueA = a.correctRate || 0;
          valueB = b.correctRate || 0;
          break;
        default:
          valueA = a.totalWordsLearned || 0;
          valueB = b.totalWordsLearned || 0;
      }
      
      if (sortOrder === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    });
    
    return sortedList;
  },
  
  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  },
  
  // 下拉刷新
  onPullDownRefresh: function() {
    this.loadStudentData();
    wx.stopPullDownRefresh();
  }
}); 