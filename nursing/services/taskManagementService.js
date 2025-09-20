import Task from '../models/Task.js';
import { analyzeDocumentWithAI, generateKnowledgeRecommendations } from '../../services/aiService.js';
import azureOpenAIService from '../../services/azureOpenAIService.js';

class TaskManagementService {
  constructor() {
    this.azureOpenAI = azureOpenAIService;
  }

  // Task CRUD Operations
  async createTask(taskData) {
    try {
      const task = new Task(taskData);
      await task.save();
      
      // Generate AI analysis if enabled
      if (taskData.settings?.autoPrioritization) {
        await this.analyzeTaskWithAI(task._id);
      }
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error creating task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTasks(patientId, userId, filters = {}) {
    try {
      const query = { patientId, userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.priority) {
        query.priority = filters.priority;
      }
      
      if (filters.assignedTo) {
        query.assignedTo = filters.assignedTo;
      }
      
      const tasks = await Task.find(query)
        .populate('patientId userId assignedBy completedBy')
        .sort(filters.sort || { dueDate: 1 });
      
      return {
        success: true,
        data: tasks
      };
    } catch (error) {
      console.error('Error getting tasks:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getTaskById(taskId) {
    try {
      const task = await Task.findById(taskId)
        .populate('patientId userId assignedBy completedBy');
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error getting task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateTask(taskId, updateData) {
    try {
      const task = await Task.findByIdAndUpdate(
        taskId,
        { ...updateData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('patientId userId assignedBy completedBy');
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error updating task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteTask(taskId) {
    try {
      const task = await Task.findByIdAndDelete(taskId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error deleting task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // AI Analysis
  async analyzeAllTasksWithAI(patientId, userId, aiModel = 'gpt-5-chat') {
    try {
      const tasks = await Task.find({ patientId, userId });
      
      if (tasks.length === 0) {
        return {
          success: true,
          data: {
            message: 'No tasks found for analysis',
            recommendations: ['Create some tasks to get AI insights'],
            alerts: [],
            productivity: 0
          }
        };
      }
      
      // Prepare content for AI analysis of all tasks
      const tasksContent = tasks.map(task => `
        Task: ${task.title}
        Description: ${task.description || 'No description'}
        Category: ${task.category}
        Priority: ${task.priority}
        Status: ${task.status}
        Due Date: ${task.dueDate}
        Progress: ${task.progress || 0}%
      `).join('\n\n');
      
      const content = `
        Patient Tasks Analysis:
        ${tasksContent}
        
        Please provide insights on:
        1. Task prioritization recommendations
        2. Workflow optimization suggestions
        3. Risk factors and alerts
        4. Productivity improvements
        5. Resource allocation advice
      `;
      
      // Use existing AI service
      const analysis = await analyzeDocumentWithAI(content);
      
      // Generate comprehensive insights
      const insights = {
        recommendations: analysis.recommendations || this.generateRecommendations(tasks, 0),
        alerts: analysis.riskFactors || this.generateAlerts(tasks, 0),
        productivity: this.calculateProductivity(tasks),
        trends: this.analyzeTrends(tasks),
        statistics: this.calculateStatistics(tasks),
        aiAnalysis: {
          confidence: analysis.confidence || 0.8,
          analyzedAt: new Date(),
          aiModel: aiModel,
          suggestions: analysis.suggestions || []
        }
      };
      
      return {
        success: true,
        data: insights
      };
    } catch (error) {
      console.error('Error analyzing all tasks with AI:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async analyzeTaskWithAI(taskId) {
    try {
      const task = await Task.findById(taskId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      // Prepare content for AI analysis
      const content = `
        Task: ${task.title}
        Description: ${task.description || 'No description'}
        Category: ${task.category}
        Priority: ${task.priority}
        Due Date: ${task.dueDate}
        Patient ID: ${task.patientId}
      `;
      
      // Use existing AI service
      const analysis = await analyzeDocumentWithAI(content);
      
      // Update task with AI analysis
      task.aiAnalysis = {
        confidence: analysis.confidence || 0.8,
        suggestions: analysis.suggestions || [],
        riskFactors: analysis.riskFactors || [],
        recommendations: analysis.recommendations || [],
        analyzedAt: new Date(),
        aiModel: 'gpt-5-chat'
      };
      
      // Auto-prioritize based on AI analysis
      if (analysis.priority) {
        task.priority = analysis.priority;
      }
      
      await task.save();
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error analyzing task with AI:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateTaskInsights(patientId, userId) {
    try {
      const tasks = await Task.find({ patientId, userId });
      
      if (tasks.length === 0) {
        return {
          success: true,
          data: {
            recommendations: ['No tasks found for analysis'],
            trends: [],
            alerts: [],
            productivity: 0
          }
        };
      }
      
      // Calculate basic statistics
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const overdueTasks = tasks.filter(t => 
        t.status !== 'completed' && new Date(t.dueDate) < new Date()
      ).length;
      const productivity = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      
      // Generate insights
      const trends = this.analyzeTrends(tasks);
      const recommendations = this.generateRecommendations(tasks, productivity);
      const alerts = this.generateAlerts(tasks, overdueTasks);
      
      const insights = {
        recommendations,
        trends,
        alerts,
        productivity: Math.round(productivity),
        statistics: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          inProgress: tasks.filter(t => t.status === 'in_progress').length
        }
      };
      
      console.log('📊 [TaskManagement] Generated insights:', {
        trends: trends.length,
        recommendations: recommendations.length,
        alerts: alerts.length,
        productivity: Math.round(productivity)
      });
      
      return {
        success: true,
        data: insights
      };
    } catch (error) {
      console.error('Error generating task insights:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Task Management Operations
  async updateTaskProgress(taskId, progress) {
    try {
      const task = await Task.findById(taskId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      await task.updateProgress(progress);
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error updating task progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async completeTask(taskId, completedBy) {
    try {
      const task = await Task.findById(taskId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      await task.complete(completedBy);
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error completing task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cancelTask(taskId, reason) {
    try {
      const task = await Task.findById(taskId);
      
      if (!task) {
        return {
          success: false,
          error: 'Task not found'
        };
      }
      
      await task.cancel(reason);
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error cancelling task:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Notifications
  async getNotifications(patientId, userId) {
    try {
      const tasks = await Task.find({ patientId, userId })
        .select('notifications title status dueDate priority category createdAt completedAt')
        .sort({ 'notifications.scheduledFor': -1 });
      
      // Generate system notifications based on task status
      const systemNotifications = this.generateSystemNotifications(tasks);
      
      // Get task-based notifications
      const taskNotifications = tasks.flatMap(task => 
        task.notifications.map(notification => ({
          ...notification.toObject(),
          taskId: task._id,
          taskTitle: task.title,
          taskStatus: task.status,
          taskDueDate: task.dueDate,
          taskPriority: task.priority,
          taskCategory: task.category
        }))
      );
      
      // Combine and sort all notifications
      const allNotifications = [...systemNotifications, ...taskNotifications]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      console.log('📬 [TaskManagement] Generated notifications:', {
        system: systemNotifications.length,
        task: taskNotifications.length,
        total: allNotifications.length
      });
      
      return {
        success: true,
        data: allNotifications
      };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateSystemNotifications(tasks) {
    const notifications = [];
    const now = new Date();
    
    // Overdue tasks
    const overdueTasks = tasks.filter(task => 
      task.status !== 'completed' && new Date(task.dueDate) < now
    );
    
    if (overdueTasks.length > 0) {
      notifications.push({
        _id: `overdue-${Date.now()}`,
        type: 'task_overdue',
        title: `${overdueTasks.length} Task${overdueTasks.length > 1 ? 's' : ''} Overdue`,
        message: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} that need immediate attention`,
        isRead: false,
        createdAt: new Date(),
        priority: 'high',
        actions: [
          { label: 'View Tasks', action: 'view_overdue' },
          { label: 'Mark Complete', action: 'mark_complete' }
        ]
      });
    }
    
    // Tasks due today
    const dueToday = tasks.filter(task => {
      const today = new Date();
      const dueDate = new Date(task.dueDate);
      return task.status !== 'completed' && 
             dueDate.toDateString() === today.toDateString();
    });
    
    if (dueToday.length > 0) {
      notifications.push({
        _id: `due-today-${Date.now()}`,
        type: 'task_reminder',
        title: `${dueToday.length} Task${dueToday.length > 1 ? 's' : ''} Due Today`,
        message: `You have ${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`,
        isRead: false,
        createdAt: new Date(),
        priority: 'medium',
        actions: [
          { label: 'View Tasks', action: 'view_due_today' }
        ]
      });
    }
    
    // High priority pending tasks
    const urgentTasks = tasks.filter(task => 
      task.priority === 'urgent' && task.status !== 'completed'
    );
    
    if (urgentTasks.length > 0) {
      notifications.push({
        _id: `urgent-${Date.now()}`,
        type: 'system_alert',
        title: `${urgentTasks.length} Urgent Task${urgentTasks.length > 1 ? 's' : ''} Pending`,
        message: `You have ${urgentTasks.length} urgent task${urgentTasks.length > 1 ? 's' : ''} that need attention`,
        isRead: false,
        createdAt: new Date(),
        priority: 'high',
        actions: [
          { label: 'View Urgent Tasks', action: 'view_urgent' }
        ]
      });
    }
    
    // Recent completions
    const recentCompletions = tasks.filter(task => {
      if (task.status !== 'completed' || !task.completedAt) return false;
      const completed = new Date(task.completedAt);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return completed > oneHourAgo;
    });
    
    if (recentCompletions.length > 0) {
      notifications.push({
        _id: `completed-${Date.now()}`,
        type: 'task_completed',
        title: `${recentCompletions.length} Task${recentCompletions.length > 1 ? 's' : ''} Completed`,
        message: `Great job! You completed ${recentCompletions.length} task${recentCompletions.length > 1 ? 's' : ''} recently`,
        isRead: false,
        createdAt: new Date(),
        priority: 'low',
        actions: [
          { label: 'View Completed', action: 'view_completed' }
        ]
      });
    }
    
    // Productivity insights
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
    
    if (completionRate > 80 && totalTasks > 3) {
      notifications.push({
        _id: `productivity-${Date.now()}`,
        type: 'ai_insight',
        title: 'Excellent Productivity!',
        message: `You have a ${completionRate.toFixed(1)}% completion rate. Keep up the great work!`,
        isRead: false,
        createdAt: new Date(),
        priority: 'low',
        actions: [
          { label: 'View Analytics', action: 'view_analytics' }
        ]
      });
    }
    
    return notifications;
  }

  async markNotificationAsRead(patientId, userId, notificationId) {
    try {
      const task = await Task.findOne({ 
        patientId, 
        userId,
        'notifications._id': notificationId 
      });
      
      if (!task) {
        return {
          success: false,
          error: 'Notification not found'
        };
      }
      
      await task.markNotificationAsRead(notificationId);
      
      return {
        success: true,
        data: task
      };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Analytics
  async getTaskAnalytics(patientId, userId, dateRange = null) {
    try {
      const matchStage = { patientId, userId };
      
      if (dateRange) {
        matchStage.createdAt = {
          $gte: new Date(dateRange.start),
          $lte: new Date(dateRange.end)
        };
      }
      
      const stats = await Task.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            inProgress: {
              $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] }
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$status', ['todo', 'in_progress', 'review']] },
                      { $lt: ['$dueDate', new Date()] }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            avgProgress: { $avg: '$progress' },
            avgDuration: { $avg: '$actualDuration' }
          }
        }
      ]);
      
      const categoryStats = await Task.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      const priorityStats = await Task.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$priority',
            count: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);
      
      return {
        success: true,
        data: {
          overview: stats[0] || {
            total: 0,
            completed: 0,
            inProgress: 0,
            overdue: 0,
            avgProgress: 0,
            avgDuration: 0
          },
          categoryBreakdown: categoryStats,
          priorityBreakdown: priorityStats
        }
      };
    } catch (error) {
      console.error('Error getting task analytics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // AI-powered task suggestions
  async generateAITaskSuggestions(patientId, taskTitle, category, aiModel = 'gpt-5-chat') {
    try {
      // Get patient context for better suggestions
      const patient = await this.getPatientContext(patientId);
      
      // Prepare context for AI analysis
      const context = `
        Patient Context:
        - Patient ID: ${patientId}
        - Age: ${patient.age || 'Unknown'}
        - Gender: ${patient.gender || 'Unknown'}
        - Primary Diagnosis: ${patient.primaryDiagnosis || 'Not specified'}
        - Secondary Diagnoses: ${patient.secondaryDiagnoses?.join(', ') || 'None'}
        - Current Medications: ${patient.medications?.join(', ') || 'None'}
        - Allergies: ${patient.allergies?.join(', ') || 'None'}
        - Care Level: ${patient.careLevel || 'Standard'}
        
        Task Request:
        - Title: ${taskTitle}
        - Category: ${category}
        
        Please generate 3-5 task suggestions that are:
        1. Specific to this patient's condition and needs
        2. Appropriate for the ${category} category
        3. Include realistic priority levels and durations
        4. Consider patient safety and care continuity
        5. Follow nursing best practices
      `;

      console.log('🤖 [TaskManagement] Generating AI suggestions with context:', context);

      // Use Azure OpenAI chat completion directly instead of analyzeDocument
      const systemPrompt = `You are a nursing AI assistant that generates task suggestions for patient care. 
      Provide 3-5 specific, actionable task suggestions based on the patient context and task requirements.
      Return your response as a JSON array with the following structure:
      [
        {
          "title": "Task Title",
          "description": "Detailed task description",
          "priority": "low|medium|high|urgent",
          "estimatedDuration": 30,
          "category": "${category}",
          "reasoning": "Why this task is important for this patient"
        }
      ]`;

      const response = await this.azureOpenAI.callAzureOpenAI(systemPrompt, context);
      
      // Parse AI response
      let suggestions;
      try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.warn('Failed to parse AI response as JSON, using fallback:', parseError);
        suggestions = this.parseTaskSuggestionsFromText(response, taskTitle, category);
      }

      // Ensure suggestions are properly formatted
      const formattedSuggestions = suggestions.map((suggestion, index) => ({
        title: suggestion.title || `${taskTitle} - Suggestion ${index + 1}`,
        description: suggestion.description || `AI-generated task suggestion for ${taskTitle}`,
        priority: suggestion.priority || 'medium',
        estimatedDuration: suggestion.estimatedDuration || 30,
        category: suggestion.category || category,
        reasoning: suggestion.reasoning || 'AI-generated based on patient context'
      }));
      
      return {
        success: true,
        data: formattedSuggestions
      };
    } catch (error) {
      console.error('Error generating AI task suggestions:', error);
      
      // Fallback suggestions
      const fallbackSuggestions = [
        {
          title: `${taskTitle} - Standard Care`,
          description: `Standard ${taskTitle} procedure for patient care`,
          priority: 'medium',
          estimatedDuration: 30,
          category: category,
          reasoning: 'Standard nursing care protocol'
        },
        {
          title: `${taskTitle} - Priority Assessment`,
          description: `Priority assessment and monitoring for ${taskTitle}`,
          priority: 'high',
          estimatedDuration: 45,
          category: category,
          reasoning: 'High priority for patient safety'
        },
        {
          title: `${taskTitle} - Follow-up Care`,
          description: `Follow-up care and documentation for ${taskTitle}`,
          priority: 'medium',
          estimatedDuration: 20,
          category: category,
          reasoning: 'Continuity of care requirement'
        }
      ];
      
      return {
        success: true,
        data: fallbackSuggestions
      };
    }
  }

  // Get patient context for AI suggestions
  async getPatientContext(patientId) {
    try {
      // Import Patient model
      const Patient = await import('../models/Patient.js');
      
      if (Patient && Patient.default) {
        const patient = await Patient.default.findById(patientId).select(
          'demographics primaryDiagnosis secondaryDiagnoses currentMedications allergies clinicalTimeline'
        );
        
        if (patient) {
          // Calculate age from date of birth
          const age = patient.demographics?.dob 
            ? Math.floor((new Date() - new Date(patient.demographics.dob)) / (365.25 * 24 * 60 * 60 * 1000))
            : 'Unknown';
          
          // Extract gender
          const gender = patient.demographics?.sex || 'Unknown';
          
          // Extract medications
          const medications = patient.currentMedications?.map(med => 
            `${med.name} ${med.dose} ${med.route} ${med.frequency}`
          ) || [];
          
          // Extract allergies
          const allergies = patient.allergies?.map(allergy => 
            `${allergy.substance} (${allergy.severity})`
          ) || [];
          
          // Determine care level based on clinical timeline
          const recentEntries = patient.clinicalTimeline?.filter(entry => 
            new Date(entry.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ) || [];
          
          const careLevel = recentEntries.length > 5 ? 'Intensive' : 
                           recentEntries.length > 2 ? 'Moderate' : 'Standard';
          
          const patientContext = {
            patientId,
            age: age.toString(),
            gender: gender.charAt(0).toUpperCase() + gender.slice(1),
            primaryDiagnosis: patient.primaryDiagnosis || 'Not specified',
            secondaryDiagnoses: patient.secondaryDiagnoses || [],
            medications: medications,
            allergies: allergies,
            careLevel: careLevel
          };
          
          console.log('📋 [TaskManagement] Patient context fetched:', patientContext);
          return patientContext;
        }
      }
      
      // Fallback to basic structure
      return {
        patientId,
        age: 'Unknown',
        gender: 'Unknown',
        primaryDiagnosis: 'Not specified',
        secondaryDiagnoses: [],
        medications: [],
        allergies: [],
        careLevel: 'Standard'
      };
    } catch (error) {
      console.error('Error getting patient context:', error);
      return {
        patientId,
        age: 'Unknown',
        gender: 'Unknown',
        primaryDiagnosis: 'Not specified',
        secondaryDiagnoses: [],
        medications: [],
        allergies: [],
        careLevel: 'Standard'
      };
    }
  }

  // Parse task suggestions from text response
  parseTaskSuggestionsFromText(response, taskTitle, category) {
    const suggestions = [];
    
    // Try to extract suggestions from text response
    const lines = response.split('\n').filter(line => line.trim());
    
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('Patient Context') && !line.startsWith('Task Request')) {
        suggestions.push({
          title: line.includes('-') ? line.split('-')[0].trim() : `${taskTitle} - Suggestion ${i + 1}`,
          description: line.includes('-') ? line.split('-').slice(1).join('-').trim() : line,
          priority: this.determinePriorityFromText(line),
          estimatedDuration: this.determineDurationFromText(line),
          category: category,
          reasoning: 'AI-generated based on patient context'
        });
      }
    }
    
    // If no suggestions found, create basic ones
    if (suggestions.length === 0) {
      suggestions.push(
        {
          title: `${taskTitle} - Primary Care`,
          description: `Primary care task for ${taskTitle}`,
          priority: 'high',
          estimatedDuration: 30,
          category: category,
          reasoning: 'Primary care requirement'
        },
        {
          title: `${taskTitle} - Monitoring`,
          description: `Monitoring and assessment for ${taskTitle}`,
          priority: 'medium',
          estimatedDuration: 20,
          category: category,
          reasoning: 'Patient monitoring requirement'
        }
      );
    }
    
    return suggestions;
  }

  // Determine priority from text
  determinePriorityFromText(text) {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('urgent') || lowerText.includes('emergency') || lowerText.includes('critical')) {
      return 'urgent';
    } else if (lowerText.includes('high') || lowerText.includes('priority') || lowerText.includes('important')) {
      return 'high';
    } else if (lowerText.includes('low') || lowerText.includes('routine')) {
      return 'low';
    }
    return 'medium';
  }

  // Determine duration from text
  determineDurationFromText(text) {
    const durationMatch = text.match(/(\d+)\s*(min|minutes?|hour|hours?)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      return unit.includes('hour') ? value * 60 : value;
    }
    return 30; // Default 30 minutes
  }

  // Parse AI response into structured task suggestions
  parseTaskSuggestions(analysis, taskTitle, category) {
    const suggestions = [];
    
    // Extract suggestions from AI analysis
    if (analysis.suggestions && Array.isArray(analysis.suggestions)) {
      analysis.suggestions.forEach((suggestion, index) => {
        if (index < 5) { // Limit to 5 suggestions
          suggestions.push({
            title: suggestion.title || `${taskTitle} - Suggestion ${index + 1}`,
            description: suggestion.description || `AI-generated task suggestion for ${taskTitle}`,
            priority: suggestion.priority || 'medium',
            estimatedDuration: suggestion.estimatedDuration || 30,
            category: category,
            reasoning: suggestion.reasoning || 'AI-generated based on patient context'
          });
        }
      });
    }
    
    // If no suggestions from AI, create basic ones
    if (suggestions.length === 0) {
      suggestions.push(
        {
          title: `${taskTitle} - Primary Care`,
          description: `Primary care task for ${taskTitle}`,
          priority: 'high',
          estimatedDuration: 30,
          category: category,
          reasoning: 'Primary care requirement'
        },
        {
          title: `${taskTitle} - Monitoring`,
          description: `Monitoring and assessment for ${taskTitle}`,
          priority: 'medium',
          estimatedDuration: 20,
          category: category,
          reasoning: 'Patient monitoring requirement'
        }
      );
    }
    
    return suggestions;
  }

  // Helper methods
  calculateProductivity(tasks) {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  }

  calculateStatistics(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => 
      t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length;
    
    return {
      total,
      completed,
      inProgress,
      overdue,
      productivity: this.calculateProductivity(tasks)
    };
  }

  generateRecommendations(tasks, productivity) {
    const recommendations = [];
    
    if (productivity < 50) {
      recommendations.push('Consider breaking down large tasks into smaller, manageable chunks');
    }
    
    if (productivity > 80) {
      recommendations.push('Great job! Consider taking on additional responsibilities');
    }
    
    const overdueCount = tasks.filter(t => 
      t.status !== 'completed' && new Date(t.dueDate) < new Date()
    ).length;
    
    if (overdueCount > 0) {
      recommendations.push(`You have ${overdueCount} overdue tasks. Prioritize completing them first`);
    }
    
    const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');
    if (urgentTasks.length > 0) {
      recommendations.push(`Focus on ${urgentTasks.length} urgent tasks that need immediate attention`);
    }
    
    return recommendations;
  }

  analyzeTrends(tasks) {
    const trends = [];
    const now = new Date();
    
    if (tasks.length === 0) {
      return ['No tasks available for trend analysis'];
    }
    
    // Completion rate trends
    const completedThisWeek = tasks.filter(t => {
      const completed = new Date(t.completedAt);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return t.status === 'completed' && completed > weekAgo;
    }).length;
    
    const completedLastWeek = tasks.filter(t => {
      const completed = new Date(t.completedAt);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return t.status === 'completed' && completed > twoWeeksAgo && completed <= weekAgo;
    }).length;
    
    if (completedThisWeek > completedLastWeek) {
      trends.push(`📈 Completion rate increased: ${completedThisWeek} tasks completed this week vs ${completedLastWeek} last week`);
    } else if (completedThisWeek < completedLastWeek) {
      trends.push(`📉 Completion rate decreased: ${completedThisWeek} tasks completed this week vs ${completedLastWeek} last week`);
    } else if (completedThisWeek > 0) {
      trends.push(`📊 Steady completion rate: ${completedThisWeek} tasks completed this week`);
    }
    
    // Priority distribution trends
    const priorityCounts = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {});
    
    const totalTasks = tasks.length;
    const urgentPercentage = ((priorityCounts.urgent || 0) / totalTasks) * 100;
    const highPercentage = ((priorityCounts.high || 0) / totalTasks) * 100;
    
    if (urgentPercentage > 30) {
      trends.push(`🚨 High urgent task load: ${urgentPercentage.toFixed(1)}% of tasks are urgent`);
    } else if (urgentPercentage > 0) {
      trends.push(`⚡ Moderate urgent tasks: ${urgentPercentage.toFixed(1)}% of tasks are urgent`);
    }
    
    if (highPercentage > 50) {
      trends.push(`🔥 High priority workload: ${highPercentage.toFixed(1)}% of tasks are high priority`);
    }
    
    // Category trends
    const categoryCounts = tasks.reduce((acc, task) => {
      acc[task.category] = (acc[task.category] || 0) + 1;
      return acc;
    }, {});
    
    const topCategory = Object.entries(categoryCounts).reduce((a, b) => 
      categoryCounts[a[0]] > categoryCounts[b[0]] ? a : b
    );
    
    if (topCategory) {
      const categoryPercentage = ((topCategory[1] / totalTasks) * 100).toFixed(1);
      trends.push(`🏷️ Most common task type: ${topCategory[0]} (${categoryPercentage}% of all tasks)`);
    }
    
    // Overdue trends
    const overdueTasks = tasks.filter(t => 
      t.status !== 'completed' && new Date(t.dueDate) < now
    ).length;
    
    if (overdueTasks > 0) {
      const overduePercentage = ((overdueTasks / totalTasks) * 100).toFixed(1);
      trends.push(`⏰ Overdue tasks: ${overdueTasks} tasks (${overduePercentage}%) need immediate attention`);
    } else {
      trends.push(`✅ All tasks are on schedule - no overdue items`);
    }
    
    // Productivity trends
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const completionRate = ((completedTasks / totalTasks) * 100).toFixed(1);
    
    if (completionRate > 80) {
      trends.push(`🎯 Excellent productivity: ${completionRate}% completion rate`);
    } else if (completionRate > 60) {
      trends.push(`📊 Good productivity: ${completionRate}% completion rate`);
    } else if (completionRate > 0) {
      trends.push(`📈 Room for improvement: ${completionRate}% completion rate`);
    }
    
    // Time-based trends
    const recentTasks = tasks.filter(t => {
      const created = new Date(t.createdAt);
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      return created > threeDaysAgo;
    }).length;
    
    if (recentTasks > 5) {
      trends.push(`🆕 High activity: ${recentTasks} new tasks created in the last 3 days`);
    } else if (recentTasks > 0) {
      trends.push(`📝 Moderate activity: ${recentTasks} new tasks created recently`);
    }
    
    // Default trend if no specific trends are identified
    if (trends.length === 0) {
      trends.push(`📋 Task management overview: ${totalTasks} total tasks with ${completionRate}% completion rate`);
    }
    
    return trends;
  }

  generateAlerts(tasks, overdueCount) {
    const alerts = [];
    
    if (overdueCount > 0) {
      alerts.push(`You have ${overdueCount} overdue tasks that need immediate attention`);
    }
    
    const dueToday = tasks.filter(t => {
      const today = new Date();
      const dueDate = new Date(t.dueDate);
      return t.status !== 'completed' && 
             dueDate.toDateString() === today.toDateString();
    }).length;
    
    if (dueToday > 0) {
      alerts.push(`${dueToday} tasks are due today`);
    }
    
    const urgentPending = tasks.filter(t => 
      t.priority === 'urgent' && t.status !== 'completed'
    ).length;
    
    if (urgentPending > 0) {
      alerts.push(`${urgentPending} urgent tasks are pending`);
    }
    
    return alerts;
  }

  // Settings Management
  async getSettings(patientId, userId) {
    try {
      // In a real application, you would store settings in a separate collection
      // For now, we'll return default settings with some customization
      const defaultSettings = {
        autoPrioritization: true,
        realTimeUpdates: true,
        reminderInterval: 30,
        aiModel: 'gpt-5-chat',
        notificationEnabled: true,
        workHours: { start: '08:00', end: '17:00' },
        breakReminders: true,
        taskCategories: ['medication', 'assessment', 'documentation', 'communication', 'procedure', 'follow_up'],
        autoArchive: false,
        smartScheduling: false,
        conflictDetection: true,
        notificationTypes: {
          task_created: true,
          task_completed: true,
          task_overdue: true,
          task_reminder: true,
          ai_insight: true,
          system_alert: true
        },
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h'
      };

      console.log('⚙️ [TaskManagement] Retrieved settings for patient:', patientId);
      
      return {
        success: true,
        data: defaultSettings
      };
    } catch (error) {
      console.error('Error getting settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateSettings(patientId, userId, settings) {
    try {
      // In a real application, you would save settings to a database
      // For now, we'll validate and return the settings
      
      const validatedSettings = {
        autoPrioritization: Boolean(settings.autoPrioritization),
        realTimeUpdates: Boolean(settings.realTimeUpdates),
        reminderInterval: Math.max(5, Math.min(480, parseInt(settings.reminderInterval) || 30)),
        aiModel: settings.aiModel || 'gpt-5-chat',
        notificationEnabled: Boolean(settings.notificationEnabled),
        workHours: {
          start: settings.workHours?.start || '08:00',
          end: settings.workHours?.end || '17:00'
        },
        breakReminders: Boolean(settings.breakReminders),
        taskCategories: Array.isArray(settings.taskCategories) ? settings.taskCategories : ['medication', 'assessment', 'documentation', 'communication', 'procedure', 'follow_up'],
        autoArchive: Boolean(settings.autoArchive),
        smartScheduling: Boolean(settings.smartScheduling),
        conflictDetection: Boolean(settings.conflictDetection),
        notificationTypes: {
          task_created: Boolean(settings.notificationTypes?.task_created),
          task_completed: Boolean(settings.notificationTypes?.task_completed),
          task_overdue: Boolean(settings.notificationTypes?.task_overdue),
          task_reminder: Boolean(settings.notificationTypes?.task_reminder),
          ai_insight: Boolean(settings.notificationTypes?.ai_insight),
          system_alert: Boolean(settings.notificationTypes?.system_alert)
        },
        theme: ['light', 'dark'].includes(settings.theme) ? settings.theme : 'light',
        language: settings.language || 'en',
        timezone: settings.timezone || 'UTC',
        dateFormat: settings.dateFormat || 'MM/DD/YYYY',
        timeFormat: ['12h', '24h'].includes(settings.timeFormat) ? settings.timeFormat : '12h'
      };

      console.log('⚙️ [TaskManagement] Updated settings for patient:', patientId, validatedSettings);
      
      return {
        success: true,
        data: validatedSettings,
        message: 'Settings updated successfully'
      };
    } catch (error) {
      console.error('Error updating settings:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new TaskManagementService();

