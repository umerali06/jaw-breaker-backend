/**
 * Predictive Modeling Service for Quality Indicators
 * Provides predictive capabilities for outcome measures and quality indicators
 */

class PredictiveModelingService {
  constructor() {
    this.models = {
      linear: { name: "Linear Regression", minDataPoints: 10 },
      exponential: { name: "Exponential Smoothing", minDataPoints: 15 },
      seasonal: { name: "Seasonal Decomposition", minDataPoints: 30 },
    };

    this.predictionHorizons = {
      short: { days: 30, confidence: 0.8 },
      medium: { days: 90, confidence: 0.6 },
      long: { days: 180, confidence: 0.4 },
    };
  }

  /**
   * Generate predictive models for quality indicators
   * @param {string} userId - User identifier
   * @param {Object} modelConfig - Configuration for the predictive model
   * @returns {Object} Predictive model results
   */
  async generatePredictiveModel(userId, modelConfig = {}) {
    try {
      const {
        outcomeData,
        indicatorType,
        horizon = "medium",
        modelType = "auto",
        includeConfidenceIntervals = true,
      } = modelConfig;

      if (!outcomeData || outcomeData.length === 0) {
        return {
          success: false,
          message: "No data provided for predictive modeling",
          model: null,
        };
      }

      // Filter data for specific indicator if provided
      const filteredData = indicatorType
        ? outcomeData.filter((d) => d.indicatorType === indicatorType)
        : outcomeData;

      if (filteredData.length < this.models.linear.minDataPoints) {
        return {
          success: false,
          message: `Insufficient data points. Need at least ${this.models.linear.minDataPoints}`,
          model: null,
        };
      }

      // Select best model type
      const selectedModel =
        modelType === "auto" ? this.selectBestModel(filteredData) : modelType;

      // Generate predictions
      const predictions = await this.generatePredictions(
        filteredData,
        selectedModel,
        horizon,
        includeConfidenceIntervals
      );

      // Calculate model performance metrics
      const performance = this.calculateModelPerformance(
        filteredData,
        selectedModel
      );

      return {
        success: true,
        userId,
        modelType: selectedModel,
        horizon,
        generatedAt: new Date(),
        dataPoints: filteredData.length,
        predictions,
        performance,
        confidence: this.calculatePredictionConfidence(
          performance,
          filteredData.length,
          horizon
        ),
      };
    } catch (error) {
      console.error("Predictive modeling error:", error);
      return {
        success: false,
        error: error.message,
        model: null,
      };
    }
  }

  /**
   * Generate risk predictions for patient outcomes
   */
  async generateRiskPredictions(userId, riskConfig = {}) {
    try {
      const {
        patientData,
        riskFactors = [],
        timeframe = 30,
        riskThresholds = { low: 0.3, medium: 0.6, high: 0.8 },
      } = riskConfig;

      const riskPredictions = [];

      for (const patient of patientData) {
        const riskScore = await this.calculateRiskScore(patient, riskFactors);
        const riskLevel = this.categorizeRisk(riskScore, riskThresholds);

        riskPredictions.push({
          patientId: patient.patientId,
          riskScore,
          riskLevel,
          contributingFactors: this.identifyRiskFactors(patient, riskFactors),
          recommendations: this.generateRiskRecommendations(riskLevel, patient),
          confidence: this.calculateRiskConfidence(patient, riskFactors),
        });
      }

      return {
        success: true,
        userId,
        timeframe,
        generatedAt: new Date(),
        predictions: riskPredictions.sort((a, b) => b.riskScore - a.riskScore),
        summary: this.generateRiskSummary(riskPredictions),
      };
    } catch (error) {
      console.error("Risk prediction error:", error);
      return {
        success: false,
        error: error.message,
        predictions: null,
      };
    }
  }

  /**
   * Generate quality improvement forecasts
   */
  async generateQualityForecasts(userId, forecastConfig = {}) {
    try {
      const {
        qualityData,
        interventions = [],
        targetMetrics = [],
        forecastPeriod = 90,
      } = forecastConfig;

      const forecasts = {};

      for (const metric of targetMetrics) {
        const metricData = qualityData.filter(
          (d) => d.indicatorType === metric
        );

        if (metricData.length < 10) {
          forecasts[metric] = {
            status: "insufficient_data",
            message: "Not enough historical data for forecasting",
          };
          continue;
        }

        // Baseline forecast without interventions
        const baselineForecast = this.generateBaselineForecast(
          metricData,
          forecastPeriod
        );

        // Forecast with interventions
        const interventionForecast = this.applyInterventionEffects(
          baselineForecast,
          interventions,
          metric
        );

        forecasts[metric] = {
          baseline: baselineForecast,
          withInterventions: interventionForecast,
          improvement: this.calculateImprovement(
            baselineForecast,
            interventionForecast
          ),
          confidence: this.calculateForecastConfidence(
            metricData,
            interventions
          ),
        };
      }

      return {
        success: true,
        userId,
        forecastPeriod,
        generatedAt: new Date(),
        forecasts,
        recommendations: this.generateForecastRecommendations(forecasts),
      };
    } catch (error) {
      console.error("Quality forecast error:", error);
      return {
        success: false,
        error: error.message,
        forecasts: null,
      };
    }
  }

  /**
   * Model selection and prediction methods
   */
  selectBestModel(data) {
    const dataLength = data.length;

    // Check for seasonality
    if (dataLength >= this.models.seasonal.minDataPoints) {
      const seasonality = this.detectSeasonality(data);
      if (seasonality.isSignificant) {
        return "seasonal";
      }
    }

    // Check for exponential patterns
    if (dataLength >= this.models.exponential.minDataPoints) {
      const exponentialFit = this.testExponentialFit(data);
      if (exponentialFit.isGoodFit) {
        return "exponential";
      }
    }

    // Default to linear
    return "linear";
  }

  async generatePredictions(
    data,
    modelType,
    horizon,
    includeConfidenceIntervals
  ) {
    const sortedData = data.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const horizonDays = this.predictionHorizons[horizon].days;
    const predictionPoints = Math.ceil(horizonDays / 7); // Weekly predictions

    let predictions = [];

    switch (modelType) {
      case "linear":
        predictions = this.generateLinearPredictions(
          sortedData,
          predictionPoints
        );
        break;
      case "exponential":
        predictions = this.generateExponentialPredictions(
          sortedData,
          predictionPoints
        );
        break;
      case "seasonal":
        predictions = this.generateSeasonalPredictions(
          sortedData,
          predictionPoints
        );
        break;
      default:
        predictions = this.generateLinearPredictions(
          sortedData,
          predictionPoints
        );
    }

    if (includeConfidenceIntervals) {
      predictions = predictions.map((pred) => ({
        ...pred,
        confidenceInterval: this.calculateConfidenceInterval(
          pred,
          sortedData,
          modelType
        ),
      }));
    }

    return predictions;
  }

  generateLinearPredictions(data, points) {
    const values = data.map((d) => d.value);
    const n = values.length;

    // Calculate linear trend
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions = [];
    const lastDate = new Date(data[data.length - 1].createdAt);

    for (let i = 1; i <= points; i++) {
      const futureX = n + i - 1;
      const predictedValue = Math.max(
        0,
        Math.min(1, slope * futureX + intercept)
      );

      const predictionDate = new Date(lastDate);
      predictionDate.setDate(predictionDate.getDate() + i * 7);

      predictions.push({
        date: predictionDate,
        predictedValue,
        method: "linear_regression",
      });
    }

    return predictions;
  }

  generateExponentialPredictions(data, points) {
    const values = data.map((d) => d.value);
    const alpha = 0.3; // Smoothing parameter

    // Calculate exponential smoothing
    let smoothedValue = values[0];
    for (let i = 1; i < values.length; i++) {
      smoothedValue = alpha * values[i] + (1 - alpha) * smoothedValue;
    }

    const predictions = [];
    const lastDate = new Date(data[data.length - 1].createdAt);
    let currentPrediction = smoothedValue;

    for (let i = 1; i <= points; i++) {
      const predictionDate = new Date(lastDate);
      predictionDate.setDate(predictionDate.getDate() + i * 7);

      predictions.push({
        date: predictionDate,
        predictedValue: Math.max(0, Math.min(1, currentPrediction)),
        method: "exponential_smoothing",
      });
    }

    return predictions;
  }

  generateSeasonalPredictions(data, points) {
    // Simplified seasonal decomposition
    const values = data.map((d) => d.value);
    const seasonLength = 12; // Assume monthly seasonality

    if (values.length < seasonLength * 2) {
      return this.generateLinearPredictions(data, points);
    }

    // Calculate seasonal indices
    const seasonalIndices = this.calculateSeasonalIndices(values, seasonLength);

    // Calculate trend
    const deseasonalized = values.map(
      (val, i) => val / seasonalIndices[i % seasonLength]
    );
    const trend = this.calculateLinearTrend(deseasonalized);

    const predictions = [];
    const lastDate = new Date(data[data.length - 1].createdAt);

    for (let i = 1; i <= points; i++) {
      const futureIndex = values.length + i - 1;
      const trendValue = trend.slope * futureIndex + trend.intercept;
      const seasonalIndex = seasonalIndices[futureIndex % seasonLength];
      const predictedValue = Math.max(
        0,
        Math.min(1, trendValue * seasonalIndex)
      );

      const predictionDate = new Date(lastDate);
      predictionDate.setDate(predictionDate.getDate() + i * 7);

      predictions.push({
        date: predictionDate,
        predictedValue,
        method: "seasonal_decomposition",
      });
    }

    return predictions;
  }

  /**
   * Risk calculation methods
   */
  async calculateRiskScore(patient, riskFactors) {
    let riskScore = 0;
    let totalWeight = 0;

    for (const factor of riskFactors) {
      const factorValue = this.extractFactorValue(patient, factor.name);
      const weight = factor.weight || 1;
      const normalizedValue = this.normalizeFactorValue(factorValue, factor);

      riskScore += normalizedValue * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? riskScore / totalWeight : 0;
  }

  categorizeRisk(riskScore, thresholds) {
    if (riskScore >= thresholds.high) return "high";
    if (riskScore >= thresholds.medium) return "medium";
    if (riskScore >= thresholds.low) return "low";
    return "very_low";
  }

  identifyRiskFactors(patient, riskFactors) {
    return riskFactors
      .map((factor) => ({
        name: factor.name,
        value: this.extractFactorValue(patient, factor.name),
        impact: this.calculateFactorImpact(patient, factor),
        weight: factor.weight,
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 5); // Top 5 contributing factors
  }

  generateRiskRecommendations(riskLevel, patient) {
    const recommendations = [];

    switch (riskLevel) {
      case "high":
        recommendations.push(
          "Immediate intervention required",
          "Increase monitoring frequency",
          "Consider care plan modification",
          "Schedule urgent assessment"
        );
        break;
      case "medium":
        recommendations.push(
          "Enhanced monitoring recommended",
          "Review current interventions",
          "Consider preventive measures"
        );
        break;
      case "low":
        recommendations.push(
          "Continue current care plan",
          "Regular monitoring sufficient"
        );
        break;
      default:
        recommendations.push("Maintain standard care protocols");
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  calculateModelPerformance(data, modelType) {
    // Use last 20% of data for validation
    const splitIndex = Math.floor(data.length * 0.8);
    const trainData = data.slice(0, splitIndex);
    const testData = data.slice(splitIndex);

    if (testData.length < 3) {
      return {
        mae: null,
        rmse: null,
        r2: null,
        message: "Insufficient test data",
      };
    }

    // Generate predictions for test period
    const testPredictions = this.generatePredictions(
      trainData,
      modelType,
      "short",
      false
    );

    // Calculate error metrics
    const errors = testData.map((actual, i) => {
      const predicted = testPredictions[i]?.predictedValue || actual.value;
      return actual.value - predicted;
    });

    const mae =
      errors.reduce((sum, err) => sum + Math.abs(err), 0) / errors.length;
    const rmse = Math.sqrt(
      errors.reduce((sum, err) => sum + err * err, 0) / errors.length
    );

    // Calculate R-squared
    const actualMean =
      testData.reduce((sum, d) => sum + d.value, 0) / testData.length;
    const ssRes = errors.reduce((sum, err) => sum + err * err, 0);
    const ssTot = testData.reduce(
      (sum, d) => sum + Math.pow(d.value - actualMean, 2),
      0
    );
    const r2 = 1 - ssRes / ssTot;

    return { mae, rmse, r2 };
  }

  calculatePredictionConfidence(performance, dataPoints, horizon) {
    let confidence = 0.5;

    // Adjust based on model performance
    if (performance.r2 > 0.8) confidence += 0.3;
    else if (performance.r2 > 0.6) confidence += 0.2;
    else if (performance.r2 > 0.4) confidence += 0.1;

    // Adjust based on data quantity
    if (dataPoints > 100) confidence += 0.2;
    else if (dataPoints > 50) confidence += 0.1;

    // Adjust based on prediction horizon
    const horizonConfidence = this.predictionHorizons[horizon].confidence;
    confidence *= horizonConfidence;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  detectSeasonality(data) {
    // Simplified seasonality detection
    if (data.length < 24) return { isSignificant: false };

    const values = data.map((d) => d.value);
    const monthlyData = this.groupByMonth(data);

    if (Object.keys(monthlyData).length < 6) {
      return { isSignificant: false };
    }

    const monthlyAverages = Object.values(monthlyData).map(
      (monthData) =>
        monthData.reduce((sum, val) => sum + val, 0) / monthData.length
    );

    const overallMean = values.reduce((a, b) => a + b, 0) / values.length;
    const seasonalVariance =
      monthlyAverages.reduce(
        (sum, avg) => sum + Math.pow(avg - overallMean, 2),
        0
      ) / monthlyAverages.length;
    const totalVariance =
      values.reduce((sum, val) => sum + Math.pow(val - overallMean, 2), 0) /
      values.length;

    const seasonalStrength = seasonalVariance / totalVariance;

    return {
      isSignificant: seasonalStrength > 0.1,
      strength: seasonalStrength,
    };
  }

  testExponentialFit(data) {
    // Test if exponential smoothing provides better fit than linear
    const values = data.map((d) => d.value);

    // Calculate linear fit error
    const linearPredictions = this.generateLinearPredictions(data, 1);
    const linearError = this.calculatePredictionError(
      values,
      linearPredictions
    );

    // Calculate exponential fit error
    const expPredictions = this.generateExponentialPredictions(data, 1);
    const expError = this.calculatePredictionError(values, expPredictions);

    return {
      isGoodFit: expError < linearError * 0.9, // 10% improvement threshold
      improvement: (linearError - expError) / linearError,
    };
  }

  calculateConfidenceInterval(prediction, historicalData, modelType) {
    const values = historicalData.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const stdDev = Math.sqrt(variance);

    // Confidence interval based on standard deviation
    const confidenceLevel = 0.95; // 95% confidence
    const zScore = 1.96; // For 95% confidence
    const margin = zScore * stdDev;

    return {
      lower: Math.max(0, prediction.predictedValue - margin),
      upper: Math.min(1, prediction.predictedValue + margin),
      level: confidenceLevel,
    };
  }

  // Additional helper methods would be implemented here...
  groupByMonth(data) {
    return data.reduce((groups, item) => {
      const month = new Date(item.createdAt).getMonth();
      if (!groups[month]) groups[month] = [];
      groups[month].push(item.value);
      return groups;
    }, {});
  }

  calculateSeasonalIndices(values, seasonLength) {
    const indices = new Array(seasonLength).fill(0);
    const counts = new Array(seasonLength).fill(0);

    // Calculate average for each season
    for (let i = 0; i < values.length; i++) {
      const seasonIndex = i % seasonLength;
      indices[seasonIndex] += values[i];
      counts[seasonIndex]++;
    }

    // Normalize indices
    for (let i = 0; i < seasonLength; i++) {
      indices[i] = counts[i] > 0 ? indices[i] / counts[i] : 1;
    }

    // Adjust so average index is 1
    const avgIndex = indices.reduce((a, b) => a + b, 0) / seasonLength;
    return indices.map((index) => index / avgIndex);
  }

  calculateLinearTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  extractFactorValue(patient, factorName) {
    // Extract factor value from patient data
    return patient[factorName] || 0;
  }

  normalizeFactorValue(value, factor) {
    // Normalize factor value to 0-1 range
    const min = factor.min || 0;
    const max = factor.max || 1;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  calculateFactorImpact(patient, factor) {
    // Calculate how much this factor contributes to overall risk
    const value = this.extractFactorValue(patient, factor.name);
    const normalized = this.normalizeFactorValue(value, factor);
    return normalized * (factor.weight || 1);
  }
}

export default PredictiveModelingService;
